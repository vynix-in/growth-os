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
import { makeBanner } from '../lib/banner.js';
import { header, footer } from '../lib/page.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(__dirname, '..', 'content', 'site');
const ARTICLE_KINDS = new Set(['blog', 'compare', 'best', 'for', 'glossary', 'kb', 'alternatives']);
const RELATED_KINDS = new Set(['compare', 'best', 'for', 'glossary', 'kb', 'alternatives']);

const KIND_LABEL = {
  compare: 'Comparisons', best: 'Guides', for: 'Use cases',
  glossary: 'Glossary', kb: 'Help articles', alternatives: 'Alternatives', blog: 'From the blog',
};

// Real product screenshots (dimensions + caption) to thread into the body of
// pages that have none, so every article shows the actual product, not just text.
const SHOT_DIMS = {
  'shot-annotate': [1152, 890], 'shot-context': [1168, 618], 'shot-github': [1168, 574],
  'shot-mcp': [1168, 574], 'shot-report': [1536, 702], 'shot-install': [1344, 496],
};
const BODY_SHOTS = [
  ['shot-context', 'Every Vynix note carries the selector, viewport, computed styles and the console error, captured automatically.'],
  ['shot-mcp', 'An AI agent reads the Vynix feedback over MCP and edits the right file.'],
  ['shot-github', 'Turn a batch of notes into GitHub issues and assign them to Copilot in one step.'],
  ['shot-annotate', 'Point at any element on a live page and write the note. Vynix names the element for you.'],
  ['shot-report', 'Copy the whole batch as one clean, AI-ready report.'],
  ['shot-install', 'Add one script tag and the launcher goes live on your site.'],
];

function shotFigure(shot, caption) {
  const [w, h] = SHOT_DIMS[shot];
  return `<figure class="vx-shot"><img src="/assets/shots/${shot}.png" alt="${caption}" loading="lazy" width="${w}" height="${h}" /><figcaption>${caption}</figcaption></figure>`;
}

// Insert two distinct real screenshots after the 1st and 3rd content sections.
function withBodyShots(html, slug) {
  if (html.includes('/assets/shots/')) return html; // already has product shots
  const closes = (html.match(/<\/section>/g) || []).length;
  if (closes < 3) return html;
  const start = [...slug].reduce((n, c) => (n + c.charCodeAt(0)) % BODY_SHOTS.length, 0);
  const picks = [BODY_SHOTS[start], BODY_SHOTS[(start + 2) % BODY_SHOTS.length]];
  let seen = 0;
  let i = 0;
  return html.replace(/<\/section>/g, (tag) => {
    seen += 1;
    if ((seen === 1 || seen === 3) && i < picks.length) {
      const [shot, cap] = picks[i++];
      return tag + shotFigure(shot, cap);
    }
    return tag;
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
    else if (e.name === 'index.html') out.push(full);
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
  const banner = makeBanner(slug, title, kind);
  byUrl.set(url, { banner, title, kind, slug });
  if (!byKind.has(kind)) byKind.set(kind, []);
  byKind.get(kind).push({ url, title, slug });
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

  const relParts = path.relative(SITE, file).split(path.sep);
  const isArticle = relParts.length === 3 && ARTICLE_KINDS.has(relParts[0]);

  if (isArticle) {
    const [kind, slug] = relParts;
    const meta = byUrl.get(`/${kind}/${slug}/`);
    if (meta) {
      // The unique banner is the single hero; drop the generic illustration that
      // repeats across every page in the section.
      html = html.replace(/<figure class="ill-hero">[\s\S]*?<\/figure>/g, '');
      // Hero -> the page's own banner (clean + unique), no caption.
      const heroFig = `<figure class="hero"><img src="${meta.banner}" alt="${meta.title}" width="1200" height="630" /></figure>`;
      if (/<figure class="hero">[\s\S]*?<\/figure>/.test(html)) {
        html = html.replace(/<figure class="hero">[\s\S]*?<\/figure>/, () => heroFig);
      } else if (/\/assets\/banners\//.test(html) === false) {
        // No hero figure on the page: place the banner before the first heading.
        if (/<h2[\s>]/.test(html)) {
          html = html.replace(/<h2[\s>]/, (m) => `${heroFig}${m}`);
        }
      }
      // Make sure the body shows the real product, not just text + banner.
      html = withBodyShots(html, slug);
      // Related interlinking before the article ends (skip if already present).
      if (RELATED_KINDS.has(kind) && !html.includes('class="related"')) {
        const rel = relatedFor(kind, slug);
        if (rel) html = html.replace(/<\/article>/, `${rel}</article>`);
      }
    }
  }

  // Listing cards -> the target page's banner thumbnail.
  html = html.replace(
    /(<a class="card" href=")(\/[a-z]+\/[a-z0-9-]+\/)("[^>]*>\s*<img[^>]*?src=")[^"]*(")/g,
    (m, p1, href, p3, p4) => {
      const meta = byUrl.get(href);
      return meta ? `${p1}${href}${p3}${meta.banner}${p4}` : m;
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
