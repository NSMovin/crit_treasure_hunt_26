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

-- ── MIGRATION v6: Admin photo deletion ───────────────────────────────────────
-- Already applied to live DB. Allows admin to delete photo submissions.

-- Storage DELETE policy for the photos bucket
CREATE POLICY "photos_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'photos');

-- SECURITY DEFINER function: nulls photo_url and removes associated votes
CREATE OR REPLACE FUNCTION admin_delete_photo(p_attempt_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM photo_votes WHERE attempt_id = p_attempt_id;
  UPDATE attempts SET photo_url = NULL WHERE id = p_attempt_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- MIGRATION v7: Mafia Hunt Side-Game
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. game_state: add mafia toggle
ALTER TABLE game_state ADD COLUMN IF NOT EXISTS mafia_active BOOLEAN DEFAULT FALSE;

-- 2. mafia_roles: one row per player per session
CREATE TABLE IF NOT EXISTS mafia_roles (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES users(id),
  session_id  BIGINT  NOT NULL REFERENCES game_sessions(id),
  role        TEXT    NOT NULL CHECK (role IN ('spy','civilian')),
  is_alive    BOOLEAN DEFAULT TRUE,
  kills       INTEGER DEFAULT 0,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT mafia_roles_unique UNIQUE (user_id, session_id)
);
CREATE INDEX IF NOT EXISTS idx_mafia_roles_session ON mafia_roles (session_id);
ALTER TABLE mafia_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mafia_roles_read_own" ON mafia_roles
  FOR SELECT USING (auth.uid() = user_id);

-- 3. mafia_actions: audit trail of every attack
CREATE TABLE IF NOT EXISTS mafia_actions (
  id               BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  attacker_user_id UUID   NOT NULL REFERENCES users(id),
  target_user_id   UUID   NOT NULL REFERENCES users(id),
  session_id       BIGINT NOT NULL REFERENCES game_sessions(id),
  success          BOOLEAN NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mafia_actions_session  ON mafia_actions (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mafia_actions_attacker ON mafia_actions (attacker_user_id, session_id);
ALTER TABLE mafia_actions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mafia_actions_read_own" ON mafia_actions
  FOR SELECT USING (auth.uid() = attacker_user_id);

-- 4. start_mafia: randomly assign roles (20% spy, 80% civilian)
CREATE OR REPLACE FUNCTION start_mafia(p_session_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ids       UUID[];
  v_count     INTEGER;
  v_spy_count INTEGER;
  v_i         INTEGER;
BEGIN
  SELECT ARRAY_AGG(uid ORDER BY RANDOM())
  INTO v_ids
  FROM (SELECT DISTINCT user_id AS uid FROM session_scores WHERE session_id = p_session_id) t;
  IF v_ids IS NULL THEN RAISE EXCEPTION 'No players found for session %.', p_session_id; END IF;
  v_count     := array_length(v_ids, 1);
  v_spy_count := GREATEST(1, ROUND(v_count * 0.20)::INTEGER);
  FOR v_i IN 1..v_count LOOP
    INSERT INTO mafia_roles (user_id, session_id, role)
    VALUES (v_ids[v_i], p_session_id, CASE WHEN v_i <= v_spy_count THEN 'spy' ELSE 'civilian' END)
    ON CONFLICT (user_id, session_id) DO NOTHING;
  END LOOP;
  UPDATE game_state SET mafia_active = TRUE WHERE id = 1;
END;
$$;

-- 5. mafia_attack: resolve an attack (server-enforces all rules)
CREATE OR REPLACE FUNCTION mafia_attack(p_target_student_id TEXT, p_session_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_attacker_id  UUID := auth.uid();
  v_target       RECORD; v_atk_role RECORD; v_tgt_role RECORD;
  v_last_attack  TIMESTAMPTZ;
  v_success      BOOLEAN; v_points_delta INTEGER; v_outcome TEXT;
BEGIN
  SELECT * INTO v_atk_role FROM mafia_roles WHERE user_id = v_attacker_id AND session_id = p_session_id;
  IF NOT FOUND               THEN RAISE EXCEPTION 'You are not enrolled in Mafia Hunt.'; END IF;
  IF NOT v_atk_role.is_alive THEN RAISE EXCEPTION 'Dead players cannot attack.'; END IF;
  SELECT MAX(created_at) INTO v_last_attack FROM mafia_actions
  WHERE attacker_user_id = v_attacker_id AND session_id = p_session_id;
  IF v_last_attack IS NOT NULL AND v_last_attack > NOW() - INTERVAL '15 minutes' THEN
    RAISE EXCEPTION 'Cooldown active. Wait % more seconds.',
      EXTRACT(EPOCH FROM (v_last_attack + INTERVAL '15 minutes' - NOW()))::INTEGER;
  END IF;
  SELECT * INTO v_target FROM users WHERE student_id = p_target_student_id;
  IF NOT FOUND               THEN RAISE EXCEPTION 'No player found with that student ID.'; END IF;
  IF v_target.id = v_attacker_id THEN RAISE EXCEPTION 'You cannot target yourself.'; END IF;
  SELECT * INTO v_tgt_role FROM mafia_roles WHERE user_id = v_target.id AND session_id = p_session_id;
  IF NOT FOUND               THEN RAISE EXCEPTION 'That player is not enrolled in Mafia Hunt.'; END IF;
  IF NOT v_tgt_role.is_alive THEN RAISE EXCEPTION 'That player is already eliminated.'; END IF;
  IF v_atk_role.role = 'spy' AND v_tgt_role.role = 'civilian' THEN
    v_success := TRUE;  v_points_delta := 100;  v_outcome := 'eliminated_civilian';
    UPDATE mafia_roles SET is_alive = FALSE WHERE user_id = v_target.id      AND session_id = p_session_id;
    UPDATE mafia_roles SET kills = kills + 1   WHERE user_id = v_attacker_id AND session_id = p_session_id;
  ELSIF v_atk_role.role = 'spy' AND v_tgt_role.role = 'spy' THEN
    v_success := FALSE; v_points_delta := -75;  v_outcome := 'spy_mistake';
    UPDATE mafia_roles SET is_alive = FALSE WHERE user_id = v_attacker_id AND session_id = p_session_id;
  ELSIF v_atk_role.role = 'civilian' AND v_tgt_role.role = 'spy' THEN
    v_success := TRUE;  v_points_delta := 100;  v_outcome := 'exposed_spy';
    UPDATE mafia_roles SET is_alive = FALSE WHERE user_id = v_target.id      AND session_id = p_session_id;
    UPDATE mafia_roles SET kills = kills + 1   WHERE user_id = v_attacker_id AND session_id = p_session_id;
  ELSE
    v_success := FALSE; v_points_delta := -75;  v_outcome := 'civilian_mistake';
    UPDATE mafia_roles SET is_alive = FALSE WHERE user_id = v_target.id AND session_id = p_session_id;
  END IF;
  UPDATE users          SET score = score + v_points_delta, last_active = NOW() WHERE id = v_attacker_id;
  UPDATE session_scores SET score = score + v_points_delta
  WHERE user_id = v_attacker_id AND session_id = p_session_id;
  INSERT INTO mafia_actions (attacker_user_id, target_user_id, session_id, success)
  VALUES (v_attacker_id, v_target.id, p_session_id, v_success);
  RETURN jsonb_build_object('outcome', v_outcome, 'success', v_success, 'points_delta', v_points_delta);
END;
$$;

-- 6. get_mafia_feed: anonymised event feed (SECURITY DEFINER bypasses RLS)
CREATE OR REPLACE FUNCTION get_mafia_feed(p_session_id BIGINT, p_limit INTEGER DEFAULT 10)
RETURNS TABLE (event_text TEXT, created_at TIMESTAMPTZ) LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    CASE
      WHEN ma.success AND mr_t.role = 'civilian' THEN '⚠️ A civilian was eliminated.'
      WHEN ma.success AND mr_t.role = 'spy'      THEN '⚠️ A spy was exposed.'
      ELSE '⚠️ Someone made a fatal mistake.'
    END,
    ma.created_at
  FROM mafia_actions ma
  LEFT JOIN mafia_roles mr_t ON ma.target_user_id = mr_t.user_id AND ma.session_id = mr_t.session_id
  WHERE ma.session_id = p_session_id
  ORDER BY ma.created_at DESC LIMIT p_limit;
$$;

-- 7. admin_get_mafia_state: full role table for admin panel only
CREATE OR REPLACE FUNCTION admin_get_mafia_state(p_session_id BIGINT)
RETURNS TABLE (user_id UUID, full_name TEXT, role TEXT, is_alive BOOLEAN, kills INTEGER)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT mr.user_id, u.full_name, mr.role, mr.is_alive, mr.kills
  FROM mafia_roles mr JOIN users u ON mr.user_id = u.id
  WHERE mr.session_id = p_session_id
  ORDER BY mr.role, mr.is_alive DESC, mr.kills DESC;
$$;

-- 8. admin_reset_mafia: wipe session roles + actions, deactivate
CREATE OR REPLACE FUNCTION admin_reset_mafia(p_session_id BIGINT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM mafia_actions WHERE session_id = p_session_id;
  DELETE FROM mafia_roles    WHERE session_id = p_session_id;
  UPDATE game_state SET mafia_active = FALSE WHERE id = 1;
END;
$$;
