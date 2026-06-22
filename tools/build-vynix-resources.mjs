// Build a /resources-prefixed copy of the generated site so it can be served
// from vynix.in/resources/ alongside the React app, with correct canonicals and
// internal links. Product links (vynix.in, /docs, /pricing, /marketing) are left
// alone. Output goes to content/vynix-resources/.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, '..', 'content', 'site');
const DEST = path.join(__dirname, '..', 'content', 'vynix-resources');
const PREFIX = '/resources';
const SECTIONS = 'blog|compare|kb|best|for|alternatives|glossary|badge|assets';
const FILES = 'badge\\.svg|sitemap\\.xml|feed\\.xml|robots\\.txt|submit-urls\\.txt|links\\.json|404\\.html';

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, e.name);
    const d = path.join(dest, e.name);
    if (e.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

// Rewrite one text file's content to use the /resources prefix.
function rewrite(content, isSitemapOrText) {
  let out = content;
  // The github.io mirror host (used by submit-urls.txt and any stray reference)
  // maps directly onto the live resources path: github.io/<path> -> vynix.in/resources/<path>.
  out = out.split('https://vynix-in.github.io').join(`https://vynix.in${PREFIX}`);
  // Root-relative internal links and asset references -> add the prefix.
  out = out.replace(new RegExp(`(href|src|srcset)="/(${SECTIONS})(/|")`, 'g'), `$1="${PREFIX}/$2$3`);
  out = out.replace(new RegExp(`(href|src|srcset)="/(${FILES})"`, 'g'), `$1="${PREFIX}/$2"`);
  // The resources home itself.
  out = out.replace(/(href|src)="\/"/g, `$1="${PREFIX}/"`);
  // Absolute self-URLs on the vynix.in host -> add the prefix.
  out = out.replace(new RegExp(`https://vynix\\.in/(${SECTIONS}|${FILES})`, 'g'), `https://vynix.in${PREFIX}/$1`);
  // Home canonical / og:url ("https://vynix.in/" with a trailing slash+quote).
  out = out.replace(/https:\/\/vynix\.in\/"/g, `https://vynix.in${PREFIX}/"`);
  if (isSitemapOrText) {
    // sitemap loc / submit list: every vynix.in/<path> that is ours.
    out = out.replace(new RegExp(`https://vynix\\.in/(${SECTIONS}|${FILES})`, 'g'), `https://vynix.in${PREFIX}/$1`);
    out = out.replace(/https:\/\/vynix\.in\/(\s|$|<)/g, `https://vynix.in${PREFIX}/$1`);
  }
  // Canonical host is https://www.vynix.in (apex 301-redirects to www). Normalise
  // every vynix.in URL (canonical, og:url, sitemap loc, product links, JSON-LD)
  // to the www host so canonicals never point at a redirect. Safe: the literal
  // "https://vynix.in" never occurs inside "https://www.vynix.in".
  out = out.split('https://vynix.in').join('https://www.vynix.in');
  return out;
}

function transform(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) transform(full);
    else if (/\.(html|xml|txt|json)$/.test(e.name)) {
      const isSr = /sitemap\.xml$|robots\.txt$|submit-urls\.txt$/.test(e.name);
      fs.writeFileSync(full, rewrite(fs.readFileSync(full, 'utf8'), isSr));
    }
  }
}

// Build the /resources copy. Returns a small summary; safe to call from the
// growth pipeline (grow/deploy) so vynix.in/resources stays in sync with content/site.
export function buildVynixResources() {
  if (!fs.existsSync(SRC)) return { built: false, reason: 'no content/site' };
  if (fs.existsSync(DEST)) fs.rmSync(DEST, { recursive: true, force: true });
  copyDir(SRC, DEST);
  transform(DEST);
  let pages = 0;
  (function count(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) count(full);
      else if (e.name === 'index.html') pages++;
    }
  })(DEST);
  return { built: true, dest: DEST, pages };
}

// When run directly (node tools/build-vynix-resources.mjs), build and print a summary.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const res = buildVynixResources();
  const samplePath = path.join(DEST, 'compare', 'jam-vs-vynix', 'index.html');
  const sample = fs.existsSync(samplePath) ? fs.readFileSync(samplePath, 'utf8') : '';
  console.log('built content/vynix-resources:', res.pages, 'pages');
  console.log('sample canonical:', (sample.match(/rel="canonical" href="([^"]+)"/) || [])[1]);
  console.log('product link preserved:', sample.includes('href="https://www.vynix.in"'));
  console.log('internal link sample:', (sample.match(/href="(\/resources\/[^"]+)"/) || [])[1] || 'none');
}
