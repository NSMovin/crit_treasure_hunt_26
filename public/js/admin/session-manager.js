// ─────────────────────────────────────────────────────────────────────────────
// admin/session-manager.js
// Admin panel: create, activate, and list game sessions.
// ─────────────────────────────────────────────────────────────────────────────

import { getAllSessions, createAndActivateSession, activateSession } from '/js/db/game-sessions.js';
import { showToast, showSpinner, hideSpinner, escapeHTML,
         showModal, hideModal }                                       from '/js/ui.js';

export async function renderSessionManager(container, _unsubs) {
  showSpinner();
  let sessions = [];
  try { sessions = await getAllSessions(); }
  finally { hideSpinner(); }
  renderList(container, sessions);
}

function renderList(container, sessions) {
  const active = sessions.find((s) => s.is_active);

  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel__header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-md);">
        <h2 style="margin:0;">Game Sessions</h2>
        <button class="btn btn--primary btn--sm" id="btn-new-session">+ New Session</button>
      </div>

      ${active
        ? `<div style="margin-bottom:var(--sp-md);padding:var(--sp-sm) var(--sp-md);background:rgba(46,204,113,0.1);border-radius:var(--radius-md);border:1px solid var(--clr-success);">
             <strong>Active:</strong> ${escapeHTML(active.name)}
             <span style="opacity:0.6;font-size:13px;margin-left:8px;">started ${new Date(active.created_at).toLocaleString()}</span>
           </div>`
        : `<div class="empty-state" style="margin-bottom:var(--sp-md);"><p>No active session. Create one to start tracking scores.</p></div>`}

      <div id="session-list">
        ${sessions.length
          ? sessions.map((s) => `
            <div class="task-row">
              <div class="task-row__info">
                <strong>${escapeHTML(s.name)}</strong>
                <span class="badge ${s.is_active ? 'badge--success' : 'badge--muted'}">${s.is_active ? 'Active' : 'Ended'}</span>
                <span class="badge">${new Date(s.created_at).toLocaleDateString()}</span>
              </div>
              <div class="task-row__actions">
                ${!s.is_active
                  ? `<button class="btn btn--sm btn--secondary btn-activate" data-id="${s.id}">Activate</button>`
                  : ''}
              </div>
            </div>`).join('')
          : '<p style="opacity:0.6;">No sessions yet.</p>'}
      </div>
    </div>
  `;

  container.querySelector('#btn-new-session').addEventListener('click', () => openNewSessionModal(container));

  container.querySelectorAll('.btn-activate').forEach((btn) => {
    btn.addEventListener('click', async () => {
      showSpinner();
      try {
        await activateSession(Number(btn.dataset.id));
        showToast('Session activated.', 'success');
        renderList(container, await getAllSessions());
      } catch {
        showToast('Failed to activate session.', 'error');
      } finally {
        hideSpinner();
      }
    });
  });
}

function openNewSessionModal(container) {
  showModal(`
    <div class="modal-form">
      <h3>New Game Session</h3>
      <div class="form-group">
        <label class="form-label">Session Name *</label>
        <input class="input" id="m-session-name" placeholder="e.g. Fantasy Kingdom Round 1" autocomplete="off" />
      </div>
      <div class="modal-actions" style="display:flex;gap:var(--sp-sm);justify-content:flex-end;margin-top:var(--sp-md);">
        <button class="btn btn--ghost" id="m-cancel">Cancel</button>
        <button class="btn btn--primary" id="m-create">Create &amp; Activate</button>
      </div>
      <p class="modal-error" id="m-error" style="color:var(--clr-error);margin-top:var(--sp-sm);"></p>
    </div>
  `);

  document.getElementById('m-cancel').addEventListener('click', hideModal);

  const createBtn = document.getElementById('m-create');
  const nameInput = document.getElementById('m-session-name');
  const errorEl   = document.getElementById('m-error');

  nameInput.focus();
  nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createBtn.click(); });

  createBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { errorEl.textContent = 'Session name is required.'; return; }

    showSpinner();
    try {
      await createAndActivateSession(name);
      hideModal();
      showToast(`Session "${name}" is now active.`, 'success');
      renderList(container, await getAllSessions());
    } catch (err) {
      errorEl.textContent = 'Failed: ' + (err.message || String(err));
    } finally {
      hideSpinner();
    }
  });
}
