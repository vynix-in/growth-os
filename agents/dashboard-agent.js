// Dashboard Agent (Phase 2)
//
// Builds the metrics snapshot the web dashboard reads. It gathers counts from
// every store, summarises the queue and approvals, and writes a single JSON
// file plus a Markdown summary. This is the command center's data layer.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { agentsConfig } from '../lib/config.js';
import { aiConfigured } from '../lib/ai.js';
import { now, humanDate } from '../lib/util.js';
import { recent as recentActivity } from '../lib/activity.js';

const log = logger('dashboard');

export const meta = { id: 'dashboard', name: 'Dashboard Agent' };

function countBy(rows, field) {
  const out = {};
  for (const r of rows) {
    const k = r[field] || 'unknown';
    out[k] = (out[k] || 0) + 1;
  }
  return out;
}

export function buildSnapshot() {
  const repos = db('repos').all();
  const directories = db('directories').all();
  const submissions = db('submissions').all();
  const comparisons = db('comparisons').all();
  const knowledgebase = db('knowledgebase').all();
  const content = db('content').all();
  const opensource = db('opensource').all();
  const links = db('links').all();
  const gateScans = db('gate_scans').all();
  const counters = db('counters').all();
  const gateTotal = (counters.find((c) => c.key === 'gate_total') || {}).n ?? gateScans.length;
  const gateBlocked = (counters.find((c) => c.key === 'gate_blocked') || {}).n ?? gateScans.filter((s) => !s.clean).length;
  const agentRuns = db('agents').all();
  const reviewRows = db('reviews').all();
  const reportRows = db('reports').all();
  const listicles = db('listicles').all();
  const usecases = db('usecases').all();
  const distributions = db('distributions').all();
  const backlinks = db('backlinks').all();

  const publishedRepos = repos.filter((r) => r.status === 'published');
  const lastDeploy = reportRows
    .filter((r) => r.kind === 'pages-deploy')
    .sort((a, b) => (b.deployed_at || '').localeCompare(a.deployed_at || ''))[0] || null;
  const reviewPassed = reviewRows.filter((r) => r.pass === true).length;
  const reviewFailed = reviewRows.filter((r) => r.pass === false).length;

  const snapshot = {
    generated_at: now(),
    generated_human: humanDate(),
    ai: { configured: aiConfigured() },
    totals: {
      repositories: repos.length,
      comparison_pages: comparisons.length,
      blog_posts: content.filter((c) => c.kind === 'blog').length,
      listicles: listicles.length,
      use_cases: usecases.length,
      directories: directories.length,
      submissions: submissions.length,
      knowledge_base_articles: knowledgebase.length,
      distribution_packets: distributions.length,
      backlink_targets: backlinks.length,
      content_assets: content.length,
      open_source_candidates: opensource.length,
      internal_link_suggestions: links.length,
      gate_scans: gateTotal,
    },
    queue: queue.stats(),
    gate: {
      total_scans: gateTotal,
      blocked: gateBlocked,
    },
    review: {
      checked: reviewRows.length,
      passed: reviewPassed,
      failed: reviewFailed,
    },
    crawl: (() => {
      const rows = db('crawl').all();
      const last = reportRows.filter((r) => r.kind === 'crawl').sort((a, b) => (b.at || '').localeCompare(a.at || ''))[0] || null;
      return {
        total: rows.length,
        live: rows.filter((r) => r.ok).length,
        broken: rows.filter((r) => !r.ok).length,
        checked_at: last?.at || null,
      };
    })(),
    published: {
      site_url: lastDeploy ? lastDeploy.base : null,
      site_pages: lastDeploy ? lastDeploy.pages : 0,
      deployed_at: lastDeploy ? lastDeploy.deployed_at : null,
      repositories: publishedRepos.map((r) => ({
        name: r.name,
        title: r.title,
        url: r.published_to ? `https://github.com/${r.published_to}` : `https://github.com/vynix-in/${r.name}`,
      })),
      blog_posts: content.filter((c) => c.kind === 'blog').length,
      comparison_pages: comparisons.length,
      kb_articles: knowledgebase.filter((k) => k.og_image).length,
    },
    growth: (() => {
      const livePages = lastDeploy ? lastDeploy.pages : 0;
      const goals = [
        { label: 'Live SEO pages', current: livePages, target: 120 },
        { label: 'Comparison pages', current: comparisons.length, target: 30 },
        { label: 'Buyer guides', current: listicles.length, target: 20 },
        { label: 'Use-case pages', current: usecases.length, target: 10 },
        { label: 'Published repos', current: publishedRepos.length, target: 11 },
        { label: 'Directory opportunities', current: directories.length, target: 60 },
        { label: 'Backlink targets', current: backlinks.length, target: 40 },
        { label: 'Distribution packets', current: distributions.length, target: 20 },
      ];
      return {
        window_days: 60,
        goals: goals.map((g) => ({ ...g, pct: Math.min(100, Math.round((g.current / g.target) * 100)) })),
      };
    })(),
    breakdowns: {
      repositories_by_status: countBy(repos, 'status'),
      directories_by_category: countBy(directories, 'category'),
      directories_by_status: countBy(directories, 'status'),
      comparisons_by_status: countBy(comparisons, 'status'),
      knowledge_base_by_type: countBy(knowledgebase, 'type'),
    },
    agents: agentsConfig.agents.map((a) => {
      const last = agentRuns.filter((r) => r.agent === a.id).sort((x, y) => (y.finished_at || '').localeCompare(x.finished_at || ''))[0];
      return {
        id: a.id,
        name: a.name,
        phase: a.phase,
        schedule: a.schedule,
        enabled: a.enabled,
        last_run: last?.finished_at || null,
        last_status: last?.status || 'never run',
        last_result: last?.result || null,
      };
    }),
    awaiting_approval: queue.awaitingApproval().map((t) => ({
      id: t.id,
      type: t.type,
      agent: t.agent,
      payload: t.payload,
      created_at: t.created_at,
    })),
  };

  return snapshot;
}

export async function run() {
  const snapshot = buildSnapshot();
  fs.mkdirSync(paths.dashboardData, { recursive: true });
  fs.writeFileSync(path.join(paths.dashboardData, 'snapshot.json'), JSON.stringify(snapshot, null, 2));
  fs.writeFileSync(path.join(paths.dashboardData, 'progress.json'), JSON.stringify(buildProgress(), null, 2));

  // Also write a plain Markdown summary for quick reading.
  const t = snapshot.totals;
  const md = `# Vynix Growth OS — snapshot

Generated: ${snapshot.generated_human}
AI provider configured: ${snapshot.ai.configured ? 'yes' : 'no (using templates)'}

## Inventory
- Repositories proposed: ${t.repositories}
- Comparison pages: ${t.comparison_pages}
- Directories tracked: ${t.directories}
- Submission packets: ${t.submissions}
- Knowledge base articles: ${t.knowledge_base_articles}
- Content assets: ${t.content_assets}
- Open-source candidates: ${t.open_source_candidates}
- Internal link suggestions: ${t.internal_link_suggestions}

## Queue
- Pending: ${snapshot.queue.pending}
- Awaiting approval: ${snapshot.queue.awaiting_approval}
- Done: ${snapshot.queue.done}
- Failed: ${snapshot.queue.failed}

## Publication gate
- Total scans: ${snapshot.gate.total_scans}
- Blocked items: ${snapshot.gate.blocked}
`;
  fs.writeFileSync(path.join(paths.dashboardData, 'snapshot.md'), md);

  log.info('dashboard snapshot updated', snapshot.totals);
  return snapshot.totals;
}

// A richer view for the Status and Progress page: a timeline of activity, the
// content that is live with direct links, deploy history, the work waiting, and
// the schedule of what runs next.
export function buildProgress() {
  const s = buildSnapshot();
  const liveBase = s.published.site_url || 'https://vynix-in.github.io';
  const content = db('content').all();
  const comparisons = db('comparisons').all();
  const listicles = db('listicles').all();
  const usecases = db('usecases').all();
  const knowledgebase = db('knowledgebase').all();
  const reportRows = db('reports').all();
  const agentRuns = db('agents').all();

  const link = (url) => `${liveBase}${url.endsWith('/') ? url : url + '/'}`;

  const inventory = {
    blog: content.filter((c) => c.kind === 'blog' && c.slug).map((c) => ({ title: c.title, url: link(c.url), updated: c.published || c.updated_at })),
    comparisons: comparisons.filter((c) => c.slug).map((c) => ({ title: `${c.competitor} vs Vynix`, url: link('/compare/' + c.slug + '/'), updated: c.updated })),
    guides: listicles.filter((l) => l.slug).map((l) => ({ title: l.title, url: link(l.url), updated: l.updated })),
    use_cases: usecases.filter((u) => u.slug).map((u) => ({ title: u.title, url: link('/for/' + u.slug + '/'), updated: u.updated })),
    help: knowledgebase.filter((k) => k.slug && k.og_image).map((k) => ({ title: k.title, url: link('/kb/' + k.slug + '/'), updated: k.updated })),
  };

  // Pending work grouped by what it is and who acts on it.
  const pending = {};
  for (const t of queue.awaitingApproval()) {
    const k = t.type;
    pending[k] = pending[k] || { type: k, count: 0, items: [] };
    pending[k].count += 1;
    if (pending[k].items.length < 8) pending[k].items.push(t.payload?.title || t.payload?.repo || t.payload?.directory || t.id);
  }

  const deploys = reportRows
    .filter((r) => r.kind === 'pages-deploy')
    .sort((a, b) => (b.deployed_at || '').localeCompare(a.deployed_at || ''))
    .slice(0, 10)
    .map((d) => ({ base: d.base, pages: d.pages, at: d.deployed_at }));

  // Per-agent: last run plus a rough "next due" based on schedule.
  const nextDue = (schedule, lastRun) => {
    if (!lastRun) return 'soon';
    const map = { hourly: 3600e3, daily: 86400e3, weekly: 604800e3, 'on-demand': 0 };
    const ms = map[schedule] ?? 0;
    if (!ms) return 'on demand';
    return new Date(new Date(lastRun).getTime() + ms).toISOString();
  };
  const agents = agentsConfig.agents.map((a) => {
    const last = agentRuns.filter((r) => r.agent === a.id).sort((x, y) => (y.finished_at || '').localeCompare(x.finished_at || ''))[0];
    return {
      id: a.id,
      name: a.name,
      schedule: a.schedule,
      enabled: a.enabled,
      last_run: last?.finished_at || null,
      last_status: last?.status || 'never run',
      next_due: nextDue(a.schedule, last?.finished_at),
    };
  });

  return {
    generated_at: now(),
    generated_human: humanDate(),
    live_site: liveBase,
    ai: s.ai,
    review: s.review,
    growth: s.growth,
    totals: s.totals,
    inventory,
    inventory_counts: Object.fromEntries(Object.entries(inventory).map(([k, v]) => [k, v.length])),
    pending: Object.values(pending),
    deploys,
    agents,
    crawl: (() => {
      const rows = db('crawl').all();
      return {
        total: rows.length,
        live: rows.filter((r) => r.ok).length,
        broken: rows.filter((r) => !r.ok).map((r) => ({ url: r.url, status: r.status })),
        checked_at: s.crawl?.checked_at || null,
      };
    })(),
    activity: recentActivity(80),
  };
}

export default { meta, run };
