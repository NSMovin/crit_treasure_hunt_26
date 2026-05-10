// ─────────────────────────────────────────────────────────────────────────────
// admin/player-monitor.js
// Admin panel: real-time active player table.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';
import { escapeHTML, formatTime } from '/js/ui.js';

export async function renderPlayerMonitor(container, unsubs) {
  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel__header">
        <h2>Active Players</h2>
        <span class="badge" id="player-count">—</span>
      </div>
      <p class="admin-hint">Sorted by most recently active. Updates live.</p>
      <div class="table-wrap">
        <table class="admin-table" id="player-table">
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Student ID</th>
              <th>Team</th><th>Score</th><th>Tasks</th><th>Last Active</th>
            </tr>
          </thead>
          <tbody id="player-tbody"></tbody>
        </table>
      </div>
    </div>
  `;

  const fetchAndRender = async () => {
    const { data: players } = await sb
      .from('users')
      .select('*')
      .order('last_active', { ascending: false })
      .limit(100);

    const list = players || [];
    document.getElementById('player-count').textContent = `${list.length} players`;
    renderTable(list);
  };

  await fetchAndRender();

  const channel = sb.channel('player-monitor')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'users' },
      fetchAndRender)
    .subscribe();

  unsubs.push(() => sb.removeChannel(channel));
}

function renderTable(players) {
  const tbody = document.getElementById('player-tbody');
  if (!tbody) return;

  if (!players.length) {
    tbody.innerHTML = '<tr><td colspan="7">No players yet.</td></tr>';
    return;
  }

  tbody.innerHTML = players.map((p, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${escapeHTML(p.full_name || '—')}</td>
      <td>${escapeHTML(p.student_id || '—')}</td>
      <td>${escapeHTML(p.team_name || '—')}</td>
      <td><strong>${p.score || 0}</strong></td>
      <td>${(p.tasks_completed || []).length}</td>
      <td>${formatTime(p.last_active)}</td>
    </tr>
  `).join('');
}
