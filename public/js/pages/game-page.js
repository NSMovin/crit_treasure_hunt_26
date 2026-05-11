// ─────────────────────────────────────────────────────────────────────────────
// pages/game-page.js
// Player dashboard: task list, live score, announcements, game status.
// ─────────────────────────────────────────────────────────────────────────────

import { touchLastActive }                from '/js/auth.js';
import { requirePlayer }                  from '/js/router.js';
import { onActiveTasksChange,
         getActiveTasks }                 from '/js/db/tasks.js';
import { getUserUnlockedTaskIds,
         onUserUnlocksChange }            from '/js/db/unlocked-tasks.js';
import { onUserChange,
         onSessionScoreChange }           from '/js/db/users.js';
import { onAnnouncementsChange }          from '/js/db/announcements.js';
import { onGameStateChange,
         getActiveSessionId }             from '/js/db/game-state.js';
import { showToast, escapeHTML, formatTime } from '/js/ui.js';

const unsubs = [];

(async function init() {
  const session = await requirePlayer();
  if (!session) return;

  const { uid, profile } = session;
  touchLastActive(uid);

  const sessionId = await getActiveSessionId();

  renderShell(profile);
  attachListeners(uid, profile, sessionId);
})().catch((err) => {
  console.error('game-page init error:', err);
  document.getElementById('task-list').innerHTML =
    `<div class="empty-state" style="color:var(--clr-error)">
       Error loading game: ${escapeHTML(err.message || String(err))}. Try refreshing.
     </div>`;
});

// ── Shell ─────────────────────────────────────────────────────────────────────

function renderShell(profile) {
  const nameEl  = document.getElementById('player-name');
  const scoreEl = document.getElementById('player-score');
  const teamEl  = document.getElementById('player-team');
  if (nameEl)  nameEl.textContent  = profile.full_name;
  if (scoreEl) scoreEl.textContent = profile.score || 0;
  if (teamEl)  teamEl.textContent  = profile.team_name ? `Team: ${profile.team_name}` : '';
}

// ── Listeners ─────────────────────────────────────────────────────────────────

function attachListeners(uid, profile, sessionId) {
  if (sessionId) {
    // Show session score live; still watch users table for completed markers
    unsubs.push(
      onSessionScoreChange(uid, sessionId, (score) => {
        document.getElementById('player-score').textContent = score;
      })
    );
    unsubs.push(
      onUserChange(uid, (data) => {
        renderCompletedMarkers(data.tasks_completed || []);
      })
    );
  } else {
    unsubs.push(
      onUserChange(uid, (data) => {
        document.getElementById('player-score').textContent = data.score || 0;
        renderCompletedMarkers(data.tasks_completed || []);
      })
    );
  }

  // Fetch unlock state first, then subscribe to active task changes
  getUserUnlockedTaskIds(uid, sessionId).then((ids) => {
    _unlockedTaskIds = ids;
    unsubs.push(
      onActiveTasksChange((tasks) =>
        renderTaskList(tasks, profile.tasks_completed || [], _unlockedTaskIds)
      )
    );
  });

  // Realtime: re-render task list when this user scans a new QR
  unsubs.push(
    onUserUnlocksChange(uid, (ids) => {
      _unlockedTaskIds = ids;
      getActiveTasks().then((tasks) =>
        renderTaskList(tasks, _completedTasks, _unlockedTaskIds)
      );
    }, sessionId)
  );

  unsubs.push(
    onAnnouncementsChange((announcements) => renderAnnouncements(announcements))
  );

  unsubs.push(
    onGameStateChange((gs) => {
      if (!gs) return;
      const banner   = document.getElementById('game-status-banner');
      const voteLink = document.getElementById('vote-nav-link');
      if (!gs.game_active) {
        banner.textContent   = '⏸ Game is currently paused. Stand by!';
        banner.style.display = 'block';
      } else {
        banner.style.display = 'none';
      }
      if (voteLink) voteLink.style.display = gs.voting_open ? 'flex' : 'none';
      const mafiaLink = document.getElementById('mafia-nav-link');
      if (mafiaLink) mafiaLink.style.display = gs.mafia_active ? 'flex' : 'none';
    })
  );

  window.addEventListener('beforeunload', () => unsubs.forEach((u) => u()));
}

// ── Task list render ──────────────────────────────────────────────────────────

let _completedTasks  = [];
let _unlockedTaskIds = [];

function renderTaskList(tasks, completedTasks, unlockedIds = []) {
  _completedTasks  = completedTasks;
  _unlockedTaskIds = unlockedIds;
  const container  = document.getElementById('task-list');

  if (!tasks.length) {
    container.innerHTML = `
      <div class="empty-state">
        <p>No treasures active yet. Watch for announcements!</p>
      </div>`;
    return;
  }

  const visible = tasks.filter((t) => t.is_public || unlockedIds.includes(t.task_id));
  const locked  = tasks.filter((t) => !t.is_public && !unlockedIds.includes(t.task_id));

  const visibleHTML = visible.map((task) => {
    const done = completedTasks.includes(task.task_id);
    return `
      <a class="task-card ${done ? 'task-card--done' : ''}"
         href="/task.html?id=${encodeURIComponent(task.task_id)}"
         ${done ? 'aria-label="Completed"' : ''}>
        <div class="task-card__icon">${taskIcon(task.type)}</div>
        <div class="task-card__body">
          <h3 class="task-card__title">${escapeHTML(task.title)}</h3>
          <span class="task-card__type">${escapeHTML(task.type.replace('_', ' '))}</span>
        </div>
        <div class="task-card__points">
          ${done ? '✅' : `<strong>+${task.points}</strong> pts`}
        </div>
      </a>`;
  }).join('');

  const lockedHTML = locked.map((task) => `
    <div class="task-card task-card--locked" aria-label="Locked task">
      <div class="task-card__icon">🔒</div>
      <div class="task-card__body">
        <h3 class="task-card__title">${escapeHTML(task.title)}</h3>
        <span class="task-card__type">Find the QR code to unlock</span>
      </div>
      <div class="task-card__points" style="color:var(--clr-text-muted)">
        <strong>+${task.points}</strong> pts
      </div>
    </div>`).join('');

  container.innerHTML =
    visibleHTML +
    (locked.length
      ? `<div class="section-heading" style="margin-top:var(--sp-md);">Locked Treasures</div>${lockedHTML}`
      : '');
}

function renderCompletedMarkers(completedTasks) {
  _completedTasks = completedTasks;
  document.querySelectorAll('.task-card').forEach((card) => {
    const href   = card.getAttribute('href') || '';
    const taskId = new URLSearchParams(href.split('?')[1]).get('id');
    if (taskId && completedTasks.includes(taskId)) {
      card.classList.add('task-card--done');
      card.querySelector('.task-card__points').innerHTML = '✅';
    }
  });
}

// ── Announcements render ──────────────────────────────────────────────────────

function renderAnnouncements(announcements) {
  const container = document.getElementById('announcements-list');
  if (!container) return;

  if (!announcements.length) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = announcements.slice(0, 5).map((ann) => `
    <div class="announcement announcement--${escapeHTML(ann.type || 'info')}
                ${ann.pinned ? 'announcement--pinned' : ''}">
      ${ann.pinned ? '<span class="announcement__pin">📌</span>' : ''}
      <span class="announcement__msg">${escapeHTML(ann.message)}</span>
      <span class="announcement__time">${formatTime(ann.sent_at)}</span>
    </div>
  `).join('');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function taskIcon(type) {
  const icons = {
    quiz:         '❓',
    memory_match: '🃏',
    fast_tap:     '⚡',
    puzzle:       '🧩',
    photo:        '📸'
  };
  return icons[type] || '🎯';
}
