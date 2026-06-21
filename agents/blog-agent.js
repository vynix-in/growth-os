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
import { humanizeDeep } from '../lib/humanize.js';
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
// used to pick the matching real image and clip. Some carry extra guidance so
// the model stays accurate on plans and roadmap.
const TOPICS = [
  { title: 'How to write bug reports an AI coding agent can fix', theme: 'context handoff agent', clip: true },
  { title: 'The context an AI agent needs to fix a front-end bug', theme: 'context console network debug', clip: true },
  { title: 'What a feedback layer is, and why AI teams need one', theme: 'loop workflow review', clip: false },
  { title: 'Turn a visual note into a GitHub issue in one step', theme: 'github issue handoff', clip: true },
  { title: 'How Vynix captures console and network detail for you', theme: 'console network debug', clip: false },
  { title: 'Using the Vynix MCP server with your AI agent', theme: 'mcp agent ai', clip: true },
  { title: 'From a reported bug to a merged fix, start to finish', theme: 'loop workflow fix', clip: true },
  { title: 'Collecting website feedback from clients and teammates', theme: 'annotate review viewport', clip: false },
  { title: 'How Vynix works, from a click to a fix', theme: 'point capture workflow', clip: true },
  { title: 'Who Vynix is for, and the problems it solves', theme: 'review workflow', clip: false },
  { title: 'Point and click feedback on any web page', theme: 'annotate point capture', clip: true },
  { title: 'Reading the Vynix AI diagnosis and the files it finds', theme: 'diagnosis ai files', clip: false },
  { title: 'Review rounds: turn a pile of notes into a short fix list', theme: 'review loop workflow', clip: false },
  { title: 'Region and element screenshots in Vynix', theme: 'screenshot region capture', clip: true },
  { title: 'Projects, roles and sharing in Vynix', theme: 'review workflow', clip: false },
  {
    title: 'How Vynix cuts the cost of running AI coding agents',
    theme: 'context diagnosis agent',
    clip: false,
    guidance:
      'Explain how giving an agent the right context up front (element, page state, console, network, AI diagnosis) means fewer wasted agent runs, shorter prompts, and less trial and error, which lowers token spend and engineer time. Do not invent specific dollar figures or savings percentages.',
  },
  { title: 'How to install Vynix on any website', theme: 'install widget setup', clip: false },
  { title: 'How to connect GitHub and hand work to Copilot', theme: 'github handoff agent', clip: true },
  {
    title: 'Vynix plans, and how to pick the right one',
    theme: 'review workflow',
    clip: false,
    guidance:
      'Describe the plans at a high level only: there is a free plan, and paid plans add more. Do not state exact prices or credit numbers, since those can change. Tell the reader to check vynix.in/pricing for current details.',
  },
  {
    title: 'What we are building next at Vynix',
    theme: 'loop workflow',
    clip: false,
    guidance:
      'Talk about general directions (deeper agent workflows, more integrations, richer feedback context) without promising specific features or dates. Point readers to the changelog at vynix.in for what has actually shipped.',
  },
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
      'You are an experienced software writer producing an original, genuinely useful blog article for a developer-tool company. Write in plain, specific English the way a real person types: use commas, periods, and ordinary hyphens. Never use an em-dash or any dash that is not on a standard keyboard. Use straight quotes, not curly ones. No marketing fluff, no keyword stuffing, no filler, and avoid stock phrases like "in today\'s fast-paced world", "seamless", "robust", "leverage", "delve" and "moreover". Use concrete examples. The article must be unique and substantial. Return only valid JSON.',
    prompt: `Write a blog article for Vynix.

About Vynix: ${product.what}
Article title: "${topic.title}"
${topic.guidance ? `Important guidance: ${topic.guidance}` : ''}

Return JSON with exactly these keys:
{
  "title": "the title, refined if needed (under 65 characters)",
  "metaDescription": "a compelling meta description under 155 characters",
  "intro": "2-3 sentence introduction (plain text)",
  "sections": [ { "heading": "H2 heading", "paragraphs": ["para", "para"], "bullets": ["optional bullet", "..."] } ],
  "faqs": [ { "q": "question", "a": "answer" } ],
  "keyTakeaways": ["takeaway", "takeaway", "takeaway"]
}

Write 5 to 7 sections totalling roughly 1000-1400 words. Make at least two sections have bullets. Include 3 FAQs. Be accurate about Vynix and never invent features, prices, or numbers that contradict the description or the guidance. Do not include any HTML. Return JSON only.`,
    maxTokens: 2600,
    fallback: () => JSON.stringify(fb),
    defaultValue: fb,
  });
  return { article: humanizeDeep(value || fb), source };
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
    ? `<figure><video controls preload="none" poster="${assets.clip.poster}" width="1080" height="1350"><source src="${assets.clip.url}" type="video/mp4" /></video><figcaption>${assets.clip.title}: see Vynix in action</figcaption></figure>`
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

  // On a full run, remove any blog page that is no longer in the topic set, so
  // renamed or dropped posts never linger as orphans.
  let removed = 0;
  if (!payload.only) {
    const valid = new Set(built.map((b) => b.slug));
    for (const rec of store.find({ kind: 'blog' })) {
      if (!valid.has(rec.slug)) {
        const dir = path.join(paths.content, 'site', 'blog', rec.slug);
        if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
        store.remove({ id: rec.id });
        removed += 1;
      }
    }
  }

  log.info(`built ${built.length} blog posts`, { removed_orphans: removed });
  return { built: built.length, removed_orphans: removed, posts: built.map((b) => b.url) };
}

export default { meta, run };
