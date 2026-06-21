# Vynix CLI

> Command-line tool for Vynix bug reporting, feedback, and issue creation.

[![Website](https://img.shields.io/badge/website-vynix.in-008448)](https://vynix.in)
[![Docs](https://img.shields.io/badge/docs-vynix.in%2Fdocs-008448)](https://vynix.in/docs)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Vynix CLI is part of the [Vynix](https://vynix.in) developer toolkit: the feedback layer for teams that build with AI coding agents. It helps connect Vynix to your workflow so visual feedback, captured context, and AI diagnosis can move from a website into your development process faster.

## What is Vynix?

Vynix is a website annotation and developer-context tool. Add a lightweight widget to any site, click on what is wrong, and Vynix captures the selected element, a screenshot, console and network context, and an AI diagnosis of the likely root cause. You can then copy a ready-to-build prompt or open a GitHub issue and assign it to a coding agent.

Learn more at **[vynix.in](https://vynix.in)** or read the **[documentation](https://vynix.in/docs)**.

## Why teams use Vynix

- **Click-to-annotate any page.** Point at an element, a region, or selected text and leave a note pinned exactly where the problem appears.
- **Automatic developer context.** Each note includes the element selector, page URL, screenshot, and a privacy-safe capture of console errors and network calls.
- **AI root-cause diagnosis.** Vynix reads the captured context and suggests the likely cause, a possible fix, and the files most likely involved.
- **Hand off to a coding agent.** Turn a note into a clear prompt or a GitHub issue, then assign it to Copilot or your own workflow.

## Install

```bash
npm install -g @vynix/cli
```

> Note: the Vynix toolkit is rolling out. If a package or command above does not resolve yet, watch this repo for the release and use the hosted product at [vynix.in](https://vynix.in) in the meantime.

## Usage

Use the Vynix CLI from your terminal to sign in, list feedback annotations, create issues, and check project status.

```bash
vynix login
vynix annotations list
vynix issue create <annotation-id>
```

## Documentation

Full guides and the API reference live at [https://vynix.in/docs](https://vynix.in/docs).

## Related Vynix projects

- [Vynix Browser Extension](https://github.com/vynix-in/vynix-browser-extension)
- [Vynix JavaScript SDK](https://github.com/vynix-in/vynix-sdk-js)
- [Vynix PHP SDK](https://github.com/vynix-in/vynix-sdk-php)
- [Vynix Python SDK](https://github.com/vynix-in/vynix-sdk-python)
- [Vynix MCP Server](https://github.com/vynix-in/vynix-mcp)
- [Vynix GitHub Action](https://github.com/vynix-in/vynix-github-action)

Browse the full toolkit at the [Vynix GitHub organisation](https://github.com/vynix-in).

## Keywords

vynix, bug-reporting, visual-feedback, website-annotation, ai-diagnosis, developer-tools, feedback-tool, cli, command-line, automation, devtools

## About Vynix

Vynix is the feedback layer for teams building with AI coding agents. Point at a bug on any live website, and Vynix captures the context, diagnoses the likely cause, and hands it to your coding agent. Start free at [vynix.in](https://vynix.in).

## License

MIT, see [LICENSE](./LICENSE).