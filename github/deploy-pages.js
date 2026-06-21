// GitHub Pages deployer.
//
// Publishes the generated static site (content/site) to the organisation's
// GitHub Pages site at https://vynix-in.github.io. This is a separate, fully
// reversible property: it never touches the live vynix.in application, so there
// is no risk to production.
//
// Before pushing it:
//   1. requires the reviewer to have passed every page (zero failures),
//   2. rewrites self-referencing URLs (canonical, og:url, sitemap) to the Pages
//      origin so canonicals never point at a URL that shows different content
//      (which is what avoids duplicate-content penalties), while leaving product
//      links and CTAs pointing at vynix.in,
//   3. scans every file with the publication gate.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { config, paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { scanFile } from '../lib/publication-gate.js';
import { now } from '../lib/util.js';
import { record as recordActivity } from '../lib/activity.js';

const log = logger('deploy-pages');
const reviews = db('reviews');
const deploys = db('reports');

const ORG = config.github.org; // vynix-in
const PAGES_REPO = `${ORG}.github.io`;
const BASE = `https://${ORG}.github.io`;
const SITE = path.join(paths.content, 'site');
const BUILD = path.join(paths.database, '..', '.pages-build');

function sh(command, opts = {}) {
  return execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}
function shQuiet(command, opts = {}) {
  try {
    return sh(command, opts);
  } catch {
    return null;
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Rewrite only self-referencing URLs to the Pages origin. Product links
// (vynix.in, vynix.in/docs, vynix.in/pricing, vynix.in/marketing) are kept as
// they are. This covers every section of the generated site so a new page type
// can never ship with a canonical that points at a missing vynix.in URL.
const SELF_SECTIONS = 'blog|compare|kb|best|for|alternatives|glossary|assets|sitemap\\.xml|feed\\.xml|404\\.html';
function rewriteSelfUrls(content, isSitemapOrRobots) {
  if (isSitemapOrRobots) {
    return content.split('https://vynix.in').join(BASE);
  }
  return content
    .replace(new RegExp(`https://vynix\\.in(/(?:${SELF_SECTIONS})[^"'\\s)]*)`, 'g'), `${BASE}$1`)
    .split('href="https://vynix.in/"').join(`href="${BASE}/"`)
    .split('content="https://vynix.in/"').join(`content="${BASE}/"`);
}

function buildSite() {
  if (fs.existsSync(BUILD)) fs.rmSync(BUILD, { recursive: true, force: true });
  copyDir(SITE, BUILD);
  // .nojekyll so GitHub Pages serves every file as-is (faster, no Jekyll step).
  fs.writeFileSync(path.join(BUILD, '.nojekyll'), '');
  // IndexNow key file, hosted at the site root so search engines can verify it.
  const key = indexNowKey();
  fs.writeFileSync(path.join(BUILD, `${key}.txt`), key);

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|xml|txt)$/.test(entry.name)) {
        const isSr = /sitemap\.xml$|robots\.txt$/.test(entry.name);
        fs.writeFileSync(full, rewriteSelfUrls(fs.readFileSync(full, 'utf8'), isSr));
      }
    }
  };
  walk(BUILD);
}

function gateBuild() {
  const violations = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|xml|txt|json|md)$/.test(entry.name)) {
        const res = scanFile(full);
        if (!res.clean) violations.push({ file: full, violations: res.violations });
      }
    }
  };
  walk(BUILD);
  return violations;
}

// A stable IndexNow key, generated once and kept in the local store.
function indexNowKey() {
  const counters = db('counters');
  const existing = counters.findOne({ key: 'indexnow_key' });
  if (existing?.value) return existing.value;
  const key = crypto.randomBytes(16).toString('hex');
  counters.upsert({ key: 'indexnow_key', value: key }, 'key');
  return key;
}

// Tell IndexNow-aware search engines (Bing, Yandex and others) about the live
// URLs so they crawl the new content quickly. Best-effort: never fails a deploy.
async function submitIndexNow(urls) {
  if (!urls.length) return;
  const key = indexNowKey();
  const host = BASE.replace(/^https?:\/\//, '');
  try {
    const res = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ host, key, keyLocation: `${BASE}/${key}.txt`, urlList: urls.slice(0, 1000) }),
    });
    log.info(`IndexNow submitted ${urls.length} urls`, { status: res.status });
  } catch (err) {
    log.warn('IndexNow submit failed (non-fatal)', { error: String(err) });
  }
}

export async function deployPages(opts = {}) {
  // 1. Reviewer must have passed everything.
  const revs = reviews.all();
  const failed = revs.filter((r) => r.pass === false);
  if (!revs.length) {
    log.warn('no review on record, run the reviewer first');
    return { ok: false, reason: 'not reviewed' };
  }
  if (failed.length) {
    log.warn(`deploy blocked: ${failed.length} pages failed review`, { routes: failed.map((f) => f.route) });
    return { ok: false, reason: 'review failures', routes: failed.map((f) => f.route) };
  }

  // 2. Build with rewritten self-URLs.
  buildSite();

  // 3. Gate the build.
  const violations = gateBuild();
  if (violations.length) {
    log.error('deploy blocked: publication gate failed', { violations });
    return { ok: false, reason: 'gate blocked', violations };
  }

  if (opts.dryRun) {
    log.info(`dry run: would deploy ${BUILD} to ${ORG}/${PAGES_REPO} (${BASE})`);
    return { ok: true, dryRun: true, base: BASE, pages: revs.length };
  }

  // 4. Create the Pages repo if needed, then push the build to main.
  if (!shQuiet(`gh api repos/${ORG}/${PAGES_REPO} --jq .name`)) {
    const created = shQuiet(
      `gh repo create ${ORG}/${PAGES_REPO} --public --description ${JSON.stringify('Vynix resources: blog, comparisons and help center')}`,
    );
    if (created === null) {
      log.error('could not create the Pages repository');
      return { ok: false, reason: 'repo create failed' };
    }
  }

  try {
    sh('git init -b main', { cwd: BUILD });
    sh('git config user.email "team@vynix.in"', { cwd: BUILD });
    sh('git config user.name "Vynix"', { cwd: BUILD });
    sh('git add -A', { cwd: BUILD });
    sh('git commit -q -m "Deploy Vynix resources site"', { cwd: BUILD });
    sh(`git remote add origin https://github.com/${ORG}/${PAGES_REPO}.git`, { cwd: BUILD });
    sh('git push -f -q origin main', { cwd: BUILD });
  } catch (err) {
    log.error('push failed', { error: String(err) });
    return { ok: false, reason: String(err) };
  }

  // 5. Make sure Pages is enabled (org root site builds from main).
  shQuiet(`gh api -X POST repos/${ORG}/${PAGES_REPO}/pages -f source[branch]=main -f source[path]=/`);
  shQuiet(`gh repo edit ${ORG}/${PAGES_REPO} --homepage ${BASE}`);

  deploys.insert({ kind: 'pages-deploy', base: BASE, repo: `${ORG}/${PAGES_REPO}`, pages: revs.length, deployed_at: now() });
  recordActivity('deploy', `Deployed ${revs.length} pages to ${BASE}`, { base: BASE, pages: revs.length });
  // Notify search engines about the live URLs.
  await submitIndexNow(revs.map((r) => `${BASE}${r.route}`));
  log.info(`deployed to ${BASE}`, { pages: revs.length });
  return { ok: true, base: BASE, repo: `${ORG}/${PAGES_REPO}`, pages: revs.length };
}

export default { deployPages, BASE, PAGES_REPO };
