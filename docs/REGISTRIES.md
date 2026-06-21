# Registries

The system keeps three registries so it is easy to see what exists, what runs,
and what is in flight.

## System registry

File: `config/system.json`

Holds the system identity, the brand and product links, the GitHub organisation,
the AI provider settings, the dashboard host and port, the orchestrator interval
and priority order, and the publication-gate policy. This is the single place to
change how the system behaves.

## Agent registry

File: `config/agents.json`

Lists every agent with its id, name, module path, phase, description, schedule,
and whether it is enabled. The runner loads agents by id from this file. To add
an agent, write the module in `agents/` and add an entry here.

| Id | Name | Phase | Schedule |
| --- | --- | --- | --- |
| dashboard | Dashboard Agent | 2 | on demand |
| github-seo | GitHub SEO Agent | 3 | hourly |
| changelog | Changelog SEO Agent | 4 | hourly |
| directory-discovery | Directory Discovery Agent | 5 | daily |
| submission | Submission Preparation Agent | 6 | daily |
| opensource-funnel | Open Source Funnel Agent | 7 | weekly |
| comparison | Comparison Page Agent | 8 | weekly |
| knowledgebase | Knowledge Base Agent | 9 | daily |
| internal-linking | Internal Linking Agent | 10 | weekly |

## Task registry

Collection: `tasks` (in `database/tasks.json`)

Every unit of work the system produces becomes a task. A task records its type,
the agent that created it, the payload, the run status, and the approval state.
The dashboard reads this registry to show what is waiting for approval. The
publisher reads it to confirm an item has been approved before it goes public.

Task statuses: pending, running, done, failed.

Approval states: not required, pending approval, approved, rejected.

Inspect the task registry from the command line:

```bash
node bin/vynix-growth.js approvals
```
