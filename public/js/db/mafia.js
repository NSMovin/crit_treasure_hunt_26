// ─────────────────────────────────────────────────────────────────────────────
// db/mafia.js
// Database layer for the Mafia Hunt side-game.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

export async function getMyRole(userId, sessionId) {
  const { data } = await sb.from('mafia_roles')
    .select('role, is_alive, kills')
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle();
  return data;
}

export async function getLastAttackTime(userId, sessionId) {
  const { data } = await sb.from('mafia_actions')
    .select('created_at')
    .eq('attacker_user_id', userId)
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.created_at || null;
}

export async function submitAttack(targetStudentId, sessionId) {
  const { data, error } = await sb.rpc('mafia_attack', {
    p_target_student_id: targetStudentId,
    p_session_id:        sessionId
  });
  if (error) throw error;
  return data;
}

export async function getMafiaFeed(sessionId, limit = 10) {
  const { data, error } = await sb.rpc('get_mafia_feed', {
    p_session_id: sessionId,
    p_limit:      limit
  });
  if (error) throw error;
  return data || [];
}

export function onMyRoleChange(userId, sessionId, callback) {
  getMyRole(userId, sessionId).then(d => { if (d) callback(d); });

  const ch = sb.channel(`mafia-role-${userId}`)
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'mafia_roles',
      filter: `user_id=eq.${userId}`
    }, ({ new: row }) => callback(row))
    .subscribe();

  return () => sb.removeChannel(ch);
}

// ── Admin-only ────────────────────────────────────────────────────────────────

export async function adminGetMafiaState(sessionId) {
  const { data, error } = await sb.rpc('admin_get_mafia_state', {
    p_session_id: sessionId
  });
  if (error) throw error;
  return data || [];
}

export async function startMafia(sessionId) {
  const { error } = await sb.rpc('start_mafia', { p_session_id: sessionId });
  if (error) throw error;
}

export async function endMafia() {
  const { error } = await sb.from('game_state')
    .update({ mafia_active: false })
    .eq('id', 1);
  if (error) throw error;
}

export async function resetMafia(sessionId) {
  const { error } = await sb.rpc('admin_reset_mafia', { p_session_id: sessionId });
  if (error) throw error;
}
