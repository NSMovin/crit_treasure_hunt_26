// ─────────────────────────────────────────────────────────────────────────────
// games/memory-match.js
// Card flip memory-matching mini-game.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mounts and runs the memory match game inside `container`.
 *
 * task.config = {
 *   pairs: [{ id: string, label: string }],  // 6–8 pairs recommended
 *   grid_size: 4   // 4 = 4x4 grid (must equal sqrt(pairs*2))
 * }
 */
export function run(task, container, onComplete) {
  const cfg          = task.config || {};
  const pairs        = cfg.pairs   || defaultPairs();
  const timeLimitSec = task.time_limit_sec || 90;

  // Build a shuffled deck: each pair appears twice
  const deck = shuffle([...pairs, ...pairs].map((p, i) => ({
    ...p,
    key: `${p.id}-${i}`
  })));

  let flipped  = [];
  let matched  = new Set();
  let locked   = false;
  const startTime = Date.now();

  // ── Render grid ────────────────────────────────────────────────────────────
  const cols = Math.ceil(Math.sqrt(deck.length));
  container.innerHTML = `
    <div class="memory">
      <div class="memory__timer">⏱ <span id="mem-countdown">${timeLimitSec}</span>s</div>
      <div class="memory__grid" id="mem-grid"
           style="grid-template-columns: repeat(${cols}, 1fr)">
        ${deck.map((card) => `
          <div class="mem-card" data-key="${card.key}" data-id="${card.id}">
            <div class="mem-card__inner">
              <div class="mem-card__back">?</div>
              <div class="mem-card__front">${card.label}</div>
            </div>
          </div>
        `).join('')}
      </div>
      <p class="memory__hint">Find all matching pairs!</p>
    </div>
  `;

  // ── Card click ─────────────────────────────────────────────────────────────
  const grid = container.querySelector('#mem-grid');
  grid.addEventListener('click', (e) => {
    const cardEl = e.target.closest('.mem-card');
    if (!cardEl || locked) return;
    if (matched.has(cardEl.dataset.id) && isAllFlipped(cardEl)) return;
    if (cardEl.classList.contains('mem-card--flipped')) return;

    cardEl.classList.add('mem-card--flipped');
    flipped.push(cardEl);

    if (flipped.length === 2) {
      locked = true;
      const [a, b] = flipped;
      if (a.dataset.id === b.dataset.id) {
        // Match!
        matched.add(a.dataset.id);
        a.classList.add('mem-card--matched');
        b.classList.add('mem-card--matched');
        flipped = [];
        locked  = false;

        if (matched.size === pairs.length) {
          stopTimer();
          const timeTakenSec = (Date.now() - startTime) / 1000;
          onComplete({ correct: true, timeTakenSec, wrongAttempts: 0 });
        }
      } else {
        // No match — flip back after a pause
        setTimeout(() => {
          a.classList.remove('mem-card--flipped');
          b.classList.remove('mem-card--flipped');
          flipped = [];
          locked  = false;
        }, 900);
      }
    }
  });

  // ── Countdown ──────────────────────────────────────────────────────────────
  let remaining = timeLimitSec;
  const countdownEl = container.querySelector('#mem-countdown');

  const timerInterval = setInterval(() => {
    remaining -= 1;
    countdownEl.textContent = remaining;
    if (remaining <= 0) {
      stopTimer();
      const timeTakenSec = (Date.now() - startTime) / 1000;
      onComplete({ correct: false, timeTakenSec, wrongAttempts: 0 });
    }
  }, 1000);

  function stopTimer() { clearInterval(timerInterval); }

  // Needed only to silence linter — grid event does not use this
  function isAllFlipped(el) { return el.classList.contains('mem-card--matched'); }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function defaultPairs() {
  return [
    { id: 'p1', label: '🐸' }, { id: 'p2', label: '🦁' },
    { id: 'p3', label: '🐧' }, { id: 'p4', label: '🦊' },
    { id: 'p5', label: '🐙' }, { id: 'p6', label: '🦋' }
  ];
}
