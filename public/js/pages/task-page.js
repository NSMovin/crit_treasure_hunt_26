// ─────────────────────────────────────────────────────────────────────────────
// pages/task-page.js
// Orchestrates the full task-play flow:
//   URL parse → auth guard → fetch task → validate → run game → score → commit
// ─────────────────────────────────────────────────────────────────────────────

import { requirePlayer }                            from '/js/router.js';
import { getTask }                                  from '/js/db/tasks.js';
import { hasCompletedTask, addScore }               from '/js/db/users.js';
import { checkGameBan }                             from '/js/db/moderation.js';
import { submitAttempt, claimFirstSolver,
         countWrongAttempts }                       from '/js/db/attempts.js';
import { getActiveSessionId }                       from '/js/db/game-state.js';
import { calculateScore, formatBreakdown }          from '/js/scoring.js';
import { uploadPhoto }                              from '/js/storage.js';
import { showToast, showSpinner, hideSpinner,
         escapeHTML, formatCountdown }              from '/js/ui.js';

const GAME_MODULE_MAP = {
  quiz:         '/js/games/quiz.js',
  memory_match: '/js/games/memory-match.js',
  fast_tap:     '/js/games/fast-tap.js',
  puzzle:       '/js/games/puzzle.js',
  photo:        '/js/games/photo-challenge.js',
  arrow_hunt:   '/js/games/arrow-hunt.js',
  tribe_finder: '/js/games/tribe-finder.js'
};

(async function init() {
  const taskId = new URLSearchParams(location.search).get('id');
  if (!taskId) {
    showToast('Invalid task link.', 'error');
    setTimeout(() => window.location.replace('/game.html'), 1500);
    return;
  }

  showSpinner();

  const session = await requirePlayer();
  if (!session) return;

  const { uid, profile } = session;
  const sessionId = await getActiveSessionId();

  // Game ban check — banned players see a soft restriction notice; no redirect
  const ban = await checkGameBan(uid);
  if (ban.is_banned) {
    hideSpinner();
    document.getElementById('game-container').innerHTML = `
      <div class="result-card result-card--fail" style="margin:16px">
        <div class="result-card__icon">🚫</div>
        <h2>Gameplay Restricted</h2>
        <p>Your account is restricted from gameplay actions for this event.</p>
        <a class="btn btn--primary" href="/game.html">Back to Game</a>
      </div>`;
    return;
  }

  const task = await getTask(taskId);
  if (!task) {
    hideSpinner();
    showToast('Task not found.', 'error');
    setTimeout(() => window.location.replace('/game.html'), 1500);
    return;
  }
  if (!task.active) {
    hideSpinner();
    showToast('This task is not active yet.', 'warning');
    setTimeout(() => window.location.replace('/game.html'), 1800);
    return;
  }

  // Unlock guard: admins and public tasks bypass this check
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  if (!isAdmin && !task.is_public) {
    const { isTaskUnlocked } = await import('/js/db/unlocked-tasks.js');
    const unlocked = await isTaskUnlocked(uid, taskId, sessionId);
    if (!unlocked) {
      hideSpinner();
      showToast('Find the QR code to unlock this challenge.', 'warning');
      setTimeout(() => window.location.replace('/game.html'), 1500);
      return;
    }
  }

  const alreadyDone = await hasCompletedTask(uid, taskId, sessionId);
  if (alreadyDone) {
    hideSpinner();
    showToast('You\'ve already completed this task! 🎉', 'info');
    setTimeout(() => window.location.replace('/game.html'), 2000);
    return;
  }

  hideSpinner();
  renderTaskHeader(task);

  const modulePath = GAME_MODULE_MAP[task.type];
  if (!modulePath) {
    showToast('Unknown task type.', 'error');
    return;
  }

  const container = document.getElementById('game-container');
  const { run }   = await import(modulePath);
  run(task, container, (result) => handleCompletion(result, task, uid, profile, sessionId));
})().catch((err) => {
  console.error('task-page init error:', err);
  hideSpinner();
  document.getElementById('game-container').innerHTML =
    `<div class="result-card result-card--fail" style="margin:16px">
       <div class="result-card__icon">⚠️</div>
       <h2>Failed to load task</h2>
       <p>${escapeHTML(err.message || String(err))}</p>
       <a class="btn btn--primary" href="/game.html">Back to Game</a>
     </div>`;
});

// ── Task header ───────────────────────────────────────────────────────────────

function renderTaskHeader(task) {
  document.getElementById('task-title').textContent = task.title;
  document.getElementById('task-points').textContent = `+${task.points} pts`;
  document.getElementById('task-type').textContent   = task.type.replace('_', ' ');

  if (task.time_limit_sec) {
    document.getElementById('task-timer').textContent =
      `⏱ ${formatCountdown(task.time_limit_sec)}`;
  }

  if (task.hint_released && task.hint) {
    const hintEl = document.getElementById('task-hint');
    if (hintEl) {
      hintEl.textContent   = `💡 Hint: ${task.hint}`;
      hintEl.style.display = 'block';
    }
  }
}

// ── Completion pipeline ───────────────────────────────────────────────────────

async function handleCompletion(result, task, uid, profile, sessionId) {
  const { correct, timeTakenSec, wrongAttempts = 0, photoBlob } = result;
  showSpinner();

  try {
    let finalScore = 0;
    let breakdown  = null;
    let isFirst    = false;

    if (correct) {
      isFirst = await claimFirstSolver(uid, task.task_id, sessionId);

      const prevWrong = wrongAttempts || await countWrongAttempts(uid, task.task_id, sessionId);

      const scored = calculateScore({
        basePoints:          task.points,
        timeTakenSec,
        timeLimitSec:        task.time_limit_sec || null,
        isFirstSolver:       isFirst,
        wrongAttemptsBefore: prevWrong
      });
      finalScore = scored.finalScore;
      breakdown  = scored.breakdown;

      await addScore(uid, finalScore, task.task_id, sessionId);
    }

    // Upload photo to Supabase Storage if present
    let photoUrl = null;
    if (photoBlob) {
      try {
        photoUrl = await uploadPhoto(photoBlob, task.task_id, uid);
      } catch (e) {
        console.warn('Photo upload failed (non-critical):', e);
      }
    }

    await submitAttempt({
      user_id:         uid,
      task_id:         task.task_id,
      session_id:      sessionId,
      result:          correct ? 'correct' : 'wrong',
      score_delta:     finalScore,
      time_taken_sec:  Math.round(timeTakenSec),
      is_first_solver: isFirst,
      attempts_count:  (wrongAttempts || 0) + (correct ? 1 : 0),
      photo_url:       photoUrl
    });

    hideSpinner();
    renderResultCard({ correct, finalScore, breakdown, isFirst, task });

  } catch (err) {
    hideSpinner();
    console.error('Submission error:', err);
    showToast('Submission failed. Please retry when connected.', 'error', 5000);
  }
}

// ── Result card ───────────────────────────────────────────────────────────────

function renderResultCard({ correct, finalScore, breakdown, isFirst, task }) {
  const container = document.getElementById('game-container');
  const lines     = breakdown ? formatBreakdown(breakdown) : [];

  container.innerHTML = `
    <div class="result-card ${correct ? 'result-card--success' : 'result-card--fail'}">
      <div class="result-card__icon">${correct ? '🎉' : '😔'}</div>
      <h2 class="result-card__heading">${correct ? 'Task Complete!' : 'Better luck next time!'}</h2>

      ${correct ? `
        <div class="result-card__score">+${finalScore} points</div>
        ${isFirst ? '<div class="result-card__badge">⭐ First Solver Bonus!</div>' : ''}
        <ul class="result-card__breakdown">
          ${lines.map((l) => `<li>${escapeHTML(l)}</li>`).join('')}
        </ul>
      ` : `
        <p class="result-card__msg">No points this time. Keep searching!</p>
      `}

      <a class="btn btn--primary" href="/game.html">Back to Game</a>
    </div>
  `;

  const header = document.getElementById('task-header');
  if (header) header.style.display = 'none';
}
