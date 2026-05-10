// ─────────────────────────────────────────────────────────────────────────────
// pages/leaderboard-page.js
// Real-time leaderboard: individual ranking + team aggregation.
// Public page — no auth required to view.
// ─────────────────────────────────────────────────────────────────────────────

import { onLeaderboardChange, computeTeamScores } from '/js/db/leaderboard.js';
import { getActiveSessionId }                     from '/js/db/game-state.js';
import { escapeHTML }                             from '/js/ui.js';

let activeTab = 'individual';
let _entries  = [];
const unsubs  = [];

(async function init() {
  attachTabSwitcher();
  const sessionId = await getActiveSessionId();
  startLeaderboardListener(sessionId);
})();

// ── Real-time listener ────────────────────────────────────────────────────────

function startLeaderboardListener(sessionId) {
  const unsub = onLeaderboardChange(sessionId, (entries) => {
    _entries = entries;
    renderCurrentTab();
  });
  unsubs.push(unsub);
  window.addEventListener('beforeunload', () => unsubs.forEach((u) => u()));
}

// ── Tab switcher ──────────────────────────────────────────────────────────────

function attachTabSwitcher() {
  document.querySelectorAll('[data-tab]').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      document.querySelectorAll('[data-tab]').forEach((b) => b.classList.remove('tab--active'));
      btn.classList.add('tab--active');
      renderCurrentTab();
    });
  });
}

function renderCurrentTab() {
  if (activeTab === 'individual') renderIndividual(_entries);
  else renderTeams(_entries);
}

// ── Individual leaderboard ────────────────────────────────────────────────────

function renderIndividual(entries) {
  const container = document.getElementById('leaderboard-body');
  if (!entries.length) {
    container.innerHTML = '<div class="empty-state">No scores yet. Be the first!</div>';
    return;
  }

  container.innerHTML = entries.map((entry, i) => {
    const rank   = i + 1;
    const medal  = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    const isTop3 = rank <= 3;
    return `
      <div class="lb-row ${isTop3 ? 'lb-row--top3' : ''}">
        <span class="lb-row__rank">${medal}</span>
        <div class="lb-row__info">
          <strong class="lb-row__name">${escapeHTML(entry.full_name)}</strong>
          ${entry.team_name
            ? `<span class="lb-row__team">${escapeHTML(entry.team_name)}</span>`
            : ''}
        </div>
        <div class="lb-row__right">
          <span class="lb-row__score">${entry.score || 0}</span>
          <span class="lb-row__tasks">${entry.tasks_completed || 0} tasks</span>
        </div>
      </div>
    `;
  }).join('');
}

// ── Team leaderboard (computed client-side) ───────────────────────────────────

function renderTeams(entries) {
  const container = document.getElementById('leaderboard-body');
  const teams     = computeTeamScores(entries);

  if (!teams.length) {
    container.innerHTML = '<div class="empty-state">No team scores yet.</div>';
    return;
  }

  container.innerHTML = teams.map((team, i) => {
    const rank  = i + 1;
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
    return `
      <div class="lb-row ${rank <= 3 ? 'lb-row--top3' : ''}">
        <span class="lb-row__rank">${medal}</span>
        <div class="lb-row__info">
          <strong class="lb-row__name">${escapeHTML(team.team_name)}</strong>
          <span class="lb-row__team">${team.member_count} member(s)</span>
        </div>
        <div class="lb-row__right">
          <span class="lb-row__score">${team.total_score}</span>
          <span class="lb-row__tasks">${team.tasks_completed} tasks</span>
        </div>
      </div>
    `;
  }).join('');
}
