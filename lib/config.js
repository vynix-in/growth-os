// Configuration loader. Reads JSON config and merges environment overrides.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Minimal .env loader (no dependency). Loads KEY=VALUE lines into process.env
// without overriding values that are already set. We load the growth .env
// first, then fall back to the Vynix backend .env so the same Azure keys power
// both. Secrets stay in those files, which are git-ignored.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && value !== '' && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

// Only these keys are imported from the backend .env fallback, so unrelated
// secrets never enter this process.
function loadEnvFileFiltered(file, allowedPrefixes) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!allowedPrefixes.some((pre) => key.startsWith(pre))) continue;
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && value !== '' && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(ROOT, '.env'));
loadEnvFileFiltered(path.resolve(ROOT, '..', 'backend', '.env'), ['AZURE_OPENAI_']);

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
