// AI router. Talks to Azure AI Foundry (the same gpt-5.5 deployment the Vynix
// product uses) when keys are present, and falls back to deterministic
// templates when they are not, so the whole system runs with or without AI.
//
// Notes that come from running gpt-5.5 in production:
//   - reasoning models reject "max_tokens"; send "max_completion_tokens"
//   - reasoning models reject a custom "temperature"; omit it
//   - the api-version must be a valid GA version (2024-10-21)
import { config, env } from './config.js';
import { logger } from './logger.js';
import { db } from './db.js';
import { sleep } from './util.js';

const log = logger('ai');
const usage = db('metrics');

function isReasoning(model) {
  return /^(o[1-9]|gpt-5)/i.test(model || '');
}

function endpointFor(deployment, apiVersion) {
  const base = env(config.ai.envEndpoint).replace(/\/+$/, '');
  return `${base}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;
}

export function aiConfigured() {
  return Boolean(env(config.ai.envEndpoint) && env(config.ai.envApiKey) && env(config.ai.envDeployment));
}

// Run a chat completion. Returns { text, model, source }.
// On any failure or when unconfigured, the caller's fallback() is used.
export async function complete({ system, prompt, maxTokens = 1200, json = false, fallback }) {
  const model = env(config.ai.envDeployment, 'gpt-5.5');
  if (!aiConfigured()) {
    return { text: runFallback(fallback, prompt), model: 'template', source: 'fallback' };
  }

  const apiVersion = env(config.ai.envApiVersion, config.ai.defaultApiVersion);
  const url = endpointFor(model, apiVersion);
  const reasoning = isReasoning(model);

  const body = {
    messages: [
      system ? { role: 'system', content: system } : null,
      { role: 'user', content: prompt },
    ].filter(Boolean),
  };
  if (reasoning) {
    body.max_completion_tokens = maxTokens + config.ai.reasoningTokenHeadroom;
  } else {
    body.max_tokens = maxTokens;
    body.temperature = 0.4;
  }
  if (json) body.response_format = { type: 'json_object' };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'api-key': env(config.ai.envApiKey) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const detail = await res.text();
        throw new Error(`HTTP ${res.status}: ${detail.slice(0, 300)}`);
      }
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim() || '';
      const tokens = data?.usage?.total_tokens || 0;
      usage.insert({ kind: 'ai_call', model, tokens, attempt });
      if (!text) throw new Error('empty completion');
      return { text, model, source: 'azure' };
    } catch (err) {
      log.warn(`completion attempt ${attempt} failed`, { error: String(err) });
      if (attempt === 3) {
        return { text: runFallback(fallback, prompt), model: 'template', source: 'fallback' };
      }
      await sleep(500 * attempt);
    }
  }
  return { text: runFallback(fallback, prompt), model: 'template', source: 'fallback' };
}

function runFallback(fallback, prompt) {
  if (typeof fallback === 'function') return fallback();
  if (typeof fallback === 'string') return fallback;
  return prompt;
}

// Helper: ask for JSON and parse it, with a default on failure.
export async function completeJson({ system, prompt, maxTokens = 1200, fallback, defaultValue }) {
  const { text, source } = await complete({ system, prompt, maxTokens, json: true, fallback });
  try {
    const cleaned = text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    return { value: JSON.parse(cleaned), source };
  } catch {
    return { value: defaultValue, source: 'fallback' };
  }
}
