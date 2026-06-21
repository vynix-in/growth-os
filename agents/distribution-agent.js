// Distribution Agent
//
// Reach comes from posting where developers already are, not just from waiting
// for search. For every blog post this builds ready-to-paste drafts for X,
// LinkedIn, Reddit, dev.to and Hashnode, plus a Hacker News title. The dev.to
// and Hashnode drafts set a canonical URL back to the live post, so they add a
// backlink without creating duplicate-content problems. Drafts are copy-paste
// for the founder and wait for approval before anything is posted.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { humanizeText } from '../lib/humanize.js';
import { product } from '../lib/vynix-facts.js';
import { humanDate } from '../lib/util.js';

const log = logger('distribution');
const content = db('content');
const distributions = db('distributions');

export const meta = { id: 'distribution', name: 'Distribution Agent' };

// Where the live posts are served. Update if the site moves to vynix.in.
const LIVE_BASE = 'https://vynix-in.github.io';

function liveUrl(url) {
  return `${LIVE_BASE}${url.endsWith('/') ? url : url + '/'}`;
}

function xThread(post, url) {
  return humanizeText(
    `${post.title}

Most bug reports lose the context that makes them fixable. Here is the short version.

1. Capture the element, the page state, the console and the network detail.
2. Let an AI read it and point at the likely cause and the files involved.
3. Hand it to your coding agent as a prompt or a GitHub issue.

Full post: ${url}

Built with Vynix, the feedback layer for teams shipping with AI agents. ${product.website}`,
  );
}

function linkedinPost(post, url) {
  return humanizeText(
    `${post.title}

${post.description}

A quick take from what we keep seeing:
- Feedback without context is slow to fix.
- An AI diagnosis on every report saves a round of back and forth.
- A direct path to a GitHub issue or a coding agent closes the loop.

Read the full post: ${url}

#webdev #softwaredevelopment #ai #devtools`,
  );
}

function redditPost(post, url) {
  return {
    subreddits: ['r/webdev', 'r/SideProject', 'r/programming', 'r/devtools'],
    title: post.title,
    body: humanizeText(
      `I wrote up how we think about this: ${post.description}

${url}

Short version: capture the element, the page state, and the console and network detail with every report, add an AI diagnosis, then hand it to a coding agent. Happy to answer questions in the comments.`,
    ),
  };
}

function devto(post, url) {
  const tags = ['webdev', 'productivity', 'ai', 'programming'];
  return humanizeText(
    `---
title: ${post.title}
published: false
tags: ${tags.join(', ')}
canonical_url: ${url}
cover_image: ${post.hero || ''}
---

${post.description}

This was first published on the Vynix blog. Read the full version here: [${post.title}](${url}).

Vynix is the feedback layer for teams building with AI coding agents. Learn more at ${product.website}.`,
  );
}

function hashnode(post, url) {
  return humanizeText(
    `Title: ${post.title}
Canonical URL (set this in Hashnode settings): ${url}
Tags: webdev, ai, programming, productivity

${post.description}

Originally published on the Vynix blog: ${url}
Learn more about Vynix at ${product.website}.`,
  );
}

function hackerNews(post, url) {
  return humanizeText(`Title: ${post.title}\nURL: ${url}\n\nNote: post during US morning hours, keep the title plain and factual, and reply to comments quickly.`);
}

function buildFor(post) {
  const url = liveUrl(post.url);
  const drafts = {
    'x-thread.txt': xThread(post, url),
    'linkedin.txt': linkedinPost(post, url),
    'devto.md': devto(post, url),
    'hashnode.txt': hashnode(post, url),
    'hacker-news.txt': hackerNews(post, url),
  };
  const reddit = redditPost(post, url);
  drafts['reddit.txt'] = humanizeText(`Subreddits: ${reddit.subreddits.join(', ')}\n\nTitle: ${reddit.title}\n\n${reddit.body}`);

  const dir = path.join(paths.content, 'distribution', post.slug);
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(drafts)) fs.writeFileSync(path.join(dir, name), body);

  const record = distributions.upsert(
    {
      key: post.slug,
      title: post.title,
      url: post.url,
      live_url: url,
      platforms: ['x', 'linkedin', 'reddit', 'devto', 'hashnode', 'hackernews'],
      path: path.relative(paths.content, dir),
      status: 'ready',
      updated: humanDate(),
    },
    'key',
  );

  queue.add(
    'distribution-publish',
    { title: post.title, url: post.url, packet: record.path },
    { agent: 'distribution', approval: APPROVAL.PENDING, priority: 4 },
  );
  return record;
}

export async function run(payload = {}) {
  // Distribute blog posts, listicles and use-case pages.
  const posts = content.find({ kind: 'blog' }).filter((p) => p.slug && p.status !== 'blocked');
  const targets = payload.only ? posts.filter((p) => p.slug === payload.only) : posts;
  const built = [];
  for (const post of targets) built.push(buildFor(post));

  // A master plan that lists everything and suggests a cadence.
  const planLines = built.map((b, i) => `- Day ${i + 1}: ${b.title}  (${b.path})`);
  const plan = humanizeText(`# Distribution plan

Updated: ${humanDate()}

Post one piece of content per working day. For each one, the drafts are ready in its folder. Suggested order:

${planLines.join('\n')}

Tips:
- Space posts out. One platform in the morning, another in the afternoon.
- Reply to every comment in the first hour.
- On dev.to and Hashnode, set the canonical URL so the original post keeps the SEO value.
- Put the vynix.in link in your profile and bio, not in every post body.
`);
  fs.mkdirSync(path.join(paths.content, 'distribution'), { recursive: true });
  fs.writeFileSync(path.join(paths.content, 'distribution', 'distribution-plan.md'), plan);

  log.info(`built distribution drafts for ${built.length} posts`);
  return { built: built.length };
}

export default { meta, run };
