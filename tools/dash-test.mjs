// Functional test of the dashboard: real data + working approve/reject actions.
const B = 'http://127.0.0.1:4310';
const j = async (path, opts) => (await fetch(B + path, opts)).json();

const snap = await j('/api/snapshot');
console.log('snapshot has totals:', !!snap.totals, '| live pages:', snap.published.site_pages, '| crawl:', snap.crawl.live + '/' + snap.crawl.total);

const q = await j('/api/queue');
console.log('queue awaiting:', q.awaiting.length);

// Pick one pending task and round-trip approve -> verify -> restore to pending.
const task = q.awaiting[0];
if (!task) {
  console.log('no pending task to test approve with');
} else {
  console.log('testing approve on task:', task.id, '(' + task.type + ')');
  const a = await j('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id }) });
  console.log('  approve response ok:', a.ok);
  const q2 = await j('/api/queue');
  const stillThere = q2.awaiting.some((t) => t.id === task.id);
  console.log('  task removed from awaiting after approve:', !stillThere);

  // Test reject endpoint too (on the same task, then restore).
  const r = await j('/api/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, reason: 'functional test' }) });
  console.log('  reject response ok:', r.ok);

  // Restore the task to pending so we change nothing permanently.
  const { db } = await import('../lib/db.js');
  db('tasks').update({ id: task.id }, { approval: 'pending_approval', reject_reason: undefined });
  const q3 = await j('/api/queue');
  console.log('  restored to pending:', q3.awaiting.some((t) => t.id === task.id));
}

// Progress API
const p = await j('/api/progress');
console.log('progress: inventory blog=' + p.inventory_counts.blog, '| growth goals=' + p.growth.goals.length, '| activity=' + p.activity.length, '| crawl live=' + p.crawl.live);
console.log('FUNCTIONAL TEST DONE');
