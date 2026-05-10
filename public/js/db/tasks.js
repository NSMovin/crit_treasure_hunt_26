// ─────────────────────────────────────────────────────────────────────────────
// db/tasks.js
// Supabase operations for the tasks table.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

/**
 * Fetches a single task by its task_id slug. Returns null if not found.
 */
export async function getTask(taskId) {
  const { data } = await sb.from('tasks').select('*').eq('task_id', taskId).maybeSingle();
  return data;
}

/**
 * Returns all active tasks ordered by display_order.
 */
export async function getActiveTasks() {
  const { data } = await sb
    .from('tasks')
    .select('*')
    .eq('active', true)
    .order('display_order', { ascending: true });
  return data || [];
}

/**
 * Returns ALL tasks (active and inactive) for admin use.
 */
export async function getAllTasks() {
  const { data } = await sb
    .from('tasks')
    .select('*')
    .order('display_order', { ascending: true });
  return data || [];
}

/**
 * Subscribes to real-time active task changes.
 * Re-fetches the full list on any change (insert / update / delete).
 * @returns {function} Unsubscribe function
 */
export function onActiveTasksChange(callback) {
  getActiveTasks().then(callback);

  const channel = sb.channel('tasks-active')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' },
      () => getActiveTasks().then(callback))
    .subscribe();

  return () => sb.removeChannel(channel);
}

/**
 * Creates a new task row. task_id must be a unique slug.
 */
export async function createTask(taskData) {
  const { error } = await sb.from('tasks').insert({
    task_id:        taskData.task_id,
    title:          taskData.title,
    description:    taskData.description || '',
    type:           taskData.type,
    points:         taskData.points,
    time_limit_sec: taskData.time_limit_sec || null,
    hint:           taskData.hint || '',
    hint_released:  taskData.hint_released || false,
    active:         taskData.active || false,
    display_order:  taskData.display_order || 99,
    config:         taskData.config || {}
  });
  if (error) throw error;
}

/**
 * Partial update of a task row.
 */
export async function updateTask(taskId, updates) {
  const { error } = await sb.from('tasks').update(updates).eq('task_id', taskId);
  if (error) throw error;
}

/**
 * Deletes a task row.
 */
export async function deleteTask(taskId) {
  const { error } = await sb.from('tasks').delete().eq('task_id', taskId);
  if (error) throw error;
}

/**
 * Toggles the active state of a task.
 */
export async function setTaskActive(taskId, active) {
  const { error } = await sb.from('tasks').update({ active }).eq('task_id', taskId);
  if (error) throw error;
}

/**
 * Updates the hint text and released flag for a task.
 */
export async function updateTaskHint(taskId, hint, released) {
  const { error } = await sb
    .from('tasks')
    .update({ hint, hint_released: released })
    .eq('task_id', taskId);
  if (error) throw error;
}
