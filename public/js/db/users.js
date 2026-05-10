// ─────────────────────────────────────────────────────────────────────────────
// db/users.js
// Supabase operations for the users table.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

/**
 * Fetches a user row by auth id. Returns null if not found.
 */
export async function getUser(userId) {
  const { data } = await sb.from('users').select('*').eq('id', userId).maybeSingle();
  return data;
}

/**
 * Atomically adds delta points and marks taskId complete.
 * Uses a Postgres security-definer function to bypass RLS.
 * Returns the new total score.
 */
export async function addScore(userId, delta, taskId) {
  const { data, error } = await sb.rpc('add_score', {
    p_user_id: userId,
    p_delta:   delta,
    p_task_id: taskId
  });
  if (error) throw error;
  return data;
}

/**
 * Returns true if the user has already completed this task.
 */
export async function hasCompletedTask(userId, taskId) {
  const { data } = await sb
    .from('users')
    .select('tasks_completed')
    .eq('id', userId)
    .maybeSingle();
  return (data?.tasks_completed || []).includes(taskId);
}

/**
 * Subscribes to live updates for a single user (score badge on game page).
 * Triggers an initial fetch immediately, then listens for row UPDATEs.
 * @returns {function} Unsubscribe function
 */
export function onUserChange(userId, callback) {
  sb.from('users').select('*').eq('id', userId).maybeSingle()
    .then(({ data }) => { if (data) callback(data); });

  const channel = sb.channel(`user-${userId}`)
    .on('postgres_changes', {
      event:  'UPDATE',
      schema: 'public',
      table:  'users',
      filter: `id=eq.${userId}`
    }, ({ new: row }) => callback(row))
    .subscribe();

  return () => sb.removeChannel(channel);
}

/**
 * Returns all users sorted by last_active (for admin player monitor).
 */
export async function getRecentPlayers(limitCount = 100) {
  const { data } = await sb
    .from('users')
    .select('*')
    .order('last_active', { ascending: false })
    .limit(limitCount);
  return data || [];
}
