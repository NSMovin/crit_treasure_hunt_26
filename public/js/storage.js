// ─────────────────────────────────────────────────────────────────────────────
// storage.js
// Uploads compressed photos to Supabase Storage.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

const BUCKET = 'photos';

/**
 * Uploads a JPEG Blob to Supabase Storage.
 * Returns the public URL of the uploaded file.
 *
 * @param {Blob}   blob    - Compressed JPEG Blob from image-compress.js
 * @param {string} taskId  - task_id slug (used in file path)
 * @param {string} userId  - user UUID (used as folder name)
 * @returns {Promise<string>} Public URL
 */
export async function uploadPhoto(blob, taskId, userId) {
  const path = `${userId}/${taskId}-${Date.now()}.jpg`;

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}
