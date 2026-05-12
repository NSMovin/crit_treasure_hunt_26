// ─────────────────────────────────────────────────────────────────────────────
// db/tribe-finder.js
// Database layer for the Tribe Finder task type.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

export async function getOrAssignTribe(taskId, sessionId) {
  const { data, error } = await sb.rpc('get_or_assign_tribe', {
    p_task_id:    taskId,
    p_session_id: sessionId
  });
  if (error) throw error;
  return data;
}

export async function submitTribeGroup(taskId, sessionId, memberStudentIds) {
  const { data, error } = await sb.rpc('submit_tribe_group', {
    p_task_id:            taskId,
    p_session_id:         sessionId,
    p_member_student_ids: memberStudentIds
  });
  if (error) throw error;
  return data;
}

// ── Admin-only ────────────────────────────────────────────────────────────────

export async function adminGetTribeState(taskId, sessionId) {
  const { data, error } = await sb.rpc('admin_get_tribe_state', {
    p_task_id:    taskId,
    p_session_id: sessionId
  });
  if (error) throw error;
  return data || [];
}

export async function adminResetTribe(taskId, sessionId) {
  const { error } = await sb.rpc('admin_reset_tribe', {
    p_task_id:    taskId,
    p_session_id: sessionId
  });
  if (error) throw error;
}
