// GitHub SEO Agent (Phase 3)
//
// Proposes public repositories for the vynix-in organisation and generates the
// content each one needs for search visibility and for sending readers back to
// Vynix: a keyword-rich README with real install and usage steps, a GitHub
// Pages landing page, docs, an example, release notes, a contributing guide,
// and repository metadata (description, homepage, topics).
//
// Nothing is pushed here. Every repository proposal lands in the approval queue
// so a human reviews it before it goes public. The publisher reads the metadata
// this agent writes to set the homepage and topics on GitHub.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { complete } from '../lib/ai.js';
import { humanizeText } from '../lib/humanize.js';
import { scanText } from '../lib/publication-gate.js';
import { publicComponents, product, features } from '../lib/vynix-facts.js';
import { humanDate } from '../lib/util.js';

const log = logger('github-seo');
const repos = db('repos');

export const meta = { id: 'github-seo', name: 'GitHub SEO Agent' };

function repoDir(name) {
  const dir = path.join(paths.github, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// Per-component search keywords (used in the README, the meta description, and
// the GitHub repository topics).
function keywordsFor(component) {
  const base = ['vynix', 'bug-reporting', 'visual-feedback', 'website-annotation', 'ai-diagnosis', 'developer-tools', 'feedback-tool'];
  const byKind = {
    extension: ['browser-extension', 'chrome-extension', 'bug-capture', 'screenshot'],
    sdk: ['sdk', 'api-client', 'integration', 'javascript'],
    mcp: ['mcp', 'model-context-protocol', 'ai-agents', 'claude', 'copilot'],
    action: ['github-action', 'ci-cd', 'automation', 'devops'],
    editor: ['vscode-extension', 'editor-integration', 'productivity'],
    cli: ['cli', 'command-line', 'automation', 'devtools'],
    examples: ['api-examples', 'sample-code', 'tutorial', 'rest-api'],
    templates: ['templates', 'boilerplate', 'starter-kit'],
    docs: ['documentation', 'developer-docs', 'guides', 'api-reference'],
  };
  return [...base, ...(byKind[component.kind] || [])];
}

// Real, useful install and usage snippets per component type. These give the
// README genuine content instead of placeholders, which is what search engines
// and readers reward.
function howTo(component) {
  switch (component.kind) {
    case 'extension':
      return {
        install: `1. Install the Vynix browser extension from your browser's extension store.
2. Pin it to your toolbar.
3. Sign in with your Vynix account from ${product.website}.`,
        usage: `Click the Vynix icon on any page, point at the element you want to report, and add a note. The extension captures the element, a screenshot, and the page context, then sends it to your Vynix project.`,
        code: `// The extension needs no code. Configure your project key at:
// ${product.website}`,
      };
    case 'sdk':
      if (component.key === 'sdk-php') {
        return {
          install: '```bash\ncomposer require vynix/sdk\n```',
          usage: 'Create a client with your project key and send feedback or read annotations from your PHP application.',
          code: "```php\n<?php\nuse Vynix\\Client;\n\n$vynix = new Client('YOUR_PROJECT_KEY');\n$annotations = $vynix->annotations()->list();\n```",
        };
      }
      if (component.key === 'sdk-python') {
        return {
          install: '```bash\npip install vynix\n```',
          usage: 'Create a client with your project key and read or create annotations from Python.',
          code: "```python\nfrom vynix import Vynix\n\nvynix = Vynix(project_key=\"YOUR_PROJECT_KEY\")\nfor note in vynix.annotations.list():\n    print(note.title)\n```",
        };
      }
      return {
        install: '```bash\nnpm install @vynix/sdk\n```',
        usage: 'Create a client with your project key and read or create annotations from JavaScript or TypeScript.',
        code: "```js\nimport { Vynix } from '@vynix/sdk';\n\nconst vynix = new Vynix({ projectKey: 'YOUR_PROJECT_KEY' });\nconst notes = await vynix.annotations.list();\n```",
      };
    case 'mcp':
      return {
        install: '```bash\nnpx -y @vynix/mcp\n```',
        usage: `Add the Vynix MCP server to your AI client (Claude Desktop, Cursor, or any MCP-aware agent) so it can read your Vynix feedback and open issues.`,
        code: `\`\`\`json
{
  "mcpServers": {
    "vynix": {
      "command": "npx",
      "args": ["-y", "@vynix/mcp"],
      "env": { "VYNIX_API_TOKEN": "YOUR_TOKEN" }
    }
  }
}
\`\`\``,
      };
    case 'action':
      return {
        install: 'Add the action to a workflow file in `.github/workflows/`.',
        usage: 'Use the Vynix GitHub Action to turn Vynix feedback into issues, or to post build status back to your Vynix project.',
        code: `\`\`\`yaml
- name: Vynix
  uses: vynix-in/vynix-github-action@v1
  with:
    project-key: \${{ secrets.VYNIX_PROJECT_KEY }}
\`\`\``,
      };
    case 'editor':
      return {
        install: 'Install the Vynix extension from the VS Code Marketplace.',
        usage: 'Open the Vynix panel in VS Code to see incoming feedback and turn a note into a task without leaving your editor.',
        code: `// Configure your project key in VS Code settings: vynix.projectKey`,
      };
    case 'cli':
      return {
        install: '```bash\nnpm install -g @vynix/cli\n```',
        usage: 'Use the Vynix CLI to list feedback, create issues, and check project status from your terminal.',
        code: "```bash\nvynix login\nvynix annotations list\nvynix issue create <annotation-id>\n```",
      };
    case 'examples':
      return {
        install: '```bash\ngit clone https://github.com/vynix-in/vynix-public-api-examples\n```',
        usage: 'Each folder is a self-contained example that calls the public Vynix API. Add your project key and run it.',
        code: "```bash\ncd vynix-public-api-examples/list-annotations\nexport VYNIX_PROJECT_KEY=YOUR_PROJECT_KEY\nnode index.js\n```",
      };
    case 'templates':
      return {
        install: 'Click "Use this template" on GitHub to start a new project.',
        usage: 'These templates come with the Vynix widget pre-wired so you can collect feedback from day one.',
        code: "```bash\n# After creating from the template:\nnpm install\nnpm run dev\n```",
      };
    case 'docs':
      return {
        install: 'No install needed. Read the docs online.',
        usage: `Browse the guides and the API reference, then try Vynix on your own site.`,
        code: `// Full documentation: ${product.docs}`,
      };
    default:
      return { install: 'See the documentation.', usage: 'See the documentation.', code: '' };
  }
}

// Cross-links to the other Vynix open-source projects. Internal links between
// repositories help search engines understand the cluster and pass authority.
function relatedProjects(component) {
  return publicComponents
    .filter((c) => c.repo !== component.repo)
    .slice(0, 6)
    .map((c) => `- [${c.name}](https://github.com/vynix-in/${c.repo})`)
    .join('\n');
}

function description(component) {
  const map = {
    extension: 'Vynix browser extension for visual bug reporting and website feedback with AI diagnosis.',
    sdk: `${component.name}: a client for the Vynix bug reporting and website feedback API.`,
    mcp: 'Vynix MCP server. Give AI coding agents access to your visual feedback and bug reports.',
    action: 'GitHub Action to turn Vynix website feedback into issues for your coding agents.',
    editor: 'Vynix for VS Code. See website feedback and bug reports inside your editor.',
    cli: 'Command-line tool for Vynix bug reporting, feedback, and issue creation.',
    examples: 'Working code examples for the public Vynix API.',
    templates: 'Starter templates with the Vynix feedback widget pre-installed.',
    docs: 'Developer documentation for Vynix, the AI-native website annotation tool.',
  };
  return map[component.kind] || `${component.name} — part of the Vynix developer toolkit.`;
}

function readmeTemplate(component) {
  const ht = howTo(component);
  const kw = keywordsFor(component);
  const featureList = features.slice(0, 4).map((f) => `- **${f.title}.** ${f.blurb}`).join('\n');
  return `# ${component.name}

> ${description(component)}

[![Website](https://img.shields.io/badge/website-vynix.in-008448)](${product.website})
[![Docs](https://img.shields.io/badge/docs-vynix.in%2Fdocs-008448)](${product.docs})
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

${component.name} is part of the [Vynix](${product.website}) developer toolkit. ${product.oneLiner} This project helps you connect Vynix to your workflow so visual feedback and AI diagnosis reach your code faster.

## What is Vynix?

${product.what}

Learn more at **[vynix.in](${product.website})** or read the **[documentation](${product.docs})**.

## Why teams use Vynix

${featureList}

## Install

${ht.install}

> Note: the Vynix toolkit is rolling out. If a package or command above does not resolve yet, watch this repo for the release and use the hosted product at [vynix.in](${product.website}) in the meantime.

## Usage

${ht.usage}

${ht.code}

## Documentation

Full guides and the API reference live at [${product.docs}](${product.docs}).

## Related Vynix projects

${relatedProjects(component)}

Browse the full toolkit at the [Vynix GitHub organisation](${product.githubOrg}).

## Keywords

${kw.join(', ')}

## About Vynix

Vynix is the feedback layer for teams building with AI coding agents. Point at a bug on any live website, and Vynix captures the context, diagnoses the likely cause, and hands it to your coding agent. Start free at [vynix.in](${product.website}).

## License

MIT — see [LICENSE](./LICENSE).
`;
}

async function readme(component) {
  const fallback = () => readmeTemplate(component);
  // Use AI to polish the template when a key is available; otherwise keep the
  // strong template. Either way the result is SEO-rich and links back to Vynix.
  const { text, source } = await complete({
    system:
      'You improve README files for open-source developer tools. Keep all links, badges, keywords, and the "Related Vynix projects" and "About Vynix" sections intact. Do not remove backlinks to vynix.in. Improve clarity and keep it plain and factual. Return Markdown only.',
    prompt: `Improve this README. Keep every link to vynix.in and every section. Do not invent install commands that differ from the ones given.\n\n${readmeTemplate(component)}`,
    maxTokens: 1100,
    fallback,
  });
  // Guard: if the AI dropped the Vynix backlink, fall back to the template.
  const safe = text.includes('vynix.in') ? text : readmeTemplate(component);
  return { text: safe, source };
}

// A GitHub Pages landing page (served from /docs on the default branch). It is
// indexable, links back to Vynix, and sets a canonical URL.
function pagesIndex(component) {
  const kw = keywordsFor(component).join(', ');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${component.name} — Vynix</title>
<meta name="description" content="${description(component)}" />
<meta name="keywords" content="${kw}" />
<link rel="canonical" href="https://vynix-in.github.io/${component.repo}/" />
<meta property="og:title" content="${component.name} — Vynix" />
<meta property="og:description" content="${description(component)}" />
<meta property="og:url" content="${product.website}" />
<style>
  body { font-family: system-ui, sans-serif; max-width: 760px; margin: 48px auto; padding: 0 20px; color: #0f172a; line-height: 1.6; }
  a { color: #008448; }
  .cta { display: inline-block; margin-top: 16px; background: #008448; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; }
  header { border-bottom: 1px solid #e2e8f0; padding-bottom: 16px; margin-bottom: 24px; }
</style>
</head>
<body>
<header>
  <h1>${component.name}</h1>
  <p>${description(component)}</p>
</header>
<p>${product.what}</p>
<p>${component.name} is part of the <a href="${product.website}">Vynix</a> developer toolkit.</p>
<h2>Get started</h2>
<ul>
  <li><a href="https://github.com/vynix-in/${component.repo}">Source on GitHub</a></li>
  <li><a href="${product.docs}">Vynix documentation</a></li>
  <li><a href="${product.githubOrg}">All Vynix open-source projects</a></li>
</ul>
<a class="cta" href="${product.website}">Try Vynix free</a>
</body>
</html>
`;
}

function docsPage(component) {
  return `# ${component.name} — Overview

${product.oneLiner}

This page introduces ${component.name} and links back to the main Vynix documentation.

## Where this fits

${product.what}

## Next steps

- Read the [Vynix documentation](${product.docs}).
- Browse the other Vynix open-source projects at [${product.githubOrg}](${product.githubOrg}).
- Try Vynix at [${product.website}](${product.website}).
`;
}

function releaseNotes(component) {
  return `# Release notes — ${component.name}

## v0.1.0 — ${humanDate()}

First public release.

- Initial project scaffold and documentation.
- Links to the [Vynix website](${product.website}) and [documentation](${product.docs}).
- Ready for community feedback.

For product feedback, use Vynix itself at [${product.website}](${product.website}).
`;
}

function example(component) {
  const ht = howTo(component);
  return `# Example

A minimal example for ${component.name}.

Get your project key from [${product.website}](${product.website}), then:

${ht.code}

See the [README](../README.md) for full setup, and the [Vynix docs](${product.docs}) for the API reference.
`;
}

function contributing(component) {
  return `# Contributing to ${component.name}

Thanks for your interest in improving ${component.name}, part of the [Vynix](${product.website}) toolkit.

## How to help

- Open an issue for bugs or ideas.
- Send a pull request for fixes and small improvements.
- Improve the documentation.

## Ground rules

- Keep changes focused and well described.
- Be kind in reviews and discussions.

For product feedback about Vynix itself, the fastest path is to use Vynix on your own site at [${product.website}](${product.website}).
`;
}

function repoMeta(component) {
  return {
    name: component.repo,
    description: description(component),
    homepage: product.website,
    topics: keywordsFor(component).slice(0, 18),
  };
}

async function buildRepo(component) {
  const dir = repoDir(component.repo);
  const { text: readmeText, source } = await readme(component);

  const files = {
    'README.md': readmeText,
    'docs/index.html': pagesIndex(component),
    'docs/overview.md': docsPage(component),
    'CHANGELOG.md': releaseNotes(component),
    'CONTRIBUTING.md': contributing(component),
    'examples/README.md': example(component),
    '.gitignore': 'repo-meta.json\n',
    'LICENSE': mitLicense(),
  };

  const violations = [];
  for (const [name, content] of Object.entries(files)) {
    const scan = scanText(content, `${component.repo}/${name}`);
    if (!scan.clean) violations.push({ file: name, violations: scan.violations });
  }

  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, name === 'LICENSE' ? content : humanizeText(content));
  }
  // Write the repository metadata the publisher uses for homepage + topics.
  fs.writeFileSync(path.join(dir, 'repo-meta.json'), JSON.stringify(repoMeta(component), null, 2));

  const record = repos.upsert(
    {
      key: component.repo,
      name: component.repo,
      title: component.name,
      kind: component.kind,
      org: 'vynix-in',
      description: description(component),
      homepage: product.website,
      topics: keywordsFor(component).slice(0, 18),
      keywords: keywordsFor(component),
      path: path.relative(paths.github, dir),
      status: violations.length ? 'blocked' : 'proposed',
      gate_violations: violations,
      ai_source: source,
    },
    'key',
  );

  queue.add(
    'github-publish',
    { repo: component.repo, title: component.name, path: record.path },
    { agent: 'github-seo', approval: violations.length ? APPROVAL.REJECTED : APPROVAL.PENDING, priority: 2 },
  );

  log.info(`prepared repo proposal "${component.repo}"`, { status: record.status, source });
  return record;
}

function mitLicense() {
  const year = new Date().getFullYear();
  return `MIT License

Copyright (c) ${year} Vynix

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
`;
}

export async function run(payload = {}) {
  const targets = payload.only
    ? publicComponents.filter((c) => c.repo === payload.only || c.key === payload.only)
    : publicComponents;

  const built = [];
  for (const component of targets) {
    built.push(await buildRepo(component));
  }
  log.info(`built ${built.length} repository proposals`);
  return { built: built.length, repos: built.map((r) => r.name) };
}

export default { meta, run };
