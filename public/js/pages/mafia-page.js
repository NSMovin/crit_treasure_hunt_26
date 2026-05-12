// ─────────────────────────────────────────────────────────────────────────────
// pages/mafia-page.js
// Mafia Hunt player interface: role card, attack form, cooldown, event feed.
// ─────────────────────────────────────────────────────────────────────────────

import { requirePlayer }                         from '/js/router.js';
import { getGameState, getActiveSessionId,
         onGameStateChange }                     from '/js/db/game-state.js';
import { getMyRole, getLastAttackTime,
         submitAttack, getMafiaFeed,
         onMyRoleChange }                        from '/js/db/mafia.js';
import { checkGameBan }                          from '/js/db/moderation.js';
import { showToast, showSpinner,
         hideSpinner, escapeHTML }               from '/js/ui.js';

const COOLDOWN_MS = 15 * 60 * 1000;
const unsubs = [];

(async function init() {
  const session = await requirePlayer();
  if (!session) return;

  const { uid } = session;

  showSpinner();
  try {
    const [gs, sessionId, ban] = await Promise.all([
      getGameState(),
      getActiveSessionId(),
      checkGameBan(uid)
    ]);

    if (ban.is_banned) {
      document.getElementById('content').innerHTML = `
        <div class="mafia__inactive empty-state">
          <div class="mafia__icon">🚫</div>
          <h2>Gameplay Restricted</h2>
          <p>Your account is restricted from gameplay actions for this event.</p>
        </div>`;
      return;
    }

    if (!gs?.mafia_active) {
      renderInactive();
      unsubs.push(
        onGameStateChange((newGs) => { if (newGs?.mafia_active) location.reload(); })
      );
      return;
    }

    const [role, lastAttack, feed] = await Promise.all([
      getMyRole(uid, sessionId),
      getLastAttackTime(uid, sessionId),
      getMafiaFeed(sessionId, 10)
    ]);

    renderPage(role, lastAttack, feed, sessionId, uid);

    unsubs.push(onMyRoleChange(uid, sessionId, updateRoleDisplay));
    unsubs.push(
      onGameStateChange((newGs) => { if (!newGs?.mafia_active) renderInactive(); })
    );
  } finally {
    hideSpinner();
  }
})().catch((err) => {
  console.error('mafia-page error:', err);
  document.getElementById('content').innerHTML =
    `<div class="empty-state" style="color:var(--clr-error)">
       Error: ${escapeHTML(err.message || String(err))}
     </div>`;
});

window.addEventListener('beforeunload', () => unsubs.forEach((u) => u()));

// ── Render helpers ────────────────────────────────────────────────────────────

function renderInactive() {
  document.getElementById('content').innerHTML = `
    <div class="mafia__inactive empty-state">
      <div class="mafia__icon">🕵️</div>
      <h2>Mafia Hunt</h2>
      <p>Mafia Hunt hasn't started yet.</p>
      <p>Keep an eye on your game — it could begin at any time.</p>
    </div>
  `;
}

function renderPage(role, lastAttack, feed, sessionId, uid) {
  const roleLabel = role?.role === 'spy' ? '🕵️ Spy' : '👤 Civilian';
  const deadClass = role?.is_alive === false ? 'mafia__role--dead' : '';

  document.getElementById('content').innerHTML = `
    <div class="mafia-page">

      <div class="mafia__role-card ${deadClass}">
        <div class="mafia__role-title">Your Role</div>
        ${role
          ? `<div class="mafia__role-name">${escapeHTML(roleLabel)}</div>
             <div class="mafia__role-status">${role.is_alive ? '✅ Alive' : '💀 Eliminated'}</div>
             <div class="mafia__kills">Kills: ${role.kills}</div>`
          : `<div class="mafia__role-name">Not assigned yet</div>`
        }
      </div>

      ${role?.is_alive
        ? `<div class="mafia__attack-section" id="mafia-attack-section">
             <h3>🎯 Make Your Move</h3>
             <p class="mafia__objective">
               ${role.role === 'spy'
                 ? 'You are a <strong>Spy</strong>. Eliminate civilians before they find you.'
                 : 'You are a <strong>Civilian</strong>. Identify and expose the spies.'}
             </p>
             <div class="mafia__cooldown" id="mafia-cooldown"></div>
             <div class="mafia__attack-form">
               <input type="text" id="mafia-target-input" class="input"
                      placeholder="Enter student ID" autocomplete="off" />
               <button class="btn btn--primary" id="mafia-submit-btn">⚔️ Attack</button>
             </div>
             <div class="mafia__result" id="mafia-result"></div>
           </div>`
        : `<div class="mafia__dead-notice">
             <p>💀 You have been eliminated from Mafia Hunt.</p>
             <p>You can still continue the treasure hunt!</p>
           </div>`
      }

      <div class="mafia__feed">
        <h3>📡 Live Feed</h3>
        <div id="mafia-feed-list"></div>
      </div>

    </div>
  `;

  renderFeed(feed);

  if (role?.is_alive) {
    initCooldown(lastAttack);
    setupAttackHandler(sessionId, uid);
  }
}

function initCooldown(lastAttack) {
  const cooldownEl = document.getElementById('mafia-cooldown');
  const submitBtn  = document.getElementById('mafia-submit-btn');
  const inputEl    = document.getElementById('mafia-target-input');
  if (!cooldownEl) return;

  function tick() {
    if (!lastAttack) {
      cooldownEl.textContent = '';
      if (submitBtn) submitBtn.disabled = false;
      if (inputEl)  inputEl.disabled  = false;
      return;
    }
    const remaining = COOLDOWN_MS - (Date.now() - new Date(lastAttack).getTime());
    if (remaining <= 0) {
      cooldownEl.textContent = '';
      if (submitBtn) submitBtn.disabled = false;
      if (inputEl)  inputEl.disabled  = false;
    } else {
      const mins = Math.floor(remaining / 60000);
      const secs = Math.floor((remaining % 60000) / 1000);
      cooldownEl.textContent = `⏳ Next attack in ${mins}:${secs.toString().padStart(2, '0')}`;
      if (submitBtn) submitBtn.disabled = true;
      if (inputEl)  inputEl.disabled  = true;
      setTimeout(tick, 1000);
    }
  }
  tick();
}

function setupAttackHandler(sessionId, uid) {
  const submitBtn = document.getElementById('mafia-submit-btn');
  const inputEl   = document.getElementById('mafia-target-input');
  const resultEl  = document.getElementById('mafia-result');
  if (!submitBtn) return;

  submitBtn.addEventListener('click', async () => {
    const targetId = inputEl.value.trim();
    if (!targetId) { showToast('Enter a student ID.', 'error'); return; }

    submitBtn.disabled = true;
    showSpinner();

    try {
      const result = await submitAttack(targetId, sessionId);

      const msgs = {
        eliminated_civilian: '✅ Target eliminated! +100 points',
        exposed_spy:         '✅ Spy exposed! +100 points',
        spy_mistake:         '💀 You hit a fellow spy. You are eliminated. −75 points',
        civilian_mistake:    '💀 Wrong accusation. −75 points'
      };

      resultEl.textContent = msgs[result.outcome] || 'Action resolved.';
      resultEl.className   = `mafia__result ${result.success ? 'mafia__result--success' : 'mafia__result--failure'}`;
      inputEl.value = '';

      const fresh = await getMafiaFeed(sessionId, 10);
      renderFeed(fresh);

      const now = new Date().toISOString();
      initCooldown(now);
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
    } finally {
      hideSpinner();
    }
  });

  inputEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') submitBtn.click();
  });
}

function updateRoleDisplay(role) {
  const card = document.querySelector('.mafia__role-card');
  if (!card) return;

  const statusEl = card.querySelector('.mafia__role-status');
  const killsEl  = card.querySelector('.mafia__kills');
  if (statusEl) statusEl.textContent = role.is_alive ? '✅ Alive' : '💀 Eliminated';
  if (killsEl)  killsEl.textContent  = `Kills: ${role.kills}`;

  if (!role.is_alive) {
    card.classList.add('mafia__role--dead');
    const section = document.getElementById('mafia-attack-section');
    if (section) {
      section.outerHTML = `
        <div class="mafia__dead-notice">
          <p>💀 You have been eliminated from Mafia Hunt.</p>
          <p>You can still continue the treasure hunt!</p>
        </div>
      `;
    }
  }
}

function renderFeed(feed) {
  const el = document.getElementById('mafia-feed-list');
  if (!el) return;
  el.innerHTML = feed.length
    ? feed.map((e) => `
        <div class="mafia__feed-item">
          <span>${escapeHTML(e.event_text)}</span>
          <span class="mafia__feed-time">${timeAgo(e.created_at)}</span>
        </div>`).join('')
    : '<div class="mafia__feed-empty">No events yet.</div>';
}

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.floor(mins / 60)}h ago`;
}
