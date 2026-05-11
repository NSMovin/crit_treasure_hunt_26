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

-- ── MIGRATION v2: QR-based task unlock system ─────────────────────────────────
-- Already applied to live DB. Run this block if setting up a fresh project.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS unlocked_tasks (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id)      ON DELETE CASCADE,
  task_id     TEXT NOT NULL REFERENCES tasks(task_id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, task_id)
);

CREATE INDEX IF NOT EXISTS idx_unlocked_tasks_user_id     ON unlocked_tasks (user_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_tasks_task_id     ON unlocked_tasks (task_id);
CREATE INDEX IF NOT EXISTS idx_unlocked_tasks_unlocked_at ON unlocked_tasks (unlocked_at DESC);

ALTER TABLE unlocked_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unlocked_tasks_read_own"   ON unlocked_tasks FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "unlocked_tasks_insert_own" ON unlocked_tasks FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

ALTER PUBLICATION supabase_realtime ADD TABLE unlocked_tasks;

CREATE OR REPLACE FUNCTION unlock_task(p_user_id UUID, p_task_id TEXT)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_active BOOLEAN;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT active INTO v_active FROM tasks WHERE task_id = p_task_id;
  IF NOT FOUND   THEN RETURN 'task_not_found'; END IF;
  IF NOT v_active THEN RETURN 'task_not_active'; END IF;
  BEGIN
    INSERT INTO unlocked_tasks (user_id, task_id) VALUES (p_user_id, p_task_id);
    RETURN 'unlocked';
  EXCEPTION WHEN unique_violation THEN RETURN 'already_unlocked';
  END;
END;
$$;

-- ── MIGRATION v3: Session-based game system ────────────────────────────────────
-- Already applied to live DB. Run this block if setting up a fresh project.

-- 1. game_sessions table
CREATE TABLE IF NOT EXISTS game_sessions (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name          TEXT NOT NULL,
  is_active     BOOLEAN DEFAULT FALSE,
  first_solvers JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  ended_at      TIMESTAMPTZ
);

-- 2. session_scores table (per-user, per-session score tracking)
CREATE TABLE IF NOT EXISTS session_scores (
  id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id      BIGINT NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
  score           INTEGER DEFAULT 0,
  tasks_completed TEXT[] DEFAULT '{}',
  UNIQUE (user_id, session_id)
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_game_sessions_active  ON game_sessions (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_session_scores_session ON session_scores (session_id);
CREATE INDEX IF NOT EXISTS idx_session_scores_score   ON session_scores (session_id, score DESC);

-- 4. Add active_session_id pointer to game_state singleton
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS active_session_id BIGINT REFERENCES game_sessions(id);

-- 5. Add session_id (nullable) to attempts, unlocked_tasks, announcements
ALTER TABLE attempts      ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES game_sessions(id);
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES game_sessions(id);

-- For unlocked_tasks: replace UNIQUE(user_id, task_id) with UNIQUE(user_id, session_id, task_id)
ALTER TABLE unlocked_tasks DROP CONSTRAINT IF EXISTS unlocked_tasks_user_id_task_id_key;
ALTER TABLE unlocked_tasks ADD COLUMN IF NOT EXISTS session_id BIGINT REFERENCES game_sessions(id);
ALTER TABLE unlocked_tasks ADD CONSTRAINT unlocked_tasks_user_session_task_key
  UNIQUE NULLS NOT DISTINCT (user_id, session_id, task_id);

-- 6. RLS for new tables
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "game_sessions_read"  ON game_sessions FOR SELECT USING (true);
CREATE POLICY "game_sessions_write" ON game_sessions FOR ALL TO authenticated USING (true) WITH CHECK (true);

ALTER TABLE session_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "session_scores_read" ON session_scores FOR SELECT USING (true);

-- 7. Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE session_scores;

-- 8. Leaderboard view (joins session_scores with users for display fields)
CREATE OR REPLACE VIEW session_leaderboard AS
SELECT
  ss.user_id,
  ss.session_id,
  ss.score,
  ss.tasks_completed,
  u.full_name,
  u.team_name
FROM session_scores ss
JOIN users u ON ss.user_id = u.id;

-- 9. Updated add_score RPC (adds p_session_id parameter, DEFAULT NULL for backward compat)
CREATE OR REPLACE FUNCTION add_score(
  p_user_id    UUID,
  p_delta      INTEGER,
  p_task_id    TEXT,
  p_session_id BIGINT DEFAULT NULL
)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  UPDATE users SET
    score           = score + p_delta,
    tasks_completed = array_append(tasks_completed, p_task_id),
    last_active     = NOW()
  WHERE id = p_user_id;

  IF p_session_id IS NOT NULL THEN
    INSERT INTO session_scores (user_id, session_id, score, tasks_completed)
    VALUES (p_user_id, p_session_id, p_delta, ARRAY[p_task_id])
    ON CONFLICT (user_id, session_id) DO UPDATE SET
      score           = session_scores.score + EXCLUDED.score,
      tasks_completed = array_append(session_scores.tasks_completed, p_task_id);
  END IF;

  RETURN (SELECT score FROM users WHERE id = p_user_id);
END;
$$;

-- 10. Updated claim_first_solver RPC (uses game_sessions.first_solvers when session provided)
CREATE OR REPLACE FUNCTION claim_first_solver(
  p_task_id    TEXT,
  p_user_id    UUID,
  p_session_id BIGINT DEFAULT NULL
)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_solvers JSONB;
BEGIN
  IF p_session_id IS NOT NULL THEN
    SELECT first_solvers INTO v_solvers FROM game_sessions WHERE id = p_session_id FOR UPDATE;
    IF v_solvers ? p_task_id THEN RETURN FALSE; END IF;
    UPDATE game_sessions SET first_solvers = first_solvers || jsonb_build_object(p_task_id, p_user_id::TEXT)
    WHERE id = p_session_id;
    RETURN TRUE;
  ELSE
    SELECT first_solvers INTO v_solvers FROM game_state WHERE id = 1 FOR UPDATE;
    IF v_solvers ? p_task_id THEN RETURN FALSE; END IF;
    UPDATE game_state SET first_solvers = first_solvers || jsonb_build_object(p_task_id, p_user_id::TEXT)
    WHERE id = 1;
    RETURN TRUE;
  END IF;
END;
$$;

-- 11. Updated unlock_task RPC (accepts optional p_session_id)
CREATE OR REPLACE FUNCTION unlock_task(p_user_id UUID, p_task_id TEXT, p_session_id BIGINT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_active BOOLEAN;
BEGIN
  IF auth.uid() IS DISTINCT FROM p_user_id THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT active INTO v_active FROM tasks WHERE task_id = p_task_id;
  IF NOT FOUND   THEN RETURN 'task_not_found'; END IF;
  IF NOT v_active THEN RETURN 'task_not_active'; END IF;
  BEGIN
    INSERT INTO unlocked_tasks (user_id, task_id, session_id)
    VALUES (p_user_id, p_task_id, p_session_id);
    RETURN 'unlocked';
  EXCEPTION WHEN unique_violation THEN RETURN 'already_unlocked';
  END;
END;
$$;

-- ── MIGRATION v4: Admin player edit ───────────────────────────────────────────
-- Already applied to live DB. Allows admin to update any player row, bypassing
-- the users_update_own RLS policy. Also syncs score to active session if provided.

CREATE OR REPLACE FUNCTION admin_update_user(
  p_user_id    UUID,
  p_full_name  TEXT,
  p_student_id TEXT,
  p_team_name  TEXT,
  p_score      INTEGER,
  p_session_id BIGINT DEFAULT NULL
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE users
  SET full_name  = p_full_name,
      student_id = p_student_id,
      team_name  = p_team_name,
      score      = p_score
  WHERE id = p_user_id;

  IF p_session_id IS NOT NULL THEN
    UPDATE session_scores
    SET score = p_score
    WHERE user_id = p_user_id AND session_id = p_session_id;
  END IF;
END;
$$;

-- ── MIGRATION v5: Community photo voting ──────────────────────────────────────
-- Apply this block in Supabase SQL Editor for new deployments.

CREATE TABLE IF NOT EXISTS photo_votes (
  id             BIGSERIAL PRIMARY KEY,
  voter_user_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  attempt_id     UUID NOT NULL REFERENCES attempts(id) ON DELETE CASCADE,
  session_id     BIGINT REFERENCES game_sessions(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS photo_votes_voter_session_unique
  ON photo_votes (voter_user_id, session_id);

ALTER TABLE photo_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can insert own vote"
  ON photo_votes FOR INSERT
  WITH CHECK (auth.uid() = voter_user_id);

CREATE POLICY "Anyone can read votes"
  ON photo_votes FOR SELECT USING (true);

ALTER TABLE game_state
  ADD COLUMN IF NOT EXISTS voting_open BOOLEAN NOT NULL DEFAULT false;

ALTER PUBLICATION supabase_realtime ADD TABLE photo_votes;

CREATE OR REPLACE FUNCTION award_vote_bonuses(p_session_id BIGINT)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rec        RECORD;
  v_rank       INT := 0;
  v_prev_votes INT := -1;
  v_bonus      INT;
BEGIN
  -- Participation bonus (+50) to every player who cast a vote
  FOR v_rec IN
    SELECT DISTINCT voter_user_id FROM photo_votes WHERE session_id = p_session_id
  LOOP
    UPDATE users SET score = score + 50 WHERE id = v_rec.voter_user_id;
    INSERT INTO session_scores (user_id, session_id, score, tasks_completed)
    VALUES (v_rec.voter_user_id, p_session_id, 50, ARRAY[]::TEXT[])
    ON CONFLICT (user_id, session_id) DO UPDATE SET
      score = session_scores.score + 50;
  END LOOP;

  -- Per-vote bonus (+10 per vote received) + podium for top 3
  FOR v_rec IN
    SELECT a.user_id,
           COUNT(pv.id)::INT AS vote_count
    FROM   photo_votes pv
    JOIN   attempts     a ON a.id = pv.attempt_id
    WHERE  pv.session_id = p_session_id
    GROUP  BY a.user_id
    ORDER  BY vote_count DESC
  LOOP
    -- Per-vote bonus
    UPDATE users SET score = score + (v_rec.vote_count * 10) WHERE id = v_rec.user_id;
    INSERT INTO session_scores (user_id, session_id, score, tasks_completed)
    VALUES (v_rec.user_id, p_session_id, (v_rec.vote_count * 10), ARRAY[]::TEXT[])
    ON CONFLICT (user_id, session_id) DO UPDATE SET
      score = session_scores.score + (v_rec.vote_count * 10);

    -- Rank (ties share same rank)
    IF v_rec.vote_count <> v_prev_votes THEN
      v_rank := v_rank + 1;
    END IF;
    v_prev_votes := v_rec.vote_count;

    -- Podium bonus
    v_bonus := CASE v_rank WHEN 1 THEN 100 WHEN 2 THEN 60 WHEN 3 THEN 30 ELSE 0 END;
    IF v_bonus > 0 THEN
      UPDATE users SET score = score + v_bonus WHERE id = v_rec.user_id;
      INSERT INTO session_scores (user_id, session_id, score, tasks_completed)
      VALUES (v_rec.user_id, p_session_id, v_bonus, ARRAY[]::TEXT[])
      ON CONFLICT (user_id, session_id) DO UPDATE SET
        score = session_scores.score + v_bonus;
    END IF;
  END LOOP;

  -- Close voting
  UPDATE game_state SET voting_open = false WHERE id = 1;
END;
$$;
