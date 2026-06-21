// Animated illustration library.
//
// Unique, branded SVG scenes with real motion. These are inline SVG with scoped
// CSS keyframes, so they animate in the browser, stay crisp at any size, and add
// almost no page weight. No stock art, no generic icons. Each scene tells a
// small part of the Vynix story.
//
// Brand: green #008448 / #06a463 / #15c47d. Designed for a light page.

function frame(id, inner, ratio = '16 / 9', label = '') {
  // A rounded panel wrapper with a soft gradient border, holding the scene.
  return `<svg class="vx-ill" viewBox="0 0 640 360" role="img" aria-label="${label}" preserveAspectRatio="xMidYMid meet" style="width:100%;height:auto;aspect-ratio:${ratio};display:block">
  <defs>
    <linearGradient id="${id}-bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f6fdfa"/><stop offset="1" stop-color="#ecfdf5"/>
    </linearGradient>
    <linearGradient id="${id}-g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#008448"/><stop offset="1" stop-color="#15c47d"/>
    </linearGradient>
    <filter id="${id}-s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#0f172a" flood-opacity="0.10"/>
    </filter>
  </defs>
  <rect x="1" y="1" width="638" height="358" rx="22" fill="url(#${id}-bg)" stroke="#d1fae5"/>
  <style>
    .${id}-pulse{transform-box:fill-box;transform-origin:center;animation:${id}-pulse 2.6s ease-in-out infinite}
    @keyframes ${id}-pulse{0%,100%{opacity:.55;transform:scale(.92)}50%{opacity:1;transform:scale(1.06)}}
    .${id}-dash{stroke-dasharray:8 10;animation:${id}-dash 1.4s linear infinite}
    @keyframes ${id}-dash{to{stroke-dashoffset:-36}}
    .${id}-float{animation:${id}-float 4s ease-in-out infinite}
    @keyframes ${id}-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
    .${id}-in{opacity:0;animation:${id}-in 6s ease-in-out infinite}
    @keyframes ${id}-in{0%,8%{opacity:0;transform:translateY(8px)}18%,72%{opacity:1;transform:translateY(0)}88%,100%{opacity:0}}
  </style>
  ${inner}
</svg>`;
}

// 1. The loop: point, capture, diagnose, ship, repeat. A dot travels the ring.
export function feedbackLoop() {
  const id = 'vxloop';
  const nodes = [
    { x: 320, y: 70, t: 'Point' },
    { x: 540, y: 180, t: 'Capture' },
    { x: 320, y: 290, t: 'Diagnose' },
    { x: 100, y: 180, t: 'Ship' },
  ];
  const ring = nodes
    .map((n, i) => {
      const delay = (i * 0.65).toFixed(2);
      return `<g class="${id}-float" style="animation-delay:${delay}s">
        <circle cx="${n.x}" cy="${n.y}" r="34" fill="#ffffff" stroke="url(#${id}-g)" stroke-width="3" filter="url(#${id}-s)"/>
        <circle cx="${n.x}" cy="${n.y}" r="34" class="${id}-pulse" fill="none" stroke="#15c47d" stroke-width="2" style="animation-delay:${delay}s"/>
        <text x="${n.x}" y="${n.y + 4}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#065f46">${n.t}</text>
      </g>`;
    })
    .join('');
  return frame(
    id,
    `<circle cx="320" cy="180" r="110" fill="none" stroke="#a7f3d0" stroke-width="3" class="${id}-dash"/>
     <circle r="7" fill="url(#${id}-g)">
       <animateMotion dur="6s" repeatCount="indefinite" rotate="auto"
         path="M 320 70 A 110 110 0 0 1 540 180 A 110 110 0 0 1 320 290 A 110 110 0 0 1 100 180 A 110 110 0 0 1 320 70"/>
     </circle>
     ${ring}`,
    '16 / 9',
    'The Vynix feedback loop: point, capture, diagnose, ship',
  );
}

// 2. Capture flow: a cursor clicks an element, a pin drops, a note appears.
export function captureFlow() {
  const id = 'vxcap';
  return frame(
    id,
    `<rect x="48" y="56" width="544" height="248" rx="14" fill="#ffffff" stroke="#e2e8f0" filter="url(#${id}-s)"/>
     <rect x="48" y="56" width="544" height="34" rx="14" fill="#f1f5f9"/>
     <circle cx="70" cy="73" r="5" fill="#f87171"/><circle cx="88" cy="73" r="5" fill="#fbbf24"/><circle cx="106" cy="73" r="5" fill="#34d399"/>
     <rect x="78" y="120" width="220" height="14" rx="7" fill="#e2e8f0"/>
     <rect x="78" y="148" width="320" height="14" rx="7" fill="#eef2f7"/>
     <rect x="78" y="200" width="150" height="40" rx="10" fill="url(#${id}-g)"/>
     <text x="153" y="225" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="700" fill="#fff">Buy now</text>
     <rect x="76" y="198" width="154" height="44" rx="12" fill="none" stroke="#008448" stroke-width="2.5" class="${id}-pulse"/>
     <g class="${id}-in">
       <rect x="300" y="190" width="252" height="86" rx="12" fill="#052e1b" filter="url(#${id}-s)"/>
       <circle cx="320" cy="210" r="7" fill="#15c47d"/>
       <rect x="336" y="204" width="120" height="9" rx="4" fill="#34d399"/>
       <rect x="312" y="228" width="220" height="8" rx="4" fill="#1e5b43"/>
       <rect x="312" y="246" width="180" height="8" rx="4" fill="#1e5b43"/>
     </g>
     <g>
       <path d="M150 210 q -2 -34 22 -40" fill="none" stroke="#008448" stroke-width="2" stroke-dasharray="4 6"/>
       <path class="${id}-float" d="M470 120 l 14 26 -10 -2 -2 12 z" fill="#0f172a"/>
     </g>`,
    '16 / 9',
    'Clicking an element and leaving a note with Vynix',
  );
}

// 3. AI diagnosis card with a filling confidence ring and appearing lines.
export function diagnosis() {
  const id = 'vxdx';
  return frame(
    id,
    `<rect x="120" y="70" width="400" height="220" rx="16" fill="#ffffff" stroke="#e2e8f0" filter="url(#${id}-s)"/>
     <circle cx="180" cy="118" r="18" fill="#ecfdf5"/>
     <path d="M172 118 l6 6 11 -12" fill="none" stroke="#008448" stroke-width="3" stroke-linecap="round"/>
     <rect x="210" y="104" width="160" height="11" rx="5" fill="#0f172a"/>
     <rect x="210" y="124" width="110" height="9" rx="4" fill="#94a3b8"/>
     <circle cx="448" cy="120" r="30" fill="none" stroke="#e2e8f0" stroke-width="7"/>
     <circle cx="448" cy="120" r="30" fill="none" stroke="url(#${id}-g)" stroke-width="7" stroke-linecap="round"
       stroke-dasharray="188" stroke-dashoffset="188" transform="rotate(-90 448 120)">
       <animate attributeName="stroke-dashoffset" from="188" to="36" dur="2.2s" begin="0s;a.end+2s" id="a" fill="freeze"/>
     </circle>
     <text x="448" y="125" text-anchor="middle" font-family="system-ui,sans-serif" font-size="14" font-weight="800" fill="#065f46">AI</text>
     <g class="${id}-in"><rect x="150" y="172" width="340" height="10" rx="5" fill="#d1fae5"/></g>
     <g class="${id}-in" style="animation-delay:.4s"><rect x="150" y="196" width="300" height="10" rx="5" fill="#eef2f7"/></g>
     <g class="${id}-in" style="animation-delay:.8s"><rect x="150" y="220" width="250" height="10" rx="5" fill="#eef2f7"/></g>
     <rect x="150" y="248" width="120" height="26" rx="8" fill="url(#${id}-g)"/>
     <text x="210" y="265" text-anchor="middle" font-family="system-ui,sans-serif" font-size="12" font-weight="700" fill="#fff">Likely cause</text>`,
    '16 / 9',
    'Vynix AI diagnosis with a confidence score',
  );
}

// 4. Handoff: a report turns into a GitHub-style issue handed to an agent.
export function handoff() {
  const id = 'vxho';
  return frame(
    id,
    `<rect x="60" y="120" width="180" height="120" rx="14" fill="#ffffff" stroke="#e2e8f0" filter="url(#${id}-s)"/>
     <circle cx="90" cy="150" r="9" fill="#15c47d"/>
     <rect x="108" y="145" width="100" height="9" rx="4" fill="#0f172a"/>
     <rect x="80" y="178" width="140" height="8" rx="4" fill="#e2e8f0"/>
     <rect x="80" y="198" width="120" height="8" rx="4" fill="#eef2f7"/>
     <path d="M250 180 h120" stroke="url(#${id}-g)" stroke-width="3" class="${id}-dash" marker-end=""/>
     <path d="M362 172 l16 8 -16 8 z" fill="#008448"/>
     <rect x="400" y="120" width="180" height="120" rx="14" fill="#052e1b" filter="url(#${id}-s)"/>
     <circle cx="430" cy="150" r="10" fill="none" stroke="#34d399" stroke-width="2.5" class="${id}-pulse"/>
     <path d="M425 150 l4 4 7 -8" fill="none" stroke="#34d399" stroke-width="2.5" stroke-linecap="round"/>
     <rect x="450" y="145" width="100" height="9" rx="4" fill="#34d399"/>
     <rect x="420" y="178" width="140" height="8" rx="4" fill="#1e5b43"/>
     <rect x="420" y="198" width="110" height="8" rx="4" fill="#1e5b43"/>
     <text x="150" y="104" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#065f46">Report</text>
     <text x="490" y="104" text-anchor="middle" font-family="system-ui,sans-serif" font-size="13" font-weight="700" fill="#065f46">Coding agent</text>`,
    '16 / 9',
    'Handing a Vynix report to a coding agent',
  );
}

const SCENES = { loop: feedbackLoop, capture: captureFlow, diagnosis, handoff };

// Pick a scene by a theme keyword, with a sensible default.
export function illustration(theme = '') {
  const t = theme.toLowerCase();
  if (/diagn|ai|cause|files/.test(t)) return diagnosis();
  if (/handoff|github|agent|issue|mcp|ship/.test(t)) return handoff();
  if (/capture|annot|point|click|screenshot|review/.test(t)) return captureFlow();
  return feedbackLoop();
}

export { SCENES };
