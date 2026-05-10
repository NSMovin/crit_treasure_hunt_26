// ─────────────────────────────────────────────────────────────────────────────
// image-compress.js
// Client-side image compression using Canvas API.
// Converts any image file to a compressed base64 JPEG string
// safe to store inside a Firestore document.
// ─────────────────────────────────────────────────────────────────────────────

import { APP_SETTINGS } from '/js/app-settings.js';

const { maxWidthPx, maxHeightPx, jpegQuality, maxBase64Bytes } = APP_SETTINGS.photo;

/**
 * Compresses an image File to a base64 JPEG data URL.
 * Recursively reduces quality if the result is still too large.
 *
 * @param {File} file        - The image file from <input type="file">
 * @param {object} [opts]    - Override defaults
 * @returns {Promise<string>} - Resolves with a base64 data URL
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

      const dataUrl = canvas.toDataURL('image/jpeg', quality);

      // If still too large, try again with reduced quality
      if (dataUrl.length > maxBase64Bytes && quality > 0.25) {
        resolve(
          compressImage(file, {
            maxWidthPx:  Math.floor(maxW  * 0.8),
            maxHeightPx: Math.floor(maxH  * 0.8),
            quality:     Math.max(0.25, quality - 0.15)
          })
        );
      } else {
        resolve(dataUrl);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(objUrl);
      reject(new Error('Failed to load image for compression.'));
    };

    img.src = objUrl;
  });
}

/**
 * Returns approximate file size in KB from a base64 string.
 */
export function base64SizeKB(dataUrl) {
  return Math.round(dataUrl.length * 0.75 / 1024);
}
