// ─────────────────────────────────────────────────────────────────────────────
// admin/moderation-manager.js
// Admin panel: player search, session ban, game ban, score reset.
//
// Layout:
//   [Search bar]
//   Player table — Name | Sid | Team | Score | Session | Game Ban | Actions
//   Manage modal — per-player ban toggles + reset score
// ─────────────────────────────────────────────────────────────────────────────

import { getActiveSessionId }          from '/js/db/game-state.js';
import { searchPlayers, getSessionBans,
         adminSetGameBan, adminSetSessionBan,
         adminResetScore }             from '/js/db/moderation.js';
import { showToast, showSpinner,
         hideSpinner, escapeHTML,
         showModal, hideModal }        from '/js/ui.js';

let _sessionId = null;

export async function renderModerationManager(container, _unsubs) {
  showSpinner();
  try {
    _sessionId = await getActiveSessionId();
  } finally {
    hideSpinner();
  }

  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel__header">
        <h2>🛡️ Moderation</h2>
        ${_sessionId
          ? `<span class="badge" style="background:rgba(46,204,113,0.15);color:#2ecc71">Session #${_sessionId} active</span>`
          : `<span class="badge badge--muted">No active session</span>`}
      </div>

      <p class="admin-hint" style="margin-bottom:var(--sp-sm)">
        Session bans hide a player from the leaderboard for this session only.
        Game bans block all gameplay actions globally. Scores and history are never deleted.
      </p>

      <div class="mod-search-row" style="display:flex;gap:var(--sp-sm);margin-bottom:var(--sp-md)">
        <input class="input" id="mod-search" placeholder="Search by name, student ID, or team…"
               style="flex:1" autocomplete="off" />
        <button class="btn btn--secondary btn--sm" id="mod-search-btn">Search</button>
        <button class="btn btn--ghost btn--sm" id="mod-clear-btn">Clear</button>
      </div>

      <div id="mod-table-wrap">
        <div class="spinner"></div>
      </div>
    </div>
  `;

  const searchInput = container.querySelector('#mod-search');
  const searchBtn   = container.querySelector('#mod-search-btn');
  const clearBtn    = container.querySelector('#mod-clear-btn');

  const doSearch = async (q = '') => {
    container.querySelector('#mod-table-wrap').innerHTML = '<div class="spinner"></div>';
    showSpinner();
    try {
      const [players, sessionBans] = await Promise.all([
        searchPlayers(q),
        getSessionBans(_sessionId)
      ]);
      renderTable(container, players, sessionBans);
    } finally {
      hideSpinner();
    }
  };

  searchBtn.addEventListener('click', () => doSearch(searchInput.value));
  clearBtn.addEventListener('click', () => { searchInput.value = ''; doSearch(''); });
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(searchInput.value); });

  await doSearch('');
}

// ── Table ─────────────────────────────────────────────────────────────────────

function renderTable(container, players, sessionBans) {
  const wrap = container.querySelector('#mod-table-wrap');

  if (!players.length) {
    wrap.innerHTML = '<p style="color:var(--clr-text-muted);padding:var(--sp-sm)">No players found.</p>';
    return;
  }

  const hasSession = !!_sessionId;

  wrap.innerHTML = `
    <p style="font-size:12px;color:var(--clr-text-muted);margin-bottom:var(--sp-xs)">
      ${players.length} player${players.length !== 1 ? 's' : ''}
    </p>
    <div class="table-wrap">
      <table class="admin-table" id="mod-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th>Student ID</th>
            <th>Team</th>
            <th>Score</th>
            ${hasSession ? '<th>Session</th>' : ''}
            <th>Game Ban</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${players.map((p, i) => playerRow(p, i, sessionBans, hasSession)).join('')}
        </tbody>
      </table>
    </div>
  `;

  wrap.querySelectorAll('.mod-manage-btn').forEach((btn) => {
    const uid = btn.dataset.uid;
    const p   = players.find((x) => x.id === uid);
    const sp  = sessionBans.get(uid);
    if (!p) return;
    btn.addEventListener('click', () => {
      openManageModal(p, sp, () => {
        const q = container.querySelector('#mod-search')?.value || '';
        searchPlayers(q).then(async (fresh) => {
          const freshBans = await getSessionBans(_sessionId);
          renderTable(container, fresh, freshBans);
        });
      });
    });
  });
}

function playerRow(p, i, sessionBans, hasSession) {
  const sp             = sessionBans.get(p.id);
  const isSessionBanned = sp?.is_session_banned ?? false;
  const isGameBanned   = p.is_game_banned ?? false;

  const sessionCell = hasSession
    ? `<td>${isSessionBanned
        ? `<span class="badge" style="background:rgba(243,156,18,0.18);color:#f39c18">⚠ Restricted</span>`
        : `<span style="color:var(--clr-text-muted);font-size:12px">—</span>`
      }</td>`
    : '';

  const gameBanCell = isGameBanned
    ? `<span class="badge" style="background:rgba(231,76,60,0.18);color:#e74c3c">🔒 Banned</span>`
    : `<span style="color:var(--clr-text-muted);font-size:12px">—</span>`;

  return `
    <tr style="${isGameBanned ? 'opacity:0.75' : ''}">
      <td>${i + 1}</td>
      <td>${escapeHTML(p.full_name || '—')}</td>
      <td>${escapeHTML(p.student_id || '—')}</td>
      <td>${escapeHTML(p.team_name || '—')}</td>
      <td><strong>${p.score || 0}</strong></td>
      ${sessionCell}
      <td>${gameBanCell}</td>
      <td>
        <button class="btn btn--sm btn--ghost mod-manage-btn" data-uid="${escapeHTML(p.id)}">
          Manage
        </button>
      </td>
    </tr>
  `;
}

// ── Manage modal ──────────────────────────────────────────────────────────────

function openManageModal(player, sessionPlayer, onChanged) {
  const isSessionBanned = sessionPlayer?.is_session_banned ?? false;
  const sessionReason   = sessionPlayer?.session_ban_reason ?? '';
  const isGameBanned    = player.is_game_banned ?? false;
  const gameReason      = player.game_ban_reason ?? '';
  const hasSession      = !!_sessionId;

  showModal(`
    <div class="modal-form">
      <h3>Manage: ${escapeHTML(player.full_name || player.student_id)}</h3>
      <p style="font-size:12px;color:var(--clr-text-muted);margin-bottom:var(--sp-md)">
        ${escapeHTML(player.student_id || '')}${player.team_name ? ' · ' + escapeHTML(player.team_name) : ''} · Score: ${player.score || 0}
      </p>

      ${hasSession ? `
      <div class="form-group" style="border:1px solid var(--clr-border);border-radius:var(--radius-sm);padding:var(--sp-sm) var(--sp-md)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-sm);flex-wrap:wrap">
          <div>
            <strong style="font-size:13px">Session Restriction</strong>
            <p style="font-size:12px;color:var(--clr-text-muted);margin:2px 0 0">
              ${isSessionBanned
                ? `<span style="color:#f39c18">⚠ Restricted${sessionReason ? ` — ${escapeHTML(sessionReason)}` : ''}</span>`
                : 'Player is eligible for competitive ranking.'}
            </p>
          </div>
          ${isSessionBanned
            ? `<button class="btn btn--sm btn--success" id="m-remove-session-ban">Remove Restriction</button>`
            : `<button class="btn btn--sm btn--warning" id="m-session-ban">Restrict from Session</button>`}
        </div>
        ${!isSessionBanned ? `
          <div class="form-group" style="margin-top:var(--sp-sm)">
            <label class="form-label" style="font-size:12px">Reason (optional)</label>
            <input class="input" id="m-session-reason" placeholder="e.g. duplicate account" value="" />
          </div>` : ''}
      </div>
      ` : `
      <p style="font-size:12px;color:var(--clr-text-muted);padding:var(--sp-xs) 0;margin-bottom:var(--sp-sm)">
        No active session — session restrictions require an active session.
      </p>
      `}

      <div class="form-group" style="border:1px solid var(--clr-border);border-radius:var(--radius-sm);padding:var(--sp-sm) var(--sp-md);margin-top:var(--sp-sm)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:var(--sp-sm);flex-wrap:wrap">
          <div>
            <strong style="font-size:13px">Game Ban</strong>
            <p style="font-size:12px;color:var(--clr-text-muted);margin:2px 0 0">
              ${isGameBanned
                ? `<span style="color:#e74c3c">🔒 Banned globally${gameReason ? ` — ${escapeHTML(gameReason)}` : ''}</span>`
                : 'Player has full gameplay access.'}
            </p>
          </div>
          ${isGameBanned
            ? `<button class="btn btn--sm btn--success" id="m-remove-game-ban">Remove Game Ban</button>`
            : `<button class="btn btn--sm btn--danger" id="m-game-ban">Game Ban</button>`}
        </div>
        ${!isGameBanned ? `
          <div class="form-group" style="margin-top:var(--sp-sm)">
            <label class="form-label" style="font-size:12px">Reason (optional)</label>
            <input class="input" id="m-game-reason" placeholder="e.g. point manipulation" value="" />
          </div>` : ''}
      </div>

      <div class="form-group" style="margin-top:var(--sp-md)">
        <strong style="font-size:13px">Reset Score</strong>
        <p style="font-size:12px;color:var(--clr-text-muted);margin:2px 0 var(--sp-sm)">
          Sets score to 0. Does not delete attempts or history.
        </p>
        <button class="btn btn--sm btn--secondary" id="m-reset-score">Reset Score to 0</button>
      </div>

      <div class="modal-actions" style="margin-top:var(--sp-md)">
        <button class="btn btn--ghost" id="m-cancel">Close</button>
      </div>
      <p id="m-mod-error" style="color:var(--clr-error);font-size:12px;margin-top:var(--sp-xs)"></p>
    </div>
  `);

  const errorEl = () => document.getElementById('m-mod-error');

  const act = async (fn, successMsg) => {
    showSpinner();
    try {
      await fn();
      hideModal();
      showToast(successMsg, 'success');
      onChanged();
    } catch (err) {
      if (errorEl()) errorEl().textContent = err.message || String(err);
    } finally {
      hideSpinner();
    }
  };

  document.getElementById('m-cancel')?.addEventListener('click', hideModal);

  // Session ban actions
  document.getElementById('m-session-ban')?.addEventListener('click', () => {
    if (!_sessionId) return;
    const reason = document.getElementById('m-session-reason')?.value.trim() || '';
    act(
      () => adminSetSessionBan(player.id, _sessionId, true, reason),
      `${player.full_name} restricted from session ranking.`
    );
  });

  document.getElementById('m-remove-session-ban')?.addEventListener('click', () => {
    if (!_sessionId) return;
    act(
      () => adminSetSessionBan(player.id, _sessionId, false, ''),
      `Session restriction removed for ${player.full_name}.`
    );
  });

  // Game ban actions
  document.getElementById('m-game-ban')?.addEventListener('click', () => {
    const reason = document.getElementById('m-game-reason')?.value.trim() || '';
    act(
      () => adminSetGameBan(player.id, true, reason),
      `Game ban applied to ${player.full_name}.`
    );
  });

  document.getElementById('m-remove-game-ban')?.addEventListener('click', () => {
    act(
      () => adminSetGameBan(player.id, false, ''),
      `Game ban removed for ${player.full_name}.`
    );
  });

  // Reset score
  document.getElementById('m-reset-score')?.addEventListener('click', () => {
    if (!confirm(`Reset score for "${player.full_name}" to 0? This cannot be undone.`)) return;
    act(
      () => adminResetScore(player.id, _sessionId),
      `Score reset for ${player.full_name}.`
    );
  });
}
