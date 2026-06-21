# Vynix Growth OS

This is the autonomous SEO and growth system for Vynix. It runs as a set of
small agents that produce growth assets on a schedule: repository proposals for
the GitHub organisation, competitor comparison pages, directory submission
packets, knowledge base articles, release content, and internal-linking plans.

Everything it produces is written to disk and recorded in a local database. A
web dashboard shows the inventory, the agent status, and the items waiting for a
human to approve. Nothing is ever published on its own. Publishing always waits
for a person to look at the work and say yes.

The system lives in its own folder, separate from the Vynix product code. It
never reads private backend source, and every piece of text it generates passes
through a publication gate that blocks secrets, internal hostnames, database
names, customer data, and private source fragments.

## Why it is built this way

- Plain Node, no framework and no native dependencies, so it runs anywhere Node
  18 or newer is installed.
- A local JSON database, so there is nothing to set up and the data is easy to
  read by hand.
- A clear split between generating content and publishing it. Generation is
  automatic. Publishing is manual and gated.
- One file of public facts about Vynix that every agent reads from, so generated
  content can never accidentally pull in something proprietary.

## Quick start

```bash
cd growth
node bin/vynix-growth.js seed        # run every agent once to fill the system
node bin/vynix-growth.js dashboard   # open the command center at http://127.0.0.1:4310
```

To run one full pass on a schedule:

```bash
node bin/vynix-growth.js orchestrate
```

## The agents

| Agent | What it does |
| --- | --- |
| Dashboard | Builds the metrics snapshot the web dashboard reads. |
| GitHub SEO | Proposes public repositories and writes their README, docs, examples and release notes. |
| Changelog | Turns releases and notable commits into blog, release and social drafts. |
| Directory Discovery | Maintains the master list of directories to submit to. |
| Submission Preparation | Builds copy-paste ready submission packets for each directory. |
| Open Source Funnel | Decides which components are safe to open source. |
| Comparison | Generates and updates "X vs Vynix" comparison pages. |
| Knowledge Base | Turns issues and fixes into sanitized help articles. |
| Internal Linking | Suggests links, clusters and hub pages across the content. |

The orchestrator runs the agents in priority order, refreshes the dashboard, and
writes a progress report.

## What it will not do

It will not publish a repository, a page, or a post without a human approving it
first. It will not include anything the publication gate flags. It will not touch
the Vynix product code.

See `docs/ARCHITECTURE.md` for how the parts fit together, `docs/SETUP.md` to get
it running, and `docs/DEPLOYMENT.md` to put it on a schedule.
