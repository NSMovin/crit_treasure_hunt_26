// ─────────────────────────────────────────────────────────────────────────────
// games/fast-tap.js
// Tap-the-correct-color fast-reaction mini-game.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * task.config = {
 *   target_color: '#e74c3c',        // Color players must tap
 *   distractors: ['#3498db', '#2ecc71', '#f39c12'],
 *   tap_count: 10,                  // Correct taps needed to win
 *   time_window_sec: 15
 * }
 */
export function run(task, container, onComplete) {
  const cfg = task.config || {};
  const targetColor   = cfg.target_color   || '#e74c3c';
  const distractors   = cfg.distractors    || ['#3498db', '#2ecc71', '#f39c12'];
  const tapCount      = cfg.tap_count      || 10;
  const timeWindowSec = cfg.time_window_sec || (task.time_limit_sec || 15);

  const allColors  = [targetColor, ...distractors];
  let correctTaps  = 0;
  let wrongTaps    = 0;
  const MAX_WRONG  = 3;
  const startTime  = Date.now();
  let done         = false;

  // ── Render ─────────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="fasttap">
      <div class="fasttap__info">
        <span>⏱ <span id="ft-countdown">${timeWindowSec}</span>s</span>
        <span>Tap: <strong id="ft-progress">0 / ${tapCount}</strong></span>
      </div>
      <div class="fasttap__target" style="background:${targetColor}"></div>
      <p class="fasttap__label">Tap only <strong style="color:${targetColor}">THIS COLOR</strong></p>
      <div class="fasttap__arena" id="ft-arena"></div>
      <p class="fasttap__feedback" id="ft-feedback"></p>
    </div>
  `;

  const arena      = container.querySelector('#ft-arena');
  const countdownEl= container.querySelector('#ft-countdown');
  const progressEl = container.querySelector('#ft-progress');
  const feedbackEl = container.querySelector('#ft-feedback');

  // ── Spawn circles ──────────────────────────────────────────────────────────
  function spawnCircle() {
    if (done) return;
    const color   = allColors[Math.floor(Math.random() * allColors.length)];
    const isTarget= color === targetColor;

    const el = document.createElement('div');
    el.className = 'ft-circle';
    el.style.cssText = `
      background: ${color};
      left: ${Math.random() * 80}%;
      top:  ${Math.random() * 70}%;
    `;

    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (done) return;
      el.remove();

      if (isTarget) {
        correctTaps += 1;
        progressEl.textContent = `${correctTaps} / ${tapCount}`;
        feedbackEl.textContent  = '✓';
        feedbackEl.style.color  = '#2ecc71';
        if (correctTaps >= tapCount) finish(true);
      } else {
        wrongTaps += 1;
        feedbackEl.textContent = `✗ Wrong! (${MAX_WRONG - wrongTaps} left)`;
        feedbackEl.style.color = '#e74c3c';
        if (wrongTaps >= MAX_WRONG) finish(false);
      }
    });

    arena.appendChild(el);
    // Auto-remove circle after 1.5s if untouched
    setTimeout(() => { if (!done) el.remove(); }, 1500);
  }

  const spawnInterval = setInterval(spawnCircle, 500);
  spawnCircle(); // spawn immediately

  // ── Countdown ──────────────────────────────────────────────────────────────
  let remaining = timeWindowSec;
  const timerInterval = setInterval(() => {
    remaining -= 1;
    countdownEl.textContent = remaining;
    if (remaining <= 0 && !done) finish(false);
  }, 1000);

  function finish(correct) {
    done = true;
    clearInterval(spawnInterval);
    clearInterval(timerInterval);
    const timeTakenSec = (Date.now() - startTime) / 1000;
    onComplete({ correct, timeTakenSec, wrongAttempts: wrongTaps });
  }
}
