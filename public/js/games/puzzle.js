// ─────────────────────────────────────────────────────────────────────────────
// games/puzzle.js
// Text-answer puzzle / riddle mini-game.
// ─────────────────────────────────────────────────────────────────────────────

const MAX_WRONG = 5;

/**
 * task.config = {
 *   answer: 'fibonacci',
 *   case_sensitive: false,
 *   allow_partial: false     // if true, answer just needs to contain the keyword
 * }
 */
export function run(task, container, onComplete) {
  const cfg            = task.config      || {};
  const correctAnswer  = cfg.answer       || '';
  const caseSensitive  = cfg.case_sensitive ?? false;
  const allowPartial   = cfg.allow_partial  ?? false;
  const timeLimitSec   = task.time_limit_sec || 0;

  let wrongAttempts = 0;
  let done          = false;
  const startTime   = Date.now();

  const hintAvailable = task.hint_released && task.hint;

  // ── Render ─────────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="puzzle">
      ${timeLimitSec ? `
        <div class="puzzle__timer">⏱ <span id="pz-countdown">${timeLimitSec}</span>s</div>
      ` : ''}
      <p class="puzzle__riddle">${esc(task.description)}</p>
      ${hintAvailable ? `<div class="puzzle__hint">💡 Hint: ${esc(task.hint)}</div>` : ''}
      <div class="puzzle__input-row">
        <input type="text" id="pz-input" class="input" placeholder="Your answer…"
               autocomplete="off" autocorrect="off" spellcheck="false" />
        <button class="btn btn--primary" id="pz-submit">Submit</button>
      </div>
      <p class="puzzle__feedback" id="pz-feedback"></p>
      <p class="puzzle__attempts" id="pz-attempts"></p>
    </div>
  `;

  const input      = container.querySelector('#pz-input');
  const submitBtn  = container.querySelector('#pz-submit');
  const feedbackEl = container.querySelector('#pz-feedback');
  const attemptsEl = container.querySelector('#pz-attempts');

  input.focus();

  // ── Submit ─────────────────────────────────────────────────────────────────
  function handleSubmit() {
    if (done) return;
    const raw      = input.value.trim();
    if (!raw) return;

    const given    = caseSensitive ? raw : raw.toLowerCase();
    const expected = caseSensitive ? correctAnswer : correctAnswer.toLowerCase();
    const correct  = allowPartial
      ? given.includes(expected)
      : given === expected;

    if (correct) {
      feedbackEl.textContent = '✓ Correct!';
      feedbackEl.className   = 'puzzle__feedback puzzle__feedback--success';
      done = true;
      stopTimer();
      setTimeout(() => {
        const timeTakenSec = (Date.now() - startTime) / 1000;
        onComplete({ correct: true, timeTakenSec, wrongAttempts });
      }, 700);
    } else {
      wrongAttempts += 1;
      feedbackEl.textContent = '✗ Not quite — try again.';
      feedbackEl.className   = 'puzzle__feedback puzzle__feedback--error';
      attemptsEl.textContent = `Attempts: ${wrongAttempts} / ${MAX_WRONG}`;
      input.value = '';
      input.focus();

      if (wrongAttempts >= MAX_WRONG) {
        done = true;
        stopTimer();
        feedbackEl.textContent = `Out of attempts. The answer was: ${correctAnswer}`;
        setTimeout(() => {
          const timeTakenSec = (Date.now() - startTime) / 1000;
          onComplete({ correct: false, timeTakenSec, wrongAttempts });
        }, 2000);
      }
    }
  }

  submitBtn.addEventListener('click', handleSubmit);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSubmit(); });

  // ── Timer ──────────────────────────────────────────────────────────────────
  let timerInterval = null;
  if (timeLimitSec > 0) {
    let remaining = timeLimitSec;
    const countdownEl = container.querySelector('#pz-countdown');
    timerInterval = setInterval(() => {
      remaining -= 1;
      countdownEl.textContent = remaining;
      if (remaining <= 0 && !done) {
        done = true;
        stopTimer();
        const timeTakenSec = (Date.now() - startTime) / 1000;
        onComplete({ correct: false, timeTakenSec, wrongAttempts });
      }
    }, 1000);
  }

  function stopTimer() { clearInterval(timerInterval); }
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
