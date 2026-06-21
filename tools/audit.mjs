// One-off deep audit of the generated site. Finds broken internal links,
// invalid structured data, missing SEO tags, missing OG images, sitemap
// mismatches, and machine-looking characters. Read-only.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(__dirname, '..', 'content', 'site');

const issues = [];
const note = (sev, where, msg) => issues.push({ sev, where, msg });

// Collect all pages and the routes they answer.
const pages = [];
const routes = new Set();
const staticFiles = new Set();
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else {
      const rel = '/' + path.relative(SITE, full).split(path.sep).join('/');
      staticFiles.add(rel);
      if (e.name === 'index.html') {
        let route = '/' + path.relative(SITE, dir).split(path.sep).join('/');
        if (route !== '/') route += '/';
        else route = '/';
        pages.push({ file: full, route });
        routes.add(route);
      }
    }
  }
}
walk(SITE);

// Helper: does a site-relative href resolve?
function resolves(href) {
  let h = href.split('#')[0].split('?')[0];
  if (h === '') return true;
  if (h === '/') return routes.has('/');
  // exact static file (sitemap.xml, robots.txt, rss.xml, png, etc.)
  if (staticFiles.has(h)) return true;
  // directory route
  const withSlash = h.endsWith('/') ? h : h + '/';
  if (routes.has(withSlash)) return true;
  // /assets/... files
  if (h.startsWith('/assets/')) return staticFiles.has(h);
  return false;
}

for (const p of pages) {
  const html = fs.readFileSync(p.file, 'utf8');

  // SEO basics
  if (!/<title>[^<]{5,}<\/title>/.test(html)) note('error', p.route, 'missing or short <title>');
  const h1 = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1 !== 1) note('error', p.route, `${h1} <h1> tags`);
  if (!/rel="canonical"/.test(html)) note('error', p.route, 'missing canonical');
  if (!/property="og:image"/.test(html)) note('warn', p.route, 'missing og:image');
  if (!/name="description"/.test(html)) note('error', p.route, 'missing meta description');

  // Canonical should be self-referencing to the same route (host-agnostic check)
  const can = (html.match(/rel="canonical" href="([^"]+)"/) || [])[1] || '';
  if (can) {
    const canPath = can.replace(/^https?:\/\/[^/]+/, '');
    const expect = p.route === '/' ? '/' : p.route;
    if (canPath !== expect && !(p.route === '/404.html')) {
      note('warn', p.route, `canonical path ${canPath} != route ${expect}`);
    }
  }

  // OG image file exists?
  const og = (html.match(/property="og:image" content="([^"]+)"/) || [])[1] || '';
  if (og) {
    const ogPath = og.replace(/^https?:\/\/[^/]+/, '');
    if (ogPath.startsWith('/assets/og/') && !staticFiles.has(ogPath)) {
      note('error', p.route, `og:image file missing on disk: ${ogPath}`);
    }
  }

  // JSON-LD validity
  const blocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || [];
  for (const b of blocks) {
    const json = b.replace(/<script[^>]*>/, '').replace(/<\/script>/, '').trim();
    try {
      JSON.parse(json);
    } catch (err) {
      note('error', p.route, `invalid JSON-LD: ${String(err).slice(0, 60)}`);
    }
  }

  // All site-relative links resolve
  const hrefs = [...html.matchAll(/href="(\/[^"]*)"/g)].map((m) => m[1]);
  for (const href of new Set(hrefs)) {
    if (href.startsWith('//')) continue;
    if (!resolves(href)) note('error', p.route, `broken internal link: ${href}`);
  }

  // Tell characters
  if (/\u2014/.test(html)) note('warn', p.route, 'contains em-dash');
  if (/[\u2018\u2019\u201C\u201D]/.test(html)) note('warn', p.route, 'contains curly quote');
}

// Sitemap cross-check: every sitemap URL should be a real route; every page
// should be in the sitemap.
const smPath = path.join(SITE, 'sitemap.xml');
if (fs.existsSync(smPath)) {
  const sm = fs.readFileSync(smPath, 'utf8');
  const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+/, ''));
  const locSet = new Set(locs.map((l) => (l.endsWith('/') ? l : l + '/')));
  for (const l of locs) {
    const r = l.endsWith('/') ? l : l + '/';
    if (r !== '/' && !routes.has(r) && !staticFiles.has(l)) note('error', 'sitemap', `lists missing page: ${l}`);
  }
  for (const r of routes) {
    if (r === '/404.html') continue;
    if (!locSet.has(r) && r !== '/') note('warn', 'sitemap', `page not in sitemap: ${r}`);
  }
} else {
  note('error', 'sitemap', 'sitemap.xml missing');
}

// Report
const errors = issues.filter((i) => i.sev === 'error');
const warns = issues.filter((i) => i.sev === 'warn');
console.log(`Pages: ${pages.length}`);
console.log(`Errors: ${errors.length}  Warnings: ${warns.length}\n`);
for (const i of errors) console.log(`ERROR  ${i.where}  ${i.msg}`);
console.log('');
const warnByMsg = {};
for (const w of warns) warnByMsg[w.msg] = (warnByMsg[w.msg] || 0) + 1;
for (const [msg, n] of Object.entries(warnByMsg)) console.log(`WARN x${n}  ${msg}`);
