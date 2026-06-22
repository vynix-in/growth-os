// Visual + structure revamp for the already-rendered resources site.
//
// Fixes the real complaints: every page got the same recycled, text-heavy
// screenshot as its hero and card thumbnail, the logo was a CSS box, and the
// guides/use-cases had no internal interlinking. This pass:
//   1. gives every article its own clean banner (hero) and uses that same banner
//      as its card thumbnail in listings,
//   2. swaps the crude header/footer for the real-logo version,
//   3. adds a "Related" section to comparison/guide/use-case/glossary/help pages.
// Real product screenshots stay as captioned figures inside the body.
// Run: node tools/revamp-visuals.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeBannerSet } from '../lib/banner.js';
import { header, footer } from '../lib/page.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(__dirname, '..', 'content', 'site');
const ARTICLE_KINDS = new Set(['blog', 'compare', 'best', 'for', 'glossary', 'kb', 'alternatives']);
const RELATED_KINDS = new Set(['compare', 'best', 'for', 'glossary', 'kb', 'alternatives']);

const KIND_LABEL = {
  compare: 'Comparisons', best: 'Guides', for: 'Use cases',
  glossary: 'Glossary', kb: 'Help articles', alternatives: 'Alternatives', blog: 'From the blog',
};

// Each real product screenshot is shown on exactly ONE relevant page (matched by
// a slug keyword), so genuine product UI still appears but no image is repeated.
const SHOT_DIMS = {
  'shot-annotate': [1152, 890], 'shot-context': [1168, 618], 'shot-github': [1168, 574],
  'shot-mcp': [1168, 574], 'shot-report': [1536, 702], 'shot-install': [1344, 496],
  'shot-demo': [1120, 866], 'shot-snippet': [1536, 406],
};
const SHOT_PLAN = [
  ['shot-annotate', 'point-and-click', 'Point at any element on a live page and write the note. Vynix names the element for you.'],
  ['shot-context', 'console-and-network', 'Every note carries the selector, viewport, computed styles and the console error, captured automatically.'],
  ['shot-github', 'connect-github', 'Turn a batch of notes into GitHub issues and assign them to Copilot in one step.'],
  ['shot-mcp', 'mcp-server', 'An AI agent reads the feedback over MCP and edits the right file.'],
  ['shot-report', 'bug-reports', 'Copy the whole batch as one clean, AI-ready report.'],
  ['shot-install', 'install-vynix', 'Add one script tag and the launcher goes live on your site.'],
  ['shot-demo', 'click-to-a-fix', 'The Vynix toolbar captures structured feedback on a live page.'],
  ['shot-snippet', 'context-an-ai-agent', 'Every note ships with the selector, DOM, console and network detail an agent needs.'],
];

function shotFigure(shot, caption) {
  const [w, h] = SHOT_DIMS[shot];
  return `<figure class="vx-shot"><img src="/assets/shots/${shot}.png" alt="${caption}" loading="lazy" width="${w}" height="${h}" /><figcaption>${caption}</figcaption></figure>`;
}

// Remove every figure that holds a product screenshot (the duplication source).
function stripShotFigures(html) {
  return html.replace(/<figure\b[^>]*>(?:(?!<\/figure>)[\s\S])*?\/assets\/shots\/(?:(?!<\/figure>)[\s\S])*?<\/figure>/g, '');
}

// Remove embedded clip figures (the same few vertical reels were repeated across
// many pages). Real, unique per-page video would need to be produced separately.
function stripClips(html) {
  return html.replace(/<figure\b[^>]*>(?:(?!<\/figure>)[\s\S])*?<video(?:(?!<\/figure>)[\s\S])*?<\/figure>/g, '');
}

// Remove orphaned VideoObject JSON-LD left behind when a clip is stripped.
function removeVideoLd(html) {
  return html.replace(/<script type="application\/ld\+json">(?:(?!<\/script>)[\s\S])*?VideoObject(?:(?!<\/script>)[\s\S])*?<\/script>\s*/g, '');
}

// A theme-aware <picture> banner (light + dark variants).
function bannerPicture(meta, cls) {
  return `<figure class="${cls}"><picture><source media="(prefers-color-scheme: light)" srcset="${meta.light}" /><img src="${meta.dark}" alt="${meta.title}" width="1200" height="630" loading="${cls === 'hero' ? 'eager' : 'lazy'}" /></picture></figure>`;
}

// Insert the one mapped screenshot for this page after the 2nd content section.
function withMappedShot(html, shotEntry) {
  if (!shotEntry) return html;
  const [shot, , caption] = shotEntry;
  const closes = (html.match(/<\/section>/g) || []).length;
  if (closes < 2) {
    return html.replace(/<\/article>/, `${shotFigure(shot, caption)}</article>`);
  }
  let seen = 0;
  return html.replace(/<\/section>/g, (tag) => {
    seen += 1;
    return seen === 2 ? tag + shotFigure(shot, caption) : tag;
  });
}

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function titleOf(html) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return stripTags(h1[1]);
  const t = html.match(/<title>([^<|]+)/i);
  return t ? t[1].trim() : 'Vynix';
}

function listHtmlFiles(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) listHtmlFiles(full, out);
    else if (e.name.endsWith('.html')) out.push(full);
  }
  return out;
}

// --- Pass 1: catalogue every article and generate its banner. ----------------
export function applyRevampVisuals() {
const files = listHtmlFiles(SITE);
const byUrl = new Map();   // url -> { banner, title, kind, slug }
const byKind = new Map();  // kind -> [ { url, title, slug } ]

for (const file of files) {
  const relParts = path.relative(SITE, file).split(path.sep); // [kind, slug, index.html]
  if (relParts.length !== 3) continue; // only <kind>/<slug>/index.html
  const [kind, slug] = relParts;
  if (!ARTICLE_KINDS.has(kind)) continue;

  const html = fs.readFileSync(file, 'utf8');
  const title = titleOf(html);
  const url = `/${kind}/${slug}/`;
  const banners = makeBannerSet(slug, title, kind);
  byUrl.set(url, { dark: banners.dark, light: banners.light, title, kind, slug });
  if (!byKind.has(kind)) byKind.set(kind, []);
  byKind.get(kind).push({ url, title, slug });
}

// Assign each real screenshot to exactly one page (matched by a slug keyword).
const SHOT_FOR = new Map();
for (const [shot, keyword, caption] of SHOT_PLAN) {
  for (const url of byUrl.keys()) {
    if (url.startsWith('/blog/') && url.includes(keyword) && !SHOT_FOR.has(url)) {
      SHOT_FOR.set(url, [shot, keyword, caption]);
      break;
    }
  }
}

// Banners for the section-index cards on the home/404 pages (Blog, Compare, ...).
const SECTIONS = {
  '/blog/': ['Blog', 'blog'], '/compare/': ['Comparisons', 'compare'], '/best/': ['Guides', 'best'],
  '/for/': ['Use cases', 'for'], '/glossary/': ['Glossary', 'glossary'], '/kb/': ['Help center', 'kb'],
};
const sectionBanner = new Map();
for (const [href, [title, kind]] of Object.entries(SECTIONS)) {
  const b = makeBannerSet(`section-${kind}`, title, kind);
  sectionBanner.set(href, { dark: b.dark, light: b.light, title });
}

function relatedFor(kind, slug) {
  const siblings = (byKind.get(kind) || []).filter((s) => s.slug !== slug);
  if (siblings.length === 0) return '';
  const start = [...slug].reduce((n, c) => (n + c.charCodeAt(0)) % Math.max(siblings.length, 1), 0);
  const picks = [];
  for (let i = 0; i < siblings.length && picks.length < 4; i++) {
    picks.push(siblings[(start + i) % siblings.length]);
  }
  const items = picks.map((p) => `<li><a href="${p.url}">${p.title}</a></li>`).join('');
  return `<section class="related"><h2>${KIND_LABEL[kind] || 'Related'}</h2><ul>${items}</ul></section>`;
}

const NEW_HEADER = header();
const NEW_FOOTER = footer();

// --- Pass 2: rewrite every page. ---------------------------------------------
let changed = 0;
for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  const before = html;

  // Real-logo header/footer everywhere (also fixes any stale nav).
  html = html.replace(/<header class="site-header">[\s\S]*?<\/header>/, () => NEW_HEADER);
  html = html.replace(/<footer class="site-footer">[\s\S]*?<\/footer>/, () => NEW_FOOTER);

  // Every page: remove repeated screenshots, repeated reels, and orphaned video schema.
  html = stripShotFigures(html);
  html = stripClips(html);
  html = removeVideoLd(html);

  const relParts = path.relative(SITE, file).split(path.sep);
  const isArticle = relParts.length === 3 && ARTICLE_KINDS.has(relParts[0]);

  if (isArticle) {
    const [kind, slug] = relParts;
    const url = `/${kind}/${slug}/`;
    const meta = byUrl.get(url);
    if (meta) {
      // Drop the repeated illustration too.
      html = html.replace(/<figure class="ill-hero">[\s\S]*?<\/figure>/g, '');
      // Hero -> the page's own unique light+dark banner.
      const heroPic = bannerPicture(meta, 'hero');
      if (/<figure class="hero">[\s\S]*?<\/figure>/.test(html)) {
        html = html.replace(/<figure class="hero">[\s\S]*?<\/figure>/, () => heroPic);
      } else if (/<h2[\s>]/.test(html)) {
        html = html.replace(/<h2[\s>]/, (m) => `${heroPic}${m}`);
      }
      // One real product screenshot, only on its mapped page (no duplication).
      html = withMappedShot(html, SHOT_FOR.get(url));
      // Related interlinking before the article ends (skip if already present).
      if (RELATED_KINDS.has(kind) && !html.includes('class="related"')) {
        const rel = relatedFor(kind, slug);
        if (rel) html = html.replace(/<\/article>/, `${rel}</article>`);
      }
    }
  }

  // Listing cards -> the target page's light+dark banner thumbnail.
  html = html.replace(
    /<a class="card" href="(\/[a-z]+\/[a-z0-9-]+\/)">\s*<img[^>]*\/>/g,
    (m, href) => {
      const meta = byUrl.get(href);
      if (!meta) return m;
      return `<a class="card" href="${href}"><picture><source media="(prefers-color-scheme: light)" srcset="${meta.light}" /><img src="${meta.dark}" alt="${meta.title}" loading="lazy" width="1080" height="608" /></picture>`;
    },
  );

  // Section-index cards (home / 404) -> the section banner.
  html = html.replace(
    /<a class="card" href="(\/[a-z]+\/)">\s*<img[^>]*\/>/g,
    (m, href) => {
      const meta = sectionBanner.get(href);
      if (!meta) return m;
      return `<a class="card" href="${href}"><picture><source media="(prefers-color-scheme: light)" srcset="${meta.light}" /><img src="${meta.dark}" alt="${meta.title}" loading="lazy" width="1080" height="608" /></picture>`;
    },
  );

  if (html !== before) {
    fs.writeFileSync(file, html);
    changed++;
  }
}

console.log(`revamp-visuals: ${byUrl.size} banners, updated ${changed}/${files.length} pages`);
  return { banners: byUrl.size, changed, total: files.length };
}

// Run directly: node tools/revamp-visuals.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  applyRevampVisuals();
}
