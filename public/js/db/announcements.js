// ─────────────────────────────────────────────────────────────────────────────
// db/announcements.js
// Supabase operations for the announcements table.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

async function fetchAnnouncements() {
  const { data } = await sb
    .from('announcements')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(20);

  const list = data || [];
  // Pinned first, then by recency
  list.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return  1;
    return 0;
  });
  return list;
}

/**
 * Subscribes to live announcement changes.
 * @returns {function} Unsubscribe function
 */
export function onAnnouncementsChange(callback) {
  fetchAnnouncements().then(callback);

  const channel = sb.channel('announcements')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'announcements' },
      () => fetchAnnouncements().then(callback))
    .subscribe();

  return () => sb.removeChannel(channel);
}

/**
 * Sends a new announcement (admin only).
 */
export async function sendAnnouncement({ message, type = 'info', pinned = false, sentBy = 'Admin', sessionId = null }) {
  const { error } = await sb.from('announcements').insert({
    message,
    type,
    pinned,
    sent_by:    sentBy,
    session_id: sessionId
  });
  if (error) throw error;
}

/**
 * Deletes an announcement by id.
 */
export async function deleteAnnouncement(id) {
  const { error } = await sb.from('announcements').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Pins or unpins an announcement.
 */
export async function pinAnnouncement(id, pinned) {
  const { error } = await sb.from('announcements').update({ pinned }).eq('id', id);
  if (error) throw error;
}
