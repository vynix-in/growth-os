# Setup

The system needs Node 18 or newer. It has no other dependencies and nothing to
install. The data lives in local JSON files, so there is no database to run.

## First run

```bash
cd growth
node bin/vynix-growth.js seed
```

This runs every agent once and fills the database. When it finishes you will
have repository proposals, comparison pages, a directory list, submission
packets, knowledge base articles, release content, open-source proposals, and
internal-linking suggestions.

## The dashboard

```bash
node bin/vynix-growth.js dashboard
```

Open http://127.0.0.1:4310 in a browser. The dashboard shows the inventory, the
agent status, the queue, the publication gate, and the items waiting for
approval. The approve and reject buttons update the queue.

## Turning on AI

The system works without AI by using templates. To use Azure AI Foundry for
richer drafts, set these environment variables before running an agent:

```bash
export AZURE_OPENAI_ENDPOINT="https://your-resource.openai.azure.com"
export AZURE_OPENAI_DEPLOYMENT="gpt-5.5"
export AZURE_OPENAI_API_KEY="your-key"
export AZURE_OPENAI_API_VERSION="2024-10-21"
```

These are the same values the Vynix backend uses. Keep them out of the
repository. The dashboard shows whether AI is connected or running on templates.

## Common commands

```bash
node bin/vynix-growth.js status            # quick summary
node bin/vynix-growth.js run <agent>       # run one agent (e.g. comparison)
node bin/vynix-growth.js run comparison jam  # run for one target only
node bin/vynix-growth.js orchestrate       # one full pass + report
node bin/vynix-growth.js approvals         # list items waiting for approval
node bin/vynix-growth.js gate <file>       # scan a file with the publication gate
node bin/vynix-growth.js publish <repo>    # push an approved repository (gated)
node bin/vynix-growth.js report            # print the latest report
```

## Agent names

`dashboard`, `github-seo`, `changelog`, `directory-discovery`, `submission`,
`opensource-funnel`, `comparison`, `knowledgebase`, `internal-linking`.

## Where things are written

- `github/<repo>/` — repository proposals.
- `comparisons/<slug>/` — comparison pages, Markdown and HTML.
- `directories/submissions/<dir>/` — submission packets.
- `knowledgebase/<slug>/` — help articles.
- `content/releases/<id>/` — release content bundles.
- `seo/internal-linking/` — the content map and link suggestions.
- `reports/` — orchestration reports.
- `dashboard/data/` — the snapshot the web dashboard reads.
- `database/` — the JSON database.
- `logs/` — daily log files.
