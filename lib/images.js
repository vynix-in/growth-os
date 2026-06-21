// Media library and OG image generator.
//
// Real product images and clips already live publicly at vynix.in/marketing/,
// so pages reference those directly instead of using fake or generic stock.
// Per-page Open Graph cards are generated fresh as branded SVG and rasterised
// to PNG with rsvg-convert.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { paths } from './config.js';
import { product } from './vynix-facts.js';

const MARKETING = 'https://vynix.in/marketing';
const SHOTS = '/assets/shots';

// Real product screenshots captured from the live Vynix UI, tagged by what they
// show. These are genuine interface captures, not stock, AI filler, or promo
// cards. Width/height are the real pixel dimensions so pages reserve the right
// space (good CLS) and never distort.
export const IMAGES = [
  { file: 'shot-annotate.png', w: 1152, h: 890, alt: 'Pointing at an element on a live page and writing a Vynix note', tags: ['annotate', 'point', 'capture', 'intro', 'element', 'selector'] },
  { file: 'shot-context.png', w: 1168, h: 618, alt: 'A Vynix note with the selector, XPath, viewport, styles and console error captured automatically', tags: ['context', 'debug', 'console', 'errors', 'network', 'api', 'viewport', 'responsive'] },
  { file: 'shot-demo.png', w: 1120, h: 866, alt: 'The Vynix toolbar capturing structured feedback on a live page', tags: ['inspect', 'demo', 'review', 'point'] },
  { file: 'shot-github.png', w: 1168, h: 574, alt: 'Vynix opening GitHub issues from a batch of notes and assigning Copilot', tags: ['github', 'issue', 'handoff', 'copilot', 'agent'] },
  { file: 'shot-mcp.png', w: 1168, h: 574, alt: 'An AI agent reading Vynix feedback and fixing the code over MCP', tags: ['mcp', 'agent', 'ai', 'fix', 'loop', 'workflow', 'files'] },
  { file: 'shot-report.png', w: 1536, h: 702, alt: 'A Vynix feedback report ready to hand to a coding agent', tags: ['formats', 'prompt', 'report', 'diagnosis', 'root-cause'] },
  { file: 'shot-install.png', w: 1344, h: 496, alt: 'Installing the Vynix widget with one script tag and confirming it is live', tags: ['install', 'setup', 'widget'] },
  { file: 'shot-snippet.png', w: 1536, h: 406, alt: 'The one-line Vynix script tag you paste into any site', tags: ['snippet', 'setup', 'install'] },
];

// Real product clips, tagged the same way. Posters reuse the real screenshots.
export const CLIPS = [
  { file: 'how_it_works.mp4', title: 'How Vynix works', poster: 'shot-annotate.png', tags: ['intro', 'how-it-works', 'overview'] },
  { file: 'point_and_capture.mp4', title: 'Point and capture feedback', poster: 'shot-annotate.png', tags: ['annotate', 'capture', 'point'] },
  { file: 'problem_to_fix.mp4', title: 'From problem to fix', poster: 'shot-report.png', tags: ['workflow', 'loop', 'fix'] },
  { file: 'github_handoff.mp4', title: 'Hand off to GitHub', poster: 'shot-github.png', tags: ['github', 'handoff', 'issue'] },
  { file: 'mcp_handoff.mp4', title: 'Hand off through MCP', poster: 'shot-mcp.png', tags: ['mcp', 'agent', 'handoff'] },
  { file: 'region_capture.mp4', title: 'Capture a region', poster: 'shot-demo.png', tags: ['capture', 'screenshot', 'region'] },
];

function score(item, theme) {
  const t = (theme || '').toLowerCase();
  return item.tags.reduce((n, tag) => n + (t.includes(tag) ? 2 : 0), 0);
}

// Pick the most relevant real image for a theme; deterministic fallback by seed.
export function pickImage(theme, seed = 0) {
  const ranked = [...IMAGES].sort((a, b) => score(b, theme) - score(a, theme));
  const best = ranked[0] && score(ranked[0], theme) > 0 ? ranked[0] : IMAGES[seed % IMAGES.length];
  return { url: `${SHOTS}/${best.file}`, alt: best.alt, file: best.file, width: best.w, height: best.h };
}

export function pickImages(theme, count = 3) {
  const ranked = [...IMAGES].sort((a, b) => score(b, theme) - score(a, theme));
  return ranked.slice(0, count).map((i) => ({ url: `${SHOTS}/${i.file}`, alt: i.alt, file: i.file, width: i.w, height: i.h }));
}

export function pickClip(theme, seed = 0) {
  const ranked = [...CLIPS].sort((a, b) => score(b, theme) - score(a, theme));
  const best = ranked[0] && score(ranked[0], theme) > 0 ? ranked[0] : CLIPS[seed % CLIPS.length];
  return {
    url: `${MARKETING}/${best.file}`,
    poster: `${SHOTS}/${best.poster}`,
    title: best.title,
    file: best.file,
  };
}

function wrap(text, maxChars) {
  const words = String(text).split(/\s+/);
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.slice(0, 4);
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Generate a branded 1200x630 Open Graph card and rasterise to PNG.
// Returns the site-relative path, e.g. /assets/og/<slug>.png.
export function makeOgImage(slug, title, eyebrow = 'Vynix') {
  const ogDir = path.join(paths.content, 'site', 'assets', 'og');
  fs.mkdirSync(ogDir, { recursive: true });
  const lines = wrap(title, 26);
  const startY = 300 - (lines.length - 1) * 38;
  const tspans = lines
    .map((ln, i) => `<text x="80" y="${startY + i * 76}" font-size="58" font-weight="800" fill="#ffffff" font-family="Segoe UI, Helvetica, Arial, sans-serif">${esc(ln)}</text>`)
    .join('\n');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#04110b"/>
      <stop offset="1" stop-color="#06301f"/>
    </linearGradient>
    <linearGradient id="chev" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#008448"/>
      <stop offset="1" stop-color="#15c47d"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="1200" height="8" fill="url(#chev)"/>
  <g transform="translate(80,80)">
    <rect width="56" height="56" rx="14" fill="url(#chev)"/>
    <path d="M16 18 L28 30 L16 42" fill="none" stroke="#ffffff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="74" y="38" font-size="30" font-weight="700" fill="#15c47d" font-family="Segoe UI, Helvetica, Arial, sans-serif">Vynix</text>
  </g>
  <text x="80" y="200" font-size="26" font-weight="600" fill="#8aa39b" font-family="Segoe UI, Helvetica, Arial, sans-serif">${esc(eyebrow)}</text>
  ${tspans}
  <text x="80" y="560" font-size="24" fill="#cbd5e1" font-family="Segoe UI, Helvetica, Arial, sans-serif">vynix.in &#183; Point it. Capture it. Ship it.</text>
</svg>`;

  const svgPath = path.join(ogDir, `${slug}.svg`);
  const pngPath = path.join(ogDir, `${slug}.png`);
  fs.writeFileSync(svgPath, svg);
  try {
    execSync(`rsvg-convert -w 1200 -h 630 "${svgPath}" -o "${pngPath}"`, { stdio: 'ignore' });
    fs.unlinkSync(svgPath);
    return `/assets/og/${slug}.png`;
  } catch {
    // If rasterising fails, keep the SVG (still a valid, indexable image).
    return `/assets/og/${slug}.svg`;
  }
}

export { MARKETING, product };
