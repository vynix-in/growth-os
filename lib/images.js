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

// Curated real product images, tagged by what they show. These are genuine
// Vynix visuals, not stock or AI filler.
export const IMAGES = [
  { file: 'p-point.png', alt: 'Pointing at an element on a live page with Vynix', tags: ['annotate', 'point', 'capture', 'intro'] },
  { file: 'p-context.png', alt: 'Developer context captured with a Vynix report', tags: ['context', 'debug', 'console'] },
  { file: 'p-console.png', alt: 'Console errors captured alongside a Vynix note', tags: ['console', 'errors', 'debug'] },
  { file: 'p-network.png', alt: 'Network requests captured with a Vynix report', tags: ['network', 'debug', 'api'] },
  { file: 'p-inspector.png', alt: 'Inspecting an element selector in Vynix', tags: ['element', 'selector', 'inspect'] },
  { file: 'p-github.png', alt: 'Creating a GitHub issue from a Vynix note', tags: ['github', 'issue', 'handoff'] },
  { file: 'p-copilot.png', alt: 'Handing a Vynix issue to a coding agent', tags: ['copilot', 'agent', 'ai', 'handoff'] },
  { file: 'p-mcp.png', alt: 'Vynix MCP server connecting to an AI client', tags: ['mcp', 'agent', 'ai'] },
  { file: 'p-install.png', alt: 'Installing the Vynix widget with one script tag', tags: ['install', 'setup', 'widget'] },
  { file: 'p-viewport.png', alt: 'Reviewing feedback across viewports in Vynix', tags: ['viewport', 'responsive', 'review'] },
  { file: 'p-formats.png', alt: 'Copying a Vynix report as an AI-ready prompt', tags: ['prompt', 'formats', 'ai'] },
  { file: 'v2-p-diagnose.png', alt: 'Vynix AI diagnosis of a captured bug', tags: ['diagnosis', 'ai', 'root-cause'] },
  { file: 'v2-p-handoff.png', alt: 'Handing a diagnosed bug to a coding agent', tags: ['handoff', 'agent', 'workflow'] },
  { file: 'v2-p-loop.png', alt: 'Closing the feedback-to-fix loop with Vynix', tags: ['loop', 'workflow', 'review'] },
  { file: 'v2-p-files.png', alt: 'Likely files surfaced by the Vynix diagnosis', tags: ['files', 'diagnosis', 'code'] },
  { file: 'v2-p-mcp-fix.png', alt: 'An AI agent fixing a Vynix-reported bug via MCP', tags: ['mcp', 'fix', 'agent'] },
];

// Real product clips, tagged the same way.
export const CLIPS = [
  { file: 'how_it_works.mp4', title: 'How Vynix works', poster: 'p-point.png', tags: ['intro', 'how-it-works', 'overview'] },
  { file: 'point_and_capture.mp4', title: 'Point and capture feedback', poster: 'p-point.png', tags: ['annotate', 'capture', 'point'] },
  { file: 'problem_to_fix.mp4', title: 'From problem to fix', poster: 'v2-p-diagnose.png', tags: ['workflow', 'loop', 'fix'] },
  { file: 'github_handoff.mp4', title: 'Hand off to GitHub', poster: 'p-github.png', tags: ['github', 'handoff', 'issue'] },
  { file: 'mcp_handoff.mp4', title: 'Hand off through MCP', poster: 'p-mcp.png', tags: ['mcp', 'agent', 'handoff'] },
  { file: 'region_capture.mp4', title: 'Capture a region', poster: 'p-point.png', tags: ['capture', 'screenshot', 'region'] },
];

function score(item, theme) {
  const t = (theme || '').toLowerCase();
  return item.tags.reduce((n, tag) => n + (t.includes(tag) ? 2 : 0), 0);
}

// Pick the most relevant real image for a theme; deterministic fallback by seed.
export function pickImage(theme, seed = 0) {
  const ranked = [...IMAGES].sort((a, b) => score(b, theme) - score(a, theme));
  const best = ranked[0] && score(ranked[0], theme) > 0 ? ranked[0] : IMAGES[seed % IMAGES.length];
  return { url: `${MARKETING}/${best.file}`, alt: best.alt, file: best.file };
}

export function pickImages(theme, count = 3) {
  const ranked = [...IMAGES].sort((a, b) => score(b, theme) - score(a, theme));
  return ranked.slice(0, count).map((i) => ({ url: `${MARKETING}/${i.file}`, alt: i.alt, file: i.file }));
}

export function pickClip(theme, seed = 0) {
  const ranked = [...CLIPS].sort((a, b) => score(b, theme) - score(a, theme));
  const best = ranked[0] && score(ranked[0], theme) > 0 ? ranked[0] : CLIPS[seed % CLIPS.length];
  return {
    url: `${MARKETING}/${best.file}`,
    poster: `${MARKETING}/${best.poster}`,
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
