// Status and Progress page logic.
const $ = (id) => document.getElementById(id);

function timeAgo(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

function dueLabel(iso) {
  if (!iso || iso === 'on demand' || iso === 'soon') return iso || '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'due now';
  const m = Math.round(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.round(h / 24)}d`;
}

function stat(num, label) {
  return `<div class="stat"><div class="num">${num}</div><div class="label">${label}</div></div>`;
}

async function load() {
  const p = await (await fetch('/api/progress')).json();

  const ai = $('ai-badge');
  ai.textContent = p.ai.configured ? 'AI: connected' : 'AI: templates';
  ai.className = 'badge ' + (p.ai.configured ? 'on' : 'off');
  $('generated').textContent = 'Updated ' + p.generated_human;
  $('site-link').href = p.live_site;

  // KPI row
  const ic = p.inventory_counts;
  $('kpi').innerHTML = [
    stat(p.totals.repositories, 'Repos live'),
    stat(ic.blog, 'Blog posts'),
    stat(ic.comparisons, 'Comparisons'),
    stat(ic.guides, 'Buyer guides'),
    stat(ic.use_cases, 'Use cases'),
    stat(ic.help, 'Help articles'),
    stat(p.review.passed + '/' + (p.review.passed + p.review.failed), 'Pages reviewed'),
    stat(p.totals.distribution_packets, 'Distribution sets'),
  ].join('');

  // Growth progress bars
  const g = p.growth || { goals: [] };
  $('growth').innerHTML = (g.goals || [])
    .map((goal) => {
      const color = goal.pct >= 100 ? 'var(--green-bright)' : goal.pct >= 50 ? 'var(--green)' : 'var(--amber)';
      return `<div style="margin:12px 0">
        <div style="display:flex;justify-content:space-between;font-size:.92rem"><span>${goal.label}</span><strong>${goal.current} / ${goal.target}</strong></div>
        <div style="height:10px;background:var(--panel-2);border:1px solid var(--border);border-radius:999px;overflow:hidden;margin-top:5px"><div style="height:100%;width:${goal.pct}%;background:${color};transition:width .4s"></div></div>
      </div>`;
    })
    .join('');

  // Crawl status
  const c = p.crawl || { total: 0, live: 0, broken: [] };
  const brokenList = Array.isArray(c.broken) ? c.broken : [];
  const pct = c.total ? Math.round((c.live / c.total) * 100) : 0;
  $('crawl').innerHTML = `
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:center;margin-bottom:10px">
      <div><div class="num" style="font-size:1.6rem;color:var(--green-bright)">${c.live}</div><div class="label">links live</div></div>
      <div><div class="num" style="font-size:1.6rem">${c.total}</div><div class="label">checked</div></div>
      <div><div class="num" style="font-size:1.6rem;color:${brokenList.length ? 'var(--red)' : 'var(--green-bright)'}">${brokenList.length}</div><div class="label">broken</div></div>
      <div style="flex:1;min-width:160px"><div style="height:10px;background:var(--panel-2);border:1px solid var(--border);border-radius:999px;overflow:hidden"><div style="height:100%;width:${pct}%;background:var(--green-bright)"></div></div><div class="sub" style="margin-top:4px">${pct}% reachable${c.checked_at ? ' &middot; ' + timeAgo(c.checked_at) : ''}</div></div>
    </div>
    ${brokenList.length ? brokenList.slice(0, 10).map((b) => `<div class="row"><div class="sub" style="color:var(--red)">${b.status} ${b.url}</div></div>`).join('') : '<div class="sub">All published links are reachable.</div>'}
    <div style="margin-top:10px"><a class="btn ghost" href="${p.live_site}/submit-urls.txt" target="_blank" rel="noopener">Open the submit-to-search list</a></div>`;

  // Inventory
  const sections = [
    ['Blog', p.inventory.blog],
    ['Comparisons', p.inventory.comparisons],
    ['Buyer guides', p.inventory.guides],
    ['Use cases', p.inventory.use_cases],
    ['Help center', p.inventory.help],
  ];
  $('inventory').innerHTML = sections
    .filter(([, items]) => items.length)
    .map(
      ([name, items]) => `<details ${name === 'Blog' ? 'open' : ''}>
        <summary class="title" style="cursor:pointer;padding:8px 0">${name} (${items.length})</summary>
        ${items
          .map((i) => `<div class="row"><div><a href="${i.url}" target="_blank" rel="noopener">${i.title}</a><div class="sub">${timeAgo(i.updated)}</div></div></div>`)
          .join('')}
      </details>`,
    )
    .join('');

  // Pending
  $('pending').innerHTML = (p.pending || []).length
    ? p.pending
        .map(
          (g) => `<div class="row">
            <div><div class="title">${g.type.replace(/-/g, ' ')}</div><div class="sub">${g.items.slice(0, 3).join(', ')}${g.count > 3 ? ` and ${g.count - 3} more` : ''}</div></div>
            <div>${pill(g.count + ' waiting')}</div>
          </div>`,
        )
        .join('')
    : '<div class="empty">Nothing waiting. You are all caught up.</div>';

  // Agents
  $('agents').innerHTML = p.agents
    .map(
      (a) => `<div class="row">
        <div><div class="title">${a.name}</div><div class="sub">${a.schedule} &middot; last ${timeAgo(a.last_run) || 'never'}</div></div>
        <div>${pill(dueLabel(a.next_due))}</div>
      </div>`,
    )
    .join('');

  // Deploys
  $('deploys').innerHTML = (p.deploys || []).length
    ? p.deploys
        .map((d) => `<div class="row"><div><div class="title">${d.pages} pages</div><div class="sub">${d.base}</div></div><div class="sub">${timeAgo(d.at)}</div></div>`)
        .join('')
    : '<div class="empty">No deploys yet.</div>';

  // Activity
  $('activity').innerHTML = (p.activity || []).length
    ? p.activity
        .map((a) => `<div class="row"><div><div class="title">${a.message}</div><div class="sub">${a.type}</div></div><div class="sub">${timeAgo(a.at)}</div></div>`)
        .join('')
    : '<div class="empty">No activity recorded yet.</div>';
}

function pill(text) {
  const cls = /due now|waiting/i.test(text) ? 'pending' : 'done';
  return `<span class="pill ${cls}">${text}</span>`;
}

$('refresh').addEventListener('click', load);
load();
setInterval(load, 15000);
