// ─────────────────────────────────────────────────────────────────────────────
// db/photo-votes.js
// Supabase operations for the photo_votes table and photo submission gallery.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

/**
 * Fetches all photo submissions for a session, with vote counts.
 * Returns rows ordered by vote count descending.
 */
export async function getPhotoSubmissions(sessionId) {
  if (!sessionId) {
    const { data, error } = await sb
      .from('attempts')
      .select('id, photo_url, user_id, users(full_name), task_id')
      .not('photo_url', 'is', null)
      .eq('result', 'correct');
    if (error) throw error;
    return (data || []).map((a) => ({
      id:         a.id,
      photo_url:  a.photo_url,
      user_id:    a.user_id,
      full_name:  a.users?.full_name || 'Unknown',
      task_id:    a.task_id,
      vote_count: 0
    }));
  }

  // With sessionId: join vote counts
  const { data: attempts, error: aErr } = await sb
    .from('attempts')
    .select('id, photo_url, user_id, users(full_name), task_id')
    .not('photo_url', 'is', null)
    .eq('session_id', sessionId)
    .eq('result', 'correct');
  if (aErr) throw aErr;

  const { data: votes, error: vErr } = await sb
    .from('photo_votes')
    .select('attempt_id')
    .eq('session_id', sessionId);
  if (vErr) throw vErr;

  const voteCounts = {};
  (votes || []).forEach(({ attempt_id }) => {
    voteCounts[attempt_id] = (voteCounts[attempt_id] || 0) + 1;
  });

  return (attempts || [])
    .map((a) => ({
      id:         a.id,
      photo_url:  a.photo_url,
      user_id:    a.user_id,
      full_name:  a.users?.full_name || 'Unknown',
      task_id:    a.task_id,
      vote_count: voteCounts[a.id] || 0
    }))
    .sort((a, b) => b.vote_count - a.vote_count);
}

/**
 * Returns the attempt_id the user already voted for in this session, or null.
 */
export async function getMyVote(userId, sessionId) {
  const { data } = await sb
    .from('photo_votes')
    .select('attempt_id')
    .eq('voter_user_id', userId)
    .eq('session_id', sessionId)
    .maybeSingle();
  return data?.attempt_id ?? null;
}

/**
 * Casts a vote. Returns { error } if it fails (e.g. duplicate).
 */
export async function castVote(userId, attemptId, sessionId) {
  const { error } = await sb.from('photo_votes').insert({
    voter_user_id: userId,
    attempt_id:    attemptId,
    session_id:    sessionId
  });
  return { error };
}

/**
 * Subscribes to vote changes for a session. Returns unsubscribe function.
 */
export function onPhotoVotesChange(sessionId, callback) {
  const channel = sb.channel(`photo-votes-${sessionId}`)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'photo_votes',
        filter: `session_id=eq.${sessionId}` },
      () => callback())
    .subscribe();
  return () => sb.removeChannel(channel);
}
