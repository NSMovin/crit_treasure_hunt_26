// ─────────────────────────────────────────────────────────────────────────────
// image-compress.js
// Client-side image compression using Canvas API.
// Resizes and compresses any image File to a JPEG Blob ready for direct upload
// to Supabase Storage (no base64 intermediary needed).
// ─────────────────────────────────────────────────────────────────────────────

import { APP_SETTINGS } from '/js/app-settings.js';

const { maxWidthPx, maxHeightPx, jpegQuality, maxBlobBytes } = APP_SETTINGS.photo;

/**
 * Compresses an image File to a JPEG Blob.
 * Recursively reduces quality/dimensions if the result exceeds maxBlobBytes.
 *
 * @param {File}   file     - The image file from <input type="file">
 * @param {object} [opts]   - Override defaults
 * @returns {Promise<Blob>} - Resolves with a JPEG Blob
 */
export function compressImage(file, opts = {}) {
  const maxW    = opts.maxWidthPx  || maxWidthPx;
  const maxH    = opts.maxHeightPx || maxHeightPx;
  const quality = opts.quality     || jpegQuality;

  return new Promise((resolve, reject) => {
    const img    = new Image();
    const objUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objUrl);

      // Compute dimensions that fit within the max box while keeping ratio
      let { naturalWidth: w, naturalHeight: h } = img;
      if (w > maxW || h > maxH) {
        const ratio = Math.min(maxW / w, maxH / h);
        w = Math.floor(w * ratio);
        h = Math.floor(h * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);

      canvas.toBlob((blob) => {
        if (!blob) { reject(new Error('Canvas toBlob failed.')); return; }

        if (blob.size > maxBlobBytes && quality > 0.25) {
          resolve(
            compressImage(file, {
              maxWidthPx:  Math.floor(maxW  * 0.8),
              maxHeightPx: Math.floor(maxH  * 0.8),
              quality:     Math.max(0.25, quality - 0.15)
            })
          );
        } else {
          resolve(blob);
        }
      }, 'image/jpeg', quality);
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Failed to load image for compression.'));
    };

    img.src = objUrl;
  });
}
