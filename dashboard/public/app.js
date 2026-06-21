// Dashboard front-end. Fetches the snapshot, renders the command center, and
// wires the approve/reject buttons.
const $ = (id) => document.getElementById(id);

async function getJson(url, opts) {
  const res = await fetch(url, opts);
  return res.json();
}

function statCard(num, label) {
  return `<div class="stat"><div class="num">${num}</div><div class="label">${label}</div></div>`;
}

function pill(text) {
  const cls = String(text).toLowerCase().replace(/[^a-z]/g, '');
  return `<span class="pill ${cls}">${text}</span>`;
}

function kvList(obj) {
  const entries = Object.entries(obj || {});
  if (!entries.length) return '<div class="empty">None yet</div>';
  return entries.map(([k, v]) => `<div class="kv"><span>${k.replace(/_/g, ' ')}</span><strong>${v}</strong></div>`).join('');
}

async function approve(id) {
  await getJson('/api/approve', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
  load();
}
async function reject(id) {
  const reason = prompt('Reason for rejecting (optional):') || '';
  await getJson('/api/reject', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, reason }) });
  load();
}
window.approve = approve;
window.reject = reject;

async function load() {
  const s = await getJson('/api/snapshot');

  // AI badge
  const aiBadge = $('ai-badge');
  aiBadge.textContent = s.ai.configured ? 'AI: connected' : 'AI: templates';
  aiBadge.className = 'badge ' + (s.ai.configured ? 'on' : 'off');
  $('generated').textContent = 'Updated ' + s.generated_human;

  // Stats
  const t = s.totals;
  $('stats').innerHTML = [
    statCard(t.repositories, 'Repositories'),
    statCard(t.blog_posts || 0, 'Blog posts'),
    statCard(t.comparison_pages, 'Comparison pages'),
    statCard(t.directories, 'Directories'),
    statCard(t.submissions, 'Submission packets'),
    statCard(t.knowledge_base_articles, 'KB articles'),
    statCard(t.open_source_candidates, 'Open-source'),
    statCard(s.queue.awaiting_approval, 'Awaiting approval'),
  ].join('');

  // Approvals
  const approvals = s.awaiting_approval || [];
  $('approvals').innerHTML = approvals.length
    ? approvals
        .map((a) => {
          const label = a.payload?.title || a.payload?.repo || a.payload?.directory || a.payload?.competitor || a.id;
          return `<div class="row">
            <div>
              <div class="title">${label}</div>
              <div class="sub">${a.type} &middot; ${a.agent || ''}</div>
            </div>
            <div class="actions">
              <button class="btn" onclick="approve('${a.id}')">Approve</button>
              <button class="btn danger" onclick="reject('${a.id}')">Reject</button>
            </div>
          </div>`;
        })
        .join('')
    : '<div class="empty">Nothing waiting for approval.</div>';

  // Agents
  $('agents').innerHTML = s.agents
    .map(
      (a) => `<div class="row">
        <div>
          <div class="title">${a.name}</div>
          <div class="sub">Phase ${a.phase} &middot; ${a.schedule}</div>
        </div>
        <div>${pill(a.last_status)}</div>
      </div>`,
    )
    .join('');

  // Queue
  $('queue').innerHTML = kvList(s.queue);

  // Gate
  $('gate').innerHTML = `<div class="kv"><span>Total scans</span><strong>${s.gate.total_scans}</strong></div>
    <div class="kv"><span>Blocked items</span><strong style="color:${s.gate.blocked ? 'var(--red)' : 'var(--green-bright)'}">${s.gate.blocked}</strong></div>`;

  // Breakdowns
  $('breakdowns').innerHTML = Object.entries(s.breakdowns)
    .map(([name, data]) => `<div class="bd"><h3>${name.replace(/_/g, ' ')}</h3>${kvList(data)}</div>`)
    .join('');
}

$('refresh').addEventListener('click', load);
load();
setInterval(load, 15000);
