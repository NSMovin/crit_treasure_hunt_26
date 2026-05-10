// ─────────────────────────────────────────────────────────────────────────────
// ui.js
// Shared DOM helpers: toast notifications, modal, spinner, and misc utilities.
// ─────────────────────────────────────────────────────────────────────────────

// ── Toast ─────────────────────────────────────────────────────────────────────

let _toastTimer = null;

export function showToast(message, type = 'info', durationMs = 3000) {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.setAttribute('role', 'alert');
    document.body.appendChild(el);
  }

  el.textContent = message;
  el.className   = `toast toast--${type} toast--visible`;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove('toast--visible');
  }, durationMs);
}

// ── Spinner ───────────────────────────────────────────────────────────────────

export function showSpinner() {
  let el = document.getElementById('spinner-overlay');
  if (!el) {
    el = document.createElement('div');
    el.id = 'spinner-overlay';
    el.innerHTML = '<div class="spinner"></div>';
    document.body.appendChild(el);
  }
  el.classList.add('spinner-overlay--visible');
}

export function hideSpinner() {
  const el = document.getElementById('spinner-overlay');
  if (el) el.classList.remove('spinner-overlay--visible');
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export function showModal(html, closeable = true) {
  let overlay = document.getElementById('modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = 'modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `<div class="modal-box" id="modal-box"></div>`;
    document.body.appendChild(overlay);
    if (closeable) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideModal();
      });
    }
  }
  document.getElementById('modal-box').innerHTML = html;
  overlay.classList.add('modal-overlay--visible');
}

export function hideModal() {
  const el = document.getElementById('modal-overlay');
  if (el) el.classList.remove('modal-overlay--visible');
}

// ── DOM Helpers ───────────────────────────────────────────────────────────────

export function setHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

export function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

export function escapeHTML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Formats an ISO timestamp string or Date into a locale time string.
 */
export function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function formatCountdown(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export function rankMedal(rank) {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}
