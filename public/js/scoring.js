// ─────────────────────────────────────────────────────────────────────────────
// scoring.js
// Pure scoring formula. No Firestore calls — just numbers in, numbers out.
// ─────────────────────────────────────────────────────────────────────────────

import { APP_SETTINGS } from '/js/app-settings.js';

const S = APP_SETTINGS.scoring;

/**
 * Calculates the final score for a task attempt.
 *
 * @param {object} params
 * @param {number} params.basePoints        - Task's base point value
 * @param {number} params.timeTakenSec      - Seconds from task open to submission
 * @param {number|null} params.timeLimitSec - Task time limit (null = no limit)
 * @param {boolean} params.isFirstSolver    - True if this player solved it first
 * @param {number} params.wrongAttemptsBefore - Wrong attempts before this correct one
 *
 * @returns {{ finalScore: number, breakdown: object }}
 */
export function calculateScore({
  basePoints,
  timeTakenSec,
  timeLimitSec,
  isFirstSolver,
  wrongAttemptsBefore
}) {
  // Speed bonus: proportional to remaining time fraction
  let speedBonus = 0;
  if (timeLimitSec && timeLimitSec > 0 && timeTakenSec < timeLimitSec) {
    const ratio = (timeLimitSec - timeTakenSec) / timeLimitSec;
    if (ratio > S.minSpeedRatioForBonus) {
      speedBonus = Math.floor(basePoints * S.speedBonusMaxPct * ratio);
    }
  }

  const firstSolverBonus = isFirstSolver ? S.firstSolverBonus : 0;
  const penalty = Math.max(0, wrongAttemptsBefore) * S.wrongAttemptPenalty;

  const rawScore   = basePoints + speedBonus + firstSolverBonus - penalty;
  const finalScore = Math.max(0, rawScore);   // never negative

  return {
    finalScore,
    breakdown: {
      base:             basePoints,
      speedBonus,
      firstSolverBonus,
      penalty,
      rawScore
    }
  };
}

/**
 * Formats a score breakdown into human-readable lines for the result card.
 */
export function formatBreakdown(breakdown) {
  const lines = [`Base points: +${breakdown.base}`];
  if (breakdown.speedBonus > 0)
    lines.push(`Speed bonus: +${breakdown.speedBonus}`);
  if (breakdown.firstSolverBonus > 0)
    lines.push(`First solver bonus: +${breakdown.firstSolverBonus}`);
  if (breakdown.penalty > 0)
    lines.push(`Wrong attempt penalty: -${breakdown.penalty}`);
  return lines;
}
