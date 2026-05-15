// ─────────────────────────────────────────────────────────────────────────────
// supabase-client.js
// Single source of truth for Supabase initialization.
// All other modules import { sb } from here.
//
// Values come from environment variables set in .env (local dev) or in the
// Vercel project dashboard (production). See .env.example for setup.
// ─────────────────────────────────────────────────────────────────────────────

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// window.supabase is set by the CDN <script> tag loaded before this ES module.
export const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:   true,
    autoRefreshToken: true
  }
});
