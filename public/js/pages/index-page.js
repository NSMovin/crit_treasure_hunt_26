// ─────────────────────────────────────────────────────────────────────────────
// pages/index-page.js
// Controls index.html: anonymous sign-in → profile setup → redirect to game.
// ─────────────────────────────────────────────────────────────────────────────

import { signInAnonymously, createUserProfile } from '/js/auth.js';
import { redirectIfLoggedIn }                   from '/js/router.js';
import { getGameState }                         from '/js/db/game-state.js';
import { showToast, showSpinner, hideSpinner, escapeHTML } from '/js/ui.js';
import { APP_SETTINGS }                         from '/js/app-settings.js';

(async function init() {
  const alreadyIn = await redirectIfLoggedIn();
  if (alreadyIn) return;

  let validTeams = [];
  try {
    const gs = await getGameState();
    validTeams = gs?.valid_teams || [];
  } catch { /* use empty list if unreachable */ }

  renderLanding(validTeams);
})().catch((err) => {
  console.error('index-page init error:', err);
  document.getElementById('app').innerHTML = `
    <div class="landing">
      <div class="landing__hero">
        <div class="landing__logo">⚠️</div>
        <h1 class="landing__title" style="font-size:24px">Something went wrong</h1>
        <p>${escapeHTML(err.message || 'Unknown error. Check console.')}</p>
        <button class="btn btn--primary" onclick="location.reload()">Retry</button>
      </div>
    </div>`;
});

// ── Landing screen ────────────────────────────────────────────────────────────

function renderLanding(validTeams) {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="landing">
      <div class="landing__hero">
        <div class="landing__logo">🗺️</div>
        <h1 class="landing__title">${escapeHTML(APP_SETTINGS.gameName)}</h1>
        <p class="landing__subtitle">University Amusement Park Treasure Hunt</p>
      </div>
      <button class="btn btn--primary btn--lg" id="btn-start">
        Join the Hunt
      </button>
    </div>
  `;

  document.getElementById('btn-start').addEventListener('click', () => {
    renderProfileForm(validTeams);
  });
}

// ── Profile setup form ────────────────────────────────────────────────────────

function renderProfileForm(validTeams) {
  const app = document.getElementById('app');
  const teamOptions = validTeams.length
    ? validTeams.map((t) => `<option value="${escapeHTML(t)}">${escapeHTML(t)}</option>`).join('')
    : '<option value="">— No teams defined —</option>';

  app.innerHTML = `
    <div class="profile-form">
      <h2 class="profile-form__title">Create Your Profile</h2>
      <p class="profile-form__sub">This is how you'll appear on the leaderboard.</p>

      <div class="form-group">
        <label class="form-label" for="inp-name">Full Name *</label>
        <input class="input" id="inp-name" type="text" placeholder="e.g. Fatima Rahman"
               maxlength="60" autocomplete="name" />
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-sid">Student ID *</label>
        <input class="input" id="inp-sid" type="text" placeholder="e.g. 20210301234"
               maxlength="20" inputmode="numeric" autocomplete="off" />
      </div>

      <div class="form-group">
        <label class="form-label" for="inp-team">Team (optional)</label>
        <select class="input" id="inp-team">
          <option value="">— Select team —</option>
          ${teamOptions}
        </select>
      </div>

      <button class="btn btn--primary btn--lg" id="btn-register">
        Start Playing 🚀
      </button>
      <p class="profile-form__error" id="form-error"></p>
    </div>
  `;

  document.getElementById('btn-register').addEventListener('click', handleRegister);
}

// ── Register handler ──────────────────────────────────────────────────────────

async function handleRegister() {
  const nameEl  = document.getElementById('inp-name');
  const sidEl   = document.getElementById('inp-sid');
  const teamEl  = document.getElementById('inp-team');
  const errorEl = document.getElementById('form-error');

  const fullName  = nameEl.value.trim();
  const studentId = sidEl.value.trim();
  const teamName  = teamEl.value.trim();

  errorEl.textContent = '';

  if (!fullName) {
    errorEl.textContent = 'Please enter your full name.';
    nameEl.focus();
    return;
  }
  if (!studentId) {
    errorEl.textContent = 'Please enter your student ID.';
    sidEl.focus();
    return;
  }
  if (!/^\d{5,15}$/.test(studentId)) {
    errorEl.textContent = 'Student ID must be 5–15 digits.';
    sidEl.focus();
    return;
  }

  showSpinner();
  document.getElementById('btn-register').disabled = true;

  try {
    // 1. Sign in anonymously (persists in localStorage; safe to call multiple times)
    const user = await signInAnonymously();

    // 2. Create profile — throws if student_id is already taken (Postgres unique constraint)
    await createUserProfile({ uid: user.id, fullName, studentId, teamName });

    // 3. Go to game
    window.location.replace('/game.html');

  } catch (err) {
    hideSpinner();
    document.getElementById('btn-register').disabled = false;

    // Postgres duplicate key error code
    if (err.code === '23505' || (err.message || '').includes('student_id')) {
      errorEl.textContent = 'That Student ID is already registered. Contact an admin if this is an error.';
    } else {
      errorEl.textContent = 'Something went wrong. Check your internet and try again.';
      showToast('Registration failed. Please retry.', 'error');
      console.error('Registration error:', err);
    }
  }
}
