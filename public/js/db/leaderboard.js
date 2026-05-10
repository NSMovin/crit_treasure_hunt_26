// ─────────────────────────────────────────────────────────────────────────────
// db/leaderboard.js
// Leaderboard reads — sourced directly from the users table.
// There is no separate leaderboard collection; scores live in users.score.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';
import { APP_SETTINGS } from '/js/app-settings.js';

const LIMIT = APP_SETTINGS.leaderboard.displayLimit;

async function fetchLeaderboard() {
  const { data } = await sb
    .from('users')
    .select('id, full_name, team_name, score, tasks_completed')
    .order('score', { ascending: false })
    .limit(LIMIT);

  return (data || []).map((u) => ({
    ...u,
    tasks_completed: (u.tasks_completed || []).length   // expose count, not array
  }));
}

/**
 * Subscribes to real-time leaderboard changes.
 * Re-fetches the sorted list whenever any user's score changes.
 * @returns {function} Unsubscribe function
 */
export function onLeaderboardChange(callback) {
  fetchLeaderboard().then(callback);

  const channel = sb.channel('leaderboard')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'users' },
      () => fetchLeaderboard().then(callback))
    .subscribe();

  return () => sb.removeChannel(channel);
}

/**
 * One-time fetch of the leaderboard (for admin use).
 */
export async function getLeaderboard() {
  return fetchLeaderboard();
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
