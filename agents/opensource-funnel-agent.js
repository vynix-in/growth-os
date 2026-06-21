// Open Source Funnel Agent (Phase 7)
//
// Reviews the codebase at a high level and decides which components are safe to
// open source and which must stay private. It never reads or copies private
// source; it reasons over a curated list of components and a hard list of
// things that must never be published. Each safe candidate becomes a proposal
// with a short rationale and a checklist, and lands in the approval queue.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { scanText } from '../lib/publication-gate.js';
import { publicComponents, neverPublish, product } from '../lib/vynix-facts.js';
import { humanDate } from '../lib/util.js';

const log = logger('opensource-funnel');
const store = db('opensource');

export const meta = { id: 'opensource-funnel', name: 'Open Source Funnel Agent' };

function rationaleFor(component) {
  const byKind = {
    extension: 'A browser extension is client-side and already distributed to users. Open sourcing it builds trust and invites contributions without exposing the backend.',
    sdk: 'An SDK only wraps the public API. It contains no business logic and helps developers integrate faster.',
    mcp: 'An MCP server speaks to the public API over a documented protocol. It has no proprietary logic and reaches the growing agent ecosystem.',
    action: 'A GitHub Action is a thin wrapper around the public API and is most useful when public.',
    editor: 'An editor extension is a client integration with no server code.',
    cli: 'A CLI calls the public API and is a natural open-source developer tool.',
    examples: 'Examples are meant to be copied. Public examples drive adoption.',
    templates: 'Templates are starter code with no secrets.',
    docs: 'Documentation should be public and is a strong source of search traffic.',
  };
  return byKind[component.kind] || 'A client-side or documentation component with no proprietary logic.';
}

function funnelNote(component) {
  return `Every page and file in ${component.name} links back to ${product.website} and the documentation at ${product.docs}, so the open-source project funnels developers toward Vynix.`;
}

function proposalMarkdown(component) {
  return `# Open source proposal — ${component.name}

Date: ${humanDate()}
Suggested repository: ${product.githubOrg}/${component.repo}

## Why this is safe to publish
${rationaleFor(component)}

## How it funnels to Vynix
${funnelNote(component)}

## What must never be included
${neverPublish.map((n) => `- ${n}`).join('\n')}

## Pre-publish checklist
- [ ] README, docs, examples and release notes prepared by the GitHub SEO agent
- [ ] Publication gate scan is clean
- [ ] No environment files, keys, or internal hostnames in the tree
- [ ] Links back to ${product.website} and ${product.docs} are present
- [ ] License file (MIT) included
- [ ] Human approval recorded

## Decision
Pending human approval.
`;
}

export async function run(payload = {}) {
  const targets = payload.only
    ? publicComponents.filter((c) => c.key === payload.only || c.repo === payload.only)
    : publicComponents;

  const built = [];
  for (const component of targets) {
    const md = proposalMarkdown(component);
    const scan = scanText(md, `opensource/${component.repo}`);
    const dir = path.join(paths.assets, 'opensource-proposals');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${component.repo}.md`), md);

    const record = store.upsert(
      {
        key: component.repo,
        component: component.name,
        kind: component.kind,
        repo: component.repo,
        rationale: rationaleFor(component),
        path: path.relative(paths.assets, path.join(dir, `${component.repo}.md`)),
        status: scan.clean ? 'candidate' : 'blocked',
        gate_clean: scan.clean,
      },
      'key',
    );

    queue.add(
      'opensource-approve',
      { component: component.name, repo: component.repo },
      { agent: 'opensource-funnel', approval: APPROVAL.PENDING, priority: 3 },
    );
    built.push(record);
  }
  log.info(`evaluated ${built.length} open-source candidates`);
  return { candidates: built.length };
}

export default { meta, run };
