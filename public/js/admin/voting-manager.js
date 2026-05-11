// ─────────────────────────────────────────────────────────────────────────────
// admin/voting-manager.js
// Admin panel: open/close photo voting and award vote bonuses.
// ─────────────────────────────────────────────────────────────────────────────

import { getActiveSessionId, setGameState, getGameState } from '/js/db/game-state.js';
import { getPhotoSubmissions, onPhotoVotesChange }        from '/js/db/photo-votes.js';
import { sb }                                             from '/js/supabase-client.js';
import { showToast, showSpinner, hideSpinner, escapeHTML } from '/js/ui.js';

export async function renderVotingManager(container, _unsubs) {
  showSpinner();
  let sessionId, gs, submissions;
  try {
    [sessionId, gs, submissions] = await Promise.all([
      getActiveSessionId(),
      getGameState(),
      getActiveSessionId().then((sid) => getPhotoSubmissions(sid))
    ]);
  } finally {
    hideSpinner();
  }

  renderPanel(container, gs?.voting_open ?? false, submissions, sessionId);

  // Live vote-count refresh
  if (sessionId) {
    const unsub = onPhotoVotesChange(sessionId, async () => {
      const fresh = await getPhotoSubmissions(sessionId);
      renderTable(container.querySelector('#vote-table-body'), fresh, gs?.voting_open ?? false, sessionId);
    });
    _unsubs.push(unsub);
  }
}

function renderPanel(container, votingOpen, submissions, sessionId) {
  container.innerHTML = `
    <div class="admin-panel">
      <div class="admin-panel__header" style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--sp-md);">
        <h2 style="margin:0;">Photo Voting</h2>
        <div style="display:flex;gap:var(--sp-sm);">
          ${votingOpen
            ? `<button class="btn btn--danger btn--sm" id="btn-close-voting">Close Voting &amp; Award Bonuses</button>`
            : `<button class="btn btn--success btn--sm" id="btn-open-voting">Open Voting</button>`}
        </div>
      </div>

      <div id="voting-status" style="margin-bottom:var(--sp-md);padding:var(--sp-sm) var(--sp-md);border-radius:var(--radius-md);font-size:var(--font-sz-sm);
        ${votingOpen
          ? 'background:rgba(46,204,113,0.1);border:1px solid var(--clr-success);color:var(--clr-success);'
          : 'background:rgba(255,255,255,0.05);border:1px solid var(--clr-border);color:var(--clr-text-muted);'}">
        ${votingOpen
          ? '✅ Voting is open — players can vote at /vote.html'
          : '⏸ Voting is closed.'}
      </div>

      ${!sessionId
        ? `<div class="empty-state"><p>No active session. Create a session first.</p></div>`
        : submissions.length === 0
          ? `<div class="empty-state"><p>No photo submissions yet for this session.</p></div>`
          : `<table style="width:100%;border-collapse:collapse;font-size:var(--font-sz-sm);">
               <thead>
                 <tr style="border-bottom:1px solid var(--clr-border);text-align:left;">
                   <th style="padding:var(--sp-xs) var(--sp-sm);">Photo</th>
                   <th style="padding:var(--sp-xs) var(--sp-sm);">Player</th>
                   <th style="padding:var(--sp-xs) var(--sp-sm);">Task</th>
                   <th style="padding:var(--sp-xs) var(--sp-sm);text-align:right;">Votes</th>
                   <th style="padding:var(--sp-xs) var(--sp-sm);"></th>
                 </tr>
               </thead>
               <tbody id="vote-table-body">
               </tbody>
             </table>`}
    </div>
  `;

  if (submissions.length > 0 && sessionId) {
    renderTable(container.querySelector('#vote-table-body'), submissions, votingOpen, sessionId);
  }

  container.querySelector('#btn-open-voting')?.addEventListener('click', () => openVoting(container, sessionId));
  container.querySelector('#btn-close-voting')?.addEventListener('click', () => closeVoting(container, sessionId));
}

function renderTable(tbody, submissions, votingOpen, sessionId) {
  if (!tbody) return;
  tbody.innerHTML = submissions.map((s, i) => `
    <tr style="border-bottom:1px solid var(--clr-border);" data-attempt="${s.id}">
      <td style="padding:var(--sp-xs) var(--sp-sm);">
        ${s.photo_url
          ? `<img src="${escapeHTML(s.photo_url)}" style="width:48px;height:48px;object-fit:cover;border-radius:var(--radius-sm);border:1px solid var(--clr-border);" />`
          : '<span style="opacity:0.4;font-size:11px;">deleted</span>'}
      </td>
      <td style="padding:var(--sp-xs) var(--sp-sm);">
        ${!votingOpen ? escapeHTML(s.full_name) : `<span style="opacity:0.5;">Anonymous</span>`}
      </td>
      <td style="padding:var(--sp-xs) var(--sp-sm);color:var(--clr-text-muted);">${escapeHTML(s.task_id)}</td>
      <td style="padding:var(--sp-xs) var(--sp-sm);text-align:right;font-weight:700;color:var(--clr-accent);">
        ${s.vote_count}${i === 0 && s.vote_count > 0 && !votingOpen ? ' 🥇' : ''}
        ${i === 1 && s.vote_count > 0 && !votingOpen ? ' 🥈' : ''}
        ${i === 2 && s.vote_count > 0 && !votingOpen ? ' 🥉' : ''}
      </td>
      <td style="padding:var(--sp-xs) var(--sp-sm);text-align:right;">
        ${s.photo_url
          ? `<button class="btn btn--sm btn--danger btn-delete-photo"
                     data-attempt="${s.id}"
                     data-url="${escapeHTML(s.photo_url)}"
                     title="Delete photo">🗑️</button>`
          : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-delete-photo').forEach((btn) => {
    btn.addEventListener('click', () =>
      deletePhoto(btn.dataset.attempt, btn.dataset.url, tbody, votingOpen, sessionId)
    );
  });
}

async function openVoting(container, sessionId) {
  showSpinner();
  try {
    await setGameState({ voting_open: true });
    showToast('Voting is now open!', 'success');
    const submissions = await getPhotoSubmissions(sessionId);
    renderPanel(container, true, submissions, sessionId);
  } catch (err) {
    showToast('Failed to open voting: ' + (err.message || String(err)), 'error');
  } finally {
    hideSpinner();
  }
}

async function closeVoting(container, sessionId) {
  if (!sessionId) { showToast('No active session.', 'error'); return; }
  if (!confirm('Close voting and award all bonuses now? This cannot be undone.')) return;

  showSpinner();
  try {
    const { error } = await sb.rpc('award_vote_bonuses', { p_session_id: sessionId });
    if (error) throw error;
    showToast('Voting closed and bonuses awarded!', 'success');
    const submissions = await getPhotoSubmissions(sessionId);
    renderPanel(container, false, submissions, sessionId);
  } catch (err) {
    showToast('Failed to close voting: ' + (err.message || String(err)), 'error');
  } finally {
    hideSpinner();
  }
}

async function deletePhoto(attemptId, photoUrl, tbody, votingOpen, sessionId) {
  if (!confirm('Delete this photo? It will be removed from storage and the gallery.')) return;

  showSpinner();
  try {
    // Null the DB reference and remove any votes for this attempt
    const { error: rpcErr } = await sb.rpc('admin_delete_photo', { p_attempt_id: attemptId });
    if (rpcErr) throw rpcErr;

    // Delete the file from Supabase Storage
    const path = new URL(photoUrl).pathname.replace('/storage/v1/object/public/photos/', '');
    const { error: storageErr } = await sb.storage.from('photos').remove([path]);
    if (storageErr) console.warn('Storage delete failed (non-critical):', storageErr);

    showToast('Photo deleted.', 'success');

    // Re-fetch and re-render just the table body
    const fresh = await getPhotoSubmissions(sessionId);
    renderTable(tbody, fresh, votingOpen, sessionId);
  } catch (err) {
    showToast('Delete failed: ' + (err.message || String(err)), 'error');
  } finally {
    hideSpinner();
  }
}
