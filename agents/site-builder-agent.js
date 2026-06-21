// Site Builder Agent
//
// Assembles the index pages, the sitemap and robots file that tie the generated
// content into a real, crawlable static site. It reads the blog, comparison and
// knowledge base records and renders listing pages with cards, then writes
// sitemap.xml and robots.txt. The output under content/site is a complete site
// the founder can deploy under vynix.in (/blog, /compare, /kb).
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { product } from '../lib/vynix-facts.js';
import { renderPage, breadcrumbsHtml } from '../lib/page.js';
import { headMeta, breadcrumbLd, abs } from '../lib/seo.js';
import { pickImage } from '../lib/images.js';
import { humanDate, now } from '../lib/util.js';

const log = logger('site-builder');
const blog = db('content');
const comparisons = db('comparisons');
const knowledgebase = db('knowledgebase');

export const meta = { id: 'site-builder', name: 'Site Builder Agent' };

function card(href, title, desc, img) {
  return `<a class="card" href="${href}">
    ${img ? `<img src="${img}" alt="${title}" loading="lazy" width="1080" height="608" />` : ''}
    <div class="body"><h3>${title}</h3><p>${desc || ''}</p></div>
  </a>`;
}

function listingPage({ title, description, canonical, eyebrow, intro, cards }) {
  const head = [
    headMeta({ title: `${title} | Vynix`, description, canonical, type: 'website' }),
    breadcrumbLd([
      { name: 'Home', url: product.website },
      { name: eyebrow, url: canonical },
    ]),
  ].join('\n');
  const body = `<main class="container">
${breadcrumbsHtml([{ name: 'Home', url: product.website }, { name: eyebrow, url: canonical }])}
<article>
  <h1>${title}</h1>
  <p class="lead">${intro}</p>
  <div class="card-grid">${cards.join('\n')}</div>
</article>
</main>`;
  return renderPage({ head, body });
}

function write(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

export async function run() {
  const siteRoot = path.join(paths.content, 'site');
  const posts = blog.find({ kind: 'blog' }).filter((p) => p.slug && p.status !== 'blocked');
  const comps = comparisons.all().filter((c) => c.slug && c.status !== 'blocked');
  const kb = knowledgebase.all().filter((k) => k.slug && k.og_image && k.status !== 'blocked');

  // Blog index
  write(
    path.join(siteRoot, 'blog', 'index.html'),
    listingPage({
      title: 'Vynix Blog',
      description: 'Practical guides on bug reporting, developer context, and shipping with AI coding agents.',
      canonical: '/blog/',
      eyebrow: 'Blog',
      intro: 'Practical writing on capturing feedback with context, diagnosing bugs, and handing work to AI coding agents.',
      cards: posts.length
        ? posts.map((p) => card(`/blog/${p.slug}/`, p.title, p.description, p.hero))
        : ['<p>New articles are on the way.</p>'],
    }),
  );

  // Compare index
  write(
    path.join(siteRoot, 'compare', 'index.html'),
    listingPage({
      title: 'Compare Vynix',
      description: 'Honest comparisons of Vynix with other bug reporting, visual feedback and monitoring tools.',
      canonical: '/compare/',
      eyebrow: 'Compare',
      intro: 'Neutral, accurate comparisons to help you choose the right feedback tool for your team.',
      cards: comps.map((c) => card(`/compare/${c.slug}/`, `${c.competitor} vs Vynix`, `How ${c.competitor} and Vynix compare.`, pickImage('diagnosis', c.slug.length).url)),
    }),
  );

  // KB index
  write(
    path.join(siteRoot, 'kb', 'index.html'),
    listingPage({
      title: 'Vynix Help Center',
      description: 'Guides and troubleshooting for installing Vynix, capturing reports, and handing work to coding agents.',
      canonical: '/kb/',
      eyebrow: 'Help',
      intro: 'Guides and answers for getting the most out of Vynix.',
      cards: kb.map((k) => card(`/kb/${k.slug}/`, k.title, k.type, pickImage('install', k.slug.length).url)),
    }),
  );

  // Resources home (a hub that links the three sections)
  write(
    path.join(siteRoot, 'index.html'),
    listingPage({
      title: 'Vynix Resources',
      description: 'Guides, comparisons and help for Vynix, the feedback layer for teams building with AI coding agents.',
      canonical: '/',
      eyebrow: 'Resources',
      intro: 'Everything to help you capture better feedback and ship faster with Vynix.',
      cards: [
        card('/blog/', 'Blog', 'Guides on context, diagnosis and AI handoff.', pickImage('workflow', 1).url),
        card('/compare/', 'Compare', 'How Vynix compares with other tools.', pickImage('diagnosis', 2).url),
        card('/kb/', 'Help Center', 'Setup and troubleshooting guides.', pickImage('install', 3).url),
      ],
    }),
  );

  // sitemap.xml
  const urls = [
    '/',
    '/blog/',
    '/compare/',
    '/kb/',
    ...posts.map((p) => `/blog/${p.slug}/`),
    ...comps.map((c) => `/compare/${c.slug}/`),
    ...kb.map((k) => `/kb/${k.slug}/`),
  ];
  const lastmod = now().slice(0, 10);
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${abs(u)}</loc><lastmod>${lastmod}</lastmod></url>`).join('\n')}
</urlset>
`;
  write(path.join(siteRoot, 'sitemap.xml'), sitemap);

  // robots.txt
  write(
    path.join(siteRoot, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${abs('/sitemap.xml')}\n`,
  );

  const total = urls.length;
  log.info('site built', { pages: total, posts: posts.length, comparisons: comps.length, kb: kb.length });
  return { pages: total, blog: posts.length, comparisons: comps.length, kb: kb.length, updated: humanDate() };
}

export default { meta, run };
