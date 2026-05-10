// ─────────────────────────────────────────────────────────────────────────────
// storage.js
// Uploads compressed photos to Supabase Storage.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

const BUCKET = 'photos';

/**
 * Uploads a base64 data URL to Supabase Storage.
 * Returns the public URL of the uploaded file.
 *
 * @param {string} dataUrl  - base64 JPEG data URL from image-compress.js
 * @param {string} taskId   - task_id slug (used in file path)
 * @param {string} userId   - user UUID (used as folder name)
 * @returns {Promise<string>} Public URL
 */
export async function uploadPhoto(dataUrl, taskId, userId) {
  const blob = dataUrlToBlob(dataUrl);
  const path = `${userId}/${taskId}-${Date.now()}.jpg`;

  const { error } = await sb.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', upsert: false });

  if (error) throw error;

  const { data } = sb.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function dataUrlToBlob(dataUrl) {
  const [header, b64] = dataUrl.split(',');
  const mime   = header.match(/:(.*?);/)[1];
  const binary = atob(b64);
  const arr    = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
