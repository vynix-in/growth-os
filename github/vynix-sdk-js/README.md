# Vynix JavaScript SDK

> Vynix JavaScript SDK: a client for the Vynix bug reporting and website feedback API.

[![Website](https://img.shields.io/badge/website-vynix.in-008448)](https://vynix.in)
[![Docs](https://img.shields.io/badge/docs-vynix.in%2Fdocs-008448)](https://vynix.in/docs)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

Vynix JavaScript SDK is part of the [Vynix](https://vynix.in) developer toolkit. It helps JavaScript and TypeScript applications connect to the Vynix API for bug reports, website feedback, annotations, and developer context.

Vynix is built for teams that use AI coding agents. It captures visual feedback and debugging context so issues can move from a website to code faster.

## What is Vynix?

Vynix is a website annotation and developer-context tool. Add a lightweight widget to a site, click the part of the page that is wrong, and Vynix captures useful context, including the selected element, a screenshot, console output, network activity, and an AI diagnosis of the likely root cause.

You can then copy a ready-to-build prompt or open a GitHub issue and assign it to a coding agent.

Learn more at **[vynix.in](https://vynix.in)** or read the **[documentation](https://vynix.in/docs)**.

## Why teams use Vynix

- **Click-to-annotate any page.** Point at an element, a region, or selected text and leave a note pinned to the relevant place.
- **Automatic developer context.** Each note can include the element selector, page URL, screenshot, and a privacy-safe capture of console errors and network calls.
- **AI root-cause diagnosis.** Vynix uses the captured context to suggest the likely cause, a fix, and the files most likely involved.
- **Hand off to a coding agent.** Convert a note into a clear prompt or GitHub issue, then assign it to Copilot or your own workflow.

## Install

```bash
npm install @vynix/sdk
```

> Note: the Vynix toolkit is rolling out. If a package or command above does not resolve yet, watch this repo for the release and use the hosted product at [vynix.in](https://vynix.in) in the meantime.

## Usage

Create a client with your project key, then read or create annotations from JavaScript or TypeScript.

```js
import { Vynix } from '@vynix/sdk';

const vynix = new Vynix({ projectKey: 'YOUR_PROJECT_KEY' });
const notes = await vynix.annotations.list();
```

## Documentation

Full guides and the API reference are available at [https://vynix.in/docs](https://vynix.in/docs).

## Related Vynix projects

- [Vynix Browser Extension](https://github.com/vynix-in/vynix-browser-extension)
- [Vynix PHP SDK](https://github.com/vynix-in/vynix-sdk-php)
- [Vynix Python SDK](https://github.com/vynix-in/vynix-sdk-python)
- [Vynix MCP Server](https://github.com/vynix-in/vynix-mcp)
- [Vynix GitHub Action](https://github.com/vynix-in/vynix-github-action)
- [Vynix VS Code Extension](https://github.com/vynix-in/vynix-vscode-extension)

Browse the full toolkit at the [Vynix GitHub organisation](https://github.com/vynix-in).

## Keywords

vynix, bug-reporting, visual-feedback, website-annotation, ai-diagnosis, developer-tools, feedback-tool, sdk, api-client, integration, javascript

## About Vynix

Vynix is the feedback layer for teams building with AI coding agents. Point at a bug on any live website, and Vynix captures the context, diagnoses the likely cause, and hands it to your coding agent. Start free at [vynix.in](https://vynix.in).

## License

MIT, see [LICENSE](./LICENSE).