// One-time pass: swap the old marketing promo-card images embedded in already
// rendered pages for the real product screenshots in /assets/shots, and fix the
// width/height so they reserve the right space. Video clips (.mp4) are kept;
// only their poster image is repointed. Run: node tools/real-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(__dirname, '..', 'content', 'site');

// Old marketing file -> real screenshot (name + real pixel dimensions).
const MAP = {
  'p-point': ['shot-annotate', 1152, 890],
  'p-inspector': ['shot-annotate', 1152, 890],
  'p-context': ['shot-context', 1168, 618],
  'p-console': ['shot-context', 1168, 618],
  'p-network': ['shot-context', 1168, 618],
  'p-viewport': ['shot-context', 1168, 618],
  'p-github': ['shot-github', 1168, 574],
  'p-copilot': ['shot-github', 1168, 574],
  'v2-p-handoff': ['shot-github', 1168, 574],
  'p-mcp': ['shot-mcp', 1168, 574],
  'v2-p-loop': ['shot-mcp', 1168, 574],
  'v2-p-files': ['shot-mcp', 1168, 574],
  'v2-p-mcp-fix': ['shot-mcp', 1168, 574],
  'p-formats': ['shot-report', 1536, 702],
  'v2-p-diagnose': ['shot-report', 1536, 702],
  'p-install': ['shot-install', 1344, 496],
};
const DIMS = {
  'shot-annotate': [1152, 890], 'shot-context': [1168, 618], 'shot-demo': [1120, 866],
  'shot-github': [1168, 574], 'shot-mcp': [1168, 574], 'shot-report': [1536, 702],
  'shot-install': [1344, 496], 'shot-snippet': [1536, 406],
};

function transform(html) {
  let out = html;
  // 1) Repoint every marketing promo-card PNG (img src and video poster) to the real shot.
  for (const [oldName, [newName]] of Object.entries(MAP)) {
    out = out.split(`https://vynix.in/marketing/${oldName}.png`).join(`/assets/shots/${newName}.png`);
  }
  // 2) Fix width/height on every <img> that now points at a real shot.
  out = out.replace(/<img\b[^>]*>/g, (tag) => {
    const m = tag.match(/src="\/assets\/shots\/(shot-[a-z]+)\.png"/i);
    if (!m || !DIMS[m[1]]) return tag;
    const [w, h] = DIMS[m[1]];
    if (/width="\d+"\s+height="\d+"/.test(tag)) {
      return tag.replace(/width="\d+"\s+height="\d+"/, `width="${w}" height="${h}"`);
    }
    return tag.replace('<img', `<img width="${w}" height="${h}"`);
  });
  // 3) Thread 2 extra, distinct real screenshots through each article so every
  //    post walks the reader through the actual product, not one hero image.
  out = insertSupportingShots(out);
  // 4) Make sure no two figures on a page show the same screenshot.
  out = dedupeFigures(out);
  return out;
}

// Replace any repeated screenshot (after its first use on the page) with the
// next unused screenshot from the product story, so every figure is distinct.
function dedupeFigures(html) {
  const used = new Set();
  const order = STORY.map(([s]) => s);
  const capOf = Object.fromEntries(STORY);
  return html.replace(/<figure\b[^>]*>[\s\S]*?<\/figure>/g, (block) => {
    const m = block.match(/src="\/assets\/shots\/(shot-[a-z]+)\.png"/);
    if (!m) return block;
    let shot = m[1];
    if (used.has(shot)) {
      const next = order.find((s) => !used.has(s));
      if (next && next !== shot) {
        const [w, h] = DIMS[next];
        block = block
          .replace(/src="\/assets\/shots\/shot-[a-z]+\.png"/, `src="/assets/shots/${next}.png"`)
          .replace(/width="\d+"\s+height="\d+"/, `width="${w}" height="${h}"`)
          .replace(/<figcaption>[\s\S]*?<\/figcaption>/, `<figcaption>${capOf[next]}</figcaption>`);
        shot = next;
      }
    }
    used.add(shot);
    return block;
  });
}

// The product story, in order, with an honest caption for each screenshot.
const STORY = [
  ['shot-annotate', 'Point at any element on your live site and write the note. Vynix names the element for you.'],
  ['shot-context', 'Every note ships with the selector, XPath, viewport, computed styles and the console error, captured automatically.'],
  ['shot-demo', 'The Vynix toolbar captures an element or a dragged region without leaving the page.'],
  ['shot-report', 'Copy the whole batch as one clean, AI-ready report.'],
  ['shot-github', 'Turn a batch of notes into GitHub issues and assign them to Copilot in one step.'],
  ['shot-mcp', 'Your AI agent reads the feedback over MCP and edits the right file.'],
  ['shot-install', 'Add one script tag and the launcher goes live on your site.'],
];

function hashSlug(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

function figure(shot, caption) {
  const [w, h] = DIMS[shot];
  return `<figure class="vx-shot"><img src="/assets/shots/${shot}.png" alt="${caption}" loading="lazy" width="${w}" height="${h}" /><figcaption>${caption}</figcaption></figure>`;
}

function insertSupportingShots(html) {
  // Only real articles (have <article> and numbered sections); never listing pages.
  if (!html.includes('<article') || html.includes('class="vx-shot"')) return html;
  const sectionCloses = (html.match(/<\/section>/g) || []).length;
  if (sectionCloses < 3) return html;

  // The hero shot already on the page; pick 2 distinct supporting shots.
  const heroMatch = html.match(/<figure class="hero"><img src="\/assets\/shots\/(shot-[a-z]+)\.png"/);
  const hero = heroMatch ? heroMatch[1] : '';
  const slug = (html.match(/rel="canonical" href="([^"]+)"/) || [])[1] || html.slice(0, 80);
  const pool = STORY.filter(([s]) => s !== hero);
  const start = hashSlug(String(slug)) % pool.length;
  const picks = [pool[start % pool.length], pool[(start + 3) % pool.length]];

  // Insert after the close of the 2nd and 4th sections (spread through the body).
  let seen = 0;
  let inserted = 0;
  return html.replace(/<\/section>/g, (tag) => {
    seen += 1;
    if ((seen === 2 || seen === 4) && inserted < picks.length) {
      const [shot, cap] = picks[inserted];
      inserted += 1;
      return tag + figure(shot, cap);
    }
    return tag;
  });
}


// Apply real screenshots to every rendered page under content/site. Safe to run
// repeatedly (idempotent) and from the growth pipeline after the site is built.
export function applyRealShots() {
  let files = 0;
  let changed = 0;
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.name.endsWith('.html')) {
        files++;
        const before = fs.readFileSync(full, 'utf8');
        const after = transform(before);
        if (after !== before) {
          fs.writeFileSync(full, after);
          changed++;
        }
      }
    }
  })(SITE);
  return { files, changed };
}

// Run directly: node tools/real-shots.mjs
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const r = applyRealShots();
  console.log(`scanned ${r.files} html files, updated ${r.changed}`);
}
