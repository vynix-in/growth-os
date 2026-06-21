# Roadmap

This is the build order and what each stage delivers. The foundation is in
place; the items further down are the natural next steps.

## Done — foundation

- Workspace structure, configuration, and registries.
- Local JSON database, task queue with approval states, file logger.
- Publication gate that blocks secrets, internal hosts, database names, private
  source, and customer data.
- AI router for Azure AI Foundry with a template fallback.
- Nine agents: dashboard, GitHub SEO, changelog, directory discovery, submission
  preparation, open-source funnel, comparison, knowledge base, internal linking.
- Orchestrator that runs the agents in priority order and writes reports.
- Web dashboard with inventory, agent status, queue, gate status, and approvals.
- GitHub publisher that pushes approved, gate-clean repositories to the
  organisation.

## Next — make it richer

- Live directory discovery: fetch and parse directory pages to find new listings
  instead of relying on the curated seed.
- Screenshot capture for submission packets and repository READMEs.
- A changelog watcher that reads tagged releases, not just commit subjects.
- Per-platform social drafts with images for each release.
- A simple approvals history view in the dashboard.

## Later — scale and measure

- Track real outcomes: which submissions were accepted, which pages rank, which
  repositories gained stars.
- Pull GitHub star and traffic numbers into the dashboard.
- Topic-cluster planning driven by search demand.
- Cost monitoring per agent when AI is in use.
- Multi-model routing: send cheaper drafts to a small model and reserve the
  large model for final copy.

## Principles that do not change

- Generation is automatic, publishing is manual and gated.
- The publication gate runs on everything before it is saved and again before it
  is published.
- Agents read public facts, never private product code.
- Quality over quantity. A smaller set of strong assets beats a large set of weak
  ones.
