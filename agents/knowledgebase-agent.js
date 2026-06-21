// Knowledge Base Agent (Phase 9)
//
// Turns issues, fixes and releases into reusable, sanitized knowledge base
// content: articles, FAQs and troubleshooting guides. Everything passes through
// the publication gate, and customer-identifying detail is stripped before the
// article is written. No customer information may appear in the output.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { complete } from '../lib/ai.js';
import { scanText } from '../lib/publication-gate.js';
import { product } from '../lib/vynix-facts.js';
import { slug, humanDate } from '../lib/util.js';

const log = logger('knowledgebase');
const store = db('knowledgebase');

export const meta = { id: 'knowledgebase', name: 'Knowledge Base Agent' };

// Seed topics that are generic, safe, and useful. These are common questions a
// Vynix user would search for. The agent expands each into a full article.
const SEED_TOPICS = [
  { title: 'How to install the Vynix widget on any website', type: 'guide', q: 'How do I add Vynix to my site?' },
  { title: 'What context does Vynix capture with each report', type: 'article', q: 'What information is in a Vynix report?' },
  { title: 'How the AI diagnosis works and what it returns', type: 'article', q: 'How does the Vynix AI diagnosis work?' },
  { title: 'Turning a Vynix note into a GitHub issue', type: 'guide', q: 'How do I create a GitHub issue from Vynix?' },
  { title: 'Controlling who can see the Vynix widget', type: 'guide', q: 'How do I limit who sees the widget?' },
  { title: 'Using review rounds to group feedback into fixes', type: 'guide', q: 'What are review rounds in Vynix?' },
  { title: 'Troubleshooting: the widget is not appearing', type: 'troubleshooting', q: 'Why is the Vynix widget not showing up?' },
  { title: 'Troubleshooting: my report has no screenshot', type: 'troubleshooting', q: 'Why is there no screenshot on my report?' },
];

// Remove anything that could identify a customer before generation.
function sanitizeInput(text) {
  return String(text || '')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[email removed]')
    .replace(/\bhttps?:\/\/(?!vynix\.in)[^\s)]+/g, '[link removed]')
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[ip removed]');
}

function fallbackArticle(topic) {
  return `# ${topic.title}

## Question
${topic.q}

## Answer
This guide explains ${topic.title.toLowerCase()} in Vynix.

Vynix is a website annotation and developer-context tool. ${product.what}

For full setup steps, see the [Vynix documentation](${product.docs}). If you are still stuck, contact the team at hello@vynix.in.

## Related
- [Vynix documentation](${product.docs})
- [Vynix website](${product.website})
`;
}

async function buildArticle(topic) {
  const cleanQ = sanitizeInput(topic.q);
  const { text, source } = await complete({
    system:
      'You write clear, calm help-centre articles for a developer tool. Use plain language and short steps. Never include customer names, emails, IP addresses, or internal system names. If you do not know an exact detail, describe it generally and link to the docs.',
    prompt: `Write a knowledge base ${topic.type} titled "${topic.title}".

It should answer: "${cleanQ}".
About Vynix: ${product.what}
Documentation lives at ${product.docs}.

Structure: a short "Question" line, a clear "Answer" with numbered steps where useful, and a "Related" list linking to ${product.docs} and ${product.website}. Keep it under 350 words. Return Markdown only.`,
    maxTokens: 800,
    fallback: () => fallbackArticle(topic),
  });

  const scan = scanText(text, `kb/${slug(topic.title)}`);
  // If the gate finds anything, fall back to the safe template instead.
  const safeText = scan.clean ? text : fallbackArticle(topic);
  const finalScan = scan.clean ? scan : scanText(safeText, `kb/${slug(topic.title)}-safe`);

  const dir = path.join(paths.knowledgebase, slug(topic.title));
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.md'), safeText);

  const record = store.upsert(
    {
      key: slug(topic.title),
      title: topic.title,
      type: topic.type,
      question: cleanQ,
      path: path.relative(paths.knowledgebase, dir),
      status: finalScan.clean ? 'ready' : 'blocked',
      gate_clean: finalScan.clean,
      ai_source: source,
      updated_human: humanDate(),
    },
    'key',
  );

  queue.add(
    'kb-publish',
    { title: topic.title, path: record.path },
    { agent: 'knowledgebase', approval: APPROVAL.PENDING, priority: 4 },
  );

  return record;
}

export async function run(payload = {}) {
  // Accept real issue/fix items, otherwise expand the seed topics.
  let topics = SEED_TOPICS;
  if (payload.items && payload.items.length) {
    topics = payload.items.map((it) => ({
      title: it.title,
      type: 'troubleshooting',
      q: sanitizeInput(it.issue || it.title),
    }));
  }
  const built = [];
  for (const topic of topics) {
    built.push(await buildArticle(topic));
  }
  log.info(`built ${built.length} knowledge base articles`);
  return { built: built.length };
}

export default { meta, run };
