// Comparison Page Agent (Phase 8)
//
// Generates and updates "X vs Vynix" comparison pages as full, search-optimised
// HTML. Each page has unique, accurate content written with gpt-5.5, a real
// product image, a comparison table, an FAQ with schema, breadcrumbs, and a
// generated Open Graph card. The system supports hundreds of pages: add a
// competitor to the facts file and a page is produced for it.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { completeJson } from '../lib/ai.js';
import { scanText } from '../lib/publication-gate.js';
import { competitors, product, features } from '../lib/vynix-facts.js';
import { renderPage, breadcrumbsHtml } from '../lib/page.js';
import { headMeta, faqLd, breadcrumbLd, softwareApplicationLd } from '../lib/seo.js';
import { pickImage, makeOgImage } from '../lib/images.js';
import { humanDate, now } from '../lib/util.js';

const log = logger('comparison');
const store = db('comparisons');

export const meta = { id: 'comparison', name: 'Comparison Page Agent' };

function defaultAngle(competitor) {
  return {
    title: `${competitor.name} vs Vynix`,
    metaDescription: `A neutral, accurate comparison of ${competitor.name} and Vynix for teams that want visual feedback with developer context and AI diagnosis.`,
    intro: `${competitor.name} is known for ${competitor.focus}. Vynix takes a different angle: it captures visual feedback with full developer context and an AI diagnosis, then hands the work to a coding agent. This page compares the two so you can choose the right tool for your team.`,
    sections: [
      { heading: `What ${competitor.name} does well`, paragraphs: [`${competitor.name} focuses on ${competitor.focus}. If that matches your main need, it is a solid choice.`] },
      { heading: 'Where Vynix is different', paragraphs: ['Vynix attaches an AI diagnosis to every report and gives you a one-click path to a GitHub issue or an AI coding agent, so feedback turns into a fix faster.'] },
    ],
    whenCompetitor: `Choose ${competitor.name} when your main need is ${competitor.focus} and you already have a workflow for turning reports into code changes.`,
    whenVynix: 'Choose Vynix when you want every report to arrive with developer context, an AI diagnosis, and a direct handoff to a coding agent.',
    rows: features.map((f) => ({ capability: f.title, vynix: 'Yes', competitor: 'Varies', note: f.blurb })),
    faqs: [
      { q: `Is Vynix a replacement for ${competitor.name}?`, a: `It can be, depending on your needs. Vynix focuses on visual feedback with developer context and AI diagnosis, then hands the work to a coding agent.` },
      { q: 'Does Vynix have a free plan?', a: 'Yes. Vynix has a free plan, and you can install it on any site with one script tag.' },
    ],
  };
}

async function buildAngle(competitor) {
  const fb = defaultAngle(competitor);
  const { value, source } = await completeJson({
    system:
      'You write fair, accurate, original software comparison pages. Never make false or unverifiable claims about a competitor. When unsure about a competitor capability, say it varies or depends on the plan. Keep a neutral, factual tone and avoid keyword stuffing. Return only valid JSON.',
    prompt: `Produce JSON for a unique comparison page "${competitor.name} vs Vynix".

About Vynix: ${product.what}
Vynix key capabilities: ${features.map((f) => f.title).join(', ')}.
About ${competitor.name}: known for ${competitor.focus} (category: ${competitor.category}).

Return JSON:
{
  "title": "${competitor.name} vs Vynix",
  "metaDescription": "neutral meta description under 155 chars",
  "intro": "2-3 sentence neutral introduction",
  "sections": [ { "heading": "H2", "paragraphs": ["para", "para"] } ],
  "whenCompetitor": "one sentence on when ${competitor.name} fits",
  "whenVynix": "one sentence on when Vynix fits",
  "rows": [ { "capability": "string", "vynix": "Yes|Partial|No", "competitor": "Yes|Partial|No|Varies", "note": "short neutral note" } ],
  "faqs": [ { "q": "question", "a": "answer" } ]
}
Write 3-4 short sections, 6-8 table rows, and 3 FAQs. Do not claim a competitor lacks a feature unless it is widely known. Return JSON only.`,
    maxTokens: 1800,
    fallback: () => JSON.stringify(fb),
    defaultValue: fb,
  });
  return { angle: value || fb, source };
}

function renderBody(competitor, angle, assets) {
  const rows = (angle.rows || [])
    .map((r) => `<tr><td>${r.capability}</td><td class="yes">${r.vynix}</td><td>${r.competitor}</td><td>${r.note}</td></tr>`)
    .join('\n');
  const sections = (angle.sections || [])
    .map((s) => `<section><h2>${s.heading}</h2>${(s.paragraphs || []).map((p) => `<p>${p}</p>`).join('')}</section>`)
    .join('\n');
  const faqHtml = (angle.faqs || []).length
    ? `<section class="faq"><h2>Frequently asked questions</h2>${angle.faqs.map((f) => `<h3>${f.q}</h3><p>${f.a}</p>`).join('')}</section>`
    : '';

  return `<main class="container">
${breadcrumbsHtml([
  { name: 'Home', url: product.website },
  { name: 'Compare', url: '/compare/' },
  { name: `${competitor.name} vs Vynix`, url: `/compare/${competitor.slug}-vs-vynix/` },
])}
<article>
  <h1>${competitor.name} vs Vynix</h1>
  <div class="meta-row"><span>Updated ${humanDate(assets.updated)}</span><span>&middot;</span><span>Maintained by the Vynix Team</span></div>
  <p class="lead">${angle.intro}</p>
  <figure class="hero"><img src="${assets.hero.url}" alt="${assets.hero.alt}" width="1080" height="1350" /><figcaption>${assets.hero.alt}</figcaption></figure>
  <h2>At a glance</h2>
  <table>
    <thead><tr><th>Capability</th><th>Vynix</th><th>${competitor.name}</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  ${sections}
  <h2>When ${competitor.name} fits</h2><p>${angle.whenCompetitor}</p>
  <h2>When Vynix fits</h2><p>${angle.whenVynix}</p>
  ${faqHtml}
  <div class="callout">
    <strong>See the difference yourself</strong>
    <p>Install Vynix on your site in a minute and capture your first report with full developer context.</p>
    <a class="cta" href="${product.website}">Try Vynix free</a>
  </div>
  <p><em>This comparison is maintained by the Vynix team and updated regularly. If something about ${competitor.name} is inaccurate, email hello@vynix.in.</em></p>
</article>
</main>`;
}

async function buildPage(competitor) {
  const { angle, source } = await buildAngle(competitor);
  const slug = `${competitor.slug}-vs-vynix`;
  const updated = now();
  const hero = pickImage('diagnosis handoff loop', slug.length);
  const ogImage = makeOgImage(slug, `${competitor.name} vs Vynix`, 'Compare');
  const assets = { hero, updated, ogImage };

  const body = renderBody(competitor, angle, assets);
  const head = [
    headMeta({
      title: `${competitor.name} vs Vynix: an honest comparison`,
      description: angle.metaDescription,
      canonical: `/compare/${slug}/`,
      ogImage,
      type: 'article',
      published: updated,
      modified: updated,
      keywords: `${competitor.name} vs vynix, ${competitor.name} alternative, visual feedback, bug reporting`,
    }),
    softwareApplicationLd(),
    breadcrumbLd([
      { name: 'Home', url: product.website },
      { name: 'Compare', url: '/compare/' },
      { name: `${competitor.name} vs Vynix`, url: `/compare/${slug}/` },
    ]),
    faqLd(angle.faqs),
  ].join('\n');

  const html = renderPage({ head, body });
  const scan = scanText(html, `compare/${slug}`);

  const dir = path.join(paths.content, 'site', 'compare', slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);

  const record = store.upsert(
    {
      key: competitor.slug,
      competitor: competitor.name,
      slug,
      url: `/compare/${slug}`,
      og_image: ogImage,
      path: path.relative(paths.content, dir),
      status: scan.clean ? 'ready' : 'blocked',
      gate_violations: scan.violations,
      ai_source: source,
      updated,
    },
    'key',
  );

  queue.add(
    'comparison-publish',
    { competitor: competitor.name, url: record.url },
    { agent: 'comparison', approval: scan.clean ? APPROVAL.PENDING : APPROVAL.REJECTED, priority: 2 },
  );

  log.info(`built comparison "${slug}"`, { status: record.status, source });
  return record;
}

export async function run(payload = {}) {
  const targets = payload.only ? competitors.filter((c) => c.slug === payload.only) : competitors;
  const built = [];
  for (const competitor of targets) {
    built.push(await buildPage(competitor));
  }
  log.info(`built ${built.length} comparison pages`);
  return { built: built.length, pages: built.map((r) => r.url) };
}

export default { meta, run };
