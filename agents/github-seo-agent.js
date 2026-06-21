// GitHub SEO Agent (Phase 3)
//
// Proposes public repositories for the vynix-in organisation and generates the
// content each one needs: a README, a short docs page, an example, and release
// notes. Nothing is pushed. Every repository proposal lands in the approval
// queue so a human reviews it before it goes public.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from '../lib/config.js';
import { db } from '../lib/db.js';
import { queue, APPROVAL } from '../lib/queue.js';
import { logger } from '../lib/logger.js';
import { complete } from '../lib/ai.js';
import { scanText } from '../lib/publication-gate.js';
import { publicComponents, product } from '../lib/vynix-facts.js';
import { slug, humanDate } from '../lib/util.js';

const log = logger('github-seo');
const repos = db('repos');

export const meta = { id: 'github-seo', name: 'GitHub SEO Agent' };

function repoDir(name) {
  const dir = path.join(paths.github, name);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function keywordsFor(component) {
  const base = ['vynix', 'bug reporting', 'visual feedback', 'website annotation', 'ai diagnosis', 'developer tools'];
  const byKind = {
    extension: ['browser extension', 'chrome extension', 'bug capture'],
    sdk: ['sdk', 'api client', 'integration'],
    mcp: ['model context protocol', 'mcp server', 'ai agents'],
    action: ['github action', 'ci', 'automation'],
    editor: ['vscode extension', 'editor integration'],
    cli: ['cli', 'command line', 'automation'],
    examples: ['api examples', 'sample code', 'tutorials'],
    templates: ['templates', 'boilerplate', 'starter'],
    docs: ['documentation', 'developer docs', 'guides'],
  };
  return [...base, ...(byKind[component.kind] || [])];
}

async function readme(component) {
  const keywords = keywordsFor(component);
  const fallback = () => `# ${component.name}

${product.oneLiner}

${component.name} is part of the [Vynix](${product.website}) developer toolkit. It helps you connect Vynix to your own workflow so visual feedback and AI diagnosis reach your code faster.

## What Vynix does

${product.what}

## Install

\`\`\`bash
# Installation steps go here once the package is published.
\`\`\`

## Usage

See the [example](./examples) folder for a working setup.

## Links

- Website: ${product.website}
- Documentation: ${product.docs}
- GitHub organisation: ${product.githubOrg}

## License

MIT
`;

  const { text, source } = await complete({
    system:
      'You write clear, plain README files for open-source developer tools. Avoid marketing fluff and buzzwords. Use short sentences. Write like an experienced engineer documenting their own project. Do not invent installation commands or API names you are not sure about; leave a placeholder instead.',
    prompt: `Write a README.md for an open-source repository called "${component.name}" in the Vynix GitHub organisation (${product.githubOrg}).

About Vynix: ${product.what}
This repository type: ${component.kind}.
Target keywords to include naturally (for search): ${keywords.join(', ')}.

Sections to include: a one-line summary, "What Vynix does", "Install" (use a placeholder if you are unsure), "Usage", "Links" (website ${product.website}, docs ${product.docs}, org ${product.githubOrg}), and "License" (MIT). Keep it under 350 words. Return Markdown only.`,
    maxTokens: 900,
    fallback,
  });
  return { text, source };
}

function docsPage(component) {
  return `# ${component.name} — Overview

${product.oneLiner}

This page introduces ${component.name} and links back to the main Vynix documentation.

## Where this fits

${product.what}

## Next steps

- Read the [Vynix documentation](${product.docs}).
- Browse the other Vynix open-source projects at ${product.githubOrg}.
- Try Vynix at ${product.website}.
`;
}

function releaseNotes(component) {
  return `# Release notes — ${component.name}

## v0.1.0 — ${humanDate()}

First public release.

- Initial project scaffold and documentation.
- Links to the Vynix website and documentation.
- Ready for community feedback.

Report problems or ideas through the issues tab. For product feedback, use Vynix itself at ${product.website}.
`;
}

function example(component) {
  return `# Example

A minimal example for ${component.name}.

Replace the placeholder values with your own Vynix project key from ${product.website}.

\`\`\`text
This example is a starting point. See the README for full setup instructions.
\`\`\`
`;
}

// Build one repository proposal end to end.
async function buildRepo(component) {
  const dir = repoDir(component.repo);
  const { text: readmeText, source } = await readme(component);

  const files = {
    'README.md': readmeText,
    'docs/overview.md': docsPage(component),
    'CHANGELOG.md': releaseNotes(component),
    'examples/README.md': example(component),
    'LICENSE': mitLicense(),
  };

  // Gate every file before writing the proposal to disk.
  const violations = [];
  for (const [name, content] of Object.entries(files)) {
    const scan = scanText(content, `${component.repo}/${name}`);
    if (!scan.clean) violations.push({ file: name, violations: scan.violations });
  }

  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content);
  }

  const record = repos.upsert(
    {
      key: component.repo,
      name: component.repo,
      title: component.name,
      kind: component.kind,
      org: 'vynix-in',
      keywords: keywordsFor(component),
      path: path.relative(paths.github, dir),
      status: violations.length ? 'blocked' : 'proposed',
      gate_violations: violations,
      ai_source: source,
    },
    'key',
  );

  // Queue for human approval before any publish.
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
