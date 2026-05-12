// ─────────────────────────────────────────────────────────────────────────────
// admin/tribe-finder-manager.js
// Admin panel for the Tribe Finder task type.
// ─────────────────────────────────────────────────────────────────────────────

import { getActiveSessionId }              from '/js/db/game-state.js';
import { getTasks }                        from '/js/db/tasks.js';
import { adminGetTribeState,
         adminResetTribe }                 from '/js/db/tribe-finder.js';
import { showToast, showSpinner,
         hideSpinner, escapeHTML }         from '/js/ui.js';

export async function renderTribeFinderManager(container, _unsubs) {
  showSpinner();
  let sessionId, tasks;
  try {
    [sessionId, tasks] = await Promise.all([
      getActiveSessionId(),
      getTasks()
    ]);
  } finally {
    hideSpinner();
  }

  const tribeTasks = (tasks || []).filter((t) => t.type === 'tribe_finder');
  await renderPanel(container, sessionId, tribeTasks);
}

async function renderPanel(container, sessionId, tribeTasks) {
  if (!sessionId) {
    container.innerHTML = `
      <div class="admin-panel">
        <h2>🏕️ Tribe Finder</h2>
        <p style="color:var(--clr-text-muted)">No active session. Activate a session first.</p>
      </div>
    `;
    return;
  }

  if (tribeTasks.length === 0) {
    container.innerHTML = `
      <div class="admin-panel">
        <h2>🏕️ Tribe Finder</h2>
        <p style="color:var(--clr-text-muted);font-size:13px">
          Session: <strong>#${sessionId}</strong>
        </p>
        <p style="margin-top:var(--sp-md);color:var(--clr-text-muted)">
          No <code>tribe_finder</code> tasks found. Create one in the Tasks panel.
        </p>
      </div>
    `;
    return;
  }

  // Load state for all tribe_finder tasks in this session
  const stateByTask = {};
  await Promise.all(tribeTasks.map(async (t) => {
    try {
      stateByTask[t.task_id] = await adminGetTribeState(t.task_id, sessionId);
    } catch {
      stateByTask[t.task_id] = [];
    }
  }));

  let html = `<div class="admin-panel"><h2>🏕️ Tribe Finder</h2>
    <p style="color:var(--clr-text-muted);font-size:13px">
      Session: <strong>#${sessionId}</strong>
    </p>`;

  for (const task of tribeTasks) {
    const rows   = stateByTask[task.task_id] || [];
    const tribes = groupByTribe(rows);
    const total  = rows.length;
    const done   = rows.filter((r) => r.completed_at).length;

    // Distribution summary
    const distRows = Object.entries(tribes).map(([label, members]) => {
      const completedCount = members.filter((m) => m.completed_at).length;
      return `<tr>
        <td>${escapeHTML(label)}</td>
        <td>${members.length}</td>
        <td>${completedCount}</td>
      </tr>`;
    }).join('');

    // Full player table
    const playerRows = rows.map((r) => `
      <tr style="${r.completed_at ? '' : 'opacity:0.7'}">
        <td>${escapeHTML(r.full_name)}</td>
        <td>${escapeHTML(r.student_id)}</td>
        <td>${escapeHTML(r.tribe_label)}</td>
        <td>${r.completed_at ? '✅ Found' : '🔍 Searching'}</td>
        <td style="font-size:11px;color:var(--clr-text-muted)">${timeAgo(r.assigned_at)}</td>
      </tr>`).join('');

    html += `
      <div style="margin-top:var(--sp-lg);border-top:1px solid var(--clr-border);padding-top:var(--sp-md)">
        <h3 style="margin-bottom:var(--sp-xs)">${escapeHTML(task.title)}</h3>
        <p style="font-size:13px;color:var(--clr-text-muted);margin-bottom:var(--sp-sm)">
          ${total} assigned · ${done} completed
        </p>

        ${distRows ? `
          <h4 style="margin-bottom:var(--sp-xs);font-size:13px">Tribe Distribution</h4>
          <table class="admin-table" style="width:100%;margin-bottom:var(--sp-md)">
            <thead><tr><th>Tribe</th><th>Assigned</th><th>Completed</th></tr></thead>
            <tbody>${distRows}</tbody>
          </table>` : ''}

        ${playerRows ? `
          <h4 style="margin-bottom:var(--sp-xs);font-size:13px">All Players</h4>
          <table class="admin-table" style="width:100%;margin-bottom:var(--sp-md)">
            <thead><tr><th>Name</th><th>ID</th><th>Tribe</th><th>Status</th><th>Assigned</th></tr></thead>
            <tbody>${playerRows}</tbody>
          </table>` : `<p style="color:var(--clr-text-muted);font-size:13px">No players assigned yet.</p>`}

        <button class="btn btn--secondary btn--sm" data-reset-task="${escapeHTML(task.task_id)}">
          🔄 Reset ${escapeHTML(task.title)}
        </button>
      </div>
    `;
  }

  html += '</div>';
  container.innerHTML = html;

  container.querySelectorAll('[data-reset-task]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const taskId = btn.dataset.resetTask;
      if (!confirm(`Reset all tribe assignments for "${taskId}"? This cannot be undone.`)) return;
      showSpinner();
      try {
        await adminResetTribe(taskId, sessionId);
        showToast('Tribe assignments reset.', 'success');
        const tasks = await getTasks();
        const tribeTasks = (tasks || []).filter((t) => t.type === 'tribe_finder');
        await renderPanel(container, sessionId, tribeTasks);
      } catch (e) {
        showToast('Error: ' + (e.message || String(e)), 'error');
      } finally {
        hideSpinner();
      }
    });
  });
}

function groupByTribe(rows) {
  return rows.reduce((acc, r) => {
    if (!acc[r.tribe_label]) acc[r.tribe_label] = [];
    acc[r.tribe_label].push(r);
    return acc;
  }, {});
}

function timeAgo(ts) {
  if (!ts) return '—';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
