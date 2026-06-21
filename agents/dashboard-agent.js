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
  const agentRuns = db('agents').all();

  const snapshot = {
    generated_at: now(),
    generated_human: humanDate(),
    ai: { configured: aiConfigured() },
    totals: {
      repositories: repos.length,
      comparison_pages: comparisons.length,
      directories: directories.length,
      submissions: submissions.length,
      knowledge_base_articles: knowledgebase.length,
      content_assets: content.length,
      open_source_candidates: opensource.length,
      internal_link_suggestions: links.length,
      gate_scans: gateScans.length,
    },
    queue: queue.stats(),
    gate: {
      total_scans: gateScans.length,
      blocked: gateScans.filter((s) => !s.clean).length,
    },
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

export default { meta, run };
