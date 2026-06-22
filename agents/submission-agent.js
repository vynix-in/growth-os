// Submission Preparation Agent (Phase 6)
//
// For every discovered directory, produces a copy-paste ready submission
// packet: short and long descriptions, tags, categories, keywords, feature
// summaries, and checklists for screenshots and logos. Output is written as
// submission.md and submission.json so the founder only has to copy and paste.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { scanText } from '../lib/publication-gate.js';
import { product, features, valueProps, audiences } from '../lib/vynix-facts.js';

const log = logger('submission');
const directories = db('directories');
const submissions = db('submissions');

export const meta = { id: 'submission', name: 'Submission Preparation Agent' };

const SHORT = 'Vynix is the feedback layer for teams building with AI coding agents. Point at any bug on a live site and Vynix captures the context, diagnoses the likely cause, and hands it to your coding agent.';

function longDescription() {
  const featureLines = features.map((f) => `- ${f.title}: ${f.blurb}`).join('\n');
  return `${product.what}

What makes Vynix different:
${valueProps.map((v) => `- ${v}`).join('\n')}

Key features:
${featureLines}

Who it is for:
${audiences.map((a) => `- ${a}`).join('\n')}

Learn more at ${product.website}.`;
}

function tagsFor(category) {
  const base = ['bug-reporting', 'visual-feedback', 'website-annotation', 'developer-tools', 'ai'];
  const byCategory = {
    ai: ['ai-tools', 'ai-diagnosis', 'ai-agents'],
    saas: ['saas', 'productivity', 'collaboration'],
    startup: ['startup', 'product', 'launch'],
    developer: ['devtools', 'github', 'workflow'],
    extension: ['browser-extension', 'chrome-extension', 'productivity'],
    mcp: ['mcp', 'model-context-protocol', 'ai-agents'],
  };
  return [...base, ...(byCategory[category] || [])];
}

function packet(directory) {
  return {
    directory: directory.name,
    submit_url: directory.submit_url,
    tier: directory.tier,
    tier_note: directory.notes,
    product: product.name,
    website: product.website,
    tagline: product.tagline,
    secondary_tagline:
      'One script tag turns any site into a feedback layer: click a bug and Vynix captures the element, console and network context automatically.',
    usp:
      'Every report already holds what an engineer needs to fix the bug: the exact element, a screenshot, console and network errors, and an AI root-cause diagnosis, ready to open as a GitHub issue and hand to a coding agent.',
    tldr: [
      'Click any bug on a live site and Vynix auto-captures the element, screenshot, console and network context.',
      'Get an AI root-cause diagnosis and turn it into a GitHub issue for Copilot or your agent in one click.',
    ],
    alternative_to: ['Marker.io', 'BugHerd', 'Jam'],
    integrations: ['GitHub', 'GitHub Copilot', 'Cursor', 'Claude (MCP)'],
    best_for: ['Front-end engineers', 'QA & support teams', 'Agencies'],
    short_description: SHORT,
    long_description: longDescription(),
    tags: tagsFor(directory.category),
    categories: ['Developer Tools', 'Bug Tracking', 'Productivity', 'AI'],
    keywords: ['bug reporting', 'visual feedback', 'website annotation', 'ai diagnosis', 'github issues', 'coding agents'],
    feature_summary: features.map((f) => `${f.title}: ${f.blurb}`),
    pricing:
      'Free plan. Pro $7/mo (500 AI credits). Business $15/mo (2,500 AI credits). Details at ' + product.pricingUrl + '.',
    contact_email: 'hello@vynix.in',
    social: { twitter: 'https://twitter.com/usevynix', github: product.githubOrg },
    assets: {
      logo_512: product.website + '/icon-512.png',
      favicon: product.website + '/favicon.svg',
      screenshots: [
        product.website + '/resources/assets/shots/shot-annotate.png',
        product.website + '/resources/assets/shots/shot-context.png',
        product.website + '/resources/assets/shots/shot-github.png',
        product.website + '/resources/assets/shots/shot-mcp.png',
        product.website + '/resources/assets/shots/shot-install.png',
      ],
    },
    screenshots_checklist: [
      'Widget open on a live page with a pinned annotation',
      'AI diagnosis panel showing a root-cause summary',
      'A generated GitHub issue assigned to a coding agent',
      'Project dashboard with a list of feedback',
      'Review round clustering several notes into fixes',
    ],
    logo_checklist: [
      'Square logo, transparent background, at least 512x512 PNG',
      'Horizontal logo with wordmark for wide placements',
      'Favicon or app icon, 64x64 and 256x256',
      'Brand colour reference: Vynix green #008448',
    ],
  };
}

function markdown(pkt) {
  return `# Submission packet — ${pkt.directory}

Submit at: ${pkt.submit_url}

> ${pkt.tier_note}

## Product
- Name: ${pkt.product}
- Website: ${pkt.website}
- Tagline: ${pkt.tagline}
- Contact: ${pkt.contact_email}

## Short description
${pkt.short_description}

## Secondary tagline (max ~140 chars)
${pkt.secondary_tagline}

## Unique selling proposition (max ~255 chars)
${pkt.usp}

## TL;DR
${pkt.tldr.map((b) => `- ${b}`).join('\n')}

## Alternative to
${pkt.alternative_to.join(', ')}

## Integrations
${pkt.integrations.join(', ')}

## Best for
${pkt.best_for.join(', ')}

## Long description
${pkt.long_description}

## Tags
${pkt.tags.join(', ')}

## Categories
${pkt.categories.join(', ')}

## Keywords
${pkt.keywords.join(', ')}

## Feature summary
${pkt.feature_summary.map((f) => `- ${f}`).join('\n')}

## Pricing
${pkt.pricing}

## Screenshots checklist
${pkt.screenshots_checklist.map((s) => `- [ ] ${s}`).join('\n')}

## Logo checklist
${pkt.logo_checklist.map((s) => `- [ ] ${s}`).join('\n')}

## Assets (ready to upload)
- Square logo (512x512): ${pkt.assets.logo_512}
- Favicon (SVG): ${pkt.assets.favicon}
- Screenshots:
${pkt.assets.screenshots.map((s) => `  - ${s}`).join('\n')}

## Social
- Twitter: ${pkt.social.twitter}
- GitHub: ${pkt.social.github}
`;
}

function buildFor(directory) {
  const pkt = packet(directory);
  const md = markdown(pkt);
  const json = JSON.stringify(pkt, null, 2);

  const scan = scanText(md + json, `submission/${directory.key}`);
  const dir = path.join(paths.directories, 'submissions', directory.key);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'submission.md'), md);
  fs.writeFileSync(path.join(dir, 'submission.json'), json);

  const record = submissions.upsert(
    {
      key: directory.key,
      directory: directory.name,
      submit_url: directory.submit_url,
      category: directory.category,
      authority: directory.authority,
      path: path.relative(paths.directories, dir),
      status: 'prepared', // prepared -> submitted -> approved/rejected (tracked by hand)
      gate_clean: scan.clean,
    },
    'key',
  );

  directories.update({ key: directory.key }, { status: 'prepared' });
  queue.add(
    'directory-submit',
    { directory: directory.name, submit_url: directory.submit_url, packet: record.path },
    { agent: 'submission', approval: APPROVAL.PENDING, priority: 4 },
  );

  return record;
}

export async function run(payload = {}) {
  const QUEUEABLE = new Set(['open', 'pr']);
  const all = payload.only ? directories.find({ key: payload.only }) : directories.all();
  const list = all.filter((d) => QUEUEABLE.has(d.tier));
  const built = [];
  for (const directory of list) {
    built.push(buildFor(directory));
  }

  // Prune anything that is not a free/open or PR directory: drop its queued task,
  // submission record, and stale packet so the approval list stays clean and real.
  let pruned = 0;
  for (const directory of directories.all()) {
    if (QUEUEABLE.has(directory.tier)) continue;
    const removedTasks = queue.removeWhere((t) => t.type === 'directory-submit' && t.payload?.directory === directory.name);
    submissions.remove({ key: directory.key });
    const dir = path.join(paths.directories, 'submissions', directory.key);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
    if (removedTasks || fs.existsSync(dir) === false) pruned += 1;
  }

  // Dedupe: keep exactly one directory-submit task per directory (re-runs of the
  // agent would otherwise pile up duplicates of the same submission).
  const seen = new Set();
  const deduped = queue.removeWhere((t) => {
    if (t.type !== 'directory-submit') return false;
    const name = t.payload?.directory;
    if (seen.has(name)) return true;
    seen.add(name);
    return false;
  });

  log.info(`prepared ${built.length} submission packets`, { pruned, deduped });
  return { built: built.length, pruned, deduped };
}

export default { meta, run };
