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
| Blog | Writes in-depth, original articles and renders them as full SEO HTML pages with real images, clips, structured data and internal links. |
| Directory Discovery | Maintains the master list of directories to submit to. |
| Submission Preparation | Builds copy-paste ready submission packets for each directory. |
| Open Source Funnel | Decides which components are safe to open source. |
| Comparison | Generates and updates "X vs Vynix" comparison pages as full SEO HTML. |
| Knowledge Base | Turns issues and fixes into sanitized HTML help articles. |
| Internal Linking | Suggests links, clusters and hub pages across the content. |
| Site Builder | Assembles index pages, sitemap.xml and robots.txt into a deployable static site. |
| Reviewer | Audits every page for SEO, working links, valid structured data and leaks. Holds back anything that fails. |

The orchestrator runs the agents in priority order, refreshes the dashboard, and
writes a progress report.

## What runs on its own, and what waits for you

The system acts on its own where it is clearly safe and reversible, and asks
only where there is real doubt.

Done automatically (our own content on our own properties, fully reversible):

- Writing and updating blog posts, comparison pages and knowledge base articles.
- Reviewing every page before it ships. Anything that fails the audit is held
  back, not published.
- Deploying the reviewed site to GitHub Pages at https://vynix-in.github.io.

Held for your approval (external, public, or hard to undo):

- Submitting to third-party directories.
- Open-sourcing new components.
- Creating new public GitHub repositories.

The dashboard shows both: a "Published & live" panel for what is already out, and
a "Needs your approval" panel for what is waiting. The reviewer panel shows the
audit result for every page.

## The live site

The generated resources site is deployed to **https://vynix-in.github.io** (blog,
comparisons, help center). It is a separate, reversible property and never
touches the live vynix.in application. Canonicals are self-referencing so there
is no duplicate-content risk, and every page links back to vynix.in. To move it
onto the main domain later, regenerate with `SITE_CANONICAL_BASE=https://vynix.in`
and add redirects.

## The generated site

The blog, comparison and knowledge base agents render complete, search-optimised
HTML pages into `content/site`. The site builder adds index pages, a sitemap and
a robots file. The result is a self-contained static site you can deploy under
vynix.in so the pages live at `/blog`, `/compare` and `/kb`.

Each page is built for real-world SEO, not thin auto-generated filler:

- Unique, substantial content written with gpt-5.5 (Azure AI Foundry).
- Real Vynix product images and clips, not stock or placeholders.
- Correct title, meta description, canonical, Open Graph and Twitter tags.
- Structured data: Article, FAQ, Breadcrumb, Organization, SoftwareApplication
  and Video, so pages are eligible for rich results.
- A generated Open Graph card per page.
- Internal links between related posts and comparisons.
- Fast, mobile-first HTML with inline critical CSS and no external fonts.

Preview the whole site from the dashboard with the "View site" link, or open
`http://127.0.0.1:4310/site/` directly.

## Turning on AI

The agents write with Azure AI Foundry (gpt-5.5) when the `AZURE_OPENAI_*` keys
are present, and fall back to templates when they are not. The config loads keys
from `growth/.env` first, then from the Vynix `backend/.env`, so the same keys
power both. The dashboard shows whether AI is connected.

## What it will not do

It will not publish a repository, a page, or a post without a human approving it
first. It will not include anything the publication gate flags. It will not touch
the Vynix product code.

See `docs/ARCHITECTURE.md` for how the parts fit together, `docs/SETUP.md` to get
it running, and `docs/DEPLOYMENT.md` to put it on a schedule.
