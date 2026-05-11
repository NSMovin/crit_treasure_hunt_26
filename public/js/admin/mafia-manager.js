// ─────────────────────────────────────────────────────────────────────────────
// admin/mafia-manager.js
// Admin panel for the Mafia Hunt side-game.
// ─────────────────────────────────────────────────────────────────────────────

import { getGameState, getActiveSessionId,
         onGameStateChange }                from '/js/db/game-state.js';
import { adminGetMafiaState, startMafia,
         endMafia, resetMafia }             from '/js/db/mafia.js';
import { showToast, showSpinner,
         hideSpinner, escapeHTML }          from '/js/ui.js';

export async function renderMafiaManager(container, _unsubs) {
  showSpinner();
  let gs, sessionId;
  try {
    [gs, sessionId] = await Promise.all([getGameState(), getActiveSessionId()]);
  } finally {
    hideSpinner();
  }

  await renderPanel(container, gs?.mafia_active || false, sessionId);

  const unsub = onGameStateChange(async (newGs) => {
    const sid = await getActiveSessionId();
    await renderPanel(container, newGs?.mafia_active || false, sid);
  });
  _unsubs.push(unsub);
}

async function renderPanel(container, mafiaActive, sessionId) {
  let roles = [];
  if (mafiaActive && sessionId) {
    try { roles = await adminGetMafiaState(sessionId); } catch { /* no roles yet */ }
  }

  const spyCount      = roles.filter((r) => r.role === 'spy').length;
  const civilianCount = roles.filter((r) => r.role === 'civilian').length;
  const aliveCount    = roles.filter((r) => r.is_alive).length;
  const deadCount     = roles.filter((r) => !r.is_alive).length;

  container.innerHTML = `
    <div class="admin-panel">
      <h2>🕵️ Mafia Hunt</h2>
      <p style="color:var(--clr-text-muted);font-size:13px">
        Session: ${sessionId ? `<strong>#${sessionId}</strong>` : '<em>No active session</em>'}
      </p>

      <div style="margin-top:var(--sp-sm)">
        Status: <strong>${mafiaActive ? '🟢 Active' : '⚫ Inactive'}</strong>
      </div>

      <div style="display:flex;gap:var(--sp-sm);flex-wrap:wrap;margin-top:var(--sp-md)">
        ${!mafiaActive
          ? `<button class="btn btn--primary" id="mafia-start-btn"
                     ${sessionId ? '' : 'disabled'}>
               🎭 Start Mafia Mode
             </button>`
          : `<button class="btn btn--danger" id="mafia-end-btn">
               ⏹ End Mafia Mode
             </button>`
        }
        <button class="btn btn--secondary" id="mafia-reset-btn"
                ${sessionId ? '' : 'disabled'}>
          🔄 Reset
        </button>
      </div>

      ${!sessionId
        ? `<p style="margin-top:var(--sp-sm);color:var(--clr-text-muted);font-size:13px">
             Activate a session first to enable Mafia Hunt.
           </p>`
        : ''
      }

      ${roles.length > 0
        ? `<div style="margin-top:var(--sp-lg)">
             <h3 style="margin-bottom:var(--sp-xs)">
               Players (${roles.length} total · ${spyCount} spies · ${civilianCount} civilians)
             </h3>
             <p style="font-size:13px;color:var(--clr-text-muted);margin-bottom:var(--sp-sm)">
               ${aliveCount} alive · ${deadCount} eliminated
             </p>
             <table class="admin-table" style="width:100%">
               <thead>
                 <tr>
                   <th>Player</th>
                   <th>Role</th>
                   <th>Status</th>
                   <th>Kills</th>
                 </tr>
               </thead>
               <tbody>
                 ${roles.map((r) => `
                   <tr style="${!r.is_alive ? 'opacity:0.5' : ''}">
                     <td>${escapeHTML(r.full_name)}</td>
                     <td>${r.role === 'spy' ? '🕵️ Spy' : '👤 Civilian'}</td>
                     <td>${r.is_alive ? '✅' : '💀'}</td>
                     <td>${r.kills}</td>
                   </tr>`).join('')}
               </tbody>
             </table>
           </div>`
        : mafiaActive
          ? `<p style="margin-top:var(--sp-md);color:var(--clr-text-muted)">
               No roles assigned yet.
             </p>`
          : ''
      }
    </div>
  `;

  container.querySelector('#mafia-start-btn')?.addEventListener('click', async () => {
    if (!confirm('Start Mafia Mode? This will assign roles to all players in this session.')) return;
    showSpinner();
    try {
      await startMafia(sessionId);
      showToast('Mafia Hunt started!', 'success');
    } catch (e) {
      showToast('Error: ' + (e.message || String(e)), 'error');
    } finally {
      hideSpinner();
    }
  });

  container.querySelector('#mafia-end-btn')?.addEventListener('click', async () => {
    if (!confirm('End Mafia Mode? Players will no longer see the Mafia Hunt page.')) return;
    showSpinner();
    try {
      await endMafia();
      showToast('Mafia Hunt ended.', 'success');
    } catch (e) {
      showToast('Error: ' + (e.message || String(e)), 'error');
    } finally {
      hideSpinner();
    }
  });

  container.querySelector('#mafia-reset-btn')?.addEventListener('click', async () => {
    if (!confirm('Reset Mafia Hunt? This will delete all roles and actions for this session.')) return;
    showSpinner();
    try {
      await resetMafia(sessionId);
      showToast('Mafia Hunt reset.', 'success');
    } catch (e) {
      showToast('Error: ' + (e.message || String(e)), 'error');
    } finally {
      hideSpinner();
    }
  });
}
