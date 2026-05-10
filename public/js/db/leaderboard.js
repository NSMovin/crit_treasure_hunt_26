// ─────────────────────────────────────────────────────────────────────────────
// db/leaderboard.js
// Leaderboard reads — sourced directly from the users table.
// There is no separate leaderboard collection; scores live in users.score.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';
import { APP_SETTINGS } from '/js/app-settings.js';

const LIMIT = APP_SETTINGS.leaderboard.displayLimit;

async function fetchLeaderboard(sessionId = null) {
  if (sessionId) {
    const { data } = await sb
      .from('session_leaderboard')
      .select('user_id, full_name, team_name, score, tasks_completed')
      .eq('session_id', sessionId)
      .order('score', { ascending: false })
      .limit(LIMIT);
    return (data || []).map((r) => ({ ...r, tasks_completed: (r.tasks_completed || []).length }));
  }

  const { data } = await sb
    .from('users')
    .select('id, full_name, team_name, score, tasks_completed')
    .order('score', { ascending: false })
    .limit(LIMIT);
  return (data || []).map((u) => ({ ...u, tasks_completed: (u.tasks_completed || []).length }));
}

/**
 * Subscribes to real-time leaderboard changes.
 * When sessionId is provided, listens to session_scores; otherwise listens to users.
 * @returns {function} Unsubscribe function
 */
export function onLeaderboardChange(sessionId, callback) {
  const table   = sessionId ? 'session_scores' : 'users';
  const channel = sb.channel('leaderboard-live')
    .on('postgres_changes', { event: '*', schema: 'public', table },
      () => fetchLeaderboard(sessionId).then(callback))
    .subscribe();

  fetchLeaderboard(sessionId).then(callback);
  return () => sb.removeChannel(channel);
}

/**
 * One-time fetch of the leaderboard (for admin use).
 */
export async function getLeaderboard(sessionId = null) {
  return fetchLeaderboard(sessionId);
}

/**
 * Computes team scores by grouping individual entries client-side.
 * @param {Array} entries - Individual leaderboard entries
 * @returns {Array} Team summaries sorted by total score descending
 */
export function computeTeamScores(entries) {
  const teams = {};

  for (const entry of entries) {
    const name = entry.team_name || '(No Team)';
    if (!teams[name]) {
      teams[name] = { team_name: name, total_score: 0, member_count: 0, tasks_completed: 0 };
    }
    teams[name].total_score     += entry.score || 0;
    teams[name].member_count    += 1;
    teams[name].tasks_completed += entry.tasks_completed || 0;
  }

  return Object.values(teams).sort((a, b) => b.total_score - a.total_score);
}
