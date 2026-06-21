# Vynix GitHub Action

> GitHub Action to turn Vynix website feedback into issues for your coding agents.

[![Website](https://img.shields.io/badge/website-vynix.in-008448)](https://vynix.in)
[![Docs](https://img.shields.io/badge/docs-vynix.in%2Fdocs-008448)](https://vynix.in/docs)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Vynix GitHub Action is part of the [Vynix](https://vynix.in) developer toolkit. It connects Vynix feedback to your GitHub workflow so visual reports, captured context, and AI diagnosis can be turned into issues for coding agents.

## What is Vynix?

Vynix is a website annotation and developer-context tool. Add a lightweight widget to any site, click the problem area, and Vynix captures the selected element, a screenshot, console and network context, and an AI diagnosis of the likely root cause.

From there, you can copy a ready-to-build prompt or open a GitHub issue and assign it to a coding agent.

Learn more at **[vynix.in](https://vynix.in)** or read the **[documentation](https://vynix.in/docs)**.

## Why teams use Vynix

- **Click-to-annotate any page.** Point at an element, region, or selected text and leave a note pinned to the exact problem area.
- **Automatic developer context.** Each note includes the element selector, page URL, screenshot, and a privacy-safe capture of console errors and network calls.
- **AI root-cause diagnosis.** Vynix reads the captured context and suggests the likely cause, a possible fix, and the files most likely involved.
- **Hand off to a coding agent.** Turn a note into a clean prompt or a GitHub issue, then assign it to Copilot or your own workflow.

## Install

Add the action to a workflow file in `.github/workflows/`.

Configure your Vynix project key as a GitHub repository secret, then reference it in the workflow step shown below.

> Note: the Vynix toolkit is rolling out. If the action version does not resolve yet, watch this repo for the release and use the hosted product at [vynix.in](https://vynix.in) in the meantime.

## Usage

Use the Vynix GitHub Action to turn Vynix feedback into issues, or to post build status back to your Vynix project.

```yaml
- name: Vynix
 uses: vynix-in/vynix-github-action@v1
 with:
 project-key: ${{ secrets.VYNIX_PROJECT_KEY }}
```

## Documentation

Full guides and the API reference live at [https://vynix.in/docs](https://vynix.in/docs).

## Related Vynix projects

- [Vynix Browser Extension](https://github.com/vynix-in/vynix-browser-extension)
- [Vynix JavaScript SDK](https://github.com/vynix-in/vynix-sdk-js)
- [Vynix PHP SDK](https://github.com/vynix-in/vynix-sdk-php)
- [Vynix Python SDK](https://github.com/vynix-in/vynix-sdk-python)
- [Vynix MCP Server](https://github.com/vynix-in/vynix-mcp)
- [Vynix VS Code Extension](https://github.com/vynix-in/vynix-vscode-extension)

Browse the full toolkit at the [Vynix GitHub organisation](https://github.com/vynix-in).

## Keywords

vynix, bug-reporting, visual-feedback, website-annotation, ai-diagnosis, developer-tools, feedback-tool, github-action, ci-cd, automation, devops

## About Vynix

Vynix is the feedback layer for teams building with AI coding agents. Point at a bug on any live website, and Vynix captures the context, diagnoses the likely cause, and hands it to your coding agent. Start free at [vynix.in](https://vynix.in).

## License

MIT, see [LICENSE](./LICENSE).