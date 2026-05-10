// ─────────────────────────────────────────────────────────────────────────────
// db/game-sessions.js
// CRUD for game_sessions table. Each session has isolated scores and unlocks.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

export async function getAllSessions() {
  const { data, error } = await sb
    .from('game_sessions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

// Creates a new session and immediately makes it the active session.
// Deactivates all other sessions and updates game_state.active_session_id.
export async function createAndActivateSession(name) {
  await sb.from('game_sessions').update({ is_active: false }).eq('is_active', true);

  const { data, error } = await sb
    .from('game_sessions')
    .insert({ name, is_active: true })
    .select()
    .single();
  if (error) throw error;

  await sb.from('game_state').update({ active_session_id: data.id }).eq('id', 1);
  return data;
}

// Re-activates a previous session (e.g. to replay or review).
export async function activateSession(sessionId) {
  await sb.from('game_sessions').update({ is_active: false }).eq('is_active', true);
  const { error } = await sb.from('game_sessions').update({ is_active: true }).eq('id', sessionId);
  if (error) throw error;
  await sb.from('game_state').update({ active_session_id: sessionId }).eq('id', 1);
}
