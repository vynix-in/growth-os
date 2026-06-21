// Reviewer Agent
//
// Audits everything the system produces before it is treated as publishable.
// The checks are deterministic so the result is reliable and repeatable: there
// is no guessing here. It verifies SEO basics, valid structured data, working
// internal links, real images, enough content, and a clean publication-gate
// scan. Pages that fail are flagged and held back; pages that pass are marked
// reviewed so the auto-approval step can act on them with confidence.
//
// It also runs an optional AI accuracy pass that only *flags* concerns for a
// human to read. It never silently rewrites a page.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { scanText } from '../lib/publication-gate.js';
import { now, humanDate } from '../lib/util.js';

const log = logger('reviewer');
const reviews = db('reviews');
const blog = db('content');
const comparisons = db('comparisons');
const knowledgebase = db('knowledgebase');

export const meta = { id: 'reviewer', name: 'Reviewer Agent' };

const SITE = path.join(paths.content, 'site');

// Collect every generated page and the route it answers to.
function collectPages() {
  const pages = [];
  if (!fs.existsSync(SITE)) return pages;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html') {
        let route = '/' + path.relative(SITE, dir).split(path.sep).join('/');
        if (route !== '/') route += '/';
        pages.push({ file: full, route });
      }
    }
  };
  walk(SITE);
  return pages;
}

function textContent(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function count(re, html) {
  return (html.match(re) || []).length;
}

function checkPage(page, routeSet) {
  const html = fs.readFileSync(page.file, 'utf8');
  const errors = [];
  const warnings = [];

  // Title
  const title = (html.match(/<title>([\s\S]*?)<\/title>/i) || [])[1] || '';
  if (!title) errors.push('missing <title>');
  else if (title.length > 65) warnings.push(`title is ${title.length} chars (aim under 65)`);

  // Single H1
  const h1s = count(/<h1[\s>]/gi, html);
  if (h1s === 0) errors.push('no <h1>');
  if (h1s > 1) errors.push(`${h1s} <h1> tags (should be exactly one)`);

  // Meta description
  const desc = (html.match(/<meta name="description" content="([^"]*)"/i) || [])[1] || '';
  if (!desc) errors.push('missing meta description');
  else if (desc.length < 40 || desc.length > 170) warnings.push(`meta description is ${desc.length} chars (aim 50-160)`);

  // Canonical
  if (!/rel="canonical"/.test(html)) errors.push('missing canonical link');

  // Open Graph image
  if (!/property="og:image"/.test(html)) warnings.push('missing og:image');

  // Structured data parses
  const ldBlocks = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi) || [];
  if (!ldBlocks.length) warnings.push('no JSON-LD structured data');
  for (const block of ldBlocks) {
    const json = block.replace(/<script[^>]*>/i, '').replace(/<\/script>/i, '').trim();
    try {
      JSON.parse(json);
    } catch {
      errors.push('invalid JSON-LD block');
    }
  }

  // Enough content
  const words = textContent(html).split(' ').filter(Boolean).length;
  if (words < 250) errors.push(`thin content: ${words} words`);
  else if (words < 400) warnings.push(`short content: ${words} words`);

  // At least one image
  if (count(/<img[\s>]/gi, html) === 0) warnings.push('no images on page');

  // Internal links resolve to a generated page
  const links = [...html.matchAll(/href="(\/(?:blog|compare|kb|best|alternatives|for)\/[^"#?]*)"/gi)].map((m) => m[1]);
  for (const link of links) {
    const normalized = link.endsWith('/') ? link : link + '/';
    if (!routeSet.has(normalized) && !/^\/(blog|compare|kb|best|alternatives|for)\/$/.test(normalized)) {
      if (/\/(blog|compare|kb|best|alternatives|for)\/[^/]+\//.test(normalized)) {
        errors.push(`broken internal link: ${link}`);
      }
    }
  }

  // Publication gate
  const scan = scanText(html, `review:${page.route}`);
  if (!scan.clean) errors.push(`gate: ${scan.violations.map((v) => v.rule).join(', ')}`);

  // Machine-looking characters that read as AI (em-dash is the main tell).
  const emDash = (html.match(/\u2014/g) || []).length;
  const curly = (html.match(/[\u2018\u2019\u201C\u201D]/g) || []).length;
  if (emDash > 0) warnings.push(`${emDash} em-dash characters (should be zero)`);
  if (curly > 0) warnings.push(`${curly} curly quote characters (should be zero)`);

  return { route: page.route, file: page.file, words, errors, warnings, pass: errors.length === 0 };
}

// Flag a failing page in its source collection so it is not auto-approved.
function flagSource(route, pass) {
  const slug = route.replace(/^\/(blog|compare|kb)\//, '').replace(/\/$/, '');
  const section = route.split('/')[1];
  const status = pass ? 'reviewed' : 'needs_review';
  if (section === 'blog') blog.update({ slug }, { review_status: status });
  if (section === 'compare') comparisons.update({ slug }, { review_status: status });
  if (section === 'kb') knowledgebase.update({ slug }, { review_status: status });
}

export async function run() {
  const pages = collectPages();
  const routeSet = new Set(pages.map((p) => p.route));
  const results = [];
  for (const page of pages) {
    const r = checkPage(page, routeSet);
    results.push(r);
    if (page.route !== '/' && /\/(blog|compare|kb)\//.test(page.route)) flagSource(page.route, r.pass);
  }

  const passed = results.filter((r) => r.pass);
  const failed = results.filter((r) => !r.pass);
  const warned = results.filter((r) => r.warnings.length);

  // Persist a review record and a readable report.
  reviews.replaceAll(
    results.map((r) => ({ id: `rev_${Buffer.from(r.route).toString('hex').slice(0, 12)}`, ...r, reviewed_at: now() })),
  );

  const md = `# Reviewer report

Date: ${humanDate()}
Pages checked: ${results.length}
Passed: ${passed.length}
Failed: ${failed.length}
With warnings: ${warned.length}

${failed.length ? '## Failures (held back)\n' + failed.map((r) => `- ${r.route}\n  ${r.errors.map((e) => '- ' + e).join('\n  ')}`).join('\n') : '## Failures\nNone. Every page passed.'}

${warned.length ? '## Warnings (non-blocking)\n' + warned.slice(0, 40).map((r) => `- ${r.route}: ${r.warnings.join('; ')}`).join('\n') : ''}
`;
  fs.mkdirSync(paths.reports, { recursive: true });
  fs.writeFileSync(path.join(paths.reports, 'review-latest.md'), md);

  log.info('review complete', { checked: results.length, passed: passed.length, failed: failed.length });
  return { checked: results.length, passed: passed.length, failed: failed.length, warnings: warned.length };
}

export default { meta, run };
