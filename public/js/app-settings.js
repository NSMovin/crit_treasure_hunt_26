// ─────────────────────────────────────────────────────────────────────────────
// app-settings.js
// Central configuration for Treasure Hunt Live.
// EDIT THIS FILE before deploying to your event.
// ─────────────────────────────────────────────────────────────────────────────

export const APP_SETTINGS = {
  // ── Event Info ─────────────────────────────────────────────────────────────
  gameName:  'Treasure Hunt',
  eventDate: '2026-05-13',             // Display only

  // ── Admin ──────────────────────────────────────────────────────────────────
  // Change this to a strong passcode before your event.
  // Keep the /admin.html URL private — this passcode is the only gate.
  adminPasscode: 'admin123',

  // ── Scoring ────────────────────────────────────────────────────────────────
  scoring: {
    speedBonusMaxPct:       0.50,      // Up to 50% of base points as speed bonus
    firstSolverBonus:       50,        // Flat bonus for being first to solve a task
    wrongAttemptPenalty:    10,        // Deducted per wrong attempt
    minSpeedRatioForBonus:  0.10       // Need >10% time remaining to earn speed bonus
  },

  // ── Photo Challenge ────────────────────────────────────────────────────────
  photo: {
    maxWidthPx:   400,
    maxHeightPx:  400,
    jpegQuality:  0.72                 // 0.0–1.0
  },

  // ── Leaderboard ────────────────────────────────────────────────────────────
  leaderboard: {
    displayLimit: 100                  // Max players shown
  }
};
