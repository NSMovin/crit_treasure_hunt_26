// ─────────────────────────────────────────────────────────────────────────────
// auth.js
// Supabase Auth: anonymous sign-in + user profile management.
// ─────────────────────────────────────────────────────────────────────────────

import { sb } from '/js/supabase-client.js';

let _cachedProfile = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns { uid, profile } if a session exists and the user has a profile.
 * uid is the Supabase auth UUID (also users.id in the database).
 * Returns null if no session at all.
 */
export async function getAuthState() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return null;

  const uid = session.user.id;

  if (_cachedProfile) {
    return { uid, profile: _cachedProfile };
  }

  const { data: profile } = await sb
    .from('users')
    .select('*')
    .eq('id', uid)
    .maybeSingle();

  _cachedProfile = profile || null;
  return { uid, profile: _cachedProfile };
}

/**
 * Signs in anonymously. Returns the Supabase User object.
 * Supabase persists the session in localStorage — subsequent calls
 * on the same device return the same session via getSession().
 */
export async function signInAnonymously() {
  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return data.user;
}

/**
 * Ensures a valid auth session exists without creating a user profile.
 * Used by the admin page which doesn't need a player profile.
 * Returns the auth user id.
 */
export async function ensureSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) return session.user.id;

  const { data, error } = await sb.auth.signInAnonymously();
  if (error) throw error;
  return data.user.id;
}

/**
 * Creates the users table row for a new player.
 * Throws if student_id is already taken (Postgres unique constraint).
 */
export async function createUserProfile({ uid, fullName, studentId, teamName }) {
  const profile = {
    id:              uid,
    full_name:       fullName,
    student_id:      studentId,
    team_name:       teamName || '',
    score:           0,
    tasks_completed: []
  };

  const { data, error } = await sb.from('users').insert(profile).select().single();
  if (error) throw error;

  _cachedProfile = data;
  return data;
}

/**
 * Updates last_active timestamp. Called on every page load.
 */
export async function touchLastActive(uid) {
  try {
    await sb.from('users')
      .update({ last_active: new Date().toISOString() })
      .eq('id', uid);
  } catch {
    // Non-critical
  }
}

export function getCachedProfile() {
  return _cachedProfile;
}

export function clearProfileCache() {
  _cachedProfile = null;
}
