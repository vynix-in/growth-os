// Agent registry and runner. Loads agent modules by id, runs them, and records
// each run in the "agents" collection so the dashboard can show history.
import { agentsConfig, p } from '../lib/config.js';
import { db } from '../lib/db.js';
import { logger } from '../lib/logger.js';
import { now } from '../lib/util.js';
import { record as recordActivity } from '../lib/activity.js';

const log = logger('runner');
const runs = db('agents');

export function listAgents() {
  return agentsConfig.agents;
}

export function findAgent(id) {
  return agentsConfig.agents.find((a) => a.id === id) || null;
}

async function load(agent) {
  const mod = await import(p(agent.module));
  return mod.default || mod;
}

// Run a single agent by id. Records start, finish, result or error.
export async function runAgent(id, payload = {}) {
  const agent = findAgent(id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  if (!agent.enabled) {
    log.warn(`agent "${id}" is disabled, skipping`);
    return { skipped: true };
  }

  const startedAt = now();
  log.info(`running agent "${id}"`);
  try {
    const impl = await load(agent);
    const result = await impl.run(payload);
    runs.insert({ agent: id, status: 'done', started_at: startedAt, finished_at: now(), result });
    recordActivity('agent_run', `${agent.name} finished`, { agent: id, result });
    log.info(`agent "${id}" finished`, result);
    return result;
  } catch (err) {
    runs.insert({ agent: id, status: 'failed', started_at: startedAt, finished_at: now(), error: String(err) });
    recordActivity('agent_error', `${agent.name} failed`, { agent: id, error: String(err) });
    log.error(`agent "${id}" failed`, { error: String(err) });
    throw err;
  }
}

// Run several agents in sequence.
export async function runAgents(ids, payload = {}) {
  const out = {};
  for (const id of ids) {
    try {
      out[id] = await runAgent(id, payload);
    } catch (err) {
      out[id] = { error: String(err) };
    }
  }
  return out;
}
