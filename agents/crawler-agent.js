// Crawler Agent
//
// Fetches every link the system has published and records whether it is live.
// This gives a real, verified picture of what is reachable, feeds the dashboard,
// and produces the list used for manual submission to search engines. It crawls
// the deployed site, so it confirms what a search engine would actually see.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { record as recordActivity } from '../lib/activity.js';
import { now, humanDate, sleep } from '../lib/util.js';

const log = logger('crawler');
const crawl = db('crawl');
const reports = db('reports');

export const meta = { id: 'crawler', name: 'Crawler Agent' };

const LIVE_BASE = 'https://vynix-in.github.io';

// Collect the routes to check from the deployed sitemap, falling back to the
// local site folder if the sitemap cannot be fetched.
async function collectUrls() {
  try {
    const res = await fetch(`${LIVE_BASE}/sitemap.xml`, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const xml = await res.text();
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      if (locs.length) return locs;
    }
  } catch {
    // fall through to local
  }
  const site = path.join(paths.content, 'site');
  const urls = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name === 'index.html') {
        let r = '/' + path.relative(site, dir).split(path.sep).join('/');
        if (r !== '/') r += '/';
        urls.push(`${LIVE_BASE}${r}`);
      }
    }
  };
  if (fs.existsSync(site)) walk(site);
  return urls;
}

async function check(url) {
  const started = Date.now();
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(9000) });
    return { url, status: res.status, ok: res.ok, ms: Date.now() - started };
  } catch (err) {
    return { url, status: 0, ok: false, ms: Date.now() - started, error: String(err).slice(0, 80) };
  }
}

// Run checks with bounded concurrency so we do not hammer the host.
async function runChecks(urls, concurrency = 6) {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: concurrency }, async () => {
    while (i < urls.length) {
      const idx = i++;
      results[idx] = await check(urls[idx]);
      await sleep(40);
    }
  });
  await Promise.all(workers);
  return results;
}

export async function run() {
  const urls = await collectUrls();
  if (!urls.length) {
    log.warn('no urls to crawl');
    return { total: 0, live: 0, broken: 0 };
  }
  const results = await runChecks(urls);
  const live = results.filter((r) => r.ok).length;
  const broken = results.filter((r) => !r.ok);

  // Store the latest crawl (one row per url, replaced each run).
  crawl.replaceAll(
    results.map((r) => ({ id: `crawl_${Buffer.from(r.url).toString('hex').slice(0, 14)}`, ...r, checked_at: now() })),
  );

  // Write a report and a manual-submission URL list.
  const siteDir = path.join(paths.content, 'site');
  fs.mkdirSync(siteDir, { recursive: true });
  fs.writeFileSync(path.join(siteDir, 'submit-urls.txt'), urls.join('\n') + '\n');
  fs.writeFileSync(
    path.join(siteDir, 'links.json'),
    JSON.stringify({ generated: now(), base: LIVE_BASE, total: urls.length, live, urls: results }, null, 2),
  );

  const reportMd = `# Crawl report

Date: ${humanDate()}
Checked: ${urls.length}
Live (200 range): ${live}
Broken or unreachable: ${broken.length}

${broken.length ? '## Needs attention\n' + broken.map((b) => `- ${b.status} ${b.url}${b.error ? ' (' + b.error + ')' : ''}`).join('\n') : '## All links are live.'}
`;
  fs.mkdirSync(paths.reports, { recursive: true });
  fs.writeFileSync(path.join(paths.reports, 'crawl-latest.md'), reportMd);
  reports.insert({ kind: 'crawl', total: urls.length, live, broken: broken.length, at: now() });
  recordActivity('crawl', `Crawled ${urls.length} links: ${live} live, ${broken.length} broken`, { total: urls.length, live });

  log.info('crawl complete', { total: urls.length, live, broken: broken.length });
  return { total: urls.length, live, broken: broken.length };
}

export default { meta, run };
