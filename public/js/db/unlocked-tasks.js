// ─────────────────────────────────────────────────────────────────────────────
// db/unlocked-tasks.js
// Supabase operations for the unlocked_tasks table.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

// Returns: 'unlocked' | 'already_unlocked' | 'task_not_found' | 'task_not_active'
export async function unlockTask(userId, taskId, sessionId = null) {
  const { data, error } = await sb.rpc('unlock_task', {
    p_user_id:    userId,
    p_task_id:    taskId,
    p_session_id: sessionId
  });
  if (error) throw error;
  return data;
}

export async function isTaskUnlocked(userId, taskId, sessionId = null) {
  let q = sb.from('unlocked_tasks').select('id')
    .eq('user_id', userId).eq('task_id', taskId);
  if (sessionId) q = q.eq('session_id', sessionId);
  const { data } = await q.maybeSingle();
  return data !== null;
}

export async function getUserUnlockedTaskIds(userId, sessionId = null) {
  let q = sb.from('unlocked_tasks').select('task_id').eq('user_id', userId);
  if (sessionId) q = q.eq('session_id', sessionId);
  const { data } = await q;
  return (data || []).map((r) => r.task_id);
}

export function onUserUnlocksChange(userId, callback, sessionId = null) {
  const channel = sb.channel(`unlocks-${userId}-${sessionId ?? 'global'}`)
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'unlocked_tasks',
      filter: `user_id=eq.${userId}`
    }, () => getUserUnlockedTaskIds(userId, sessionId).then(callback))
    .subscribe();
  return () => sb.removeChannel(channel);
}
