// ─────────────────────────────────────────────────────────────────────────────
// admin/player-monitor.js
// Admin panel: real-time active player table with inline edit.
// ─────────────────────────────────────────────────────────────────────────────

import { sb }                            from '/js/supabase-client.js';
import { getActiveSessionId }            from '/js/db/game-state.js';
import { showToast, showSpinner,
         hideSpinner, escapeHTML,
         showModal, hideModal,
         formatTime }                    from '/js/ui.js';

let _sessionId = null;

export async function renderPlayerMonitor(container, unsubs) {
  _sessionId = await getActiveSessionId();

  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel__header">
        <h2>Active Players</h2>
        <span class="badge" id="player-count">—</span>
      </div>
      <p class="admin-hint">Sorted by most recently active. Updates live. Click Edit to change a player's details.</p>
      <div class="table-wrap">
        <table class="admin-table" id="player-table">
          <thead>
            <tr>
              <th>#</th><th>Name</th><th>Student ID</th>
              <th>Team</th><th>Score</th><th>Tasks</th><th>Last Active</th><th></th>
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
    tbody.innerHTML = '<tr><td colspan="8">No players yet.</td></tr>';
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
      <td>
        <button class="btn btn--sm btn--ghost btn-edit-player"
                data-id="${p.id}"
                data-name="${escapeHTML(p.full_name || '')}"
                data-sid="${escapeHTML(p.student_id || '')}"
                data-team="${escapeHTML(p.team_name || '')}"
                data-score="${p.score || 0}">
          Edit
        </button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-edit-player').forEach((btn) => {
    btn.addEventListener('click', () => openEditModal({
      id:         btn.dataset.id,
      full_name:  btn.dataset.name,
      student_id: btn.dataset.sid,
      team_name:  btn.dataset.team,
      score:      Number(btn.dataset.score)
    }));
  });
}

function openEditModal(player) {
  showModal(`
    <div class="modal-form">
      <h3>Edit Player</h3>

      <div class="form-group">
        <label class="form-label">Full Name</label>
        <input class="input" id="m-name" value="${escapeHTML(player.full_name)}" />
      </div>

      <div class="form-group">
        <label class="form-label">Student ID</label>
        <input class="input" id="m-sid" value="${escapeHTML(player.student_id)}" />
      </div>

      <div class="form-group">
        <label class="form-label">Team</label>
        <input class="input" id="m-team" value="${escapeHTML(player.team_name)}" />
      </div>

      <div class="form-group">
        <label class="form-label">Score${_sessionId ? ' (session)' : ' (lifetime)'}</label>
        <input class="input" id="m-score" type="number" min="0" value="${player.score}" />
      </div>

      <div class="modal-actions" style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-md);">
        <button class="btn btn--ghost" id="m-cancel">Cancel</button>
        <button class="btn btn--primary" id="m-save">Save</button>
      </div>
      <p id="m-error" style="color:var(--clr-error);margin-top:var(--sp-sm);"></p>
    </div>
  `);

  document.getElementById('m-cancel').addEventListener('click', hideModal);

  document.getElementById('m-save').addEventListener('click', async () => {
    const full_name  = document.getElementById('m-name').value.trim();
    const student_id = document.getElementById('m-sid').value.trim();
    const team_name  = document.getElementById('m-team').value.trim();
    const score      = parseInt(document.getElementById('m-score').value, 10);
    const errorEl    = document.getElementById('m-error');

    if (!full_name)           { errorEl.textContent = 'Name is required.';       return; }
    if (!student_id)          { errorEl.textContent = 'Student ID is required.'; return; }
    if (isNaN(score) || score < 0) { errorEl.textContent = 'Score must be a non-negative number.'; return; }

    showSpinner();
    try {
      const { error } = await sb.rpc('admin_update_user', {
        p_user_id:    player.id,
        p_full_name:  full_name,
        p_student_id: student_id,
        p_team_name:  team_name,
        p_score:      score,
        p_session_id: _sessionId
      });
      if (error) throw error;

      hideModal();
      showToast('Player updated.', 'success');
    } catch (err) {
      errorEl.textContent = 'Failed: ' + (err.message || String(err));
    } finally {
      hideSpinner();
    }
  });
}
