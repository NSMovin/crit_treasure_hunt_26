// ─────────────────────────────────────────────────────────────────────────────
// games/tribe-finder.js
// Tribe Finder task module — secret tribe assignment + social group validation.
// ─────────────────────────────────────────────────────────────────────────────

import { getOrAssignTribe, submitTribeGroup } from '/js/db/tribe-finder.js';
import { getActiveSessionId }                 from '/js/db/game-state.js';
import { escapeHTML }                         from '/js/ui.js';

export async function run(task, container, onComplete) {
  const startTime = Date.now();
  let   finished  = false;
  let   cooldownInterval = null;

  // ── Loading state ───────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="tf__wrap">
      <div class="tf__loading">
        <div class="spinner"></div>
        <p>Consulting the ancient records…</p>
      </div>
    </div>
  `;

  let sessionId, assignment;
  try {
    sessionId  = await getActiveSessionId();
    assignment = await getOrAssignTribe(task.task_id, sessionId);
  } catch (err) {
    container.innerHTML = `
      <div class="tf__wrap">
        <div class="tf__error">
          <p>⚠️ ${escapeHTML(err.message || String(err))}</p>
        </div>
      </div>
    `;
    return;
  }

  const { tribe_label, completed_at, tribe_size, cooldown_seconds } = assignment;
  const membersNeeded = (tribe_size || 4) - 1;

  // ── Already completed ───────────────────────────────────────────────────────
  // task-page.js hasCompletedTask guard normally blocks re-entry, but handle
  // the edge case where completed_at is set but the attempt wasn't recorded.
  if (completed_at) {
    container.innerHTML = `
      <div class="tf__wrap">
        <div class="tf__tribe-card tf__tribe-card--done">
          <div class="tf__tribe-icon">🏕️</div>
          <div class="tf__tribe-label">Tribe ${escapeHTML(tribe_label)}</div>
          <p class="tf__mission">Your tribe has already been found. Well done.</p>
        </div>
      </div>
    `;
    if (!finished) {
      finished = true;
      onComplete({ correct: true, timeTakenSec: 0, wrongAttempts: 0 });
    }
    return;
  }

  // ── Build input fields ──────────────────────────────────────────────────────
  const inputFields = Array.from({ length: membersNeeded }, (_, i) => `
    <div class="tf__input-row">
      <label class="tf__input-label">Teammate ${i + 1} Student ID</label>
      <input type="text" class="input tf__id-input" placeholder="e.g. 2210123"
             autocomplete="off" autocapitalize="none" spellcheck="false" />
    </div>
  `).join('');

  // ── Main render ─────────────────────────────────────────────────────────────
  container.innerHTML = `
    <div class="tf__wrap">

      <div class="tf__tribe-card">
        <div class="tf__tribe-icon">🏕️</div>
        <div class="tf__tribe-eyebrow">Your Secret Tribe</div>
        <div class="tf__tribe-label">${escapeHTML(tribe_label)}</div>
      </div>

      <div class="tf__mission">
        <p>You are one of <strong>${tribe_size}</strong> members of Tribe <strong>${escapeHTML(tribe_label)}</strong>.</p>
        <p>Your mission: find your ${membersNeeded} teammate${membersNeeded > 1 ? 's' : ''} in real life.
           Talk to people. Ask questions. Figure out who shares your tribe.</p>
        <p class="tf__mission-hint">When you're sure — enter their student IDs below.</p>
      </div>

      <div class="tf__inputs">
        ${inputFields}
      </div>

      <div class="tf__cooldown tf__hidden" id="tf-cooldown"></div>
      <div class="tf__result tf__hidden"   id="tf-result"></div>

      <button class="btn btn--primary tf__submit-btn" id="tf-submit">
        🔍 Submit Group
      </button>

    </div>
  `;

  const submitBtn  = container.querySelector('#tf-submit');
  const cooldownEl = container.querySelector('#tf-cooldown');
  const resultEl   = container.querySelector('#tf-result');
  const inputs     = container.querySelectorAll('.tf__id-input');

  // ── Resume cooldown if one was already active ───────────────────────────────
  if (cooldown_seconds > 0) startCooldown(cooldown_seconds);

  // ── Submit handler ──────────────────────────────────────────────────────────
  submitBtn.addEventListener('click', handleSubmit);
  inputs.forEach((inp) => {
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSubmit(); });
  });

  async function handleSubmit() {
    if (finished || submitBtn.disabled) return;

    const ids = Array.from(inputs).map((i) => i.value.trim()).filter(Boolean);
    if (ids.length < membersNeeded) {
      showResult(`Enter all ${membersNeeded} teammate ID${membersNeeded > 1 ? 's' : ''} before submitting.`, 'error');
      return;
    }

    submitBtn.disabled = true;
    showResult('Verifying…', 'info');

    try {
      const res = await submitTribeGroup(task.task_id, sessionId, ids);

      if (res.success) {
        renderSuccess(tribe_label);
        setTimeout(() => {
          if (!finished) {
            finished = true;
            onComplete({
              correct:      true,
              timeTakenSec: (Date.now() - startTime) / 1000,
              wrongAttempts: 0
            });
          }
        }, 1400);
      } else {
        const msg = res.outcome === 'player_not_found'
          ? '❌ One or more student IDs not found. Check and try again.'
          : '❌ Wrong group. That\'s not your full tribe. −50 points.';
        showResult(msg, 'error');
        startCooldown(res.cooldown_seconds || 120);
      }
    } catch (err) {
      const msg = err.message || String(err);
      // Cooldown error comes as an exception from the RPC
      const cdMatch = msg.match(/Wait (\d+) more seconds/);
      if (cdMatch) {
        showResult('⏳ Cooldown active — wait before trying again.', 'error');
        startCooldown(parseInt(cdMatch[1], 10));
      } else {
        showResult(`⚠️ ${escapeHTML(msg)}`, 'error');
        submitBtn.disabled = false;
      }
    }
  }

  // ── Cooldown timer ──────────────────────────────────────────────────────────
  function startCooldown(seconds) {
    clearInterval(cooldownInterval);
    submitBtn.disabled = true;
    let remaining = seconds;

    function tick() {
      if (remaining <= 0) {
        clearInterval(cooldownInterval);
        cooldownEl.classList.add('tf__hidden');
        resultEl.classList.add('tf__hidden');
        submitBtn.disabled = false;
        return;
      }
      const m = Math.floor(remaining / 60);
      const s = remaining % 60;
      cooldownEl.textContent = `⏳ Next attempt in ${m}:${String(s).padStart(2, '0')}`;
      cooldownEl.classList.remove('tf__hidden');
      remaining--;
    }

    tick();
    cooldownInterval = setInterval(tick, 1000);
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function showResult(msg, type) {
    resultEl.textContent = msg;
    resultEl.className   = `tf__result tf__result--${type}`;
  }

  function renderSuccess(label) {
    container.querySelector('.tf__wrap').innerHTML = `
      <div class="tf__success-overlay">
        <div class="tf__success-icon">🏕️</div>
        <h2 class="tf__success-title">Tribe Found!</h2>
        <p class="tf__success-label">Tribe ${escapeHTML(label)}</p>
        <p class="tf__success-sub">Your group has been verified. Calculating score…</p>
      </div>
    `;
  }
}
