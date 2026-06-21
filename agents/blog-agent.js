// Blog Agent
//
// Writes in-depth, original blog articles with gpt-5.5 and renders each one as
// a complete, search-optimised HTML page: a real hero image and product clip
// from the Vynix media library, a table of contents, an FAQ with FAQ schema,
// Article and Breadcrumb structured data, internal links to related pages, and
// a generated Open Graph card. Articles are substantial and genuinely useful,
// which is what keeps them safe from thin-content and spam penalties.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { completeJson } from '../lib/ai.js';
import { scanText } from '../lib/publication-gate.js';
import { product } from '../lib/vynix-facts.js';
import { renderPage, breadcrumbsHtml } from '../lib/page.js';
import { headMeta, articleLd, faqLd, breadcrumbLd, videoLd } from '../lib/seo.js';
import { pickImage, pickClip, makeOgImage } from '../lib/images.js';
import { slug as toSlug, humanDate, now } from '../lib/util.js';

const log = logger('blog');
const store = db('content');
const comparisons = db('comparisons');

export const meta = { id: 'blog', name: 'Blog Agent' };

// High-value, genuinely useful topics for the Vynix audience. Each has a theme
// used to pick the matching real image and clip.
const TOPICS = [
  { title: 'How to write bug reports that AI coding agents can actually fix', theme: 'context handoff agent', clip: true },
  { title: 'The context an AI coding agent needs to fix a front-end bug', theme: 'context console network debug', clip: true },
  { title: 'What is a feedback layer, and why teams building with AI need one', theme: 'loop workflow review', clip: false },
  { title: 'From a visual note to a GitHub issue in one step', theme: 'github issue handoff', clip: true },
  { title: 'Automatic console and network capture for bug reports', theme: 'console network debug', clip: false },
  { title: 'Using MCP to let AI agents read your bug reports', theme: 'mcp agent ai', clip: true },
  { title: 'Closing the loop: from a reported bug to a merged fix', theme: 'loop workflow fix', clip: true },
  { title: 'Collecting visual website feedback from clients and stakeholders', theme: 'annotate review viewport', clip: false },
];

function fallbackArticle(topic) {
  return {
    title: topic.title,
    metaDescription: `${topic.title}. A practical guide from Vynix on capturing feedback with the context engineers and AI agents need.`,
    intro:
      'Most bug reports lose the one thing that makes them fixable: context. This guide walks through how to capture feedback that carries the element, the page state, and the developer signals an engineer or an AI coding agent needs to act on it.',
    sections: [
      {
        heading: 'Why context is the missing piece',
        paragraphs: [
          'A screenshot and a sentence rarely tell you what went wrong. The person who has to fix the issue still needs to know which element, which page state, and which errors were on screen at the moment the problem appeared.',
          'Vynix captures that context automatically, so the report arrives ready to act on instead of starting a back-and-forth.',
        ],
      },
      {
        heading: 'What a good report contains',
        paragraphs: ['A report that an AI coding agent can act on includes the element selector, the page URL, a screenshot, and a privacy-safe capture of the console and network activity.'],
        bullets: ['The exact element and its selector', 'The page URL and viewport', 'Console errors and failed network calls', 'A short, specific description'],
      },
      {
        heading: 'Handing the report to an agent',
        paragraphs: ['Once the context is captured, Vynix turns it into a clean prompt or a GitHub issue you can assign to a coding agent, so the fix starts immediately.'],
      },
    ],
    faqs: [
      { q: 'Does Vynix capture sensitive data?', a: 'Vynix captures metadata such as the element, the page URL, console errors, and network call paths. It does not capture request bodies or headers.' },
      { q: 'Which AI agents work with Vynix?', a: 'Any agent you use. Vynix produces a ready-to-build prompt and can open a GitHub issue you assign to Copilot or your own workflow.' },
    ],
    keyTakeaways: [
      'Context is what makes a bug report fixable.',
      'Capture the element, page state, console, and network automatically.',
      'Hand the report to an AI agent as a prompt or a GitHub issue.',
    ],
  };
}

async function writeArticle(topic) {
  const fb = fallbackArticle(topic);
  const { value, source } = await completeJson({
    system:
      'You are an experienced software writer producing an original, genuinely useful blog article for a developer-tool company. Write in plain, specific English. No marketing fluff, no keyword stuffing, no filler. Use concrete examples. The article must be unique and substantial. Return only valid JSON.',
    prompt: `Write a blog article for Vynix.

About Vynix: ${product.what}
Article title: "${topic.title}"

Return JSON with exactly these keys:
{
  "title": "the title, refined if needed (under 65 characters)",
  "metaDescription": "a compelling meta description under 155 characters",
  "intro": "2-3 sentence introduction (plain text)",
  "sections": [ { "heading": "H2 heading", "paragraphs": ["para", "para"], "bullets": ["optional bullet", "..."] } ],
  "faqs": [ { "q": "question", "a": "answer" } ],
  "keyTakeaways": ["takeaway", "takeaway", "takeaway"]
}

Write 5 to 7 sections totalling roughly 1000-1400 words. Make at least two sections have bullets. Include 3 FAQs. Be accurate about Vynix and never invent features that contradict the description. Do not include any HTML. Return JSON only.`,
    maxTokens: 2600,
    fallback: () => JSON.stringify(fb),
    defaultValue: fb,
  });
  return { article: value || fb, source };
}

function readingTime(article) {
  const text = [article.intro, ...(article.sections || []).flatMap((s) => [...(s.paragraphs || []), ...(s.bullets || [])])].join(' ');
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(2, Math.round(words / 200));
}

function sectionId(heading, i) {
  return `s${i + 1}-${toSlug(heading).slice(0, 30)}`;
}

function relatedLinks(currentSlug) {
  const comps = comparisons.all().slice(0, 3).map((c) => `<li><a href="${c.url}/">${c.competitor} vs Vynix</a></li>`);
  const posts = store
    .find({ kind: 'blog' })
    .filter((p) => p.slug !== currentSlug)
    .slice(0, 3)
    .map((p) => `<li><a href="/blog/${p.slug}/">${p.title}</a></li>`);
  const items = [...posts, ...comps].slice(0, 5);
  if (!items.length) return '';
  return `<h2>Keep reading</h2><ul>${items.join('')}</ul>`;
}

function renderArticleBody(topic, article, assets, slug) {
  const rt = readingTime(article);
  const toc = (article.sections || [])
    .map((s, i) => `<li><a href="#${sectionId(s.heading, i)}">${s.heading}</a></li>`)
    .join('');

  const sectionsHtml = (article.sections || [])
    .map((s, i) => {
      const paras = (s.paragraphs || []).map((p) => `<p>${p}</p>`).join('');
      const bullets = s.bullets && s.bullets.length ? `<ul>${s.bullets.map((b) => `<li>${b}</li>`).join('')}</ul>` : '';
      // Drop a real product image mid-article for visual proof.
      const inlineImg =
        i === 1 && assets.midImage
          ? `<figure><img src="${assets.midImage.url}" alt="${assets.midImage.alt}" loading="lazy" width="1080" height="1350" /><figcaption>${assets.midImage.alt}</figcaption></figure>`
          : '';
      return `<section id="${sectionId(s.heading, i)}"><h2>${s.heading}</h2>${paras}${bullets}${inlineImg}</section>`;
    })
    .join('\n');

  const clipHtml = assets.clip
    ? `<figure><video controls preload="none" poster="${assets.clip.poster}" width="1080" height="1350"><source src="${assets.clip.url}" type="video/mp4" /></video><figcaption>${assets.clip.title} — see Vynix in action</figcaption></figure>`
    : '';

  const takeaways = (article.keyTakeaways || []).length
    ? `<div class="callout"><strong>Key takeaways</strong><ul>${article.keyTakeaways.map((t) => `<li>${t}</li>`).join('')}</ul></div>`
    : '';

  const faqHtml = (article.faqs || []).length
    ? `<section class="faq"><h2>Frequently asked questions</h2>${article.faqs
        .map((f) => `<h3>${f.q}</h3><p>${f.a}</p>`)
        .join('')}</section>`
    : '';

  return `<main class="container">
${breadcrumbsHtml([
  { name: 'Home', url: product.website },
  { name: 'Blog', url: '/blog/' },
  { name: article.title, url: `/blog/${slug}/` },
])}
<article>
  <h1>${article.title}</h1>
  <div class="meta-row">
    <span>By the Vynix Team</span>
    <span>&middot;</span>
    <time datetime="${assets.published}">${humanDate(assets.published)}</time>
    <span>&middot;</span>
    <span>${rt} min read</span>
  </div>
  <p class="lead">${article.intro}</p>
  <figure class="hero"><img src="${assets.hero.url}" alt="${assets.hero.alt}" width="1080" height="1350" /><figcaption>${assets.hero.alt}</figcaption></figure>
  <div class="toc"><strong>On this page</strong><ol>${toc}</ol></div>
  ${sectionsHtml}
  ${clipHtml}
  ${takeaways}
  ${faqHtml}
  <div class="callout">
    <strong>Try Vynix on your own site</strong>
    <p>Install the widget with one script tag, point at a bug, and hand the fix to your coding agent.</p>
    <a class="cta" href="${product.website}">Get started free</a>
  </div>
  ${relatedLinks(slug)}
</article>
</main>`;
}

async function buildPost(topic) {
  const { article, source } = await writeArticle(topic);
  const slug = toSlug(article.title);
  const published = now();

  const hero = pickImage(topic.theme, slug.length);
  const midImage = pickImage(topic.theme + ' files diagnosis', slug.length + 3);
  const clip = topic.clip ? pickClip(topic.theme, slug.length) : null;
  const ogImage = makeOgImage(slug, article.title, 'Vynix Blog');

  const assets = { hero, midImage, clip, published, ogImage };
  const body = renderArticleBody(topic, article, assets, slug);

  const head = [
    headMeta({
      title: `${article.title} | Vynix`,
      description: article.metaDescription,
      canonical: `/blog/${slug}/`,
      ogImage,
      type: 'article',
      published,
      modified: published,
      keywords: `${topic.theme.split(' ').join(', ')}, vynix, bug reporting, ai coding agents`,
    }),
    articleLd({
      title: article.title,
      description: article.metaDescription,
      canonical: `/blog/${slug}/`,
      image: ogImage,
      published,
    }),
    breadcrumbLd([
      { name: 'Home', url: product.website },
      { name: 'Blog', url: '/blog/' },
      { name: article.title, url: `/blog/${slug}/` },
    ]),
    faqLd(article.faqs),
    clip ? videoLd({ name: clip.title, description: article.metaDescription, thumbnail: clip.poster, contentUrl: clip.url, uploadDate: published }) : '',
  ]
    .filter(Boolean)
    .join('\n');

  const html = renderPage({ head, body });

  // Gate the rendered page before saving.
  const scan = scanText(html, `blog/${slug}`);
  const dir = path.join(paths.content, 'site', 'blog', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);

  const record = store.upsert(
    {
      key: `blog-${slug}`,
      kind: 'blog',
      title: article.title,
      slug,
      description: article.metaDescription,
      url: `/blog/${slug}/`,
      theme: topic.theme,
      hero: hero.url,
      clip: clip?.url || null,
      og_image: ogImage,
      path: path.relative(paths.content, dir),
      status: scan.clean ? 'ready' : 'blocked',
      gate_clean: scan.clean,
      ai_source: source,
      published,
    },
    'key',
  );

  queue.add(
    'content-publish',
    { kind: 'blog', title: article.title, url: record.url, path: record.path },
    { agent: 'blog', approval: scan.clean ? APPROVAL.PENDING : APPROVAL.REJECTED, priority: 3 },
  );

  log.info(`wrote blog post "${slug}"`, { source, status: record.status });
  return record;
}

export async function run(payload = {}) {
  const targets = payload.only ? TOPICS.filter((t) => toSlug(t.title).includes(payload.only)) : TOPICS;
  const built = [];
  for (const topic of targets) {
    built.push(await buildPost(topic));
  }
  log.info(`built ${built.length} blog posts`);
  return { built: built.length, posts: built.map((b) => b.url) };
}

export default { meta, run };
