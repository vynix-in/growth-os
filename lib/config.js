// Configuration loader. Reads JSON config and merges environment overrides.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

export const config = readJson(path.join(ROOT, 'config', 'system.json'));
export const agentsConfig = readJson(path.join(ROOT, 'config', 'agents.json'));

// Resolve a path relative to the growth workspace root.
export function p(...parts) {
  return path.join(ROOT, ...parts);
}

// Read an environment value with a fallback.
export function env(name, fallback = '') {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : v;
}

export const paths = {
  database: p('database'),
  queue: p('queue'),
  logs: p('logs'),
  reports: p('reports'),
  github: p('github'),
  seo: p('seo'),
  content: p('content'),
  comparisons: p('comparisons'),
  directories: p('directories'),
  knowledgebase: p('knowledgebase'),
  assets: p('assets'),
  dashboardData: p('dashboard', 'data'),
};

// Make sure every working directory exists.
export function ensureDirs() {
  for (const dir of Object.values(paths)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
