// Per-page banner generator.
//
// Every article and listing card gets its own clean, on-brand banner instead of
// a recycled, text-heavy product screenshot scaled down to an illegible thumbnail.
// Banners are deterministic from the page (same slug -> same art), branded with
// the real Vynix mark, and legible at both hero and card sizes. Rendered as SVG
// then rasterised to PNG with rsvg-convert (same toolchain as the OG cards).
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { paths } from './config.js';

const W = 1200;
const H = 630;

// The real Vynix mark (the nested-chevron "V"), traced from the brand artwork.
const LOGO_PATH =
  'M30 8675 c0 -2 600 -532 1333 -1177 732 -645 1878 -1653 2544 -2240 l1213 -1068 1087 958 c599 526 1744 1535 2546 2240 801 706 1457 1285 1457 1288 0 2 -17 -6 -37 -19 -21 -13 -1166 -713 -2546 -1555 l-2507 -1532 -2388 1458 c-1313 803 -2458 1502 -2544 1555 -87 53 -158 95 -158 92z M1745 8503 c17 -11 783 -489 1702 -1061 l1673 -1042 1702 1061 c937 584 1694 1059 1683 1057 -11 -3 -777 -249 -1703 -548 l-1682 -543 -1683 543 c-1829 590 -1735 561 -1692 533z M1087 6789 c3048 -4001 4027 -5284 4033 -5284 9 0 4169 5458 4165 5463 -2 2 -295 -252 -652 -565 -356 -313 -1288 -1130 -2071 -1816 -783 -687 -1429 -1250 -1436 -1253 -8 -3 -239 192 -547 463 -1857 1629 -3606 3160 -3618 3168 -8 4 49 -74 126 -176z';

// Distinct accent per section so the library does not feel monochrome.
const ACCENTS = {
  blog: ['#0ea5e9', '#06b6d4'],
  compare: ['#15c47d', '#0ea5e9'],
  best: ['#f59e0b', '#15c47d'],
  for: ['#a855f7', '#15c47d'],
  glossary: ['#14b8a6', '#22d3ee'],
  kb: ['#6366f1', '#15c47d'],
  default: ['#008448', '#15c47d'],
};

const EYEBROWS = {
  blog: 'Vynix Blog',
  compare: 'Comparison',
  best: 'Buyer guide',
  for: 'Use case',
  glossary: 'Glossary',
  kb: 'Help center',
  default: 'Vynix',
};

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function wrap(text, maxChars, maxLines) {
  const words = String(text).split(/\s+/).filter(Boolean);
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
  return lines.slice(0, maxLines);
}

function logoMark(x, y, size, fill = '#15c47d') {
  // The mark path is authored in a 1024 box with a flip transform; scale to size.
  const s = size / 1024;
  return `<g transform="translate(${x},${y}) scale(${s})"><g transform="translate(0,1024) scale(0.1,-0.1)" fill="${fill}"><path d="${LOGO_PATH}"/></g></g>`;
}

// "X vs Vynix" gets a VS motif with both names; everything else gets a title block.
function compareArt(title) {
  const left = title.replace(/\s*vs\s*vynix\s*$/i, '').trim() || 'Tool';
  const leftLines = wrap(left, 16, 2);
  const startY = 330 - (leftLines.length - 1) * 30;
  const leftText = leftLines
    .map((ln, i) => `<text x="300" y="${startY + i * 60}" font-size="54" font-weight="800" fill="#ffffff" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif">${esc(ln)}</text>`)
    .join('');
  return `
  ${leftText}
  <circle cx="600" cy="312" r="54" fill="#0b3b28" stroke="#15c47d" stroke-width="3"/>
  <text x="600" y="330" font-size="40" font-weight="800" fill="#15c47d" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif">VS</text>
  ${logoMark(840, 270, 86)}
  <text x="900" y="430" font-size="46" font-weight="800" fill="#ffffff" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif">Vynix</text>`;
}

function titleArt(title, accentTo) {
  const lines = wrap(title, 24, 3);
  const startY = 340 - (lines.length - 1) * 44;
  return lines
    .map((ln, i) => `<text x="80" y="${startY + i * 88}" font-size="68" font-weight="800" fill="#ffffff" font-family="Segoe UI, Helvetica, Arial, sans-serif">${esc(ln)}</text>`)
    .join('\n');
}

/**
 * Generate (or reuse) a banner PNG for a page. Returns the site-relative path,
 * e.g. /assets/banners/<slug>.png.
 */
export function makeBanner(slug, title, kind = 'default') {
  const dir = path.join(paths.content, 'site', 'assets', 'banners');
  fs.mkdirSync(dir, { recursive: true });
  const pngPath = path.join(dir, `${slug}.png`);
  const rel = `/assets/banners/${slug}.png`;
  if (fs.existsSync(pngPath)) {
    return rel;
  }

  const [a1, a2] = ACCENTS[kind] || ACCENTS.default;
  const eyebrow = EYEBROWS[kind] || EYEBROWS.default;
  const isCompare = kind === 'compare' && /vs\s+vynix/i.test(title);
  const art = isCompare ? compareArt(title) : titleArt(title, a2);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#04110b"/>
      <stop offset="1" stop-color="#072a1c"/>
    </linearGradient>
    <linearGradient id="bar" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${a1}"/>
      <stop offset="1" stop-color="${a2}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="1060" cy="120" r="240" fill="${a2}" opacity="0.07"/>
  <circle cx="120" cy="560" r="200" fill="${a1}" opacity="0.06"/>
  <rect x="0" y="0" width="${W}" height="10" fill="url(#bar)"/>
  <g transform="translate(80,70)">
    ${logoMark(0, 0, 44, a2)}
    <text x="60" y="33" font-size="30" font-weight="800" fill="#ffffff" font-family="Segoe UI, Helvetica, Arial, sans-serif">Vynix</text>
  </g>
  <text x="80" y="190" font-size="26" font-weight="700" fill="${a2}" letter-spacing="2" font-family="Segoe UI, Helvetica, Arial, sans-serif">${esc(eyebrow.toUpperCase())}</text>
  ${art}
  <text x="80" y="565" font-size="24" fill="#9fb4ab" font-family="Segoe UI, Helvetica, Arial, sans-serif">vynix.in &#183; Point it. Capture it. Ship it.</text>
</svg>`;

  const svgPath = path.join(dir, `${slug}.svg`);
  fs.writeFileSync(svgPath, svg);
  try {
    execSync(`rsvg-convert -w ${W} -h ${H} "${svgPath}" -o "${pngPath}"`, { stdio: 'ignore' });
    fs.unlinkSync(svgPath);
    return rel;
  } catch {
    return rel.replace('.png', '.svg');
  }
}
