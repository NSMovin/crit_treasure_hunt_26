-- ─────────────────────────────────────────────────────────────────────────────
-- Treasure Hunt Live — Supabase PostgreSQL Schema
-- Run this entire file in Supabase SQL Editor once after creating your project.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tables ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              UUID PRIMARY KEY,          -- equals auth.uid()
  full_name       TEXT NOT NULL,
  student_id      TEXT UNIQUE NOT NULL,
  team_name       TEXT DEFAULT '',
  score           INTEGER DEFAULT 0,
  tasks_completed TEXT[] DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  last_active     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  task_id         TEXT PRIMARY KEY,          -- human-readable slug, e.g. "task-01-quiz"
  title           TEXT NOT NULL,
  description     TEXT DEFAULT '',
  type            TEXT NOT NULL CHECK (type IN ('quiz','memory_match','fast_tap','puzzle','photo')),
  points          INTEGER DEFAULT 100,
  time_limit_sec  INTEGER,                   -- NULL = no timer
  hint            TEXT DEFAULT '',
  hint_released   BOOLEAN DEFAULT FALSE,
  active          BOOLEAN DEFAULT FALSE,
  display_order   INTEGER DEFAULT 99,
  config          JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS attempts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  task_id         TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  result          TEXT NOT NULL CHECK (result IN ('correct','wrong')),
  score_delta     INTEGER DEFAULT 0,
  time_taken_sec  INTEGER DEFAULT 0,
  is_first_solver BOOLEAN DEFAULT FALSE,
  attempts_count  INTEGER DEFAULT 1,
  photo_url       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message   TEXT NOT NULL,
  type      TEXT DEFAULT 'info',
  pinned    BOOLEAN DEFAULT FALSE,
  sent_by   TEXT DEFAULT 'Admin',
  sent_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Single-row game state (always id=1)
CREATE TABLE IF NOT EXISTS game_state (
  id            INTEGER PRIMARY KEY DEFAULT 1,
  game_active   BOOLEAN DEFAULT FALSE,
  game_name     TEXT DEFAULT 'Treasure Hunt Live',
  valid_teams   TEXT[] DEFAULT '{}',
  first_solvers JSONB DEFAULT '{}',
  started_at    TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ
);

-- Seed the single game_state row
INSERT INTO game_state (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_users_score        ON users (score DESC);
CREATE INDEX IF NOT EXISTS idx_users_last_active  ON users (last_active DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_active_order ON tasks (active, display_order ASC);
CREATE INDEX IF NOT EXISTS idx_attempts_user_task ON attempts (user_id, task_id);

-- ── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE users         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE attempts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_state    ENABLE ROW LEVEL SECURITY;

-- users: public read (leaderboard visible without login), own-row write
CREATE POLICY "users_read_all"   ON users FOR SELECT USING (true);
CREATE POLICY "users_insert_own" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE TO authenticated USING (auth.uid() = id);

-- tasks: public read, any authenticated user can write (admin page is passcode-gated)
CREATE POLICY "tasks_read"  ON tasks FOR SELECT USING (true);
CREATE POLICY "tasks_write" ON tasks FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- attempts: authenticated read, own-row insert
CREATE POLICY "attempts_read"   ON attempts FOR SELECT TO authenticated USING (true);
CREATE POLICY "attempts_insert" ON attempts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- announcements: public read, any authenticated can write
CREATE POLICY "announcements_read"  ON announcements FOR SELECT USING (true);
CREATE POLICY "announcements_write" ON announcements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- game_state: public read, any authenticated can write
CREATE POLICY "game_state_read"  ON game_state FOR SELECT USING (true);
CREATE POLICY "game_state_write" ON game_state FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── Security-definer Functions ────────────────────────────────────────────────

-- Atomically add points + mark task complete. Bypasses RLS so the update succeeds
-- even though the normal UPDATE policy checks auth.uid() = id.
CREATE OR REPLACE FUNCTION add_score(
  p_user_id UUID,
  p_delta   INTEGER,
  p_task_id TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_score INTEGER;
BEGIN
  -- Guard: caller must be the same user
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE users
  SET score           = score + p_delta,
      tasks_completed = array_append(tasks_completed, p_task_id),
      last_active     = NOW()
  WHERE id = p_user_id
  RETURNING score INTO v_new_score;

  RETURN v_new_score;
END;
$$;

-- Atomically claim the first-solver slot for a task.
-- Returns TRUE if this call claimed it, FALSE if already taken.
CREATE OR REPLACE FUNCTION claim_first_solver(
  p_task_id TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_solvers JSONB;
BEGIN
  SELECT first_solvers INTO v_solvers
  FROM game_state WHERE id = 1 FOR UPDATE;

  IF v_solvers IS NULL THEN v_solvers := '{}'::JSONB; END IF;

  IF v_solvers ? p_task_id THEN
    RETURN FALSE;
  END IF;

  UPDATE game_state
  SET first_solvers = first_solvers || jsonb_build_object(p_task_id, p_user_id::TEXT)
  WHERE id = 1;

  RETURN TRUE;
END;
$$;

-- ── Realtime ──────────────────────────────────────────────────────────────────
-- Enable Supabase Realtime on these tables.
-- (Also enable in Supabase Dashboard → Database → Replication if needed.)

ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;

-- ── Storage ───────────────────────────────────────────────────────────────────
-- Run these after creating the storage bucket named "photos" in the dashboard.
-- Dashboard → Storage → New bucket → name: "photos", Public: ON

-- INSERT INTO storage.buckets (id, name, public) VALUES ('photos', 'photos', true)
--   ON CONFLICT (id) DO NOTHING;

-- CREATE POLICY "photos_upload" ON storage.objects
--   FOR INSERT TO authenticated WITH CHECK (bucket_id = 'photos');

-- CREATE POLICY "photos_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'photos');
