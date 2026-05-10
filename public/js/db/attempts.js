// ─────────────────────────────────────────────────────────────────────────────
// db/attempts.js
// Supabase operations for the attempts table.
// Also wraps the claim_first_solver RPC.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

/**
 * Inserts a completed attempt row.
 */
export async function submitAttempt(attempt) {
  const { error } = await sb.from('attempts').insert({ ...attempt });
  if (error) throw error;
}

/**
 * Counts wrong attempts for a user on a specific task.
 * When sessionId is provided, filters by session.
 */
export async function countWrongAttempts(userId, taskId, sessionId = null) {
  let q = sb.from('attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .eq('result', 'wrong');
  if (sessionId) q = q.eq('session_id', sessionId);
  const { count } = await q;
  return count || 0;
}

/**
 * Atomically claims the first-solver slot for a task via a Postgres function.
 * Returns true if this call claimed it, false if already taken by someone else.
 */
export async function claimFirstSolver(userId, taskId, sessionId = null) {
  const { data, error } = await sb.rpc('claim_first_solver', {
    p_task_id:    taskId,
    p_user_id:    userId,
    p_session_id: sessionId
  });
  if (error) throw error;
  return data === true;
}

/**
 * Returns all attempts for a given user (for admin analytics).
 */
export async function getUserAttempts(userId) {
  const { data } = await sb
    .from('attempts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true });
  return data || [];
}
