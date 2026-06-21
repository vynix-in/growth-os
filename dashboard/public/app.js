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

  // Published & live
  const pub = s.published || {};
  const repoLinks = (pub.repositories || [])
    .map((r) => `<a href="${r.url}" target="_blank" rel="noopener" class="tag" style="margin:3px 6px 3px 0;display:inline-block">${r.name}</a>`)
    .join('');
  $('published').innerHTML = `
    <div class="row">
      <div>
        <div class="title">Live resources site</div>
        <div class="sub">${pub.site_pages || 0} pages · ${pub.blog_posts || 0} blog · ${pub.comparison_pages || 0} comparisons · ${pub.kb_articles || 0} help articles</div>
      </div>
      <div class="actions">
        ${pub.site_url ? `<a class="btn" href="${pub.site_url}" target="_blank" rel="noopener">Open live site</a>` : '<span class="muted">not deployed</span>'}
      </div>
    </div>
    <div class="row">
      <div style="width:100%">
        <div class="title">Published sections</div>
        <div class="sub" style="margin-top:6px">
          ${
            pub.site_url
              ? ['blog', 'compare', 'best', 'for', 'glossary', 'kb', 'badge']
                  .map((sec) => `<a class="tag" style="margin:3px 6px 3px 0;display:inline-block" href="${pub.site_url}/${sec}/" target="_blank" rel="noopener">/${sec}</a>`)
                  .join('')
              : 'not deployed yet'
          }
        </div>
      </div>
    </div>
    ${
      s.crawl
        ? `<div class="row"><div><div class="title">Links live</div><div class="sub">${s.crawl.live} of ${s.crawl.total} reachable${s.crawl.broken ? ' · ' + s.crawl.broken + ' broken' : ''}</div></div><div>${pill(s.crawl.broken ? s.crawl.broken + ' broken' : 'all live')}</div></div>`
        : ''
    }
    <div class="row">
      <div>
        <div class="title">Published GitHub repositories (${(pub.repositories || []).length})</div>
        <div class="sub" style="margin-top:6px">${repoLinks || 'none yet'}</div>
      </div>
    </div>
    ${pub.deployed_at ? `<div class="sub" style="margin-top:8px">Last deploy: ${new Date(pub.deployed_at).toLocaleString()}</div>` : ''}
    <div style="margin-top:10px"><a class="btn ghost" href="/progress">See all published links and progress</a></div>`;

  // Growth plan
  const g = s.growth || { goals: [] };
  $('growth').innerHTML = (g.goals || [])
    .map((goal) => {
      const color = goal.pct >= 100 ? 'var(--green-bright)' : goal.pct >= 50 ? 'var(--green)' : 'var(--amber)';
      return `<div style="margin:10px 0">
        <div style="display:flex;justify-content:space-between;font-size:.9rem"><span>${goal.label}</span><strong>${goal.current} / ${goal.target}</strong></div>
        <div style="height:8px;background:var(--panel-2);border:1px solid var(--border);border-radius:999px;overflow:hidden;margin-top:4px"><div style="height:100%;width:${goal.pct}%;background:${color}"></div></div>
      </div>`;
    })
    .join('');

  // Reviewer
  const rev = s.review || {};
  const ok = (rev.failed || 0) === 0;
  $('reviewer').innerHTML = `
    <div class="kv"><span>Pages checked</span><strong>${rev.checked || 0}</strong></div>
    <div class="kv"><span>Passed</span><strong style="color:var(--green-bright)">${rev.passed || 0}</strong></div>
    <div class="kv"><span>Failed</span><strong style="color:${ok ? 'var(--green-bright)' : 'var(--red)'}">${rev.failed || 0}</strong></div>
    <div class="sub" style="margin-top:8px">${ok ? 'All pages passed the audit.' : 'Some pages are held back until fixed.'}</div>`;

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
