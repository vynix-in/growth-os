// Internal Linking Agent (Phase 10)
//
// Audits everything the system has produced (comparison pages, knowledge base
// articles, release content, repositories) and suggests internal links, topic
// clusters, and hub pages. Better internal linking helps search engines crawl
// the content and helps readers find related pages.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { product } from '../lib/vynix-facts.js';
import { humanDate } from '../lib/util.js';

const log = logger('internal-linking');
const links = db('links');
const comparisons = db('comparisons');
const knowledgebase = db('knowledgebase');
const repos = db('repos');
const content = db('content');

export const meta = { id: 'internal-linking', name: 'Internal Linking Agent' };

function buildClusters() {
  return [
    {
      id: 'comparisons',
      title: 'Vynix vs other tools',
      hub: '/compare',
      members: comparisons.all().map((c) => ({ title: `${c.competitor} vs Vynix`, url: c.url })),
    },
    {
      id: 'getting-started',
      title: 'Getting started with Vynix',
      hub: '/docs',
      members: knowledgebase
        .find({ type: 'guide' })
        .map((k) => ({ title: k.title, url: `/kb/${k.key}` })),
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      hub: '/kb/troubleshooting',
      members: knowledgebase
        .find({ type: 'troubleshooting' })
        .map((k) => ({ title: k.title, url: `/kb/${k.key}` })),
    },
    {
      id: 'open-source',
      title: 'Vynix open source',
      hub: product.githubOrg,
      members: repos.all().map((r) => ({ title: r.title, url: `${product.githubOrg}/${r.name}` })),
    },
    {
      id: 'updates',
      title: 'Product updates',
      hub: '/blog',
      members: content.find({ kind: 'release' }).map((c) => ({ title: c.title, url: `/blog` })),
    },
  ].filter((c) => c.members.length > 0);
}

// Suggest cross-links: every comparison should link to two sibling comparisons
// and to the getting-started hub; every guide links to a relevant comparison.
function buildSuggestions(clusters) {
  const suggestions = [];
  const comparisonCluster = clusters.find((c) => c.id === 'comparisons');
  if (comparisonCluster) {
    const members = comparisonCluster.members;
    members.forEach((m, i) => {
      const siblings = [members[(i + 1) % members.length], members[(i + 2) % members.length]]
        .filter((s) => s && s.url !== m.url)
        .map((s) => s.url);
      suggestions.push({ from: m.url, add_links_to: [...new Set(siblings)], reason: 'Related comparison pages' });
    });
  }
  for (const cluster of clusters) {
    if (cluster.id === 'comparisons') continue;
    for (const m of cluster.members) {
      suggestions.push({ from: m.url, add_links_to: [cluster.hub], reason: `Link back to the ${cluster.title} hub` });
    }
  }
  return suggestions;
}

function hubPage(clusters) {
  const sections = clusters
    .map((c) => {
      const items = c.members.map((m) => `- [${m.title}](${m.url})`).join('\n');
      return `## ${c.title}\n\nHub: ${c.hub}\n\n${items}`;
    })
    .join('\n\n');
  return `---
title: Vynix content map
updated: ${humanDate()}
---

# Vynix content map

This page links the main clusters of Vynix content together. Use it as a hub for internal linking.

${sections}
`;
}

export async function run() {
  const clusters = buildClusters();
  const suggestions = buildSuggestions(clusters);

  links.replaceAll(
    suggestions.map((s) => ({ id: `link_${Buffer.from(s.from).toString('hex').slice(0, 10)}`, ...s, updated_at: humanDate() })),
  );

  const dir = path.join(paths.seo, 'internal-linking');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'content-map.md'), hubPage(clusters));
  fs.writeFileSync(
    path.join(dir, 'link-suggestions.json'),
    JSON.stringify({ generated: humanDate(), clusters, suggestions }, null, 2),
  );

  log.info('internal linking audit complete', { clusters: clusters.length, suggestions: suggestions.length });
  return { clusters: clusters.length, suggestions: suggestions.length };
}

export default { meta, run };
