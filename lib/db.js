// A small JSON document store. Each collection is one JSON file on disk.
// No native dependencies, safe to run with plain node. Good enough for the
// volumes this system produces (thousands of records, not millions).
import fs from 'node:fs';
import path from 'node:path';
import { paths } from './config.js';
import { id as makeId, now } from './util.js';

function fileFor(collection) {
  fs.mkdirSync(paths.database, { recursive: true });
  return path.join(paths.database, `${collection}.json`);
}

function load(collection) {
  const file = fileFor(collection);
  if (!fs.existsSync(file)) return [];
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return [];
  }
}

function save(collection, rows) {
  const file = fileFor(collection);
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(rows, null, 2));
  fs.renameSync(tmp, file); // atomic replace
}

function matches(row, where) {
  return Object.entries(where).every(([k, v]) => row[k] === v);
}

export function db(collection) {
  return {
    all() {
      return load(collection);
    },
    find(where = {}) {
      return load(collection).filter((r) => matches(r, where));
    },
    findOne(where = {}) {
      return load(collection).find((r) => matches(r, where)) || null;
    },
    count(where = {}) {
      return this.find(where).length;
    },
    // Insert a new row. Generates an id and timestamps if missing.
    insert(row) {
      const rows = load(collection);
      const record = {
        id: row.id || makeId(collection.slice(0, 3)),
        created_at: row.created_at || now(),
        updated_at: now(),
        ...row,
      };
      rows.push(record);
      save(collection, rows);
      return record;
    },
    // Insert or update by a unique key (default "key").
    upsert(row, uniqueKey = 'key') {
      const rows = load(collection);
      const idx = rows.findIndex((r) => r[uniqueKey] === row[uniqueKey]);
      if (idx === -1) {
        return this.insert(row);
      }
      rows[idx] = { ...rows[idx], ...row, updated_at: now() };
      save(collection, rows);
      return rows[idx];
    },
    update(where, patch) {
      const rows = load(collection);
      let changed = 0;
      for (const r of rows) {
        if (matches(r, where)) {
          Object.assign(r, patch, { updated_at: now() });
          changed += 1;
        }
      }
      save(collection, rows);
      return changed;
    },
    remove(where) {
      const rows = load(collection);
      const kept = rows.filter((r) => !matches(r, where));
      save(collection, kept);
      return rows.length - kept.length;
    },
    replaceAll(rows) {
      save(collection, rows);
      return rows.length;
    },
  };
}

// The collections this system uses.
export const collections = [
  'agents',
  'tasks',
  'repos',
  'directories',
  'submissions',
  'content',
  'comparisons',
  'knowledgebase',
  'links',
  'opensource',
  'reports',
  'gate_scans',
  'metrics',
];
