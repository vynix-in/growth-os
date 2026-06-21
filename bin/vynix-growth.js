#!/usr/bin/env node
// Vynix Growth OS command-line entrypoint.
//
// Usage:
//   vynix-growth status              show a quick summary
//   vynix-growth seed                run every agent once to populate the system
//   vynix-growth run <agent> [only]  run a single agent
//   vynix-growth orchestrate         run one full orchestration pass
//   vynix-growth dashboard           start the web command center
//   vynix-growth report              print the latest report
//   vynix-growth gate <file>         scan a file with the publication gate
//   vynix-growth approvals           list items waiting for approval
//   vynix-growth publish <repo>      push an approved repository to GitHub
import fs from 'node:fs';
import path from 'node:path';
import { ensureDirs, paths, config } from '../lib/config.js';
import { runAgent, listAgents } from '../agents/index.js';
import { orchestrate } from '../orchestrator/orchestrator.js';
import { startDashboard } from '../dashboard/server.js';
import { buildSnapshot } from '../agents/dashboard-agent.js';
import { queue } from '../lib/queue.js';
import { scanFile } from '../lib/publication-gate.js';
import { publishRepo, approveAllRepos, publishAllRepos } from '../github/publish.js';

ensureDirs();

const [cmd, arg1, arg2] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case 'status': {
      const s = buildSnapshot();
      console.log('\nVynix Growth OS');
      console.log('AI provider:', s.ai.configured ? 'connected' : 'templates (no key set)');
      console.log('Generated:', s.generated_human);
      console.log('\nInventory:');
      for (const [k, v] of Object.entries(s.totals)) console.log(`  ${k.replace(/_/g, ' ')}: ${v}`);
      console.log('\nQueue:', JSON.stringify(s.queue));
      console.log('Gate scans:', s.gate.total_scans, '| blocked:', s.gate.blocked);
      break;
    }
    case 'seed': {
      console.log('Seeding the system. This runs every agent once.\n');
      // Order matters: directories before submissions, content before linking.
      const order = [
        'directory-discovery',
        'github-seo',
        'comparison',
        'blog',
        'changelog',
        'knowledgebase',
        'submission',
        'opensource-funnel',
        'internal-linking',
        'site-builder',
        'dashboard',
      ];
      for (const id of order) {
        await runAgent(id);
      }
      console.log('\nSeed complete. Start the dashboard with: node bin/vynix-growth.js dashboard');
      break;
    }
    case 'run': {
      if (!arg1) {
        console.log('Agents:', listAgents().map((a) => a.id).join(', '));
        break;
      }
      const payload = arg2 ? { only: arg2 } : {};
      const res = await runAgent(arg1, payload);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'orchestrate': {
      const res = await orchestrate(arg1 ? { only: arg1 } : {});
      console.log('\n' + res.md);
      break;
    }
    case 'dashboard': {
      startDashboard();
      break;
    }
    case 'report': {
      const latest = path.join(paths.reports, 'latest.md');
      if (fs.existsSync(latest)) console.log(fs.readFileSync(latest, 'utf8'));
      else console.log('No report yet. Run: node bin/vynix-growth.js orchestrate');
      break;
    }
    case 'gate': {
      if (!arg1) return console.log('Usage: gate <file>');
      const res = scanFile(arg1);
      console.log(res.clean ? 'CLEAN' : 'BLOCKED');
      if (!res.clean) console.log(JSON.stringify(res.violations, null, 2));
      break;
    }
    case 'approvals': {
      const items = queue.awaitingApproval();
      if (!items.length) return console.log('Nothing waiting for approval.');
      for (const t of items) {
        const label = t.payload?.title || t.payload?.repo || t.payload?.directory || t.id;
        console.log(`- ${t.id}  [${t.type}]  ${label}`);
      }
      break;
    }
    case 'publish': {
      if (!arg1) return console.log('Usage: publish <repo-name>');
      const res = await publishRepo(arg1, { dryRun: arg2 === '--dry-run' });
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case 'approve-all-repos': {
      const n = approveAllRepos();
      console.log(`Approved ${n} repository tasks.`);
      break;
    }
    case 'publish-all-repos': {
      const results = await publishAllRepos({ dryRun: arg1 === '--dry-run', force: arg1 === '--force' });
      for (const r of results) {
        console.log(`${r.ok ? 'OK  ' : 'FAIL'} ${r.repo}${r.url ? '  ' + r.url : ''}${r.reason ? '  ' + r.reason : ''}${r.skipped ? '  (' + r.skipped + ')' : ''}`);
      }
      break;
    }
    default:
      console.log(`Vynix Growth OS (${config.system.version})

Commands:
  status                 quick summary
  seed                   run every agent once to populate the system
  run <agent> [only]     run a single agent
  orchestrate [agent]    run one full orchestration pass
  dashboard              start the web command center
  report                 print the latest report
  gate <file>            scan a file with the publication gate
  approvals              list items waiting for approval
  publish <repo>         push an approved repository to GitHub (gated)
  approve-all-repos      approve every pending repository for publishing
  publish-all-repos      push every approved repository to GitHub (gated)
`);
  }
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
