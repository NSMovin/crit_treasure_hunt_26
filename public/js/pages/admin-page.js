// ─────────────────────────────────────────────────────────────────────────────
// pages/admin-page.js
// Admin dashboard: passcode gate → panel tabs → delegates to admin/ modules.
// ─────────────────────────────────────────────────────────────────────────────

import { ensureSession }                 from '/js/auth.js';
import { getGameState, setGameState,
         setGameActive }                 from '/js/db/game-state.js';
import { renderTaskManager }             from '/js/admin/task-manager.js';
import { renderAnnouncementManager }     from '/js/admin/announcement-manager.js';
import { renderPlayerMonitor }           from '/js/admin/player-monitor.js';
import { renderHintManager }             from '/js/admin/hint-manager.js';
import { renderSessionManager }          from '/js/admin/session-manager.js';
import { APP_SETTINGS }                  from '/js/app-settings.js';
import { showToast, showSpinner,
         hideSpinner, escapeHTML }       from '/js/ui.js';

let _uid = null;
let passcodeAttempts = 0;

(async function init() {
  showSpinner();
  try {
    _uid = await ensureSession();
  } catch {
    hideSpinner();
    showToast('Could not connect to Supabase. Check your internet.', 'error');
    return;
  }
  hideSpinner();

  if (localStorage.getItem('isAdmin') === 'true') {
    renderDashboard();
  } else {
    renderPasscodeGate();
  }
})();

// ── Passcode gate ─────────────────────────────────────────────────────────────

function renderPasscodeGate() {
  document.getElementById('app').innerHTML = `
    <div class="admin-gate">
      <div class="admin-gate__logo">🔐</div>
      <h1 class="admin-gate__title">Admin Access</h1>
      <p class="admin-gate__sub">Enter the admin passcode to continue.</p>
      <input type="password" id="admin-passcode" class="input"
             placeholder="Passcode" autocomplete="off" />
      <button class="btn btn--primary" id="btn-passcode-submit">Unlock</button>
      <p class="admin-gate__error" id="passcode-error"></p>
    </div>
  `;

  const input     = document.getElementById('admin-passcode');
  const submitBtn = document.getElementById('btn-passcode-submit');
  const errorEl   = document.getElementById('passcode-error');

  const attempt = () => {
    const entered = input.value.trim();
    if (entered === APP_SETTINGS.adminPasscode) {
      localStorage.setItem('isAdmin', 'true');
      renderDashboard();
    } else {
      passcodeAttempts += 1;
      errorEl.textContent = `Incorrect passcode. (${passcodeAttempts} attempt(s))`;
      input.value = '';
      input.focus();
      if (passcodeAttempts >= 5) {
        submitBtn.disabled  = true;
        errorEl.textContent = 'Too many attempts. Refresh to try again.';
      }
    }
  };

  submitBtn.addEventListener('click', attempt);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') attempt(); });
  input.focus();
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function renderDashboard() {
  document.getElementById('app').innerHTML = `
    <div class="admin-dashboard">
      <header class="admin-header">
        <h1 class="admin-header__title">🎯 Admin Dashboard</h1>
        <button class="btn btn--sm btn--ghost" id="btn-admin-logout">Logout</button>
      </header>

      <nav class="admin-tabs" role="tablist">
        ${['tasks','players','announcements','hints','settings','sessions'].map((tab, i) => `
          <button class="admin-tab ${i === 0 ? 'admin-tab--active' : ''}"
                  data-panel="${tab}" role="tab">${tabLabel(tab)}</button>
        `).join('')}
      </nav>

      <div class="admin-content" id="admin-content">
        <div class="spinner"></div>
      </div>
    </div>
  `;

  document.getElementById('btn-admin-logout').addEventListener('click', () => {
    localStorage.removeItem('isAdmin');
    window.location.reload();
  });

  document.querySelectorAll('.admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((b) => b.classList.remove('admin-tab--active'));
      btn.classList.add('admin-tab--active');
      loadPanel(btn.dataset.panel);
    });
  });

  loadPanel('tasks');
}

// ── Panel loader ──────────────────────────────────────────────────────────────

const _panelUnsubs = [];

async function loadPanel(name) {
  _panelUnsubs.forEach((u) => u());
  _panelUnsubs.length = 0;

  const content = document.getElementById('admin-content');
  content.innerHTML = '<div class="spinner"></div>';

  try {
    switch (name) {
      case 'tasks':         await renderTaskManager(content, _panelUnsubs);         break;
      case 'players':       await renderPlayerMonitor(content, _panelUnsubs);       break;
      case 'announcements': await renderAnnouncementManager(content, _panelUnsubs); break;
      case 'hints':         await renderHintManager(content, _panelUnsubs);         break;
      case 'settings':      await renderSettings(content);                          break;
      case 'sessions':      await renderSessionManager(content, _panelUnsubs);      break;
    }
  } catch (err) {
    console.error(`Panel "${name}" failed to load:`, err);
    content.innerHTML = `
      <div class="admin-panel">
        <p style="color:var(--clr-error)">
          Failed to load panel: ${escapeHTML(err.message || String(err))}
        </p>
        <p style="color:var(--clr-text-muted);font-size:13px">
          Check the browser console. Common causes: Supabase RLS not set up,
          no internet connection, or schema not deployed.
        </p>
        <button class="btn btn--secondary btn--sm" onclick="location.reload()">Retry</button>
      </div>`;
  }
}

// ── Settings panel ────────────────────────────────────────────────────────────

async function renderSettings(container) {
  showSpinner();
  const gs = await getGameState();
  hideSpinner();

  const teamsStr   = (gs?.valid_teams || []).join('\n');
  const gameActive = gs?.game_active ?? false;
  const endsAt     = gs?.ends_at ? new Date(gs.ends_at).toISOString().slice(0, 16) : '';

  container.innerHTML = `
    <div class="admin-panel">
      <h2>Game Settings</h2>

      <div class="settings-row">
        <label>Game Active</label>
        <button class="btn ${gameActive ? 'btn--danger' : 'btn--success'}" id="btn-toggle-game">
          ${gameActive ? 'Pause Game' : 'Activate Game'}
        </button>
      </div>

      <div class="form-group">
        <label class="form-label">Game End Time</label>
        <input class="input" type="datetime-local" id="inp-ends-at" value="${endsAt}" />
      </div>

      <div class="form-group">
        <label class="form-label">Valid Teams (one per line)</label>
        <textarea class="input input--textarea" id="inp-teams" rows="6">${escapeHTML(teamsStr)}</textarea>
      </div>

      <button class="btn btn--primary" id="btn-save-settings">Save Settings</button>
      <p id="settings-status"></p>
    </div>
  `;

  document.getElementById('btn-toggle-game').addEventListener('click', async () => {
    try {
      await setGameActive(!gameActive);
      showToast(`Game ${!gameActive ? 'activated' : 'paused'}.`, 'success');
      await renderSettings(container);
    } catch { showToast('Failed to update game state.', 'error'); }
  });

  document.getElementById('btn-save-settings').addEventListener('click', async () => {
    const teams    = document.getElementById('inp-teams').value
      .split('\n').map((t) => t.trim()).filter(Boolean);
    const endsInput = document.getElementById('inp-ends-at').value;
    const endsDate  = endsInput ? new Date(endsInput).toISOString() : null;

    showSpinner();
    try {
      await setGameState({
        valid_teams: teams,
        ...(endsDate ? { ends_at: endsDate } : {})
      });
      hideSpinner();
      document.getElementById('settings-status').textContent = 'Saved ✓';
      showToast('Settings saved!', 'success');
    } catch {
      hideSpinner();
      showToast('Save failed.', 'error');
    }
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function tabLabel(tab) {
  return {
    tasks:         '📋 Tasks',
    players:       '👥 Players',
    announcements: '📢 Announcements',
    hints:         '💡 Hints',
    settings:      '⚙️ Settings',
    sessions:      '🎮 Sessions'
  }[tab] || tab;
}
