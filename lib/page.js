// Page template. Wraps page content in a complete, responsive, fast-loading
// HTML document with the site header, footer, breadcrumbs, and inline critical
// CSS (no external fonts or CSS, so the page renders instantly — good for Core
// Web Vitals and SEO). Every page built by the agents goes through here so the
// look is consistent and the markup is clean and semantic.
import { product } from './vynix-facts.js';
import { headMeta, organizationLd, abs } from './seo.js';

const NAV = [
  { label: 'Product', url: product.website },
  { label: 'Blog', url: '/blog/' },
  { label: 'Compare', url: '/compare/' },
  { label: 'Docs', url: product.docs },
  { label: 'Help', url: '/kb/' },
];

const CSS = `
:root{--green:#008448;--green-2:#06a463;--ink:#0f172a;--muted:#475569;--line:#e2e8f0;--bg:#ffffff;--soft:#f8fafc}
*{box-sizing:border-box}
html{scroll-behavior:smooth}
body{margin:0;font-family:system-ui,-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:var(--ink);background:var(--bg);line-height:1.65;font-size:17px}
a{color:var(--green);text-decoration:none}
a:hover{text-decoration:underline}
img,video{max-width:100%;height:auto;border-radius:12px}
.container{max-width:880px;margin:0 auto;padding:0 20px}
.site-header{border-bottom:1px solid var(--line);position:sticky;top:0;background:rgba(255,255,255,.9);backdrop-filter:blur(8px);z-index:10}
.site-header .container{display:flex;align-items:center;justify-content:space-between;height:62px}
.brand{display:flex;align-items:center;gap:10px;font-weight:700;color:var(--ink)}
.brand .mark{width:26px;height:26px;border-radius:7px;background:linear-gradient(135deg,var(--green),var(--green-2));position:relative;display:inline-block}
.brand .mark::after{content:"";position:absolute;inset:7px 8px;border-left:3px solid #fff;border-bottom:3px solid #fff;transform:rotate(-45deg)}
nav.main a{color:var(--muted);font-size:.95rem;margin-left:18px;font-weight:500}
nav.main a:hover{color:var(--green)}
.cta{display:inline-block;background:var(--green);color:#fff!important;padding:9px 16px;border-radius:9px;font-weight:600;text-decoration:none!important}
.cta:hover{background:var(--green-2)}
.breadcrumbs{font-size:.85rem;color:var(--muted);padding:16px 0}
.breadcrumbs a{color:var(--muted)}
article{padding:8px 0 48px}
article h1{font-size:2.3rem;line-height:1.15;margin:.2em 0 .3em}
article h2{font-size:1.5rem;margin:1.6em 0 .5em}
article h3{font-size:1.2rem;margin:1.4em 0 .4em}
.lead{font-size:1.2rem;color:var(--muted)}
.meta-row{display:flex;gap:14px;align-items:center;color:var(--muted);font-size:.9rem;margin:10px 0 22px;flex-wrap:wrap}
.hero{margin:18px 0 26px;border:1px solid var(--line)}
figure{margin:24px 0}
figure img,figure video{border:1px solid var(--line);width:100%}
figcaption{color:var(--muted);font-size:.85rem;margin-top:8px;text-align:center}
table{width:100%;border-collapse:collapse;margin:22px 0;font-size:.96rem}
th,td{text-align:left;padding:11px 13px;border-bottom:1px solid var(--line);vertical-align:top}
th{background:var(--soft);font-weight:600}
td.yes{color:var(--green);font-weight:600}
.toc{background:var(--soft);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin:24px 0}
.toc strong{display:block;margin-bottom:8px;font-size:.9rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
.toc ol{margin:0;padding-left:20px}
.faq h3{font-size:1.08rem;margin-top:1.2em}
.callout{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 20px;margin:26px 0}
.callout a.cta{margin-top:8px}
.card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:18px;margin:24px 0}
.card{border:1px solid var(--line);border-radius:14px;overflow:hidden;background:#fff;transition:box-shadow .15s}
.card:hover{box-shadow:0 8px 24px rgba(15,23,42,.08)}
.card img{border-radius:0;display:block;aspect-ratio:16/9;object-fit:cover;width:100%}
.card .body{padding:14px 16px}
.card h3{margin:.2em 0;font-size:1.05rem}
.card p{color:var(--muted);font-size:.92rem;margin:.3em 0 0}
.tag{display:inline-block;font-size:.72rem;color:var(--green);background:#ecfdf5;border:1px solid #bbf7d0;border-radius:999px;padding:2px 9px;margin-right:6px}
.site-footer{border-top:1px solid var(--line);background:var(--soft);margin-top:40px}
.site-footer .container{padding:32px 20px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:18px;color:var(--muted);font-size:.9rem}
.site-footer a{color:var(--muted)}
@media(max-width:640px){article h1{font-size:1.8rem}nav.main a{margin-left:12px}body{font-size:16px}}
`;

function header() {
  return `<header class="site-header"><div class="container">
  <a class="brand" href="${product.website}"><span class="mark"></span> Vynix</a>
  <nav class="main">
    ${NAV.map((n) => `<a href="${n.url}">${n.label}</a>`).join('')}
    <a class="cta" href="${product.website}">Try free</a>
  </nav>
</div></header>`;
}

function footer() {
  const year = new Date().getFullYear();
  return `<footer class="site-footer"><div class="container">
  <div>&copy; ${year} Vynix &middot; <a href="${product.website}">vynix.in</a></div>
  <div>
    <a href="/blog/">Blog</a> &middot;
    <a href="/compare/">Compare</a> &middot;
    <a href="/kb/">Help</a> &middot;
    <a href="${product.githubOrg}">GitHub</a> &middot;
    <a href="${product.website}/privacy">Privacy</a>
  </div>
</div></footer>`;
}

export function breadcrumbsHtml(items) {
  return `<div class="breadcrumbs container">${items
    .map((it, i) => (i < items.length - 1 ? `<a href="${it.url}">${it.name}</a> / ` : `<span>${it.name}</span>`))
    .join('')}</div>`;
}

// Build a complete HTML page. `head` is the SEO meta + JSON-LD strings, `body`
// is the inner HTML (already wrapped in its own container/article as needed).
export function renderPage({ head, body }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
${head}
${organizationLd()}
<style>${CSS}</style>
</head>
<body>
${header()}
${body}
${footer()}
</body>
</html>
`;
}

export { headMeta, abs };
