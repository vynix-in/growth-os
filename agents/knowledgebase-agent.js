// Knowledge Base Agent (Phase 9)
//
// Turns issues, fixes and common questions into sanitized, search-optimised
// help articles rendered as full HTML pages with breadcrumbs, an FAQ schema,
// a real product image, and a generated Open Graph card. Customer-identifying
// detail is stripped before generation and the page is scanned by the gate.
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
import { headMeta, faqLd, breadcrumbLd } from '../lib/seo.js';
import { pickImage, makeOgImage } from '../lib/images.js';
import { slug as toSlug, humanDate, now } from '../lib/util.js';

const log = logger('knowledgebase');
const store = db('knowledgebase');

export const meta = { id: 'knowledgebase', name: 'Knowledge Base Agent' };

const SEED_TOPICS = [
  { title: 'How to install the Vynix widget on any website', type: 'guide', q: 'How do I add Vynix to my site?', theme: 'install widget setup' },
  { title: 'What context Vynix captures with each report', type: 'article', q: 'What information is in a Vynix report?', theme: 'context console network' },
  { title: 'How the Vynix AI diagnosis works', type: 'article', q: 'How does the Vynix AI diagnosis work?', theme: 'diagnosis ai root-cause' },
  { title: 'Turning a Vynix note into a GitHub issue', type: 'guide', q: 'How do I create a GitHub issue from Vynix?', theme: 'github issue handoff' },
  { title: 'Controlling who can see the Vynix widget', type: 'guide', q: 'How do I limit who sees the widget?', theme: 'install widget' },
  { title: 'Using review rounds to group feedback into fixes', type: 'guide', q: 'What are review rounds in Vynix?', theme: 'loop review workflow' },
  { title: 'Fixing a widget that does not appear', type: 'troubleshooting', q: 'Why is the Vynix widget not showing up?', theme: 'install widget' },
  { title: 'Fixing a report with no screenshot', type: 'troubleshooting', q: 'Why is there no screenshot on my report?', theme: 'capture screenshot' },
];

function sanitizeInput(text) {
  return String(text || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email removed]')
    .replace(/\bhttps?:\/\/(?!vynix\.in)[^\s)]+/g, '[link removed]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip removed]');
}

function fallbackArticle(topic) {
  return {
    title: topic.title,
    metaDescription: `${topic.title}. A short, practical help article from Vynix.`,
    intro: `This article explains ${topic.title.toLowerCase()}.`,
    steps: ['Open your Vynix project.', 'Follow the on-screen guidance.', 'Check the documentation if you need more detail.'],
    body: [`Vynix is a website annotation and developer-context tool. ${product.what}`],
    faqs: [{ q: topic.q, a: `See the Vynix documentation at ${product.docs} for full detail.` }],
  };
}

async function writeArticle(topic) {
  const cleanQ = sanitizeInput(topic.q);
  const fb = fallbackArticle(topic);
  const { value, source } = await completeJson({
    system:
      'You write clear, calm help-centre articles for a developer tool. Plain language, short steps. Never include customer names, emails, IP addresses, or internal system names. If unsure of an exact detail, describe it generally and refer to the docs. Return only valid JSON.',
    prompt: `Write a knowledge base ${topic.type} for Vynix titled "${topic.title}". It should answer: "${cleanQ}".

About Vynix: ${product.what}
Docs: ${product.docs}

Return JSON:
{
  "title": "${topic.title}",
  "metaDescription": "under 155 chars",
  "intro": "1-2 sentence intro",
  "steps": ["step", "step"],
  "body": ["paragraph", "paragraph"],
  "faqs": [ { "q": "question", "a": "answer" } ]
}
Keep it under 400 words. Include 3-6 steps where it makes sense and 2 FAQs. Return JSON only.`,
    maxTokens: 1400,
    fallback: () => JSON.stringify(fb),
    defaultValue: fb,
  });
  return { article: value || fb, source };
}

function renderBody(topic, article, assets, slug) {
  const steps = (article.steps || []).length ? `<ol>${article.steps.map((s) => `<li>${s}</li>`).join('')}</ol>` : '';
  const paras = (article.body || []).map((p) => `<p>${p}</p>`).join('');
  const faqHtml = (article.faqs || []).length
    ? `<section class="faq"><h2>Related questions</h2>${article.faqs.map((f) => `<h3>${f.q}</h3><p>${f.a}</p>`).join('')}</section>`
    : '';

  return `<main class="container">
${breadcrumbsHtml([
  { name: 'Home', url: product.website },
  { name: 'Help', url: '/kb/' },
  { name: article.title, url: `/kb/${slug}/` },
])}
<article>
  <span class="tag">${topic.type}</span>
  <h1>${article.title}</h1>
  <div class="meta-row"><span>Updated ${humanDate(assets.updated)}</span></div>
  <p class="lead">${article.intro}</p>
  ${steps}
  ${paras}
  <figure><img src="${assets.hero.url}" alt="${assets.hero.alt}" loading="lazy" width="1080" height="1350" /><figcaption>${assets.hero.alt}</figcaption></figure>
  ${faqHtml}
  <div class="callout"><strong>Still need help?</strong><p>Read the full <a href="${product.docs}">documentation</a> or email hello@vynix.in.</p></div>
</article>
</main>`;
}

async function buildArticle(topic) {
  const { article, source } = await writeArticle(topic);
  const slug = toSlug(article.title);
  const updated = now();
  const hero = pickImage(topic.theme, slug.length);
  const ogImage = makeOgImage(slug, article.title, 'Vynix Help');
  const assets = { hero, updated, ogImage };

  const body = renderBody(topic, article, assets, slug);
  const head = [
    headMeta({
      title: `${article.title} | Vynix Help`,
      description: article.metaDescription,
      canonical: `/kb/${slug}/`,
      ogImage,
      type: 'article',
      published: updated,
      modified: updated,
    }),
    breadcrumbLd([
      { name: 'Home', url: product.website },
      { name: 'Help', url: '/kb/' },
      { name: article.title, url: `/kb/${slug}/` },
    ]),
    faqLd(article.faqs),
  ].join('\n');

  const html = renderPage({ head, body });
  const scan = scanText(html, `kb/${slug}`);
  const safe = scan.clean;

  const dir = path.join(paths.content, 'site', 'kb', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);

  const record = store.upsert(
    {
      key: slug,
      title: article.title,
      type: topic.type,
      slug,
      url: `/kb/${slug}`,
      og_image: ogImage,
      path: path.relative(paths.content, dir),
      status: safe ? 'ready' : 'blocked',
      gate_clean: safe,
      ai_source: source,
      updated,
    },
    'key',
  );

  queue.add('kb-publish', { title: article.title, url: record.url }, { agent: 'knowledgebase', approval: APPROVAL.PENDING, priority: 4 });
  return record;
}

export async function run(payload = {}) {
  let topics = SEED_TOPICS;
  if (payload.items && payload.items.length) {
    topics = payload.items.map((it) => ({ title: it.title, type: 'troubleshooting', q: sanitizeInput(it.issue || it.title), theme: it.theme || 'debug' }));
  }
  const built = [];
  for (const topic of topics) {
    built.push(await buildArticle(topic));
  }
  log.info(`built ${built.length} knowledge base articles`);
  return { built: built.length };
}

export default { meta, run };
