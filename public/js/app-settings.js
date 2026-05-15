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
  // Set via VITE_ADMIN_PASSCODE environment variable.
  // Local dev: add to .env. Production: set in Vercel project dashboard.
  adminPasscode: import.meta.env.VITE_ADMIN_PASSCODE,

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
    jpegQuality:  0.72,                // 0.0–1.0
    maxBlobBytes: 150000               // ~150 KB; triggers recursive quality reduction if exceeded
  },

  // ── Voting ─────────────────────────────────────────────────────────────────
  voting: {
    participationBonus: 50,            // Awarded to every player who casts a vote
    perVoteBonus:       10,            // Per vote received by a submitted photo
    podium1st:          100,           // Top vote-getter
    podium2nd:          60,
    podium3rd:          30
  },

  // ── Leaderboard ────────────────────────────────────────────────────────────
  leaderboard: {
    displayLimit: 100                  // Max players shown
  }
};
