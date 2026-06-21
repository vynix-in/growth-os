// GitHub publisher. Pushes an approved repository proposal to the vynix-in
// organisation using the gh CLI, then sets the description, homepage, topics,
// and GitHub Pages so the repository is search-friendly and links back to
// Vynix.
//
// It refuses to run unless:
//   1. the repository proposal exists and its files pass the publication gate,
//   2. a matching task in the queue has been approved by a human.
//
// If the organisation cannot be used, it falls back to the configured owner.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { config, paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { scanFile } from '../lib/publication-gate.js';

const log = logger('github-publish');
const repos = db('repos');
const tasks = db('tasks');

function sh(command, opts = {}) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function shQuiet(command, opts = {}) {
  try {
    return sh(command, opts);
  } catch (err) {
    return null;
  }
}

// Scan every file in the repository proposal directory.
function gateRepoDir(dir) {
  const violations = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else {
        const res = scanFile(full);
        if (!res.clean) violations.push({ file: full, violations: res.violations });
      }
    }
  };
  walk(dir);
  return violations;
}

function approvedTaskFor(repoName) {
  return tasks
    .find({ type: 'github-publish' })
    .find((t) => t.payload?.repo === repoName && t.approval === APPROVAL.APPROVED);
}

// Apply description, homepage, and topics from repo-meta.json.
function applyMetadata(owner, repoName, dir) {
  const metaFile = path.join(dir, 'repo-meta.json');
  if (!fs.existsSync(metaFile)) return;
  let meta;
  try {
    meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  } catch {
    return;
  }
  const full = `${owner}/${repoName}`;
  if (meta.description || meta.homepage) {
    shQuiet(
      `gh repo edit ${full} ${meta.description ? `--description ${JSON.stringify(meta.description)}` : ''} ${meta.homepage ? `--homepage ${JSON.stringify(meta.homepage)}` : ''}`,
    );
  }
  if (Array.isArray(meta.topics) && meta.topics.length) {
    const names = meta.topics
      .map((t) => String(t).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, ''))
      .filter(Boolean)
      .slice(0, 20);
    shQuiet(`gh api -X PUT repos/${full}/topics -H "Accept: application/vnd.github+json" -f names[]=${names.join(' -f names[]=')}`);
  }
}

// Best-effort: turn on GitHub Pages serving from the /docs folder on main.
function enablePages(owner, repoName) {
  const full = `${owner}/${repoName}`;
  shQuiet(`gh api -X POST repos/${full}/pages -f source[branch]=main -f source[path]=/docs`);
}

export async function publishRepo(repoName, opts = {}) {
  const record = repos.findOne({ name: repoName });
  if (!record) {
    log.error(`no repository proposal named "${repoName}"`);
    return { ok: false, reason: 'not found' };
  }

  // 1. Approval check.
  const task = approvedTaskFor(repoName);
  if (!task) {
    log.warn(`"${repoName}" is not approved for publishing`);
    return { ok: false, reason: 'not approved, approve it in the dashboard first' };
  }

  // 2. Gate check on the actual files.
  const dir = path.join(paths.github, repoName);
  const violations = gateRepoDir(dir);
  if (violations.length) {
    log.error(`publication gate blocked "${repoName}"`, { violations });
    return { ok: false, reason: 'gate blocked', violations };
  }

  if (opts.dryRun) {
    log.info(`dry run: would publish ${config.github.org}/${repoName} from ${dir}`);
    return { ok: true, dryRun: true, org: config.github.org, repo: repoName };
  }

  // Decide the target owner: org first, fall back to the configured owner.
  let owner = config.github.org;
  if (!shQuiet(`gh api orgs/${owner} --jq .login`)) {
    owner = config.github.fallbackOwner;
    log.warn(`org not reachable, falling back to ${owner}`);
  }

  // If the repo already exists, treat as published (idempotent).
  if (shQuiet(`gh api repos/${owner}/${repoName} --jq .name`)) {
    log.info(`${owner}/${repoName} already exists, syncing metadata only`);
    applyMetadata(owner, repoName, dir);
    enablePages(owner, repoName);
    repos.update({ name: repoName }, { status: 'published', published_to: `${owner}/${repoName}` });
    queue.complete(task.id, { published: `${owner}/${repoName}`, note: 'already existed' });
    return { ok: true, url: `https://github.com/${owner}/${repoName}`, existed: true };
  }

  try {
    // Keep the internal metadata file out of the published tree.
    const metaFile = path.join(dir, 'repo-meta.json');
    let metaBackup = null;
    if (fs.existsSync(metaFile)) {
      metaBackup = fs.readFileSync(metaFile, 'utf8');
      fs.unlinkSync(metaFile);
    }

    if (!fs.existsSync(path.join(dir, '.git'))) {
      sh('git init -b main', { cwd: dir });
      sh('git config user.email "team@vynix.in"', { cwd: dir });
      sh('git config user.name "Vynix"', { cwd: dir });
      sh('git add -A', { cwd: dir });
      sh(`git commit -q -m "Initial public release of ${repoName}"`, { cwd: dir });
    }
    sh(
      `gh repo create ${owner}/${repoName} --public --source . --remote origin --push --description ${JSON.stringify(record.description || record.title)}`,
      { cwd: dir },
    );

    // Restore the metadata file locally for future runs.
    if (metaBackup !== null) fs.writeFileSync(metaFile, metaBackup);

    applyMetadata(owner, repoName, dir);
    enablePages(owner, repoName);

    repos.update({ name: repoName }, { status: 'published', published_to: `${owner}/${repoName}` });
    queue.complete(task.id, { published: `${owner}/${repoName}` });
    log.info(`published ${owner}/${repoName}`);
    return { ok: true, url: `https://github.com/${owner}/${repoName}` };
  } catch (err) {
    log.error(`failed to publish ${repoName}`, { error: String(err) });
    return { ok: false, reason: String(err) };
  }
}

// Approve every pending github-publish task. Used when the founder approves the
// whole batch at once.
export function approveAllRepos() {
  const pending = tasks.find({ type: 'github-publish' }).filter((t) => t.approval === APPROVAL.PENDING);
  for (const t of pending) queue.approve(t.id);
  log.info(`approved ${pending.length} repository tasks`);
  return pending.length;
}

// Publish every approved, not-yet-published repository.
export async function publishAllRepos(opts = {}) {
  const names = [...new Set(repos.all().map((r) => r.name))];
  const results = [];
  for (const name of names) {
    if (!approvedTaskFor(name)) continue;
    const rec = repos.findOne({ name });
    if (rec?.status === 'published' && !opts.force) {
      results.push({ repo: name, ok: true, skipped: 'already published' });
      continue;
    }
    results.push({ repo: name, ...(await publishRepo(name, opts)) });
  }
  return results;
}

export default { publishRepo, approveAllRepos, publishAllRepos };
