// ─────────────────────────────────────────────────────────────────────────────
// supabase-client.js
// Single source of truth for Supabase initialization.
// All other modules import { sb } from here.
//
// SETUP: Replace SUPABASE_URL and SUPABASE_ANON_KEY with your project values.
// Find them in: Supabase Dashboard → Project Settings → API
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = 'https://ijwssdalkpxklyvchcsw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xTprfgd2a9JWqKJa3x7FtQ_DI2Nsj0C';

// window.supabase is set by the CDN <script> tag loaded before this ES module.
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true
  }
});
