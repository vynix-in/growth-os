# Architecture

This document explains how the Vynix Growth OS is put together and why.

## The shape of the system

There are three layers.

1. A small set of shared libraries in `lib/`. These handle configuration, the
   local database, the task queue, logging, the AI router, the publication gate,
   and the public facts about Vynix.
2. A set of agents in `agents/`. Each agent does one job and writes its output to
   disk and to the database. Agents do not talk to each other directly; they
   share state through the database and the queue.
3. An orchestrator and a dashboard. The orchestrator runs the agents on a
   schedule. The dashboard shows what has been produced and lets a person
   approve work.

```
            +---------------------+
            |    Orchestrator     |   runs agents in priority order, hourly
            +----------+----------+
                       |
        +--------------+---------------+
        |        Agents (9)            |   one job each, write to disk + db
        +--------------+---------------+
                       |
   +---------+---------+---------+----------+
   |  lib/db |  queue  | gate    |  ai      |   shared libraries
   +----+----+----+----+----+----+-----+----+
        |         |         |          |
   database/   queue.json  scans     Azure / templates
        |
   +----+--------------------------------+
   |   Dashboard (web command center)    |   read + approve
   +-------------------------------------+
```

## The database

The database is a folder of JSON files under `database/`, one file per
collection. A tiny store in `lib/db.js` provides insert, find, update, upsert,
and replace. Writes are atomic (write a temp file, then rename). This is enough
for the volumes this system produces and keeps the data readable by hand.

Collections:

- `agents` — a history of agent runs.
- `tasks` — the queue, including approval state.
- `repos` — repository proposals for the GitHub organisation.
- `directories` — the master directory list.
- `submissions` — prepared submission packets.
- `content` — release and blog content.
- `comparisons` — comparison pages.
- `knowledgebase` — help articles.
- `links` — internal-linking suggestions.
- `opensource` — open-source candidates.
- `reports` — orchestration reports.
- `gate_scans` — a record of every publication gate scan.
- `metrics` — AI usage and other counters.

## The queue and approvals

Every asset that could be published creates a task in the queue with an approval
state. The states are: not required, pending approval, approved, rejected. The
orchestrator and agents never move a task to approved. Only a person does that,
either in the dashboard or with the command line. The publisher refuses to push
anything that is not approved.

## The publication gate

`lib/publication-gate.js` scans text for things that must never go public:
private keys, API keys and tokens, JSON Web Tokens, internal hostnames, database
names, environment-file content, private backend namespaces, proprietary
implementation terms, and email addresses that are not on the Vynix domain. Every
agent runs its output through the gate before saving it. The publisher runs the
gate again on the actual files before pushing. If the gate finds anything, the
item is blocked and flagged for manual review.

## The AI router

`lib/ai.js` calls Azure AI Foundry (the same deployment the Vynix product uses)
when the environment variables are set, and falls back to deterministic
templates when they are not. This means the whole system runs with or without
AI. The router handles the quirks of reasoning models: it sends
`max_completion_tokens` instead of `max_tokens`, omits a custom temperature, and
uses a valid API version. It retries a few times and records token usage.

## Public facts

`lib/vynix-facts.js` holds the only Vynix information the agents use: the product
description, features, value propositions, competitor list, and the list of
components that are safe to open source. Agents read from this file rather than
from the product code, so generated content stays on the safe side of the line.

## Why generation and publishing are separate

The goal is to reduce founder effort to approvals only, not to remove the founder
from the loop. Generating drafts is cheap and reversible. Publishing to GitHub or
a directory is public and hard to undo. So the system does all the generation on
its own and stops at the approval step every time.
