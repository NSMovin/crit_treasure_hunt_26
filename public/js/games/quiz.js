// ─────────────────────────────────────────────────────────────────────────────
// games/quiz.js
// Multi-question quiz mini-game.
// Signature: run(task, container, onComplete)
//
// Supports two config formats (backward compatible):
//   Single-question (legacy):  { question, options, correct_index }
//   Multi-question (new):      { questions: [{ question, options, correct_index }, …] }
//
// onComplete({ correct, timeTakenSec, wrongAttempts, correctAnswers, totalQuestions })
//   correct / wrongAttempts  — kept for backward compat with task-page.js scoring
//   correctAnswers / totalQuestions — new extended fields (ignored by task-page.js)
// ─────────────────────────────────────────────────────────────────────────────

const MAX_WRONG = 3; // max wrong attempts per question before auto-advancing

export function run(task, container, onComplete) {
  // ── Normalise config → always a questions array ───────────────────────────
  const cfg = task.config || {};
  const questions = cfg.questions?.length
    ? cfg.questions
    : [{
        question:      cfg.question    || task.description,
        options:       cfg.options     || [],
        correct_index: cfg.correct_index ?? 0
      }];
  const totalQuestions = questions.length;
  const timeLimitSec   = task.time_limit_sec || 0;
  const multiQ         = totalQuestions > 1;

  // ── Shared state ──────────────────────────────────────────────────────────
  let currentIdx         = 0;
  let correctAnswers     = 0;
  let totalWrongAttempts = 0;
  let finished           = false;
  let timerInterval      = null;
  let remaining          = timeLimitSec;
  const startTime        = Date.now();

  // ── Render skeleton once — questions update the DOM in-place ──────────────
  container.innerHTML = `
    <div class="quiz">
      <div class="quiz__timer" id="quiz-timer" ${!timeLimitSec ? 'style="display:none"' : ''}>
        ⏱ <span id="quiz-countdown">${timeLimitSec}</span>s
      </div>

      <p class="quiz__progress" id="quiz-progress"
         ${!multiQ ? 'style="display:none"' : ''}>
        Question 1 / ${totalQuestions}
      </p>
      <div class="quiz__progress-bar" id="quiz-progress-bar"
           ${!multiQ ? 'style="display:none"' : ''}>
        <div class="quiz__progress-fill" id="quiz-progress-fill" style="width:0%"></div>
      </div>

      <p class="quiz__question" id="quiz-question"></p>
      <div class="quiz__options" id="quiz-options"></div>
      <p class="quiz__attempts" id="quiz-attempts"></p>
    </div>
  `;

  // ── Timer (covers full quiz, not per-question) ────────────────────────────
  if (timeLimitSec > 0) {
    const countdownEl = container.querySelector('#quiz-countdown');
    timerInterval = setInterval(() => {
      remaining -= 1;
      countdownEl.textContent = remaining;
      if (remaining <= 0 && !finished) finish();
    }, 1000);
  }

  // ── Start first question ──────────────────────────────────────────────────
  renderQuestion(0);

  // ── renderQuestion — updates DOM in-place, no skeleton rebuild ────────────
  function renderQuestion(idx) {
    const q = questions[idx];

    // Progress indicator
    const progressEl = container.querySelector('#quiz-progress');
    const fillEl     = container.querySelector('#quiz-progress-fill');
    if (progressEl) progressEl.textContent = `Question ${idx + 1} / ${totalQuestions}`;
    if (fillEl)     fillEl.style.width     = `${(idx / totalQuestions) * 100}%`;

    // Question text
    container.querySelector('#quiz-question').textContent = q.question || '';

    // Options — rebuilt per question; previous event listener is discarded
    // because we replace innerHTML (the old DOM node is gone)
    const optionsEl = container.querySelector('#quiz-options');
    optionsEl.innerHTML = (q.options || []).map((opt, i) =>
      `<button class="btn btn--option" data-idx="${i}">${escQ(opt)}</button>`
    ).join('');

    // Clear wrong-attempt message from previous question
    container.querySelector('#quiz-attempts').textContent = '';

    // Fresh handler — local vars scope per call, so retry counter resets
    attachOptionHandler(q, optionsEl);
  }

  // ── attachOptionHandler — new closure per question ────────────────────────
  function attachOptionHandler(q, optionsEl) {
    let wrongThisQuestion = 0;
    let questionAnswered  = false;

    optionsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-idx]');
      if (!btn || questionAnswered) return;

      const chosen  = parseInt(btn.dataset.idx, 10);
      const correct = chosen === (q.correct_index ?? 0);

      // Disable all immediately to prevent double-tap
      optionsEl.querySelectorAll('button').forEach((b) => (b.disabled = true));

      if (correct) {
        btn.classList.add('btn--correct');
        correctAnswers++;
        questionAnswered = true;
        setTimeout(() => advance(), 900);
      } else {
        btn.classList.add('btn--wrong');
        wrongThisQuestion++;
        totalWrongAttempts++;

        if (wrongThisQuestion >= MAX_WRONG) {
          // Reveal correct answer, then auto-advance
          const correctBtn = optionsEl.children[q.correct_index ?? 0];
          if (correctBtn) correctBtn.classList.add('btn--correct');
          questionAnswered = true;
          setTimeout(() => advance(), 1200);
        } else {
          const attemptsEl = container.querySelector('#quiz-attempts');
          attemptsEl.textContent = `Wrong! ${MAX_WRONG - wrongThisQuestion} attempt(s) left.`;

          setTimeout(() => {
            optionsEl.querySelectorAll('button').forEach((b) => {
              b.disabled = false;
              b.classList.remove('btn--wrong');
            });
          }, 1000);
        }
      }
    });
  }

  // ── advance — next question or finish ─────────────────────────────────────
  function advance() {
    if (finished) return;
    currentIdx++;
    if (currentIdx < totalQuestions) {
      renderQuestion(currentIdx);
    } else {
      finish();
    }
  }

  // ── finish — single guarded exit point ───────────────────────────────────
  function finish() {
    if (finished) return;
    finished = true;
    clearInterval(timerInterval);
    const timeTakenSec = (Date.now() - startTime) / 1000;
    onComplete({
      correct:       correctAnswers > 0,  // task-page.js: gates scoring
      wrongAttempts: totalWrongAttempts,  // task-page.js: penalty input
      timeTakenSec,
      correctAnswers,                     // extended — ignored by task-page
      totalQuestions                      // extended — ignored by task-page
    });
  }
}

function escQ(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
