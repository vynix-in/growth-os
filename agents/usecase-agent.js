// Use-case Agent
//
// Builds persona landing pages: "Vynix for agencies", "for QA teams", and so on.
// These pages speak to one audience, name their problem, and show how Vynix
// helps, which converts far better than a generic page. Each carries Article,
// FAQ and Breadcrumb structured data and links to the relevant blog posts.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { completeJson } from '../lib/ai.js';
import { humanizeDeep } from '../lib/humanize.js';
import { scanText } from '../lib/publication-gate.js';
import { product, features } from '../lib/vynix-facts.js';
import { renderPage, breadcrumbsHtml } from '../lib/page.js';
import { headMeta, faqLd, breadcrumbLd, articleLd } from '../lib/seo.js';
import { pickImage, makeOgImage } from '../lib/images.js';
import { now, humanDate } from '../lib/util.js';

const log = logger('usecase');
const store = db('usecases');

export const meta = { id: 'usecase', name: 'Use-case Agent' };

const PERSONAS = [
  { slug: 'agencies', title: 'Vynix for agencies', who: 'web and design agencies collecting client feedback on staging and live sites', theme: 'annotate review viewport' },
  { slug: 'qa-teams', title: 'Vynix for QA teams', who: 'QA and test engineers who file reproducible bugs', theme: 'console network debug' },
  { slug: 'startups', title: 'Vynix for startups and founders', who: 'small teams and founders shipping fast with AI coding agents', theme: 'loop workflow handoff' },
  { slug: 'designers', title: 'Vynix for product designers', who: 'designers reviewing live work and leaving precise feedback', theme: 'annotate point review' },
  { slug: 'ai-developers', title: 'Vynix for developers using AI agents', who: 'engineers who build with Copilot, Claude or Cursor', theme: 'mcp agent diagnosis handoff' },
  { slug: 'support-teams', title: 'Vynix for support teams', who: 'support and success teams turning user reports into clear bug tickets', theme: 'context capture handoff' },
];

function fallback(p) {
  return {
    title: p.title,
    metaDescription: `${p.title}. See how ${p.who} use Vynix to capture feedback with context and ship fixes faster.`,
    intro: `Vynix helps ${p.who} capture feedback that already has the context needed to act on it.`,
    problem: `Feedback from ${p.who} often loses the detail that makes it fixable, which means slow back and forth and missed issues.`,
    sections: [
      { heading: 'How Vynix helps', paragraphs: [`Vynix captures the element, the page state, and the developer context with every note, then adds an AI diagnosis and a path to a coding agent.`] },
    ],
    benefits: features.slice(0, 4).map((f) => `${f.title}: ${f.blurb}`),
    faqs: [
      { q: `Is Vynix a good fit for ${p.who}?`, a: 'Yes. It installs on any site with one script tag, has a free plan, and gives every report the context an engineer or an AI agent needs.' },
      { q: 'How long does it take to set up?', a: 'A few minutes. Add one script tag, open a page, and capture your first report.' },
    ],
  };
}

async function buildAngle(p) {
  const fb = fallback(p);
  const { value, source } = await completeJson({
    system:
      'You write focused, honest landing pages for one audience at a time. Be specific about their real problems. No hype, no invented features. Write the way a person types: commas, periods, plain hyphens, straight quotes. Never use an em-dash or curly quotes. Return only valid JSON.',
    prompt: `Write a landing page titled "${p.title}" for ${p.who}.

About Vynix: ${product.what}
Vynix features: ${features.map((f) => f.title).join(', ')}.

Return JSON:
{
  "title": "${p.title}",
  "metaDescription": "under 155 chars",
  "intro": "2 sentence intro that names the audience",
  "problem": "2-3 sentences on the specific problem this audience faces",
  "sections": [ { "heading": "H2", "paragraphs": ["para", "para"] } ],
  "benefits": ["benefit tied to a feature", "..."],
  "faqs": [ { "q": "question", "a": "answer" } ]
}
Write 2-3 sections, 4-5 benefits, and 3 FAQs. Be accurate about Vynix. Return JSON only.`,
    maxTokens: 1500,
    fallback: () => JSON.stringify(fb),
    defaultValue: fb,
  });
  return { angle: humanizeDeep(value || fb), source };
}

function renderBody(p, angle, assets) {
  const sections = (angle.sections || []).map((s) => `<section><h2>${s.heading}</h2>${(s.paragraphs || []).map((x) => `<p>${x}</p>`).join('')}</section>`).join('\n');
  const benefits = (angle.benefits || []).length ? `<h2>What you get</h2><ul>${angle.benefits.map((b) => `<li>${b}</li>`).join('')}</ul>` : '';
  const faqHtml = (angle.faqs || []).length ? `<section class="faq"><h2>Frequently asked questions</h2>${angle.faqs.map((f) => `<h3>${f.q}</h3><p>${f.a}</p>`).join('')}</section>` : '';
  return `<main class="container">
${breadcrumbsHtml([
  { name: 'Home', url: product.website },
  { name: 'Use cases', url: '/for/' },
  { name: p.title, url: `/for/${p.slug}/` },
])}
<article>
  <h1>${p.title}</h1>
  <p class="lead">${angle.intro}</p>
  <figure class="hero"><img src="${assets.hero.url}" alt="${assets.hero.alt}" width="1080" height="1350" /><figcaption>${assets.hero.alt}</figcaption></figure>
  <h2>The problem</h2>
  <p>${angle.problem}</p>
  ${sections}
  ${benefits}
  ${faqHtml}
  <div class="callout"><strong>Try it on your own site</strong><p>One script tag, a free plan, and your first report in a minute.</p><a class="cta" href="${product.website}">Get started free</a></div>
</article>
</main>`;
}

async function buildPage(p) {
  const { angle, source } = await buildAngle(p);
  const updated = now();
  const hero = pickImage(p.theme, p.slug.length);
  const ogImage = makeOgImage(`for-${p.slug}`, p.title, 'Use case');
  const assets = { hero, updated, ogImage };

  const body = renderBody(p, angle, assets);
  const head = [
    headMeta({
      title: `${p.title}: feedback with context | Vynix`,
      description: angle.metaDescription,
      canonical: `/for/${p.slug}/`,
      ogImage,
      type: 'article',
      published: updated,
      modified: updated,
      keywords: `${p.title.toLowerCase()}, ${p.who}, bug reporting, visual feedback`,
    }),
    articleLd({ title: p.title, description: angle.metaDescription, canonical: `/for/${p.slug}/`, image: ogImage, published: updated }),
    breadcrumbLd([
      { name: 'Home', url: product.website },
      { name: 'Use cases', url: '/for/' },
      { name: p.title, url: `/for/${p.slug}/` },
    ]),
    faqLd(angle.faqs),
  ].join('\n');

  const html = renderPage({ head, body });
  const scan = scanText(html, `for/${p.slug}`);
  const outDir = path.join(paths.content, 'site', 'for', p.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  const record = store.upsert(
    {
      key: p.slug,
      title: p.title,
      slug: p.slug,
      url: `/for/${p.slug}`,
      og_image: ogImage,
      path: path.relative(paths.content, outDir),
      status: scan.clean ? 'ready' : 'blocked',
      ai_source: source,
      updated,
    },
    'key',
  );

  queue.add('content-publish', { kind: 'usecase', title: p.title, url: record.url }, { agent: 'usecase', approval: scan.clean ? APPROVAL.PENDING : APPROVAL.REJECTED, priority: 3 });
  log.info(`built use-case "${p.slug}"`, { status: record.status, source });
  return record;
}

export async function run(payload = {}) {
  const targets = payload.only ? PERSONAS.filter((p) => p.slug === payload.only) : PERSONAS;
  const built = [];
  for (const p of targets) built.push(await buildPage(p));
  log.info(`built ${built.length} use-case pages`);
  return { built: built.length, pages: built.map((b) => b.url) };
}

export default { meta, run };
