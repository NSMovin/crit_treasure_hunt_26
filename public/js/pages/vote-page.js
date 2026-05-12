// ─────────────────────────────────────────────────────────────────────────────
// pages/vote-page.js
// Community photo voting gallery.
// ─────────────────────────────────────────────────────────────────────────────

import { requirePlayer }                        from '/js/router.js';
import { getActiveSessionId, onGameStateChange } from '/js/db/game-state.js';
import { getPhotoSubmissions, getMyVote,
         castVote, onPhotoVotesChange }          from '/js/db/photo-votes.js';
import { checkGameBan }                          from '/js/db/moderation.js';
import { showToast, escapeHTML }                 from '/js/ui.js';

let _uid        = null;
let _sessionId  = null;
let _myVote     = null;
let _votingOpen = false;
const unsubs    = [];

(async function init() {
  const session = await requirePlayer();
  if (!session) return;

  _uid       = session.uid;
  _sessionId = await getActiveSessionId();

  const [gs, submissions, myVote] = await Promise.all([
    import('/js/db/game-state.js').then((m) => m.getGameState()),
    getPhotoSubmissions(_sessionId),
    _sessionId ? getMyVote(_uid, _sessionId) : Promise.resolve(null)
  ]);

  _votingOpen = gs?.voting_open ?? false;
  _myVote     = myVote;

  renderStatusBar(_votingOpen);
  renderGallery(submissions);

  // Live: re-render gallery when someone votes
  if (_sessionId) {
    unsubs.push(
      onPhotoVotesChange(_sessionId, async () => {
        const fresh = await getPhotoSubmissions(_sessionId);
        _myVote     = await getMyVote(_uid, _sessionId);
        renderGallery(fresh);
      })
    );
  }

  // Live: update status bar if admin opens/closes voting
  unsubs.push(
    onGameStateChange(async (gs) => {
      _votingOpen = gs?.voting_open ?? false;
      renderStatusBar(_votingOpen);
      // Re-render to show/hide vote buttons and author names
      const fresh = await getPhotoSubmissions(_sessionId);
      renderGallery(fresh);
    })
  );

  window.addEventListener('beforeunload', () => unsubs.forEach((u) => u()));
})().catch((err) => {
  console.error('vote-page init error:', err);
  document.getElementById('gallery-grid').innerHTML =
    `<div class="vote-empty" style="color:var(--clr-error)">
       Error loading gallery: ${escapeHTML(err.message || String(err))}
     </div>`;
});

// ── Status bar ────────────────────────────────────────────────────────────────

function renderStatusBar(votingOpen) {
  const el = document.getElementById('vote-status-bar');
  if (!el) return;
  el.className = `vote-status ${votingOpen ? 'vote-status--open' : 'vote-status--closed'}`;
  el.textContent = votingOpen
    ? '✅ Voting is open — tap a photo to cast your vote!'
    : '📷 Gallery — voting is currently closed.';
}

// ── Gallery ───────────────────────────────────────────────────────────────────

function renderGallery(submissions) {
  const container = document.getElementById('gallery-grid');

  if (!submissions.length) {
    container.innerHTML = `<div class="vote-empty">No photo submissions yet.</div>`;
    return;
  }

  container.innerHTML = `<div class="photo-grid">${submissions.map(cardHTML).join('')}</div>`;

  // Attach vote handlers
  container.querySelectorAll('.photo-card__vote-btn[data-attempt]').forEach((btn) => {
    btn.addEventListener('click', () => handleVote(btn.dataset.attempt));
  });
}

function cardHTML(s) {
  const isOwn    = s.user_id === _uid;
  const hasVoted = _myVote !== null;
  const votedThis = _myVote === s.id;

  const classes = [
    'photo-card',
    votedThis  ? 'photo-card--voted' : '',
    isOwn      ? 'photo-card--own'   : ''
  ].filter(Boolean).join(' ');

  const imgEl = s.photo_url
    ? `<img class="photo-card__img" src="${escapeHTML(s.photo_url)}" alt="Photo submission" loading="lazy" />`
    : `<div class="photo-card__img-placeholder">📸</div>`;

  // Show author name when voting closed; hide (anonymous) while open
  const authorEl = `<p class="photo-card__author">${
    !_votingOpen ? escapeHTML(s.full_name) : '<span style="opacity:0.4;">Anonymous</span>'
  }</p>`;

  const countEl = !_votingOpen
    ? `<p class="photo-card__count">${s.vote_count} vote${s.vote_count !== 1 ? 's' : ''}</p>`
    : '';

  let voteBtn = '';
  if (_votingOpen) {
    if (isOwn) {
      voteBtn = `<button class="btn btn--secondary btn--sm photo-card__vote-btn" disabled>Your photo</button>`;
    } else if (votedThis) {
      voteBtn = `<button class="btn btn--primary btn--sm photo-card__vote-btn" disabled>Voted ✓</button>`;
    } else if (hasVoted) {
      voteBtn = `<button class="btn btn--ghost btn--sm photo-card__vote-btn" disabled>Already voted</button>`;
    } else {
      voteBtn = `<button class="btn btn--primary btn--sm photo-card__vote-btn" data-attempt="${s.id}">👍 Vote</button>`;
    }
  }

  return `
    <div class="${classes}" data-attempt-id="${s.id}">
      ${imgEl}
      ${authorEl}
      ${countEl}
      ${voteBtn}
    </div>`;
}

// ── Vote handler ──────────────────────────────────────────────────────────────

async function handleVote(attemptId) {
  if (!_sessionId) { showToast('No active session.', 'error'); return; }
  if (_myVote !== null) { showToast('You have already voted.', 'warning'); return; }

  // Game ban check — server RLS will also block the insert
  const ban = await checkGameBan(_uid);
  if (ban.is_banned) {
    showToast('Your account is restricted from gameplay actions for this event.', 'warning', 4000);
    return;
  }

  const { error } = await castVote(_uid, attemptId, _sessionId);
  if (error) {
    if (error.code === '23505') {
      showToast('You have already voted this session.', 'warning');
    } else {
      showToast('Vote failed: ' + (error.message || 'Unknown error'), 'error');
    }
    return;
  }

  _myVote = attemptId;
  showToast('Vote cast!', 'success');

  const fresh = await getPhotoSubmissions(_sessionId);
  renderGallery(fresh);
}
