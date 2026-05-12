// ─────────────────────────────────────────────────────────────────────────────
// db/moderation.js
// Client-side DB layer for the dual-layer moderation system.
//   - checkGameBan        : fast ban check for page guards
//   - searchPlayers       : admin full-text search across name/sid/team
//   - getSessionBans      : bulk fetch of session_players for a session
//   - adminSetGameBan     : set/clear global game ban via RPC
//   - adminSetSessionBan  : set/clear session ban via RPC
//   - adminResetScore     : reset score to 0 via RPC
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

/**
 * Checks whether the currently-authenticated user is game-banned.
 * Called at the top of task-page, vote-page, mafia-page before gameplay.
 * Returns { is_banned: bool, reason: string }.
 */
export async function checkGameBan(userId) {
  const { data } = await sb
    .from('users')
    .select('is_game_banned, game_ban_reason')
    .eq('id', userId)
    .maybeSingle();
  return {
    is_banned: data?.is_game_banned ?? false,
    reason:    data?.game_ban_reason ?? ''
  };
}

/**
 * Fetches all players, optionally filtered by a search query.
 * Searches full_name, student_id, and team_name (case-insensitive).
 * Always includes ban fields so the admin panel can display status.
 */
export async function searchPlayers(query = '') {
  const q = query.trim();
  let req = sb
    .from('users')
    .select('id, full_name, student_id, team_name, score, tasks_completed, is_game_banned, game_ban_reason, last_active')
    .order('last_active', { ascending: false })
    .limit(100);

  if (q) {
    req = req.or(`full_name.ilike.%${q}%,student_id.ilike.%${q}%,team_name.ilike.%${q}%`);
  }

  const { data } = await req;
  return data || [];
}

/**
 * Fetches all session_players rows for a session in one query.
 * Returns a Map keyed by user_id for O(1) lookup when rendering the table.
 */
export async function getSessionBans(sessionId) {
  if (!sessionId) return new Map();
  const { data } = await sb
    .from('session_players')
    .select('user_id, is_session_banned, session_ban_reason')
    .eq('session_id', sessionId);
  const map = new Map();
  (data || []).forEach((r) => map.set(r.user_id, r));
  return map;
}

/**
 * Sets or clears a global game ban. Calls the admin_set_game_ban SECURITY
 * DEFINER RPC — no client can bypass this by modifying the users row directly
 * because the admin update function is the only way to set is_game_banned.
 */
export async function adminSetGameBan(userId, banned, reason = '') {
  const { error } = await sb.rpc('admin_set_game_ban', {
    p_user_id: userId,
    p_banned:  banned,
    p_reason:  reason || null
  });
  if (error) throw error;
}

/**
 * Sets or clears a session-scoped ban. Upserts into session_players.
 */
export async function adminSetSessionBan(userId, sessionId, banned, reason = '') {
  const { error } = await sb.rpc('admin_set_session_ban', {
    p_user_id:    userId,
    p_session_id: sessionId,
    p_banned:     banned,
    p_reason:     reason || null
  });
  if (error) throw error;
}

/**
 * Resets a player's score to 0. Affects both users.score and session_scores.score
 * when sessionId is provided. Does NOT delete attempts or history.
 */
export async function adminResetScore(userId, sessionId = null) {
  const { error } = await sb.rpc('admin_reset_player_score', {
    p_user_id:    userId,
    p_session_id: sessionId
  });
  if (error) throw error;
}
