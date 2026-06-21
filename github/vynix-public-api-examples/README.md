# Vynix Public API Examples

> Working code examples for the public Vynix API.

[![Website](https://img.shields.io/badge/website-vynix.in-008448)](https://vynix.in)
[![Docs](https://img.shields.io/badge/docs-vynix.in%2Fdocs-008448)](https://vynix.in/docs)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Vynix Public API Examples is part of the [Vynix](https://vynix.in) developer toolkit. It provides small, focused examples that show how to call the public Vynix API and connect Vynix data to your own workflow.

Vynix is the feedback layer for teams that build with AI coding agents. It helps visual feedback and AI diagnosis reach your code faster.

## What is Vynix?

Vynix is a website annotation and developer-context tool. Add a lightweight widget to any site, click what is wrong, and Vynix captures the selected element, a screenshot, console and network context, and an AI diagnosis of the likely root cause.

From there, you can copy a ready-to-build prompt or open a GitHub issue and assign it to a coding agent.

Learn more at **[vynix.in](https://vynix.in)** or read the **[documentation](https://vynix.in/docs)**.

## Why teams use Vynix

- **Click-to-annotate any page.** Point at an element, a region, or selected text and leave a note pinned to the exact location.
- **Automatic developer context.** Each note includes the element selector, page URL, screenshot, and a privacy-safe capture of console errors and network calls.
- **AI root-cause diagnosis.** Vynix reads the captured context and suggests the likely cause, a fix, and the files most likely involved.
- **Hand off to a coding agent.** Turn a note into a clean prompt or a GitHub issue, then assign it to Copilot or your own workflow.

## Install

```bash
git clone https://github.com/vynix-in/vynix-public-api-examples
```

> Note: the Vynix toolkit is rolling out. If an example depends on a package, command, or endpoint that is not available yet, watch this repo for updates and use the hosted product at [vynix.in](https://vynix.in) in the meantime.

## Usage

Each folder is a self-contained example that calls the public Vynix API. Add your project key, then run the example.

```bash
cd vynix-public-api-examples/list-annotations
export VYNIX_PROJECT_KEY=YOUR_PROJECT_KEY
node index.js
```

Replace `YOUR_PROJECT_KEY` with your Vynix project key.

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

vynix, bug-reporting, visual-feedback, website-annotation, ai-diagnosis, developer-tools, feedback-tool, api-examples, sample-code, tutorial, rest-api

## About Vynix

Vynix is the feedback layer for teams building with AI coding agents. Point at a bug on any live website, and Vynix captures the context, diagnoses the likely cause, and hands it to your coding agent. Start free at [vynix.in](https://vynix.in).

## License

MIT, see [LICENSE](./LICENSE).