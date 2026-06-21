// Public facts about Vynix. Everything here is safe to publish. Agents read
// from this file instead of the private product code so generated content can
// never accidentally pull in proprietary detail.

export const product = {
  name: 'Vynix',
  tagline: 'Point it. Capture it. Ship it.',
  oneLiner: 'The feedback layer for teams that build with AI coding agents.',
  what:
    'Vynix is a website annotation and developer-context tool. Drop a lightweight widget on any site, click on what is wrong, and Vynix captures the element, a screenshot, the console and network context, and an AI diagnosis of the likely root cause. From there you can copy a ready-to-build prompt or open a GitHub issue and assign it to a coding agent.',
  website: 'https://vynix.in',
  docs: 'https://vynix.in/docs',
  blog: 'https://vynix.in/blog',
  pricingUrl: 'https://vynix.in/pricing',
  githubOrg: 'https://github.com/vynix-in',
};

export const audiences = [
  'Front-end and full-stack engineers',
  'Product designers reviewing live sites',
  'QA and support teams filing reproducible bugs',
  'Founders and indie hackers shipping with AI agents',
  'Agencies collecting client feedback on staging sites',
];

export const features = [
  {
    key: 'visual-annotation',
    title: 'Click-to-annotate any page',
    blurb: 'Point at an element, a region, or selected text and leave a note pinned exactly where the problem is.',
  },
  {
    key: 'context-capture',
    title: 'Automatic developer context',
    blurb: 'Every note carries the element selector, page URL, screenshot, and a privacy-safe capture of console errors and network calls.',
  },
  {
    key: 'ai-diagnosis',
    title: 'AI root-cause diagnosis',
    blurb: 'Vynix reads the captured context and suggests the likely cause, a fix, and the files most likely involved.',
  },
  {
    key: 'agent-handoff',
    title: 'Hand off to a coding agent',
    blurb: 'Turn a note into a clean prompt or a GitHub issue, then assign it to Copilot or your own workflow.',
  },
  {
    key: 'review-rounds',
    title: 'Review rounds',
    blurb: 'Group a batch of notes into a single review and let Vynix cluster them into a short list of fixes.',
  },
  {
    key: 'team',
    title: 'Projects, roles and sharing',
    blurb: 'Organise feedback by project, invite teammates, and share read-only links.',
  },
];

export const valueProps = [
  'Feedback that already contains the context an engineer needs to fix it.',
  'An AI diagnosis attached to every report, not a separate manual step.',
  'A direct path from a visual note to a GitHub issue and a coding agent.',
  'A widget that installs with one script tag and works on any framework.',
];

// Competitors used by the comparison agent. Only public, well-known facts.
export const competitors = [
  { name: 'Jam', slug: 'jam', category: 'Bug reporting', focus: 'one-click bug reports with console and network logs' },
  { name: 'Marker.io', slug: 'marker-io', category: 'Visual feedback', focus: 'visual website feedback that syncs to issue trackers' },
  { name: 'Usersnap', slug: 'usersnap', category: 'Feedback platform', focus: 'feedback and bug capture with surveys' },
  { name: 'Sentry', slug: 'sentry', category: 'Error monitoring', focus: 'automatic application error and performance monitoring' },
  { name: 'Bugsnag', slug: 'bugsnag', category: 'Error monitoring', focus: 'stability monitoring and crash reporting' },
  { name: 'LogRocket', slug: 'logrocket', category: 'Session replay', focus: 'session replay and front-end monitoring' },
  { name: 'Hotjar', slug: 'hotjar', category: 'Product analytics', focus: 'heatmaps and session recordings' },
  { name: 'Instabug', slug: 'instabug', category: 'Mobile feedback', focus: 'in-app bug reporting for mobile apps' },
  { name: 'Linear', slug: 'linear', category: 'Issue tracking', focus: 'fast issue tracking for software teams' },
  { name: 'Jira', slug: 'jira', category: 'Issue tracking', focus: 'configurable project and issue management' },
  { name: 'BugHerd', slug: 'bugherd', category: 'Visual feedback', focus: 'point-and-click website feedback for agencies' },
  { name: 'Userback', slug: 'userback', category: 'Visual feedback', focus: 'visual feedback and bug tracking' },
];

// Open-source candidate components. These are the parts that are safe to
// publish. The open-source funnel agent reasons over this list, and the rules
// below define what must never leave the private repo.
export const publicComponents = [
  { key: 'browser-extension', name: 'Vynix Browser Extension', kind: 'extension', repo: 'vynix-browser-extension' },
  { key: 'sdk-js', name: 'Vynix JavaScript SDK', kind: 'sdk', repo: 'vynix-sdk-js' },
  { key: 'sdk-php', name: 'Vynix PHP SDK', kind: 'sdk', repo: 'vynix-sdk-php' },
  { key: 'sdk-python', name: 'Vynix Python SDK', kind: 'sdk', repo: 'vynix-sdk-python' },
  { key: 'mcp', name: 'Vynix MCP Server', kind: 'mcp', repo: 'vynix-mcp' },
  { key: 'github-action', name: 'Vynix GitHub Action', kind: 'action', repo: 'vynix-github-action' },
  { key: 'vscode', name: 'Vynix VS Code Extension', kind: 'editor', repo: 'vynix-vscode-extension' },
  { key: 'cli', name: 'Vynix CLI', kind: 'cli', repo: 'vynix-cli' },
  { key: 'api-examples', name: 'Vynix Public API Examples', kind: 'examples', repo: 'vynix-public-api-examples' },
  { key: 'templates', name: 'Vynix Templates', kind: 'templates', repo: 'vynix-templates' },
  { key: 'docs', name: 'Vynix Developer Docs', kind: 'docs', repo: 'vynix-docs' },
];

export const neverPublish = [
  'Backend application code',
  'Internal REST API implementation',
  'AI diagnosis engine implementation',
  'Authentication and billing logic',
  'Database schemas and migrations',
  'Customer data and screenshots',
  'Internal architecture diagrams',
  'Anything under the private PinPoint backend namespace',
];
