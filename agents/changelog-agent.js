// Changelog SEO Agent (Phase 4)
//
// Watches releases and notable commits and turns the public-safe ones into
// content: a blog draft, release notes, and short social drafts for LinkedIn
// and X. It reads recent git history from the parent repository but runs every
// item through the publication gate, so anything that mentions internal detail
// is skipped automatically.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { paths, p } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { complete } from '../lib/ai.js';
import { scanText } from '../lib/publication-gate.js';
import { product } from '../lib/vynix-facts.js';
import { slug, humanDate, hash } from '../lib/util.js';

const log = logger('changelog');
const store = db('content');

export const meta = { id: 'changelog', name: 'Changelog SEO Agent' };

// Pull recent commit subjects from the parent repo. Safe failure if git is
// unavailable or this is not a repo.
function recentCommits(limit = 40) {
  try {
    const out = execSync(`git -C ${p('..')} log --pretty=format:%s -n ${limit}`, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return out.split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

// Keep only commits that look like user-facing features or fixes and that pass
// the gate. Internal-sounding subjects are dropped.
function selectNotable(subjects) {
  const interesting = /\b(add|added|ship|shipped|launch|new|feature|support|improve|fix|fixed|redesign|introduce)\b/i;
  const internal = /\b(refactor|lint|test|chore|bump|wip|merge|revert|typo|ci|deploy|migration)\b/i;
  const seen = new Set();
  const picked = [];
  for (const s of subjects) {
    if (internal.test(s)) continue;
    if (!interesting.test(s)) continue;
    const key = hash(s.toLowerCase());
    if (seen.has(key)) continue;
    if (!scanText(s, 'commit').clean) continue; // gate the subject itself
    seen.add(key);
    picked.push(s);
    if (picked.length >= 8) break;
  }
  return picked;
}

function fallbackBlog(items) {
  const bullets = items.map((i) => `- ${i}`).join('\n');
  return `# What's new in Vynix

We have shipped a batch of improvements. Here is a short summary.

${bullets}

Try the latest version at ${product.website}. As always, the fastest way to tell us what to build next is to use Vynix on your own site and send us a note.
`;
}

async function buildRelease(items) {
  const blogFallback = () => fallbackBlog(items);
  const { text: blog, source } = await complete({
    system:
      'You write short, plain product update posts for a developer tool. No hype, no buzzwords. Write like a founder updating their users. Keep it under 300 words.',
    prompt: `Write a "What's new in Vynix" blog draft from these update lines. Group related items, keep it factual, and end with one sentence inviting feedback. Lines:\n${items.map((i) => `- ${i}`).join('\n')}\n\nAbout Vynix: ${product.what}\nReturn Markdown only.`,
    maxTokens: 700,
    fallback: blogFallback,
  });

  const linkedin = `New in Vynix\n\n${items.slice(0, 5).map((i) => `• ${i}`).join('\n')}\n\nVynix is the feedback layer for teams building with AI coding agents. ${product.website}`;
  const x = `Shipped in Vynix:\n${items.slice(0, 3).map((i) => `• ${i}`).join('\n')}\nPoint it. Capture it. Ship it. ${product.website}`;
  const releaseNotes = `# Release — ${humanDate()}\n\n${items.map((i) => `- ${i}`).join('\n')}\n`;

  const bundle = { blog, linkedin, x, releaseNotes };
  const scan = scanText(JSON.stringify(bundle), 'release-content');

  const dir = path.join(paths.content, 'releases', slug(humanDate()) + '-' + hash(items.join('')).slice(0, 6));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'blog.md'), blog);
  fs.writeFileSync(path.join(dir, 'release-notes.md'), releaseNotes);
  fs.writeFileSync(path.join(dir, 'linkedin.txt'), linkedin);
  fs.writeFileSync(path.join(dir, 'x.txt'), x);

  const record = store.insert({
    kind: 'release',
    title: `Release content — ${humanDate()}`,
    items,
    path: path.relative(paths.content, dir),
    status: scan.clean ? 'draft' : 'blocked',
    gate_clean: scan.clean,
    ai_source: source,
  });

  queue.add(
    'content-publish',
    { kind: 'release', title: record.title, path: record.path },
    { agent: 'changelog', approval: scan.clean ? APPROVAL.PENDING : APPROVAL.REJECTED, priority: 3 },
  );

  log.info('built release content bundle', { items: items.length, status: record.status, source });
  return record;
}

// Public-safe highlights to write about when git history yields nothing the
// gate will pass. These describe shipped, user-facing capabilities only.
const SAFE_HIGHLIGHTS = [
  'Review rounds now group a batch of notes into a short list of suggested fixes.',
  'AI diagnosis is attached to every report and flows into the generated prompt and GitHub issue.',
  'One-click GitHub connect with a native account, organisation and repository picker.',
  'A light and dark theme across the marketing site and the dashboard.',
  'Faster first load with route-level code splitting and long-term asset caching.',
  'Region and element screenshots captured directly from the widget.',
];

export async function run(payload = {}) {
  let items = payload.items;
  if (!items || !items.length) {
    items = selectNotable(recentCommits());
  }
  if (!items.length) {
    // Nothing public-safe in git history, so write about known shipped features.
    log.info('no notable commits passed the gate, using public-safe highlights');
    items = SAFE_HIGHLIGHTS;
  }
  const record = await buildRelease(items);
  return { built: 1, content: record.path, items: items.length };
}

export default { meta, run };
