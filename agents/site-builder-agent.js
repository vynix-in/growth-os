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
import { headMeta, breadcrumbLd, faqLd, abs } from '../lib/seo.js';
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

function listingPage({ title, description, canonical, eyebrow, intro, bodyParas = [], faqs = [], cards }) {
  const head = [
    headMeta({ title: `${title} | Vynix`, description, canonical, type: 'website' }),
    breadcrumbLd([
      { name: 'Home', url: product.website },
      { name: eyebrow, url: canonical },
    ]),
    faqs.length ? faqLd(faqs) : '',
  ]
    .filter(Boolean)
    .join('\n');
  const paras = bodyParas.map((p) => `<p>${p}</p>`).join('');
  const faqHtml = faqs.length
    ? `<section class="faq"><h2>Common questions</h2>${faqs.map((f) => `<h3>${f.q}</h3><p>${f.a}</p>`).join('')}</section>`
    : '';
  const body = `<main class="container">
${breadcrumbsHtml([{ name: 'Home', url: product.website }, { name: eyebrow, url: canonical }])}
<article>
  <h1>${title}</h1>
  <p class="lead">${intro}</p>
  ${paras}
  <div class="card-grid">${cards.join('\n')}</div>
  ${faqHtml}
  <div class="callout"><strong>Try Vynix on your own site</strong><p>Install the widget with one script tag and capture your first report with full developer context.</p><a class="cta" href="${product.website}">Get started free</a></div>
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
      bodyParas: [
        'Most feedback loses the one thing that makes it actionable: the context an engineer needs to reproduce and fix the problem. These articles focus on the practical side of that problem, from what to capture in a bug report to how to hand the work to an AI coding agent without a long back and forth.',
        'If you build with AI agents like Copilot, Claude or Cursor, the quality of your input decides the quality of the output. We write about how to give those tools the element, the page state, the console and the network detail they need, and how Vynix captures that automatically so every report arrives ready to act on.',
        'New posts are added regularly. Each one is written to be genuinely useful on its own, with concrete steps and real product examples rather than generic advice.',
      ],
      faqs: [
        { q: 'Who is the Vynix blog for?', a: 'Front-end and full-stack engineers, QA and support teams, designers reviewing live sites, and founders shipping with AI coding agents.' },
        { q: 'How often is it updated?', a: 'New articles are published regularly as we learn more about what makes feedback fixable and how teams work with AI agents.' },
      ],
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
      bodyParas: [
        'There are many good tools for bug reporting, visual feedback, error monitoring and session replay. They solve overlapping but different problems, and the right choice depends on how your team works. These comparisons lay out where each tool is strong and where Vynix takes a different approach, so you can decide with the full picture.',
        'Vynix focuses on one thing: turning a visual report into a fix. It captures the element, the page state, the console and the network context, attaches an AI diagnosis of the likely cause, and gives you a one-click path to a GitHub issue or an AI coding agent. Where another tool is a better fit for your needs, these pages say so plainly.',
        'Every comparison is maintained by the Vynix team and kept up to date. If you ever spot something inaccurate about another tool, email hello@vynix.in and we will correct it.',
      ],
      faqs: [
        { q: 'Are these comparisons fair?', a: 'Yes. We describe competitors accurately, avoid unverifiable claims, and say when another tool is the better fit. The goal is to help you choose, not to mislead.' },
        { q: 'How is Vynix different from most of these tools?', a: 'Vynix attaches an AI diagnosis to every report and hands the work straight to a coding agent or a GitHub issue, so feedback turns into a fix faster.' },
      ],
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
      bodyParas: [
        'This help center covers the practical side of using Vynix: installing the widget, understanding what each report captures, reading the AI diagnosis, handing work to GitHub and coding agents, and fixing the occasional setup issue. Each guide is short, specific, and written so you can act on it straight away.',
        'If you are just getting started, begin with installing the widget and capturing your first report. If you are troubleshooting, the troubleshooting guides cover the most common questions. For anything not answered here, the full documentation goes deeper, and you can always reach the team at hello@vynix.in.',
      ],
      faqs: [
        { q: 'How do I get started with Vynix?', a: 'Install the widget with one script tag, then click on any element on your site to capture your first report. The install guide walks through it step by step.' },
        { q: 'Where can I get more help?', a: 'Read the full documentation at vynix.in/docs, or email the team at hello@vynix.in.' },
      ],
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
      bodyParas: [
        'Vynix is the feedback layer for teams building with AI coding agents. Point at a bug on any live website, and Vynix captures the element, a screenshot, and the console and network context, attaches an AI diagnosis of the likely cause, and hands it to your coding agent as a clean prompt or a GitHub issue.',
        'These resources help you get more out of it. The blog covers how to capture feedback with the context engineers and AI agents need. The comparison pages help you choose the right tool for your team. The help center walks through setup and troubleshooting. Everything links back to the product so you can try each idea on your own site.',
      ],
      faqs: [
        { q: 'What is Vynix?', a: 'A website annotation and developer-context tool. It captures visual feedback with full context, diagnoses the likely cause with AI, and hands the work to a coding agent or a GitHub issue.' },
        { q: 'Is there a free plan?', a: 'Yes. Vynix has a free plan and installs on any site with one script tag.' },
      ],
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
