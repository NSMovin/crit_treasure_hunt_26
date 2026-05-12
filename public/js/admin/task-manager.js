// ─────────────────────────────────────────────────────────────────────────────
// admin/task-manager.js
// Admin panel: create, edit, delete, and toggle tasks.
// ─────────────────────────────────────────────────────────────────────────────

import { getAllTasks, createTask, updateTask, deleteTask, setTaskActive } from '/js/db/tasks.js';
import { showToast, showSpinner, hideSpinner, escapeHTML, showModal, hideModal } from '/js/ui.js';

export async function renderTaskManager(container, _unsubs) {
  showSpinner();
  let tasks = [];
  try {
    tasks = await getAllTasks();
  } finally {
    hideSpinner();
  }
  renderList(container, tasks);
}

// ── Task list ─────────────────────────────────────────────────────────────────

function renderList(container, tasks) {
  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel__header">
        <h2>Tasks (${tasks.length})</h2>
        <button class="btn btn--primary btn--sm" id="btn-add-task">+ Add Task</button>
      </div>
      <div id="task-list-admin">
        ${tasks.length ? tasks.map(renderTaskRow).join('') : '<p>No tasks yet.</p>'}
      </div>
    </div>
  `;

  container.querySelector('#btn-add-task').addEventListener('click', () => openTaskModal(null, container));

  container.querySelectorAll('.task-row').forEach((row) => {
    const taskId = row.dataset.taskId;
    const task   = tasks.find((t) => t.task_id === taskId);
    if (!task) return;

    row.querySelector('.btn-edit')?.addEventListener('click',   () => openTaskModal(task, container));
    row.querySelector('.btn-toggle')?.addEventListener('click', () => toggleTask(task, container));
    row.querySelector('.btn-delete')?.addEventListener('click', () => confirmDeleteTask(task, container));
  });
}

function renderTaskRow(task) {
  return `
    <div class="task-row" data-task-id="${escapeHTML(task.task_id)}">
      <div class="task-row__info">
        <strong>${escapeHTML(task.title)}</strong>
        <span class="badge badge--${task.type}">${escapeHTML(task.type)}</span>
        <span class="badge">${task.points} pts</span>
        <span class="badge ${task.active ? 'badge--success' : 'badge--muted'}">
          ${task.active ? 'Active' : 'Inactive'}
        </span>
        ${task.is_public ? '<span class="badge" style="background:rgba(52,152,219,0.2);color:#3498db;">Public</span>' : ''}
      </div>
      <div class="task-row__actions">
        <button class="btn btn--sm btn--ghost btn-edit">Edit</button>
        <button class="btn btn--sm ${task.active ? 'btn--warning' : 'btn--success'} btn-toggle">
          ${task.active ? 'Deactivate' : 'Activate'}
        </button>
        <button class="btn btn--sm btn--danger btn-delete">Delete</button>
      </div>
    </div>
  `;
}

// ── Task modal (create / edit) ────────────────────────────────────────────────

const TASK_TYPES = ['quiz', 'memory_match', 'fast_tap', 'puzzle', 'photo', 'arrow_hunt', 'tribe_finder'];

function openTaskModal(task, container) {
  const isEdit = !!task;
  const t      = task || {
    task_id: '', title: '', description: '', type: 'quiz',
    points: 100, time_limit_sec: 60, hint: '', active: false,
    display_order: 99, config: {}, is_public: false
  };

  showModal(`
    <div class="modal-form">
      <h3>${isEdit ? 'Edit Task' : 'New Task'}</h3>

      <div class="form-group">
        <label class="form-label">Task ID (slug, no spaces)*</label>
        <input class="input" id="m-task-id" value="${escapeHTML(t.task_id)}"
               placeholder="e.g. task-01-quiz" ${isEdit ? 'readonly' : ''} />
      </div>
      <div class="form-group">
        <label class="form-label">Title *</label>
        <input class="input" id="m-title" value="${escapeHTML(t.title)}" />
      </div>
      <div class="form-group">
        <label class="form-label">Description / Question</label>
        <textarea class="input input--textarea" id="m-desc" rows="3">${escapeHTML(t.description)}</textarea>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Type *</label>
          <select class="input" id="m-type">
            ${TASK_TYPES.map((tp) =>
              `<option value="${tp}" ${t.type === tp ? 'selected' : ''}>${tp}</option>`
            ).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Base Points</label>
          <input class="input" type="number" id="m-points" value="${t.points}" min="1" />
        </div>
        <div class="form-group">
          <label class="form-label">Time Limit (sec, 0=none)</label>
          <input class="input" type="number" id="m-time" value="${t.time_limit_sec || 0}" min="0" />
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">Display Order</label>
        <input class="input" type="number" id="m-order" value="${t.display_order || 99}" min="1" />
      </div>
      <div class="form-group">
        <label class="checkbox-label">
          <input type="checkbox" id="m-is-public" ${t.is_public ? 'checked' : ''} />
          Public task (visible to all players without scanning a QR code)
        </label>
      </div>
      <div class="form-group">
        <label class="form-label">Hint (shown when released)</label>
        <input class="input" id="m-hint" value="${escapeHTML(t.hint || '')}" />
      </div>
      <div class="form-group">
        <label class="form-label">Config JSON (type-specific)</label>
        <textarea class="input input--textarea input--mono" id="m-config" rows="5"
          placeholder='e.g. {"question":"...","options":["A","B","C","D"],"correct_index":0}'
        >${JSON.stringify(t.config || {}, null, 2)}</textarea>
      </div>

      <div class="modal-actions">
        <button class="btn btn--ghost" id="m-cancel">Cancel</button>
        <button class="btn btn--primary" id="m-save">${isEdit ? 'Save Changes' : 'Create Task'}</button>
      </div>
      <p class="modal-error" id="m-error"></p>
    </div>
  `);

  document.getElementById('m-cancel').addEventListener('click', hideModal);

  document.getElementById('m-save').addEventListener('click', async () => {
    const taskId  = document.getElementById('m-task-id').value.trim();
    const title   = document.getElementById('m-title').value.trim();
    const desc    = document.getElementById('m-desc').value.trim();
    const type    = document.getElementById('m-type').value;
    const points  = parseInt(document.getElementById('m-points').value, 10) || 100;
    const timeSec = parseInt(document.getElementById('m-time').value, 10) || 0;
    const order   = parseInt(document.getElementById('m-order').value, 10) || 99;
    const hint     = document.getElementById('m-hint').value.trim();
    const isPublic = document.getElementById('m-is-public').checked;
    const errorEl  = document.getElementById('m-error');

    let config = {};
    try {
      config = JSON.parse(document.getElementById('m-config').value || '{}');
    } catch {
      errorEl.textContent = 'Config JSON is invalid.';
      return;
    }

    if (!taskId || !title) { errorEl.textContent = 'Task ID and Title are required.'; return; }
    if (!/^[a-z0-9-_]+$/.test(taskId)) {
      errorEl.textContent = 'Task ID must contain only lowercase letters, numbers, hyphens, underscores.';
      return;
    }

    showSpinner();
    try {
      const data = {
        task_id:        taskId,
        title,
        description:    desc,
        type,
        points,
        time_limit_sec: timeSec || null,
        display_order:  order,
        hint,
        hint_released:  t.hint_released || false,
        active:         isEdit ? t.active : false,
        config,
        is_public:      isPublic
      };

      if (isEdit) {
        const { task_id: _, ...updates } = data;
        await updateTask(taskId, updates);
        showToast('Task updated!', 'success');
      } else {
        await createTask(data);
        showToast('Task created!', 'success');
      }

      hideModal();
      const tasks = await getAllTasks();
      renderList(container, tasks);
    } catch (err) {
      errorEl.textContent = 'Save failed: ' + err.message;
    } finally {
      hideSpinner();
    }
  });
}

// ── Toggle active ─────────────────────────────────────────────────────────────

async function toggleTask(task, container) {
  showSpinner();
  try {
    await setTaskActive(task.task_id, !task.active);
    const tasks = await getAllTasks();
    hideSpinner();
    renderList(container, tasks);
    showToast(`Task ${!task.active ? 'activated' : 'deactivated'}.`, 'success');
  } catch {
    hideSpinner();
    showToast('Failed to update task.', 'error');
  }
}

// ── Delete ────────────────────────────────────────────────────────────────────

function confirmDeleteTask(task, container) {
  showModal(`
    <div class="modal-confirm">
      <h3>Delete Task?</h3>
      <p>Delete "<strong>${escapeHTML(task.title)}</strong>"? This cannot be undone.</p>
      <div class="modal-actions">
        <button class="btn btn--ghost" id="m-no">Cancel</button>
        <button class="btn btn--danger" id="m-yes">Delete</button>
      </div>
    </div>
  `);

  document.getElementById('m-no').addEventListener('click', hideModal);
  document.getElementById('m-yes').addEventListener('click', async () => {
    showSpinner();
    try {
      await deleteTask(task.task_id);
      hideModal();
      const tasks = await getAllTasks();
      hideSpinner();
      renderList(container, tasks);
      showToast('Task deleted.', 'info');
    } catch {
      hideSpinner();
      showToast('Delete failed.', 'error');
    }
  });
}
