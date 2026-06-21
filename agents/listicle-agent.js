// Listicle Agent
//
// Builds the high commercial-intent pages that people search for when they are
// close to choosing a tool: "best bug reporting tools", "best visual feedback
// tools", and "<competitor> alternatives". These rank for buyer keywords and
// send ready-to-try traffic to Vynix. Every tool is described fairly from known
// facts, Vynix is presented honestly as a strong option, and the page carries
// ItemList and FAQ structured data.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { completeJson } from '../lib/ai.js';
import { humanizeDeep } from '../lib/humanize.js';
import { scanText } from '../lib/publication-gate.js';
import { competitors, product, features } from '../lib/vynix-facts.js';
import { renderPage, breadcrumbsHtml } from '../lib/page.js';
import { headMeta, faqLd, breadcrumbLd, itemListLd } from '../lib/seo.js';
import { pickImage, makeOgImage } from '../lib/images.js';
import { now, humanDate } from '../lib/util.js';

const log = logger('listicle');
const store = db('listicles');

export const meta = { id: 'listicle', name: 'Listicle Agent' };

// The Vynix entry, written from facts so it is always accurate.
const VYNIX_ENTRY = {
  name: 'Vynix',
  best_for: 'teams that want visual feedback with developer context and an AI diagnosis that hands work to a coding agent',
  note:
    'Vynix captures the element, the page state, the console and the network detail, adds an AI diagnosis of the likely cause, and turns it into a prompt or a GitHub issue you can assign to a coding agent. It installs on any site with one script tag and has a free plan.',
  url: product.website,
  isVynix: true,
};

function toolEntries(names) {
  const entries = [VYNIX_ENTRY];
  for (const name of names) {
    const c = competitors.find((x) => x.name === name);
    if (c) entries.push({ name: c.name, best_for: c.focus, note: `${c.name} is known for ${c.focus}.`, url: '', isVynix: false });
  }
  return entries;
}

const PAGES = [
  {
    kind: 'best',
    slug: 'best-bug-reporting-tools',
    title: 'The best bug reporting tools in 2026',
    intro: 'A practical look at the tools teams use to report and fix bugs, and where each one fits.',
    tools: ['Jam', 'Bugsnag', 'Sentry', 'Instabug', 'Usersnap'],
    keyword: 'best bug reporting tools',
  },
  {
    kind: 'best',
    slug: 'best-visual-feedback-tools',
    title: 'The best visual website feedback tools in 2026',
    intro: 'Tools that let people point at a problem on a live page and leave a note, compared.',
    tools: ['Marker.io', 'BugHerd', 'Usersnap', 'Userback'],
    keyword: 'best visual feedback tools',
  },
  {
    kind: 'best',
    slug: 'best-tools-for-ai-coding-agents',
    title: 'The best feedback tools for teams using AI coding agents',
    intro: 'If you ship with Copilot, Claude or Cursor, the right feedback tool gives your agent the context it needs.',
    tools: ['Jam', 'Marker.io', 'Sentry', 'Linear'],
    keyword: 'feedback tools for ai coding agents',
  },
  {
    kind: 'best',
    slug: 'best-website-feedback-tools-for-agencies',
    title: 'The best website feedback tools for agencies in 2026',
    intro: 'Agencies need clean feedback from clients on staging and live sites. Here are the tools that do it well.',
    tools: ['Marker.io', 'BugHerd', 'Userback', 'Usersnap'],
    keyword: 'website feedback tools for agencies',
  },
  {
    kind: 'alternatives',
    slug: 'jam-alternatives',
    title: 'Jam alternatives in 2026',
    intro: 'Jam is a popular one-click bug reporter. If you want something with a different fit, here are the main options.',
    tools: ['Marker.io', 'Usersnap', 'Sentry', 'BugHerd'],
    keyword: 'jam alternatives',
  },
  {
    kind: 'alternatives',
    slug: 'marker-io-alternatives',
    title: 'Marker.io alternatives in 2026',
    intro: 'Marker.io is a strong visual feedback tool. These are the alternatives worth a look.',
    tools: ['Jam', 'BugHerd', 'Userback', 'Usersnap'],
    keyword: 'marker.io alternatives',
  },
  {
    kind: 'alternatives',
    slug: 'bugherd-alternatives',
    title: 'BugHerd alternatives in 2026',
    intro: 'BugHerd is built for point-and-click website feedback. Here are other tools in the same space.',
    tools: ['Marker.io', 'Usersnap', 'Userback', 'Jam'],
    keyword: 'bugherd alternatives',
  },
  {
    kind: 'alternatives',
    slug: 'usersnap-alternatives',
    title: 'Usersnap alternatives in 2026',
    intro: 'Usersnap covers feedback and bug capture. If it is not the right fit, start here.',
    tools: ['Marker.io', 'BugHerd', 'Jam', 'Userback'],
    keyword: 'usersnap alternatives',
  },
  {
    kind: 'best',
    slug: 'best-session-replay-tools',
    title: 'The best session replay tools in 2026',
    intro: 'Session replay shows you what users did. Here are the main tools and where each one fits.',
    tools: ['FullStory', 'Smartlook', 'LogRocket', 'Mouseflow', 'Hotjar'],
    keyword: 'best session replay tools',
  },
  {
    kind: 'best',
    slug: 'best-error-monitoring-tools',
    title: 'The best error monitoring tools in 2026',
    intro: 'Error monitoring catches problems in production. These are the tools teams rely on.',
    tools: ['Sentry', 'Bugsnag', 'LogRocket'],
    keyword: 'best error monitoring tools',
  },
  {
    kind: 'best',
    slug: 'best-website-feedback-tools',
    title: 'The best website feedback tools in 2026',
    intro: 'Tools for collecting feedback on a live website, compared by what they do well.',
    tools: ['Marker.io', 'BugHerd', 'Ruttl', 'Pastel', 'MarkUp.io', 'Userback'],
    keyword: 'best website feedback tools',
  },
  {
    kind: 'best',
    slug: 'best-issue-tracking-tools-for-developers',
    title: 'The best issue tracking tools for developers in 2026',
    intro: 'Where bugs and tasks live once they are reported. Here are the main options.',
    tools: ['Linear', 'Jira', 'Shortcut', 'Trello', 'ClickUp'],
    keyword: 'best issue tracking tools',
  },
  {
    kind: 'alternatives',
    slug: 'hotjar-alternatives',
    title: 'Hotjar alternatives in 2026',
    intro: 'Hotjar is known for heatmaps and recordings. Here are other tools to consider.',
    tools: ['Mouseflow', 'Smartlook', 'FullStory', 'LogRocket'],
    keyword: 'hotjar alternatives',
  },
  {
    kind: 'alternatives',
    slug: 'logrocket-alternatives',
    title: 'LogRocket alternatives in 2026',
    intro: 'LogRocket combines session replay and front-end monitoring. These are the alternatives.',
    tools: ['FullStory', 'Sentry', 'Smartlook', 'Bugsnag'],
    keyword: 'logrocket alternatives',
  },
];

function fallback(page, entries) {
  return {
    title: page.title,
    metaDescription: `${page.title}. An honest, up-to-date comparison of the main options, including what each tool is best for.`,
    intro: page.intro,
    criteria: [
      'How much context each report carries for the person who has to fix it.',
      'How quickly a report turns into a fix or a tracked issue.',
      'How easy it is to install and roll out across a team.',
      'Pricing and whether there is a free plan to start with.',
    ],
    faqs: [
      { q: `What is the best ${page.keyword.replace('best ', '')}?`, a: 'It depends on your team. If you want feedback that arrives with developer context and an AI diagnosis you can hand to a coding agent, Vynix is a strong place to start, and it has a free plan.' },
      { q: 'Do these tools have free plans?', a: 'Several do, including Vynix. Check each tool for current details, since plans change.' },
    ],
    vynixPitch: VYNIX_ENTRY.note,
  };
}

async function buildAngle(page, entries) {
  const fb = fallback(page, entries);
  const { value, source } = await completeJson({
    system:
      'You write fair, accurate, original "best tools" and "alternatives" articles. Never invent features or make unverifiable claims about a product. Keep a neutral, helpful tone. Write the way a person types: commas, periods, plain hyphens, straight quotes. Never use an em-dash or curly quotes. Return only valid JSON.',
    prompt: `Write the editorial parts of a listicle titled "${page.title}".

Tools covered (in order): ${entries.map((e) => e.name).join(', ')}.
Vynix is one of the tools. About Vynix: ${product.what}

Return JSON:
{
  "title": "${page.title}",
  "metaDescription": "under 155 chars, includes the search intent",
  "intro": "2-3 sentence neutral introduction",
  "criteria": ["what to look for, 3-5 short points"],
  "vynixPitch": "2-3 honest sentences on where Vynix fits, no hype",
  "faqs": [ { "q": "question", "a": "answer" } ]
}
Write 3 FAQs. Do not write the per-tool descriptions, those are supplied separately. Return JSON only.`,
    maxTokens: 1200,
    fallback: () => JSON.stringify(fb),
    defaultValue: fb,
  });
  return { angle: humanizeDeep(value || fb), source };
}

function renderBody(page, entries, angle, assets) {
  const criteria = (angle.criteria || []).map((c) => `<li>${c}</li>`).join('');
  const items = entries
    .map((e, i) => {
      const isV = e.isVynix;
      const note = isV ? angle.vynixPitch || e.note : e.note;
      const cta = isV ? `<p><a class="cta" href="${product.website}">Try Vynix free</a></p>` : '';
      return `<section id="tool-${i + 1}">
        <h2>${i + 1}. ${e.name}${isV ? ' (our pick for context and AI handoff)' : ''}</h2>
        <p><strong>Best for:</strong> ${e.best_for}.</p>
        <p>${note}</p>
        ${cta}
      </section>`;
    })
    .join('\n');
  const faqHtml = (angle.faqs || []).length
    ? `<section class="faq"><h2>Frequently asked questions</h2>${angle.faqs.map((f) => `<h3>${f.q}</h3><p>${f.a}</p>`).join('')}</section>`
    : '';

  return `<main class="container">
${breadcrumbsHtml([
  { name: 'Home', url: product.website },
  { name: 'Guides', url: '/best/' },
  { name: page.title, url: `/${page.dir}/${page.slug}/` },
])}
<article>
  <h1>${page.title}</h1>
  <div class="meta-row"><span>Updated ${humanDate(assets.updated)}</span><span>&middot;</span><span>By the Vynix Team</span></div>
  <p class="lead">${angle.intro}</p>
  <figure class="hero"><img src="${assets.hero.url}" alt="${assets.hero.alt}" width="1080" height="1350" /><figcaption>${assets.hero.alt}</figcaption></figure>
  <h2>What to look for</h2>
  <ul>${criteria}</ul>
  ${items}
  ${faqHtml}
  <div class="callout"><strong>The fastest way to decide</strong><p>Install Vynix on your site and capture one real report with full context. You will see the difference in a minute.</p><a class="cta" href="${product.website}">Get started free</a></div>
</article>
</main>`;
}

async function buildPage(page) {
  const dir1 = page.kind === 'alternatives' ? 'alternatives' : 'best';
  page.dir = dir1;
  const entries = toolEntries(page.tools);
  const { angle, source } = await buildAngle(page, entries);
  const updated = now();
  const hero = pickImage('workflow diagnosis review', page.slug.length);
  const ogImage = makeOgImage(page.slug, page.title, page.kind === 'alternatives' ? 'Alternatives' : 'Best tools');
  const assets = { hero, updated, ogImage };

  const body = renderBody(page, entries, angle, assets);
  const listItems = entries.map((e) => ({ name: e.name, url: e.isVynix ? product.website : `/${dir1}/${page.slug}/` }));
  const head = [
    headMeta({
      title: `${page.title} | Vynix`,
      description: angle.metaDescription,
      canonical: `/${dir1}/${page.slug}/`,
      ogImage,
      type: 'article',
      published: updated,
      modified: updated,
      keywords: `${page.keyword}, ${entries.map((e) => e.name.toLowerCase()).join(', ')}`,
    }),
    itemListLd(listItems, page.title),
    breadcrumbLd([
      { name: 'Home', url: product.website },
      { name: 'Guides', url: '/best/' },
      { name: page.title, url: `/${dir1}/${page.slug}/` },
    ]),
    faqLd(angle.faqs),
  ].join('\n');

  const html = renderPage({ head, body });
  const scan = scanText(html, `${dir1}/${page.slug}`);

  const outDir = path.join(paths.content, 'site', dir1, page.slug);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'index.html'), html);

  const record = store.upsert(
    {
      key: page.slug,
      title: page.title,
      kind: page.kind,
      slug: page.slug,
      url: `/${dir1}/${page.slug}`,
      section: dir1,
      og_image: ogImage,
      path: path.relative(paths.content, outDir),
      status: scan.clean ? 'ready' : 'blocked',
      ai_source: source,
      updated,
    },
    'key',
  );

  queue.add('content-publish', { kind: 'listicle', title: page.title, url: record.url }, { agent: 'listicle', approval: scan.clean ? APPROVAL.PENDING : APPROVAL.REJECTED, priority: 3 });
  log.info(`built listicle "${page.slug}"`, { status: record.status, source });
  return record;
}

export async function run(payload = {}) {
  let targets = payload.only ? PAGES.filter((p) => p.slug === payload.only) : PAGES;
  if (payload.expand) {
    targets = targets.filter((p) => {
      const dir1 = p.kind === 'alternatives' ? 'alternatives' : 'best';
      return !fs.existsSync(path.join(paths.content, 'site', dir1, p.slug, 'index.html'));
    });
  }
  const built = [];
  for (const page of targets) built.push(await buildPage(page));
  log.info(`built ${built.length} listicles`);
  return { built: built.length, pages: built.map((b) => b.url) };
}

export default { meta, run };
