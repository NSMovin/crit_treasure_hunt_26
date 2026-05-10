// ─────────────────────────────────────────────────────────────────────────────
// db/game-state.js
// Supabase operations for the game_state table (always row id=1).
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

/**
 * Fetches the current game state. Returns null if the row doesn't exist.
 */
export async function getGameState() {
  const { data } = await sb.from('game_state').select('*').eq('id', 1).maybeSingle();
  return data;
}

/**
 * Subscribes to live game state changes (pause / end overlay).
 * @returns {function} Unsubscribe function
 */
export function onGameStateChange(callback) {
  getGameState().then(callback);

  const channel = sb.channel('game-state')
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_state' },
      ({ new: row }) => callback(row))
    .subscribe();

  return () => sb.removeChannel(channel);
}

/**
 * Upserts game state fields (admin only).
 */
export async function setGameState(data) {
  const { error } = await sb.from('game_state').upsert({ id: 1, ...data });
  if (error) throw error;
}

/**
 * Toggles the game_active flag.
 */
export async function setGameActive(active) {
  const update = { game_active: active };
  if (active) update.started_at = new Date().toISOString();
  const { error } = await sb.from('game_state').update(update).eq('id', 1);
  if (error) throw error;
}

export async function getActiveSessionId() {
  const gs = await getGameState();
  return gs?.active_session_id ?? null;
}
