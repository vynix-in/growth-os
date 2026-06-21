// Comparison Page Agent (Phase 8)
//
// Generates and updates "X vs Vynix" comparison pages from a shared template.
// The system is built to support hundreds of pages: add a competitor to the
// facts file and the agent produces a page for it. Pages are written as both
// Markdown (for a docs or blog pipeline) and a standalone HTML preview.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { completeJson } from '../lib/ai.js';
import { scanText } from '../lib/publication-gate.js';
import { competitors, product, features } from '../lib/vynix-facts.js';
import { humanDate } from '../lib/util.js';

const log = logger('comparison');
const store = db('comparisons');

export const meta = { id: 'comparison', name: 'Comparison Page Agent' };

function defaultAngle(competitor) {
  return {
    intro: `${competitor.name} is known for ${competitor.focus}. Vynix takes a different angle: it captures visual feedback with full developer context and an AI diagnosis, then hands the work to a coding agent. This page compares the two so you can pick the right tool for your team.`,
    whenCompetitor: `Choose ${competitor.name} when your main need is ${competitor.focus} and you already have a separate workflow for turning reports into code changes.`,
    whenVynix:
      'Choose Vynix when you want every report to arrive with the context an engineer needs, an AI diagnosis of the likely cause, and a one-click path to a GitHub issue or an AI coding agent.',
    rows: features.map((f) => ({ capability: f.title, vynix: 'Yes', competitor: 'Varies', note: f.blurb })),
  };
}

async function buildAngle(competitor) {
  const fallback = defaultAngle(competitor);
  const { value, source } = await completeJson({
    system:
      'You write fair, accurate software comparison pages. Never make false or unverifiable claims about a competitor. When unsure about a competitor capability, say it varies or depends on the plan. Keep a neutral, factual tone.',
    prompt: `Produce a JSON object for a comparison page "${competitor.name} vs Vynix".

About Vynix: ${product.what}
Vynix key capabilities: ${features.map((f) => f.title).join(', ')}.
About ${competitor.name}: known for ${competitor.focus} (category: ${competitor.category}).

Return JSON with exactly these keys:
{
  "intro": "2-3 sentence neutral introduction",
  "whenCompetitor": "one sentence on when ${competitor.name} is the better fit",
  "whenVynix": "one sentence on when Vynix is the better fit",
  "rows": [ { "capability": "string", "vynix": "Yes|No|Partial", "competitor": "Yes|No|Partial|Varies", "note": "short neutral note" } ]
}
Include 6 to 8 rows covering visual annotation, developer context capture, AI diagnosis, coding-agent handoff, integrations, and pricing transparency. Do not claim a competitor lacks a feature unless it is widely known. Return JSON only.`,
    maxTokens: 1100,
    fallback: () => JSON.stringify(fallback),
    defaultValue: fallback,
  });
  return { angle: value || fallback, source };
}

function markdown(competitor, angle) {
  const rows = angle.rows
    .map((r) => `| ${r.capability} | ${r.vynix} | ${r.competitor} | ${r.note} |`)
    .join('\n');
  return `---
title: ${competitor.name} vs Vynix
description: A neutral comparison of ${competitor.name} and Vynix for teams that want visual feedback with developer context and AI diagnosis.
slug: /compare/${competitor.slug}-vs-vynix
updated: ${humanDate()}
---

# ${competitor.name} vs Vynix

${angle.intro}

## At a glance

| Capability | Vynix | ${competitor.name} | Notes |
| --- | --- | --- | --- |
${rows}

## When ${competitor.name} fits

${angle.whenCompetitor}

## When Vynix fits

${angle.whenVynix}

## Try Vynix

Vynix installs with one script tag and works on any framework. Start at [${product.website}](${product.website}) or read the [documentation](${product.docs}).

_This comparison is maintained by the Vynix team and updated regularly. If you spot something inaccurate about ${competitor.name}, let us know at hello@vynix.in._
`;
}

function html(competitor, angle) {
  const rows = angle.rows
    .map(
      (r) =>
        `<tr><td>${r.capability}</td><td class="yes">${r.vynix}</td><td>${r.competitor}</td><td class="note">${r.note}</td></tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${competitor.name} vs Vynix</title>
<meta name="description" content="A neutral comparison of ${competitor.name} and Vynix." />
<link rel="canonical" href="${product.website}/compare/${competitor.slug}-vs-vynix" />
<style>
  body { font-family: system-ui, sans-serif; max-width: 820px; margin: 40px auto; padding: 0 20px; color: #0f172a; line-height: 1.6; }
  h1 { font-size: 2rem; }
  table { width: 100%; border-collapse: collapse; margin: 24px 0; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f8fafc; }
  td.yes { color: #008448; font-weight: 600; }
  td.note { color: #475569; font-size: 0.9rem; }
  a { color: #008448; }
</style>
</head>
<body>
<h1>${competitor.name} vs Vynix</h1>
<p>${angle.intro}</p>
<h2>At a glance</h2>
<table>
<thead><tr><th>Capability</th><th>Vynix</th><th>${competitor.name}</th><th>Notes</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<h2>When ${competitor.name} fits</h2>
<p>${angle.whenCompetitor}</p>
<h2>When Vynix fits</h2>
<p>${angle.whenVynix}</p>
<p><a href="${product.website}">Try Vynix</a> &middot; <a href="${product.docs}">Read the docs</a></p>
</body>
</html>
`;
}

async function buildPage(competitor) {
  const { angle, source } = await buildAngle(competitor);
  const md = markdown(competitor, angle);
  const page = html(competitor, angle);

  const scan = scanText(md + page, `compare/${competitor.slug}`);
  const dir = path.join(paths.comparisons, `${competitor.slug}-vs-vynix`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.md'), md);
  fs.writeFileSync(path.join(dir, 'index.html'), page);

  const record = store.upsert(
    {
      key: competitor.slug,
      competitor: competitor.name,
      slug: `${competitor.slug}-vs-vynix`,
      url: `/compare/${competitor.slug}-vs-vynix`,
      path: path.relative(paths.comparisons, dir),
      status: scan.clean ? 'ready' : 'blocked',
      gate_violations: scan.violations,
      ai_source: source,
    },
    'key',
  );

  queue.add(
    'comparison-publish',
    { competitor: competitor.name, url: record.url },
    { agent: 'comparison', approval: scan.clean ? APPROVAL.PENDING : APPROVAL.REJECTED, priority: 2 },
  );

  log.info(`built comparison "${competitor.slug}-vs-vynix"`, { status: record.status, source });
  return record;
}

export async function run(payload = {}) {
  const targets = payload.only
    ? competitors.filter((c) => c.slug === payload.only)
    : competitors;
  const built = [];
  for (const competitor of targets) {
    built.push(await buildPage(competitor));
  }
  log.info(`built ${built.length} comparison pages`);
  return { built: built.length, pages: built.map((r) => r.url) };
}

export default { meta, run };
