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
import { headMeta, breadcrumbLd, faqLd, itemListLd, abs } from '../lib/seo.js';
import { pickImage } from '../lib/images.js';
import { humanDate, now } from '../lib/util.js';

const log = logger('site-builder');
const blog = db('content');
const comparisons = db('comparisons');
const knowledgebase = db('knowledgebase');
const listicles = db('listicles');
const usecases = db('usecases');
const glossary = db('glossary');

export const meta = { id: 'site-builder', name: 'Site Builder Agent' };

function card(href, title, desc, img) {
  return `<a class="card" href="${href}">
    ${img ? `<img src="${img}" alt="${title}" loading="lazy" width="1080" height="608" />` : ''}
    <div class="body"><h3>${title}</h3><p>${desc || ''}</p></div>
  </a>`;
}

function listingPage({ title, description, canonical, eyebrow, intro, bodyParas = [], faqs = [], cards, items = [] }) {
  const head = [
    headMeta({ title: `${title} | Vynix`, description, canonical, type: 'website' }),
    breadcrumbLd([
      { name: 'Home', url: product.website },
      { name: eyebrow, url: canonical },
    ]),
    items.length ? itemListLd(items, title) : '',
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

function escapeXml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Self-healing: walk every generated page and drop internal list links that
// point to a page which no longer exists (for example a post that was renamed
// or removed). This keeps the site free of broken internal links on every build.
function fixBrokenLinks(siteRoot) {
  const exists = (route) => {
    const rel = route.replace(/^\//, '').replace(/\/$/, '');
    return fs.existsSync(path.join(siteRoot, rel, 'index.html'));
  };
  let fixed = 0;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === 'index.html') {
        let html = fs.readFileSync(full, 'utf8');
        const before = html;
        html = html.replace(/<li><a href="(\/(?:blog|compare|kb|best|alternatives|for|glossary)\/[^"/]+\/)">[^<]*<\/a><\/li>/g, (m, route) =>
          exists(route) ? m : '',
        );
        if (html !== before) {
          fs.writeFileSync(full, html);
          fixed += 1;
        }
      }
    }
  };
  walk(siteRoot);
  return fixed;
}

export async function run() {
  const siteRoot = path.join(paths.content, 'site');
  const posts = blog.find({ kind: 'blog' }).filter((p) => p.slug && p.status !== 'blocked');
  const comps = comparisons.all().filter((c) => c.slug && c.status !== 'blocked');
  const kb = knowledgebase.all().filter((k) => k.slug && k.og_image && k.status !== 'blocked');
  const lists = listicles.all().filter((l) => l.slug && l.status !== 'blocked');
  const ucs = usecases.all().filter((u) => u.slug && u.status !== 'blocked');
  const gloss = glossary.all().filter((g) => g.slug && g.status !== 'blocked');

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
      items: posts.map((p) => ({ name: p.title, url: `/blog/${p.slug}/` })),
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
      items: comps.map((c) => ({ name: `${c.competitor} vs Vynix`, url: `/compare/${c.slug}/` })),
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
      items: kb.map((k) => ({ name: k.title, url: `/kb/${k.slug}/` })),
    }),
  );

  // Guides index (best-of and alternatives listicles)
  if (lists.length) {
    write(
      path.join(siteRoot, 'best', 'index.html'),
      listingPage({
        title: 'Vynix Guides: best tools and alternatives',
        description: 'Buyer guides comparing the best bug reporting and visual feedback tools, and alternatives to popular options.',
        canonical: '/best/',
        eyebrow: 'Guides',
        intro: 'Straight buyer guides to the best bug reporting and feedback tools, and honest alternatives to the popular ones.',
        bodyParas: [
          'Choosing a feedback tool is easier when you can see the options side by side. These guides round up the main tools in each category, say what each one is best for, and explain where Vynix fits. They are written to be fair, so if another tool suits you better, the guide says so.',
          'Use these alongside the detailed one-to-one comparisons. Start with a guide to see the field, then read the head-to-head page for the two tools you are weighing up.',
        ],
        faqs: [
          { q: 'How do you pick the tools in these guides?', a: 'We include the widely used tools in each category and describe them from known facts. We do not rank by who pays us, because no one does.' },
          { q: 'Is Vynix always listed first?', a: 'Vynix is listed as a strong option because it is our product, but each guide explains what every tool is best for so you can choose honestly.' },
        ],
        cards: lists.map((l) => card(`${l.url}/`, l.title, l.kind === 'alternatives' ? 'Alternatives guide' : 'Buyer guide', pickImage('workflow', l.slug.length).url)),
        items: lists.map((l) => ({ name: l.title, url: `${l.url}/` })),
      }),
    );
  }

  // Use cases index (persona landing pages)
  if (ucs.length) {
    write(
      path.join(siteRoot, 'for', 'index.html'),
      listingPage({
        title: 'Vynix use cases',
        description: 'How different teams use Vynix: agencies, QA, startups, designers, AI developers and support teams.',
        canonical: '/for/',
        eyebrow: 'Use cases',
        intro: 'See how Vynix fits the way your team works.',
        bodyParas: [
          'Vynix helps any team that collects feedback on a website, but the day-to-day looks different depending on who you are. These pages walk through the specific problems each audience faces and how Vynix helps, with the features that matter most to them.',
          'Pick the page closest to your role to see the fastest path to value. Each one ends with a free way to try Vynix on your own site.',
          'Whether you run an agency collecting client feedback, a QA team filing reproducible bugs, a startup shipping fast with AI agents, a design team reviewing live work, or a support team turning user reports into clear tickets, the same idea applies. Feedback is only useful when it carries the context needed to act on it, and Vynix captures that context for you so the work moves forward instead of bouncing back and forth.',
        ],
        faqs: [
          { q: 'Which plan do I need?', a: 'Most teams start on the free plan. Check vynix.in/pricing for current details on what each plan includes.' },
          { q: 'Does Vynix work with my stack?', a: 'Yes. The widget installs with one script tag and works on any framework or plain HTML.' },
        ],
        cards: ucs.map((u) => card(`/for/${u.slug}/`, u.title, 'Use case', pickImage('review', u.slug.length).url)),
        items: ucs.map((u) => ({ name: u.title, url: `/for/${u.slug}/` })),
      }),
    );
  }

  // Glossary index
  if (gloss.length) {
    write(
      path.join(siteRoot, 'glossary', 'index.html'),
      listingPage({
        title: 'Vynix glossary',
        description: 'Plain-language definitions of bug reporting, feedback and debugging terms developers use every day.',
        canonical: '/glossary/',
        eyebrow: 'Glossary',
        intro: 'Clear definitions of the terms that come up when teams report and fix problems on a website.',
        bodyParas: [
          'Words like session replay, error monitoring and developer context get used loosely, which leads to confusion when a bug is handed off. This glossary explains each term in plain language, with enough detail to be genuinely useful rather than a one-line dictionary stub.',
          'Each entry covers what the term means, why it matters, and how it fits into the work of capturing feedback and shipping a fix. Where it helps, the entries point to the deeper guides and to the product.',
        ],
        faqs: [
          { q: 'Who is this glossary for?', a: 'Developers, QA, designers and anyone who reports or fixes problems on a website and wants the vocabulary to be clear.' },
          { q: 'How is it kept current?', a: 'New terms are added over time as the way teams work with AI agents and feedback tools changes.' },
        ],
        cards: gloss.map((g) => card(`/glossary/${g.slug}/`, g.term, 'Definition', pickImage('context', g.slug.length).url)),
        items: gloss.map((g) => ({ name: g.term, url: `/glossary/${g.slug}/` })),
      }),
    );
  }

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
        card('/best/', 'Guides', 'Best tools and alternatives, compared.', pickImage('files', 4).url),
        card('/for/', 'Use cases', 'How different teams use Vynix.', pickImage('review', 5).url),
        card('/glossary/', 'Glossary', 'Plain definitions of the terms.', pickImage('context', 6).url),
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
    ...(lists.length ? ['/best/'] : []),
    ...(ucs.length ? ['/for/'] : []),
    ...(gloss.length ? ['/glossary/'] : []),
    ...posts.map((p) => `/blog/${p.slug}/`),
    ...comps.map((c) => `/compare/${c.slug}/`),
    ...kb.map((k) => `/kb/${k.slug}/`),
    ...lists.map((l) => `${l.url}/`),
    ...ucs.map((u) => `/for/${u.slug}/`),
    ...gloss.map((g) => `/glossary/${g.slug}/`),
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

  // RSS feed for the blog (helps syndication and faster indexing).
  const rssItems = posts
    .slice(0, 30)
    .map(
      (p) => `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${abs('/blog/' + p.slug + '/')}</link>
      <guid>${abs('/blog/' + p.slug + '/')}</guid>
      <description>${escapeXml(p.description || '')}</description>
      <pubDate>${new Date(p.published || now()).toUTCString()}</pubDate>
    </item>`,
    )
    .join('\n');
  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Vynix Blog</title>
    <link>${abs('/blog/')}</link>
    <description>Practical guides on bug reporting, developer context, and shipping with AI coding agents.</description>
    <language>en</language>
${rssItems}
  </channel>
</rss>
`;
  write(path.join(siteRoot, 'blog', 'rss.xml'), rss);
  write(path.join(siteRoot, 'feed.xml'), rss);

  // A friendly 404 page.
  write(
    path.join(siteRoot, '404.html'),
    listingPage({
      title: 'Page not found',
      description: 'That page could not be found. Browse the Vynix blog, comparisons and help center instead.',
      canonical: '/404.html',
      eyebrow: 'Not found',
      intro: 'We could not find that page. Here are some good places to go next.',
      bodyParas: ['The link may be old or mistyped. Try one of the sections below, or head to the product.'],
      cards: [
        card('/blog/', 'Blog', 'Guides and how-tos.', pickImage('workflow', 1).url),
        card('/compare/', 'Compare', 'Vynix vs other tools.', pickImage('diagnosis', 2).url),
        card('/best/', 'Guides', 'Best tools and alternatives.', pickImage('files', 4).url),
      ],
    }),
  );

  const total = urls.length;
  const fixedLinks = fixBrokenLinks(siteRoot);
  log.info('site built', { pages: total, posts: posts.length, comparisons: comps.length, kb: kb.length, listicles: lists.length, usecases: ucs.length, glossary: gloss.length, fixedLinks });
  return { pages: total, blog: posts.length, comparisons: comps.length, kb: kb.length, listicles: lists.length, usecases: ucs.length, fixed_links: fixedLinks, updated: humanDate() };
}

export default { meta, run };
