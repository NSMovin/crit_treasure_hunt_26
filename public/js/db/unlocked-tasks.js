// ─────────────────────────────────────────────────────────────────────────────
// db/unlocked-tasks.js
// Supabase operations for the unlocked_tasks table.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

// Returns: 'unlocked' | 'already_unlocked' | 'task_not_found' | 'task_not_active'
export async function unlockTask(userId, taskId) {
  const { data, error } = await sb.rpc('unlock_task', { p_user_id: userId, p_task_id: taskId });
  if (error) throw error;
  return data;
}

export async function isTaskUnlocked(userId, taskId) {
  const { data } = await sb
    .from('unlocked_tasks')
    .select('id')
    .eq('user_id', userId)
    .eq('task_id', taskId)
    .maybeSingle();
  return data !== null;
}

export async function getUserUnlockedTaskIds(userId) {
  const { data } = await sb
    .from('unlocked_tasks')
    .select('task_id')
    .eq('user_id', userId);
  return (data || []).map((r) => r.task_id);
}

export function onUserUnlocksChange(userId, callback) {
  const channel = sb.channel(`unlocks-${userId}`)
    .on('postgres_changes', {
      event:  'INSERT',
      schema: 'public',
      table:  'unlocked_tasks',
      filter: `user_id=eq.${userId}`
    }, () => getUserUnlockedTaskIds(userId).then(callback))
    .subscribe();
  return () => sb.removeChannel(channel);
}
