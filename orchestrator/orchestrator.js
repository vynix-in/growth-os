// Claude Orchestrator (Phase 11)
//
// Runs on a schedule (hourly by default). It reviews the queues, runs the
// agents in priority order, refreshes the dashboard snapshot, and writes a
// progress report. It never publishes anything: publishing always waits for a
// human to approve an item in the queue.
import fs from 'node:fs';
import path from 'node:path';
import { config, paths } from '../lib/config.js';
import { runAgent } from '../agents/index.js';
import { db } from '../lib/db.js';
import { queue } from '../lib/queue.js';
import { applyPolicy } from '../lib/policy.js';
import { deployPages } from '../github/deploy-pages.js';
import { logger } from '../lib/logger.js';
import { now, humanDate, id as makeId } from '../lib/util.js';

const log = logger('orchestrator');
const reports = db('reports');

// One full pass: run every agent in the configured priority order, then build
// the dashboard snapshot, then write a report.
export async function orchestrate(opts = {}) {
  const startedAt = now();
  log.info('orchestration pass started');

  const order = opts.only ? [opts.only] : config.orchestrator.priority;
  const results = {};
  for (const agentId of order) {
    try {
      results[agentId] = await runAgent(agentId);
    } catch (err) {
      results[agentId] = { error: String(err) };
    }
  }

  // Review everything that was produced before anything is treated as ready.
  try {
    results.reviewer = await runAgent('reviewer');
  } catch (err) {
    results.reviewer = { error: String(err) };
  }

  // Auto-approve the items that are clearly safe; leave the rest for the founder.
  try {
    results.policy = applyPolicy();
  } catch (err) {
    results.policy = { error: String(err) };
  }

  // Deploy the reviewed site to GitHub Pages (a separate, reversible property;
  // never touches the live vynix.in app). Skipped automatically if anything
  // failed review. Disable with VYNIX_NO_DEPLOY=1.
  if (!process.env.VYNIX_NO_DEPLOY && !opts.noDeploy) {
    try {
      results.deploy = await deployPages({ dryRun: Boolean(opts.dryRunDeploy) });
    } catch (err) {
      results.deploy = { error: String(err) };
    }
  }

  // Always refresh the dashboard last so it reflects this pass.
  await runAgent('dashboard');

  const report = writeReport(startedAt, results);
  log.info('orchestration pass complete', { report: report.path });
  return report;
}

function writeReport(startedAt, results) {
  const stats = queue.stats();
  const lines = Object.entries(results).map(([agent, res]) => {
    if (res?.error) return `- ${agent}: failed (${res.error})`;
    return `- ${agent}: ${JSON.stringify(res)}`;
  });

  const md = `# Growth OS progress report

Date: ${humanDate()}
Pass started: ${startedAt}
Pass finished: ${now()}

## Agents run this pass
${lines.join('\n')}

## Queue
- Pending: ${stats.pending}
- Awaiting approval: ${stats.awaiting_approval}
- Approved: ${stats.approved}
- Done: ${stats.done}
- Failed: ${stats.failed}

## What needs a human
${
  queue.awaitingApproval().length
    ? queue
        .awaitingApproval()
        .map((t) => `- [${t.type}] ${t.payload?.title || t.payload?.repo || t.payload?.directory || t.id}`)
        .join('\n')
    : '- Nothing waiting right now.'
}

## Notes
Publishing is never automatic. Review the items above, approve the ones that are ready, then run the publish step by hand.
`;

  fs.mkdirSync(paths.reports, { recursive: true });
  const file = path.join(paths.reports, `report-${now().slice(0, 19).replace(/[:T]/g, '-')}.md`);
  fs.writeFileSync(file, md);
  fs.writeFileSync(path.join(paths.reports, 'latest.md'), md);

  const record = reports.insert({
    id: makeId('rep'),
    started_at: startedAt,
    finished_at: now(),
    results,
    queue: stats,
    path: path.relative(paths.reports, file),
  });
  return { ...record, md };
}

export default { orchestrate };
