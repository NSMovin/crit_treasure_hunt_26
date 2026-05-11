// ─────────────────────────────────────────────────────────────────────────────
// games/photo-challenge.js
// Photo capture + client-side compression.
// The compressed Blob is returned via onComplete; task-page.js uploads it
// to Supabase Storage and stores the resulting URL.
// ─────────────────────────────────────────────────────────────────────────────

import { compressImage } from '/js/image-compress.js';

/**
 * task.config = {
 *   prompt: 'Take a photo of the red bench near the fountain.'
 * }
 *
 * onComplete receives:
 *   { correct: true, timeTakenSec, wrongAttempts: 0, photoBlob: Blob }
 *
 * Points are awarded optimistically — admin reviews photos manually.
 */
export function run(task, container, onComplete) {
  const cfg       = task.config || {};
  const prompt    = cfg.prompt  || task.description || 'Take a photo for this challenge.';
  const startTime = Date.now();
  let   photoData = null;   // Blob
  let   previewObjUrl = null;
  let   done      = false;

  container.innerHTML = `
    <div class="photo-challenge">
      <p class="photo-challenge__prompt">${esc(prompt)}</p>
      <div class="photo-challenge__preview" id="ph-preview-wrap" style="display:none">
        <img id="ph-preview" alt="Preview" />
        <p class="photo-challenge__size" id="ph-size"></p>
      </div>

      <label class="btn btn--secondary photo-challenge__pick" for="ph-input">
        📷 Choose / Take Photo
      </label>
      <input type="file" id="ph-input" accept="image/*" capture="environment"
             style="display:none" />

      <button class="btn btn--primary photo-challenge__submit" id="ph-submit"
              disabled>Submit Photo</button>
      <p class="photo-challenge__status" id="ph-status"></p>
    </div>
  `;

  const fileInput   = container.querySelector('#ph-input');
  const submitBtn   = container.querySelector('#ph-submit');
  const previewWrap = container.querySelector('#ph-preview-wrap');
  const previewImg  = container.querySelector('#ph-preview');
  const sizeEl      = container.querySelector('#ph-size');
  const statusEl    = container.querySelector('#ph-status');

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    statusEl.textContent = 'Compressing image…';
    submitBtn.disabled   = true;

    try {
      const blob = await compressImage(file);
      photoData  = blob;

      // Revoke previous object URL before creating a new one
      if (previewObjUrl) URL.revokeObjectURL(previewObjUrl);
      previewObjUrl = URL.createObjectURL(blob);

      previewImg.src            = previewObjUrl;
      previewWrap.style.display = 'block';
      sizeEl.textContent        = `~${Math.round(blob.size / 1024)} KB`;
      submitBtn.disabled        = false;
      statusEl.textContent      = 'Looks good! Hit Submit when ready.';
    } catch (err) {
      statusEl.textContent = 'Could not process image. Please try again.';
      console.error('Image compression error:', err);
    }
  });

  submitBtn.addEventListener('click', () => {
    if (!photoData || done) return;
    done = true;
    submitBtn.disabled   = true;
    statusEl.textContent = 'Uploading…';

    const timeTakenSec = (Date.now() - startTime) / 1000;
    onComplete({ correct: true, timeTakenSec, wrongAttempts: 0, photoBlob: photoData });
  });
}

function esc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
