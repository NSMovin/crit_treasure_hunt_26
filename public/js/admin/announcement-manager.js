// ─────────────────────────────────────────────────────────────────────────────
// admin/announcement-manager.js
// Admin panel: send, pin, and delete announcements.
// ─────────────────────────────────────────────────────────────────────────────

import { onAnnouncementsChange, sendAnnouncement,
         deleteAnnouncement, pinAnnouncement } from '/js/db/announcements.js';
import { getActiveSessionId }                  from '/js/db/game-state.js';
import { showToast, escapeHTML, formatTime }   from '/js/ui.js';

export async function renderAnnouncementManager(container, unsubs) {
  container.innerHTML = `
    <div class="admin-panel">
      <h2>Send Announcement</h2>
      <div class="form-group">
        <textarea class="input input--textarea" id="ann-msg" rows="3"
                  placeholder="Type your announcement…" maxlength="500"></textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type</label>
          <select class="input" id="ann-type">
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="hint_release">Hint Release</option>
            <option value="task_activate">Task Activated</option>
          </select>
        </div>
        <div class="form-group" style="align-self:flex-end">
          <label class="checkbox-label">
            <input type="checkbox" id="ann-pin" /> Pin to top
          </label>
        </div>
      </div>
      <button class="btn btn--primary" id="btn-send-ann">Send</button>
      <hr class="divider" />
      <h2>Recent Announcements</h2>
      <div id="ann-list"></div>
    </div>
  `;

  // ── Send ──────────────────────────────────────────────────────────────────
  document.getElementById('btn-send-ann').addEventListener('click', async () => {
    const message = document.getElementById('ann-msg').value.trim();
    const type    = document.getElementById('ann-type').value;
    const pinned  = document.getElementById('ann-pin').checked;

    if (!message) { showToast('Message cannot be empty.', 'warning'); return; }

    try {
      const sessionId = await getActiveSessionId();
      await sendAnnouncement({ message, type, pinned, sessionId });
      document.getElementById('ann-msg').value = '';
      document.getElementById('ann-pin').checked = false;
      showToast('Announcement sent!', 'success');
    } catch {
      showToast('Failed to send announcement.', 'error');
    }
  });

  // ── Live list ─────────────────────────────────────────────────────────────
  const unsub = onAnnouncementsChange((list) => renderList(list));
  unsubs.push(unsub);
}

function renderList(announcements) {
  const listEl = document.getElementById('ann-list');
  if (!listEl) return;

  if (!announcements.length) {
    listEl.innerHTML = '<p>No announcements yet.</p>';
    return;
  }

  listEl.innerHTML = announcements.map((ann) => `
    <div class="ann-row announcement--${escapeHTML(ann.type || 'info')}">
      <div class="ann-row__body">
        ${ann.pinned ? '<span>📌 </span>' : ''}
        <span>${escapeHTML(ann.message)}</span>
        <small class="ann-row__meta">${escapeHTML(ann.type)} · ${formatTime(ann.sent_at)}</small>
      </div>
      <div class="ann-row__actions">
        <button class="btn btn--sm btn--ghost btn-pin" data-id="${ann.id}" data-pinned="${ann.pinned}">
          ${ann.pinned ? 'Unpin' : 'Pin'}
        </button>
        <button class="btn btn--sm btn--danger btn-del" data-id="${ann.id}">Delete</button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.btn-pin').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const isPinned = btn.dataset.pinned === 'true';
      try {
        await pinAnnouncement(btn.dataset.id, !isPinned);
      } catch { showToast('Failed to update pin.', 'error'); }
    });
  });

  listEl.querySelectorAll('.btn-del').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        await deleteAnnouncement(btn.dataset.id);
        showToast('Deleted.', 'info');
      } catch { showToast('Delete failed.', 'error'); }
    });
  });
}
