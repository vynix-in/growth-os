// Activity log. A single, capped feed of the meaningful things the system does,
// so the progress page can show a timeline. Stored as one collection that is
// trimmed to the most recent entries, so it never grows without bound.
import { db } from './db.js';
import { now } from './util.js';

const activity = db('activity');
const MAX = 500;

export function record(type, message, meta = {}) {
  const rows = activity.all();
  if (rows.length >= MAX) activity.replaceAll(rows.slice(-(MAX - 1)));
  return activity.insert({ type, message, meta, at: now() });
}

export function recent(limit = 60) {
  return activity
    .all()
    .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
    .slice(0, limit);
}

export default { record, recent };
