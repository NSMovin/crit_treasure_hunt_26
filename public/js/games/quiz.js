// ─────────────────────────────────────────────────────────────────────────────
// games/quiz.js
// Multiple-choice quiz mini-game.
// Signature: run(task, container, onComplete)
// onComplete({ correct: bool, timeTakenSec: number, wrongAttempts: number })
// ─────────────────────────────────────────────────────────────────────────────

const MAX_WRONG = 3;   // Force fail after this many wrong attempts

/**
 * Mounts and runs the quiz mini-game inside `container`.
 */
export function run(task, container, onComplete) {
  const cfg         = task.config || {};
  const question    = cfg.question    || task.description;
  const options     = cfg.options     || [];
  const correctIdx  = cfg.correct_index ?? 0;
  const timeLimitSec = task.time_limit_sec || 0;

  let wrongAttempts = 0;
  let answered      = false;
  const startTime   = Date.now();

  // ── Timer ──────────────────────────────────────────────────────────────────
  let timerInterval = null;
  let remaining     = timeLimitSec;

  function stopTimer() {
    clearInterval(timerInterval);
  }

  function finish(correct) {
    stopTimer();
    answered = true;
    const timeTakenSec = (Date.now() - startTime) / 1000;
    onComplete({ correct, timeTakenSec, wrongAttempts });
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="quiz">
      <div class="quiz__timer" id="quiz-timer" ${!timeLimitSec ? 'style="display:none"' : ''}>
        ⏱ <span id="quiz-countdown">${timeLimitSec}</span>s
      </div>
      <p class="quiz__question">${escQ(question)}</p>
      <div class="quiz__options" id="quiz-options">
        ${options.map((opt, i) => `
          <button class="btn btn--option" data-idx="${i}">${escQ(opt)}</button>
        `).join('')}
      </div>
      <p class="quiz__attempts" id="quiz-attempts"></p>
    </div>
  `;

  // ── Option click handler ───────────────────────────────────────────────────
  const optionsEl = container.querySelector('#quiz-options');
  optionsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-idx]');
    if (!btn || answered) return;

    const chosen = parseInt(btn.dataset.idx, 10);
    const correct = chosen === correctIdx;

    // Disable all buttons immediately
    optionsEl.querySelectorAll('button').forEach((b) => (b.disabled = true));

    if (correct) {
      btn.classList.add('btn--correct');
      setTimeout(() => finish(true), 900);
    } else {
      btn.classList.add('btn--wrong');
      wrongAttempts += 1;

      if (wrongAttempts >= MAX_WRONG) {
        // Reveal correct answer and fail
        optionsEl.children[correctIdx].classList.add('btn--correct');
        setTimeout(() => finish(false), 1200);
      } else {
        const attemptsEl = container.querySelector('#quiz-attempts');
        attemptsEl.textContent = `Wrong! ${MAX_WRONG - wrongAttempts} attempt(s) left.`;

        // Re-enable after 1s
        setTimeout(() => {
          optionsEl.querySelectorAll('button').forEach((b) => {
            b.disabled = false;
            b.classList.remove('btn--wrong');
          });
        }, 1000);
      }
    }
  });

  // ── Countdown timer ────────────────────────────────────────────────────────
  if (timeLimitSec > 0) {
    const countdownEl = container.querySelector('#quiz-countdown');
    timerInterval = setInterval(() => {
      remaining -= 1;
      countdownEl.textContent = remaining;
      if (remaining <= 0) {
        if (!answered) finish(false);
      }
    }, 1000);
  }
}

function escQ(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
