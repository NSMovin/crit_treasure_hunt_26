// ─────────────────────────────────────────────────────────────────────────────
// admin/hint-manager.js
// Admin panel: release / update hints per task.
// ─────────────────────────────────────────────────────────────────────────────

import { getAllTasks, updateTaskHint } from '/js/db/tasks.js';
import { sendAnnouncement }            from '/js/db/announcements.js';
import { showToast, showSpinner, hideSpinner, escapeHTML } from '/js/ui.js';

export async function renderHintManager(container, _unsubs) {
  showSpinner();
  const tasks = await getAllTasks();
  hideSpinner();

  container.innerHTML = `
    <div class="admin-panel">
      <h2>Hint Manager</h2>
      <p class="admin-hint">
        Releasing a hint makes it visible on the player's task page.
        You can also auto-send an announcement when releasing.
      </p>
      <div id="hint-list">
        ${tasks.map(renderHintRow).join('') || '<p>No tasks.</p>'}
      </div>
    </div>
  `;

  container.querySelectorAll('.hint-row').forEach((row) => {
    const taskId = row.dataset.taskId;
    const task   = tasks.find((t) => t.task_id === taskId);
    if (!task) return;

    row.querySelector('.btn-save-hint')?.addEventListener('click', () => saveHint(row, task, container));
  });
}

function renderHintRow(task) {
  return `
    <div class="hint-row" data-task-id="${escapeHTML(task.task_id)}">
      <div class="hint-row__header">
        <strong>${escapeHTML(task.title)}</strong>
        <span class="badge ${task.hint_released ? 'badge--success' : 'badge--muted'}">
          ${task.hint_released ? '🟢 Released' : '🔒 Hidden'}
        </span>
      </div>
      <div class="form-row">
        <input class="input hint-row__input" type="text"
               value="${escapeHTML(task.hint || '')}"
               placeholder="Enter hint text…" />
        <label class="checkbox-label">
          <input type="checkbox" class="hint-row__release"
                 ${task.hint_released ? 'checked' : ''} />
          Released
        </label>
        <label class="checkbox-label">
          <input type="checkbox" class="hint-row__announce" />
          Send announcement
        </label>
        <button class="btn btn--primary btn--sm btn-save-hint">Save</button>
      </div>
    </div>
  `;
}

async function saveHint(row, task, container) {
  const hintText    = row.querySelector('.hint-row__input').value.trim();
  const released    = row.querySelector('.hint-row__release').checked;
  const doAnnounce  = row.querySelector('.hint-row__announce').checked;

  showSpinner();
  try {
    await updateTaskHint(task.task_id, hintText, released);

    if (doAnnounce && hintText) {
      await sendAnnouncement({
        message: `💡 Hint for "${task.title}": ${hintText}`,
        type:    'hint_release',
        pinned:  true
      });
    }

    showToast(`Hint ${released ? 'released' : 'saved (hidden)'}.`, 'success');

    // Re-render to reflect new state
    const tasks = await getAllTasks();
    hideSpinner();
    container.innerHTML = '';
    await renderHintManager(container, []);
  } catch {
    hideSpinner();
    showToast('Failed to save hint.', 'error');
  }
}
