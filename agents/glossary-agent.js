// Glossary Agent
//
// Builds substantial definition pages for the terms developers search for. Each
// page is a real explainer, not a thin dictionary stub, so it earns its place
// in search and links naturally to the product and the deeper content. Carries
// DefinedTerm and FAQ structured data.
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
import { headMeta, faqLd, breadcrumbLd, definedTermLd } from '../lib/seo.js';
import { pickImage, makeOgImage } from '../lib/images.js';
import { slug as toSlug, humanDate, now } from '../lib/util.js';

const log = logger('glossary');
const store = db('glossary');

export const meta = { id: 'glossary', name: 'Glossary Agent' };

const TERMS = [
  { term: 'Bug report', theme: 'context capture' },
  { term: 'Visual feedback', theme: 'annotate review' },
  { term: 'Session replay', theme: 'review workflow' },
  { term: 'Error monitoring', theme: 'console debug' },
  { term: 'Website annotation', theme: 'annotate point' },
  { term: 'Developer context', theme: 'context console network' },
  { term: 'Root cause analysis', theme: 'diagnosis files' },
  { term: 'Feedback loop', theme: 'loop workflow' },
  { term: 'Issue tracker', theme: 'github handoff' },
  { term: 'AI coding agent', theme: 'agent ai handoff' },
  { term: 'Model Context Protocol (MCP)', theme: 'mcp agent ai' },
  { term: 'Regression', theme: 'debug diagnosis' },
  { term: 'Console error', theme: 'console debug' },
  { term: 'Network request', theme: 'network debug' },
];

function fallback(t) {
  return {
    term: t.term,
    metaDescription: `${t.term}: what it means, why it matters, and how it fits into a modern feedback and debugging workflow.`,
    definition: `${t.term} is a common idea in web development and feedback workflows.`,
    sections: [
      { heading: 'What it means', paragraphs: [`${t.term} comes up often when teams report and fix problems on a website.`] },
      { heading: 'Why it matters', paragraphs: ['Getting this right means fewer misunderstandings and faster fixes.'] },
      { heading: 'How Vynix relates', paragraphs: [`Vynix captures the context that makes ${t.term.toLowerCase()} useful in practice. ${product.what}`] },
    ],
    faqs: [{ q: `What is ${t.term.toLowerCase()}?`, a: `${t.term} is explained above. See the Vynix docs for how it applies in practice.` }],
  };
}

async function buildAngle(t) {
  const fb = fallback(t);
  const { value, source } = await completeJson({
    system:
      'You write clear, substantial glossary entries for a developer audience. Be accurate and specific, not vague. Write the way a person types: commas, periods, plain hyphens, straight quotes. Never use an em-dash or curly quotes. Return only valid JSON.',
    prompt: `Write a glossary entry for the term "${t.term}".

About Vynix (mention it briefly and naturally where it fits): ${product.what}

Return JSON:
{
  "term": "${t.term}",
  "metaDescription": "under 155 chars",
  "definition": "a clear one or two sentence definition",
  "sections": [ { "heading": "H2", "paragraphs": ["para", "para"] } ],
  "faqs": [ { "q": "question", "a": "answer" } ]
}
Write 3-4 sections (what it means, why it matters, common mistakes or examples, how it relates to feedback and fixing bugs) totalling 400-600 words, and 2 FAQs. Return JSON only.`,
    maxTokens: 1400,
    fallback: () => JSON.stringify(fb),
    defaultValue: fb,
  });
  return { angle: humanizeDeep(value || fb), source };
}

function renderBody(t, angle, assets, slug) {
  const sections = (angle.sections || []).map((s) => `<section><h2>${s.heading}</h2>${(s.paragraphs || []).map((x) => `<p>${x}</p>`).join('')}</section>`).join('\n');
  const faqHtml = (angle.faqs || []).length ? `<section class="faq"><h2>Frequently asked questions</h2>${angle.faqs.map((f) => `<h3>${f.q}</h3><p>${f.a}</p>`).join('')}</section>` : '';
  return `<main class="container">
${breadcrumbsHtml([
  { name: 'Home', url: product.website },
  { name: 'Glossary', url: '/glossary/' },
  { name: t.term, url: `/glossary/${slug}/` },
])}
<article>
  <span class="tag">Glossary</span>
  <h1>${t.term}</h1>
  <p class="lead">${angle.definition}</p>
  <figure class="hero"><img src="${assets.hero.url}" alt="${assets.hero.alt}" loading="lazy" width="1080" height="1350" /><figcaption>${assets.hero.alt}</figcaption></figure>
  ${sections}
  ${faqHtml}
  <div class="callout"><strong>See it in practice</strong><p>Vynix captures the context that turns a vague report into a clear fix.</p><a class="cta" href="${product.website}">Try Vynix free</a></div>
</article>
</main>`;
}

async function buildTerm(t) {
  const { angle, source } = await buildAngle(t);
  const slug = toSlug(t.term.replace(/\(.*?\)/g, ''));
  const updated = now();
  const hero = pickImage(t.theme, slug.length);
  const ogImage = makeOgImage(`glossary-${slug}`, t.term, 'Glossary');
  const assets = { hero, updated, ogImage };

  const body = renderBody(t, angle, assets, slug);
  const head = [
    headMeta({
      title: `${t.term}: definition and how it works | Vynix`,
      description: angle.metaDescription,
      canonical: `/glossary/${slug}/`,
      ogImage,
      type: 'article',
      published: updated,
      modified: updated,
      keywords: `${t.term.toLowerCase()}, definition, meaning, bug reporting, developer tools`,
    }),
    definedTermLd({ name: t.term, description: angle.definition, url: `/glossary/${slug}/` }),
    breadcrumbLd([
      { name: 'Home', url: product.website },
      { name: 'Glossary', url: '/glossary/' },
      { name: t.term, url: `/glossary/${slug}/` },
    ]),
    faqLd(angle.faqs),
  ].join('\n');

  const html = renderPage({ head, body });
  const scan = scanText(html, `glossary/${slug}`);
  const outDir = path.join(paths.content, 'site', 'glossary', slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  const record = store.upsert(
    {
      key: slug,
      term: t.term,
      slug,
      url: `/glossary/${slug}`,
      og_image: ogImage,
      path: path.relative(paths.content, outDir),
      status: scan.clean ? 'ready' : 'blocked',
      ai_source: source,
      updated,
    },
    'key',
  );

  queue.add('content-publish', { kind: 'glossary', title: t.term, url: record.url }, { agent: 'glossary', approval: scan.clean ? APPROVAL.PENDING : APPROVAL.REJECTED, priority: 4 });
  log.info(`built glossary "${slug}"`, { status: record.status, source });
  return record;
}

export async function run(payload = {}) {
  let targets = payload.only ? TERMS.filter((t) => toSlug(t.term).includes(payload.only)) : TERMS;
  if (payload.expand) {
    targets = targets.filter((t) => !fs.existsSync(path.join(paths.content, 'site', 'glossary', toSlug(t.term.replace(/\(.*?\)/g, '')), 'index.html')));
  }
  const built = [];
  for (const t of targets) built.push(await buildTerm(t));
  log.info(`built ${built.length} glossary entries`);
  return { built: built.length };
}

export default { meta, run };
