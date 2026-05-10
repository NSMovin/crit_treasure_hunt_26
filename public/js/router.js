// ─────────────────────────────────────────────────────────────────────────────
// router.js
// Lightweight auth guards and page redirects.
// ─────────────────────────────────────────────────────────────────────────────

import { getAuthState } from '/js/auth.js';

/**
 * Ensures the user is authenticated and has a completed profile.
 * Redirects to /index.html if not.
 * Returns { uid, profile } on success.
 */
export async function requirePlayer() {
  const state = await getAuthState();
  if (!state || !state.profile) {
    window.location.replace('/index.html');
    return null;
  }
  return state;
}

/**
 * Ensures the user has admin session (localStorage flag).
 * Redirects to /admin.html for passcode re-entry if missing.
 * Returns { uid, profile } on success.
 */
export async function requireAdmin() {
  const state = await getAuthState();
  if (!state || !state.profile) {
    window.location.replace('/index.html');
    return null;
  }
  if (localStorage.getItem('isAdmin') !== 'true') {
    window.location.replace('/admin.html');
    return null;
  }
  return state;
}

/**
 * Used on index.html: if already logged in with a profile, skip to game.
 */
export async function redirectIfLoggedIn() {
  const state = await getAuthState();
  if (state && state.profile) {
    window.location.replace('/game.html');
    return true;
  }
  return false;
}
