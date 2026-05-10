// ─────────────────────────────────────────────────────────────────────────────
// pages/unlock-page.js
// QR landing page: validates task → calls unlock RPC → redirects to task.html
// QR code format: /unlock.html?task=<task_id>
// ─────────────────────────────────────────────────────────────────────────────

import { requirePlayer } from '/js/router.js';
import { getTask }       from '/js/db/tasks.js';
import { unlockTask }    from '/js/db/unlocked-tasks.js';
import { escapeHTML }    from '/js/ui.js';

const statusEl = document.getElementById('unlock-status');

function showMessage(icon, heading, body, linkHref, linkText) {
  statusEl.innerHTML = `
    <div style="font-size:64px;margin-bottom:var(--sp-md);">${icon}</div>
    <h2>${escapeHTML(heading)}</h2>
    <p style="margin:var(--sp-sm) 0 var(--sp-lg);">${escapeHTML(body)}</p>
    ${linkHref ? `<a class="btn btn--primary" href="${linkHref}">${escapeHTML(linkText)}</a>` : ''}
  `;
}

(async function init() {
  const taskId = new URLSearchParams(location.search).get('task');
  if (!taskId) {
    showMessage('❌', 'Invalid QR Code', 'No task ID found in this link.', '/game.html', 'Back to Game');
    return;
  }

  const session = await requirePlayer();
  if (!session) return; // requirePlayer redirects to /index.html if not logged in

  const { uid } = session;

  const task = await getTask(taskId);
  if (!task) {
    showMessage('❌', 'Task Not Found', 'This task does not exist.', '/game.html', 'Back to Game');
    return;
  }
  if (!task.active) {
    showMessage('⏸', 'Task Not Active', 'This task is not active yet. Check back later!', '/game.html', 'Back to Game');
    return;
  }

  const status = await unlockTask(uid, taskId);

  if (status === 'unlocked' || status === 'already_unlocked') {
    showMessage('🔓', 'Task Unlocked!', `"${task.title}" is now available. Redirecting…`, '', '');
    setTimeout(() => window.location.replace(`/task.html?id=${encodeURIComponent(taskId)}`), 1200);
    return;
  }
  if (status === 'task_not_active') {
    showMessage('⏸', 'Task Not Active', 'This task is not active yet. Check back later!', '/game.html', 'Back to Game');
    return;
  }
  showMessage('❌', 'Task Not Found', 'This task does not exist.', '/game.html', 'Back to Game');
})().catch((err) => {
  console.error('unlock-page error:', err);
  showMessage('⚠️', 'Something Went Wrong', err.message || String(err), '/game.html', 'Back to Game');
});
