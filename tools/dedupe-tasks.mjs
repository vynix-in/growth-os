import { queue } from '../lib/queue.js';

const seen = new Set();
const removed = queue.removeWhere((t) => {
  let id = null;
  if (t.type === 'distribution-publish') id = 'dist:' + (t.payload?.url || '');
  else if (t.type === 'opensource-approve') id = 'os:' + (t.payload?.repo || '');
  if (!id) return false;
  if (seen.has(id)) return true;
  seen.add(id);
  return false;
});
console.log('deduped', removed, 'tasks');
