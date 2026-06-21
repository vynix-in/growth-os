// GitHub publisher. Pushes an approved repository proposal to the vynix-in
// organisation using the gh CLI. This is the only place that talks to GitHub,
// and it refuses to run unless:
//   1. the repository proposal exists and its gate scan is clean, and
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

// Scan every file in the repository proposal directory.
function gateRepoDir(dir) {
  const violations = [];
  const walk = (d) => {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
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

export async function publishRepo(repoName, opts = {}) {
  const record = repos.findOne({ name: repoName });
  if (!record) {
    log.error(`no repository proposal named "${repoName}"`);
    return { ok: false, reason: 'not found' };
  }

  // 1. Approval check.
  const task = tasks
    .find({ type: 'github-publish' })
    .find((t) => t.payload?.repo === repoName);
  if (!task || task.approval !== APPROVAL.APPROVED) {
    log.warn(`"${repoName}" is not approved for publishing`, { approval: task?.approval });
    return { ok: false, reason: 'not approved — approve it in the dashboard first' };
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
  try {
    sh(`gh api orgs/${owner} --jq .login`);
  } catch {
    owner = config.github.fallbackOwner;
    log.warn(`org not reachable, falling back to ${owner}`);
  }

  try {
    // Initialise git in the proposal dir if needed.
    if (!fs.existsSync(path.join(dir, '.git'))) {
      sh('git init -b main', { cwd: dir });
      sh('git add -A', { cwd: dir });
      sh(`git commit -m "Initial public release of ${repoName}"`, { cwd: dir });
    }
    // Create the remote repo and push.
    sh(
      `gh repo create ${owner}/${repoName} --public --source . --remote origin --push --description ${JSON.stringify(record.title)}`,
      { cwd: dir },
    );
    repos.update({ name: repoName }, { status: 'published', published_to: `${owner}/${repoName}` });
    queue.complete(task.id, { published: `${owner}/${repoName}` });
    log.info(`published ${owner}/${repoName}`);
    return { ok: true, url: `https://github.com/${owner}/${repoName}` };
  } catch (err) {
    log.error(`failed to publish ${repoName}`, { error: String(err) });
    return { ok: false, reason: String(err) };
  }
}

export default { publishRepo };
