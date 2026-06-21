// File-backed logger. Writes both a rolling text log and a structured JSON log.
import fs from 'node:fs';
import path from 'node:path';
import { paths } from './config.js';
import { now } from './util.js';

function write(line) {
  fs.mkdirSync(paths.logs, { recursive: true });
  const day = now().slice(0, 10);
  fs.appendFileSync(path.join(paths.logs, `growth-${day}.log`), line + '\n');
}

function record(level, scope, message, data) {
  const stamp = now();
  const text = `[${stamp}] ${level.toUpperCase().padEnd(5)} ${scope} ${message}`;
  write(text);
  if (data !== undefined) {
    write('  ' + JSON.stringify(data));
  }
  // Mirror to the console so live runs are visible.
  const tag = level === 'error' ? 'ERROR' : level === 'warn' ? 'WARN ' : 'INFO ';
  process.stdout.write(`${tag} ${scope} ${message}\n`);
  return { stamp, level, scope, message, data };
}

export function logger(scope = 'system') {
  return {
    info: (message, data) => record('info', scope, message, data),
    warn: (message, data) => record('warn', scope, message, data),
    error: (message, data) => record('error', scope, message, data),
  };
}
