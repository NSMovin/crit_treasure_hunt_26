# Treasure Hunt Live

A production-ready mobile-first web app for university amusement park treasure hunts with 80+ participants. Built on **Supabase** (PostgreSQL + Auth + Realtime + Storage) and hosted on **Vercel** — no backend servers, no frameworks.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| Auth | Supabase Anonymous Authentication |
| Database | Supabase PostgreSQL |
| Realtime | Supabase Realtime (postgres_changes) |
| Storage | Supabase Storage (photo uploads) |
| Hosting | Vercel |
| SDK | Supabase JS v2 (CDN UMD build) |

---

## Project Structure

```
crit_treasure_hunt_26/
├── vercel.json                  # Vercel deployment config
├── supabase-schema.sql          # Run this once in Supabase SQL Editor
│
└── public/                      # Vercel serves this as the root
    ├── index.html               # Entry / sign-in / profile setup
    ├── game.html                # Player dashboard (tasks list, score)
    ├── task.html                # Task runner (QR lands here)
    ├── unlock.html              # QR landing page → unlocks task
    ├── leaderboard.html         # Real-time leaderboard (public)
    ├── vote.html                # Community photo voting gallery
    ├── mafia.html               # Mafia Hunt side-game player page
    ├── admin.html               # Admin dashboard (passcode-gated)
    │
    ├── css/
    │   ├── base.css             # Reset + design tokens
    │   ├── components.css       # Buttons, inputs, toast, modal
    │   ├── layout.css           # Header, nav, announcements
    │   ├── game.css             # Player dashboard styles
    │   ├── task.css             # Task runner + all mini-games
    │   ├── leaderboard.css      # Leaderboard styles
    │   ├── vote.css             # Photo voting gallery styles
    │   ├── mafia.css            # Mafia Hunt side-game styles
    │   └── admin.css            # Admin dashboard styles
    │
    └── js/
        ├── supabase-client.js   # ⚙️ EDIT — your Supabase URL + anon key
        ├── app-settings.js      # ⚙️ EDIT — admin passcode, scoring config
        ├── auth.js              # Anonymous auth + profile management
        ├── router.js            # Auth guards + redirects
        ├── scoring.js           # Scoring formula (pure math)
        ├── image-compress.js    # Canvas image compression
        ├── storage.js           # Supabase Storage photo upload
        ├── ui.js                # Toast, modal, spinner utils
        │
        ├── db/                  # Supabase database modules
        │   ├── users.js
        │   ├── tasks.js
        │   ├── attempts.js
        │   ├── leaderboard.js
        │   ├── announcements.js
        │   ├── game-state.js
        │   ├── game-sessions.js
        │   ├── unlocked-tasks.js
        │   ├── photo-votes.js
        │   ├── mafia.js
        │   └── tribe-finder.js  # DB layer for tribe_finder task type
        │
        ├── games/               # Mini-game implementations
        │   ├── quiz.js
        │   ├── memory-match.js
        │   ├── fast-tap.js
        │   ├── puzzle.js
        │   ├── photo-challenge.js
        │   ├── arrow-hunt.js    # Rotating log — stick all arrows without overlap
        │   └── tribe-finder.js  # Social deduction — find your hidden tribe members
        │
        ├── pages/               # Page-level controllers
        │   ├── index-page.js
        │   ├── game-page.js
        │   ├── task-page.js
        │   ├── unlock-page.js
        │   ├── leaderboard-page.js
        │   ├── vote-page.js
        │   ├── mafia-page.js
        │   └── admin-page.js
        │
        └── admin/               # Admin panel sub-modules
            ├── task-manager.js
            ├── announcement-manager.js
            ├── player-monitor.js
            ├── hint-manager.js
            ├── session-manager.js
            ├── voting-manager.js
            ├── mafia-manager.js
            └── tribe-finder-manager.js  # Admin view: tribe distribution + reset
```

---

## Setup Guide

### Step 1 — Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a region close to your event venue
3. Wait for the project to initialize (~2 minutes)

### Step 2 — Run the Database Schema

1. In the Supabase dashboard → **SQL Editor** → **New query**
2. Paste the entire contents of `supabase-schema.sql`
3. Click **Run** — this creates all tables, RLS policies, and functions

### Step 3 — Create the Photos Storage Bucket

1. Supabase dashboard → **Storage** → **New bucket**
2. Name: `photos` | Public: **ON**
3. In SQL Editor, run the storage policy lines at the bottom of `supabase-schema.sql` (the commented-out section)

### Step 4 — Get Your API Keys

Supabase dashboard → **Project Settings** → **API**:
- **Project URL** — looks like `https://xxxxxxxxxxxx.supabase.co`
- **anon / public key** — starts with `eyJ...`

### Step 5 — Configure the App

Open `public/js/supabase-client.js` and replace the placeholder values:

```javascript
const SUPABASE_URL      = 'https://YOUR_PROJECT_ID.supabase.co';
const SUPABASE_ANON_KEY = 'YOUR_ANON_KEY_HERE';
```

Open `public/js/app-settings.js` and set your admin passcode:

```javascript
adminPasscode: 'YourStrongPasscode2026!',
```

### Step 6 — Deploy to Vercel

**Option A — Vercel CLI:**
```bash
npm install -g vercel
vercel login
vercel --prod
```

**Option B — Vercel Dashboard (drag-and-drop):**
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your Git repository (or drag the project folder)
3. Leave all settings as defaults — Vercel auto-detects the `vercel.json`
4. Click **Deploy**

Your app is live at `https://your-project.vercel.app`

---

## Enable Supabase Realtime

After deploying the schema, verify realtime is on:

Supabase dashboard → **Database** → **Replication** → check that `users`, `tasks`, `announcements`, and `game_state` are listed under the `supabase_realtime` publication.

If not, run in SQL Editor:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
```

---

## Pre-Event Checklist

### Admin Setup (do this before participants arrive)

1. Open `https://your-project.vercel.app/admin.html`
2. Enter your admin passcode
3. **Settings** → set valid team names (one per line) → Save
4. **Tasks** → create all task stations:
   - Task ID: a slug like `task-01-quiz`
   - Choose type, fill in Config JSON (see Task Config section)
   - Leave **Active = false** until the game starts
5. Print QR codes pointing to:
   `https://your-project.vercel.app/task.html?id=task-01-quiz`
   Use any free QR generator such as [qr-code-generator.com](https://www.qr-code-generator.com)
6. Keep game paused (Settings → Game Active = OFF) until the event starts

### Event Day

1. Admin **Activate Game** in Settings
2. Activate individual tasks when ready
3. Release hints: Hints panel → toggle Released
4. Send announcements to all players live
5. Monitor active players in the Players panel
6. Watch live leaderboard at `/leaderboard.html`

---

## Task Config JSON Reference

### Quiz — Single Question (legacy format)

```json
{
  "question": "What year was this university founded?",
  "options": ["1990", "1998", "2002", "2010"],
  "correct_index": 1
}
```

### Quiz — Multiple Questions (new format)

Use the `questions` array to chain questions sequentially inside a single task. The player moves through each question one by one — no page reload. The wrong-attempt counter (`MAX_WRONG = 3`) resets per question. The timer (if set) covers the whole quiz, not each question individually.

```json
{
  "questions": [
    {
      "question": "What does AI stand for?",
      "options": ["Artificial Intelligence", "Automated Internet", "Advanced Interface", "Algorithmic Input"],
      "correct_index": 0
    },
    {
      "question": "Which programming language is most used in AI?",
      "options": ["Python", "PHP", "HTML", "Swift"],
      "correct_index": 0
    },
    {
      "question": "What year was this university founded?",
      "options": ["1990", "1998", "2002", "2010"],
      "correct_index": 1
    }
  ]
}
```

`correct_index` is zero-based (`0` = first option, `1` = second, etc.).  
Scoring: `correct = true` if the player answered at least one question correctly. Total wrong attempts across all questions feed into the penalty formula.

### Memory Match

```json
{
  "pairs": [
    { "id": "cat",   "label": "🐱" },
    { "id": "dog",   "label": "🐶" },
    { "id": "bird",  "label": "🐦" },
    { "id": "fish",  "label": "🐟" },
    { "id": "frog",  "label": "🐸" },
    { "id": "tiger", "label": "🐯" }
  ],
  "grid_size": 4
}
```

### Fast Tap

```json
{
  "target_color": "#e74c3c",
  "distractors": ["#3498db", "#2ecc71", "#f39c12"],
  "tap_count": 10,
  "time_window_sec": 15
}
```

### Puzzle / Riddle

Set the riddle in the task `description` field. Config:

```json
{
  "answer": "fibonacci",
  "case_sensitive": false,
  "allow_partial": false
}
```

### Photo Challenge

```json
{
  "prompt": "Take a selfie in front of the main fountain!"
}
```

### Arrow Hunt

A canvas mini-game. A wooden log rotates on screen. Players tap/click to fire arrows into the log — arrows must not overlap. If two arrow tips land within the collision tolerance, the player is eliminated and can try again internally (wrong attempt is counted). When all arrows are placed without a collision, the task is marked correct.

```json
{
  "target_rotation_speed": 1.8,
  "arrow_count": 10,
  "speed_increase_per_arrow": 0.18,
  "collision_tolerance": 12,
  "reverse_at_arrow": 5,
  "scoring": {
    "base_per_arrow": 10,
    "bonus_at_5": 25,
    "bonus_at_10": 75
  }
}
```

All fields are optional — omit the config entirely (`{}`) to use the defaults above.

| Field | Default | Effect |
|-------|---------|--------|
| `target_rotation_speed` | `1.8` | Degrees per frame the log rotates at the start |
| `arrow_count` | `10` | Number of arrows to place for a win |
| `speed_increase_per_arrow` | `0.18` | Additional rotation speed added each time an arrow sticks |
| `collision_tolerance` | `12` | Minimum degrees of separation required between arrows |
| `reverse_at_arrow` | `5` | The log reverses rotation direction when this many arrows have been placed |
| `scoring.base_per_arrow` | `10` | Points awarded each time an arrow sticks |
| `scoring.bonus_at_5` | `25` | Bonus awarded when the 5th arrow sticks |
| `scoring.bonus_at_10` | `75` | Bonus awarded when the 10th (final) arrow sticks |

The in-game score is passed to the standard scoring formula via `onComplete`. The task reports `correct: true` only when all arrows are placed successfully.

#### How to add an Arrow Hunt task (admin steps)

1. Open **Admin → Tasks** → **+ New Task**
2. Fill in **Title**, **Description** (shown to the player above the game), and **Points**
3. Set **Type** to `arrow_hunt`
4. In **Config JSON**, paste the block above — or leave it as `{}` for default difficulty
5. Optionally set a **Time Limit** (seconds). If left blank there is no timer
6. Set **Active = true** when you are ready for players to reach this task
7. Print a QR code pointing to:
   `https://your-project.vercel.app/unlock.html?task=<task_id>`

Players scan the QR code → the task unlocks → they are taken to the game. Completion is recorded in the attempts table and points are added to the leaderboard automatically.

To increase difficulty: raise `target_rotation_speed`, lower `collision_tolerance`, or increase `arrow_count`. To make it easier: lower speed, raise tolerance, or reduce arrow count.

### Tribe Finder

A social deduction task. Players are secretly assigned to hidden tribes and must physically talk to other participants to figure out who shares their tribe. When a player believes they have found all their tribe members, they submit everyone's student IDs for server-side validation.

```json
{
  "tribe_size": 4,
  "tribe_labels": ["Phoenix", "Kraken", "Titan", "Nova", "Shadow", "Eclipse"],
  "cooldown_minutes": 2
}
```

All fields are optional — omit the config entirely (`{}`) to use the defaults above.

| Field | Default | Effect |
|-------|---------|--------|
| `tribe_size` | `4` | Total number of players per tribe, including the submitter |
| `tribe_labels` | 6 labels (Phoenix … Eclipse) | Names players see on their tribe card |
| `cooldown_minutes` | `2` | Minutes a player must wait after a wrong submission before trying again |

**How it works:**

1. A player scans the QR code and reaches the task page
2. The server assigns them to the tribe with the fewest current members (race-safe)
3. The player sees their tribe name and a mission briefing — but **not** who else is in their tribe
4. They must find `tribe_size - 1` other participants in real life and ask for their student IDs
5. They enter those student IDs and submit
6. The server validates that every submitted ID belongs to a player in the **same tribe** for this task and session
7. **Wrong group** → −50 pts applied immediately, `cooldown_minutes` wait before next attempt
8. **Correct group** → all matched players are marked completed; standard scoring applies (base points + speed bonus + first-solver bonus)

Players who are matched by someone else's correct submission are also marked completed — they do not need to submit separately.

**Scoring note:** Wrong-attempt penalties are applied live by the server RPC (not via the standard `calculateScore` formula). The `onComplete` callback always passes `wrongAttempts: 0` to avoid double-penalising.

#### How to add a Tribe Finder task (admin steps)

1. Open **Admin → Tasks** → **+ New Task**
2. Set **Task ID** to a slug like `task-tribe-01`
3. Set **Title** (e.g. "Find Your Tribe") and **Description** (shown above the game as flavour text)
4. Set **Type** to `tribe_finder`
5. Set **Points** — suggested 150 for a social task of this difficulty
6. In **Config JSON**, paste the block above, or use `{}` for defaults
7. Leave **Time Limit** blank (no countdown pressure) or set one if you want urgency
8. Set **Active = true** when ready for players
9. Print a QR code pointing to:
   `https://your-project.vercel.app/unlock.html?task=<task_id>`

For a quick test during setup, use `"tribe_size": 2` — only one other student ID is needed, so you can test with two browser sessions on two phones.

To monitor progress during the event: **Admin → 🏕️ Tribe Finder** shows every player's assigned tribe, completion status, and when they were assigned. Use the **Reset** button on any task to clear all assignments and start fresh.

---

## Scoring Formula

### Task Completion

```
Final Score = base_points + speed_bonus + first_solver_bonus - wrong_attempt_penalty
```

| Component | Default |
|-----------|---------|
| `base_points` | Set per task in admin |
| `speed_bonus` | Up to 50% of base, proportional to time remaining |
| `first_solver_bonus` | +50 pts flat (configurable) |
| `wrong_attempt_penalty` | −10 pts per wrong attempt |

All values are configurable in `public/js/app-settings.js → scoring`.

### Photo Voting Bonuses (awarded in batch when admin closes voting)

| Component | Default |
|-----------|---------|
| `participationBonus` | +50 pts for every player who casts any vote |
| `perVoteBonus` | +10 pts per vote a photo receives |
| `podium1st` | +100 pts for the most-voted photo |
| `podium2nd` | +60 pts |
| `podium3rd` | +30 pts |

Configurable in `public/js/app-settings.js → voting`. Ties share the same podium rank.

---

## Database Schema

### `users`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Equals `auth.uid()` |
| full_name | TEXT | From profile form |
| student_id | TEXT UNIQUE | Unique per event |
| team_name | TEXT | Empty if no team |
| score | INTEGER | Running total |
| tasks_completed | TEXT[] | Array of task_id slugs |
| created_at | TIMESTAMPTZ | |
| last_active | TIMESTAMPTZ | Updated on every page load |

### `tasks`
| Column | Type | Notes |
|--------|------|-------|
| task_id | TEXT PK | Human-readable slug |
| title | TEXT | |
| description | TEXT | Riddle text / instructions |
| type | TEXT | quiz / memory_match / fast_tap / puzzle / photo / arrow_hunt / tribe_finder |
| points | INTEGER | Base points |
| time_limit_sec | INTEGER | NULL = no timer |
| hint | TEXT | Empty until released |
| hint_released | BOOLEAN | Shows hint to players |
| active | BOOLEAN | Must be true to be playable |
| display_order | INTEGER | Sort order on game page |
| config | JSONB | Type-specific config |

### `attempts`
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Auto-generated |
| user_id | UUID | References users.id |
| task_id | TEXT | References tasks.task_id |
| result | TEXT | correct / wrong |
| score_delta | INTEGER | Points earned |
| time_taken_sec | INTEGER | |
| is_first_solver | BOOLEAN | |
| attempts_count | INTEGER | |
| photo_url | TEXT | Supabase Storage URL (photo tasks) |
| created_at | TIMESTAMPTZ | |

### `announcements`
| Column | Type |
|--------|------|
| id | UUID |
| message | TEXT |
| type | TEXT (info / warning / hint_release / task_activate) |
| pinned | BOOLEAN |
| sent_by | TEXT |
| sent_at | TIMESTAMPTZ |

### `game_state` (single row, id=1)
| Column | Type |
|--------|------|
| game_active | BOOLEAN |
| game_name | TEXT |
| valid_teams | TEXT[] |
| first_solvers | JSONB `{task_id: user_id}` |
| started_at | TIMESTAMPTZ |
| ends_at | TIMESTAMPTZ |
| active_session_id | BIGINT | FK → game_sessions.id |
| voting_open | BOOLEAN | Controls photo voting gallery |
| mafia_active | BOOLEAN | Controls Mafia Hunt side-game |

### `photo_votes`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGSERIAL | Auto-generated |
| voter_user_id | UUID | References users.id |
| attempt_id | UUID | References attempts.id (the photo submission) |
| session_id | BIGINT | References game_sessions.id |
| created_at | TIMESTAMPTZ | |

UNIQUE constraint on `(voter_user_id, session_id)` — one vote per player per session.

### `mafia_roles`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT | Auto-generated |
| user_id | UUID | References users.id |
| session_id | BIGINT | References game_sessions.id |
| role | TEXT | `spy` or `civilian` |
| is_alive | BOOLEAN | False once eliminated |
| kills | INTEGER | Successful eliminations |
| assigned_at | TIMESTAMPTZ | |

UNIQUE constraint on `(user_id, session_id)`. RLS: each player can only read their own row — other roles are never exposed to players.

### `tribe_assignments`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT | Auto-generated |
| user_id | UUID | References users.id |
| task_id | TEXT | References tasks.task_id |
| session_id | BIGINT | References game_sessions.id |
| tribe_label | TEXT | The tribe this player belongs to for this task |
| completed_at | TIMESTAMPTZ | Set when the player's group is correctly validated |
| assigned_at | TIMESTAMPTZ | When the assignment was made |

UNIQUE constraint on `(user_id, task_id, session_id)` — one assignment per player per task per session. RLS: each player can only read their own row.

### `tribe_submissions`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT | Auto-generated |
| submitter_id | UUID | Who submitted |
| task_id | TEXT | References tasks.task_id |
| session_id | BIGINT | References game_sessions.id |
| submitted_ids | JSONB | Array of student ID strings that were submitted |
| success | BOOLEAN | True if the submission was correct |
| created_at | TIMESTAMPTZ | Used for cooldown enforcement |

RLS: each player can only read their own submission rows (used for cooldown display). The `submit_tribe_group` RPC reads `MAX(created_at) WHERE success = FALSE` to enforce the cooldown server-side.

### `mafia_actions`
| Column | Type | Notes |
|--------|------|-------|
| id | BIGINT | Auto-generated |
| attacker_user_id | UUID | Who attacked |
| target_user_id | UUID | Who was targeted |
| session_id | BIGINT | References game_sessions.id |
| success | BOOLEAN | True if attacker achieved their goal |
| created_at | TIMESTAMPTZ | Used for 15-minute cooldown enforcement |

RLS: players can only read their own attack rows (used for cooldown display). The anonymous event feed is served via a SECURITY DEFINER RPC that strips identities.

---

## Tribe Finder Task

Tribe Finder is a **task type** (not a side-game). It appears in the task list alongside quiz, puzzle, and arrow hunt — players reach it by scanning a QR code, and completing it earns points that go directly onto the leaderboard. The mechanic is social: players cannot complete it alone.

### Concept

When a player reaches the Tribe Finder task, the server secretly assigns them to one of several named tribes. They can see their own tribe name, but they have no idea who else is in it. To complete the task they must:

1. Walk around and ask other participants: *"What tribe are you in?"*
2. Collect the student IDs of everyone they believe is in their tribe
3. Submit those IDs — if correct, everyone in that group is marked as complete

Because tribes are assigned at first access (not pre-loaded), the social interaction is the mechanic. Players genuinely do not know who their tribe members are until they start talking.

### How Assignment Works

Tribes are filled greedily — each new player is assigned to the tribe with the fewest current members. Tie-break goes to the first tribe in the `tribe_labels` list. The assignment is race-safe (`INSERT ... ON CONFLICT DO NOTHING` + re-select).

With the default config (`tribe_size: 4`, 6 tribes) and 80 participants, you get roughly 20 tribes of 4. Adjust `tribe_size` and `tribe_labels` to control group sizes.

### Submission and Validation

The player enters `tribe_size - 1` student IDs (everyone except themselves). The `submit_tribe_group` server RPC checks:

- Every submitted student ID maps to a real user
- None of the submitted IDs is the submitter's own
- Every submitted user has a `tribe_assignments` row for the same task, session, **and tribe label**
- Every submitted user's assignment is not already completed (prevents a player from being claimed twice)

If all checks pass → all matched players (submitter + submitted) are marked `completed_at = NOW()`. The submitter's `onComplete({ correct: true })` fires and `task-page.js` runs the standard scoring formula.

### Scoring

| Outcome | How it works |
|---------|-------------|
| Correct group | Standard scoring: base points + speed bonus + first-solver bonus |
| Wrong group | −50 pts applied immediately via server RPC; `cooldown_minutes` wait |
| Already completed (entered via URL after finishing) | Task-page guard redirects; no double award |

Wrong-attempt penalties are deducted live by the server (same pattern as Mafia Hunt attacks). The `wrongAttempts: 0` value passed to `onComplete` prevents the `calculateScore` formula from also deducting — there is no double penalty.

### The Cooldown

After a wrong submission the player must wait `cooldown_minutes` (default 2) before submitting again. The countdown is displayed on the task page and updates every second. Enforcement is server-side — the RPC checks `MAX(created_at) WHERE success = FALSE` against wall-clock time. If a player refreshes mid-cooldown, the remaining time is fetched from the server on mount and the countdown resumes correctly.

### What Happens to Players Who Are Found

When a correct submission comes in, **all players in that group** — submitter and everyone they named — are marked `completed_at`. A player who was found by someone else will see an already-completed notice if they later scan the QR code themselves. They still receive full credit: the `hasCompletedTask` guard in `task-page.js` detects the completed state and shows a success toast rather than re-running the game.

Players who were found cannot submit again (the `completed_at IS NOT NULL` check in the RPC raises an exception).

### Admin Controls — Admin → 🏕️ Tribe Finder

The Tribe Finder panel shows live state for every `tribe_finder` task in the active session.

| Section | What It Shows |
|---------|--------------|
| Tribe Distribution table | Each tribe label, number of players assigned, number completed |
| All Players table | Name, student ID, tribe, status (🔍 Searching / ✅ Found), assigned time |
| Reset button | Clears all `tribe_assignments` and `tribe_submissions` for that task — use to start fresh |

There are no Start/End buttons. Tribe Finder activates and deactivates via the standard `tasks.active` toggle in the Tasks panel, consistent with all other task types.

### Security

All rules are enforced inside the `submit_tribe_group` and `get_or_assign_tribe` SECURITY DEFINER RPCs:

- **Identity guard** — `auth.uid()` is read server-side; the client cannot claim to be another user
- **Cooldown** — server wall-clock check; refreshing the page does not reset it
- **Self-submission** — rejected if any submitted ID resolves to `auth.uid()`
- **Cross-tribe submission** — rejected if any submitted user's `tribe_label` differs from the submitter's
- **Already-completed guard** — rejected if the submitter's `completed_at IS NOT NULL`
- **Race-safe assignment** — `INSERT ... ON CONFLICT DO NOTHING` followed by re-select

---

## Photo Voting Workflow

### Admin Steps

1. After photo tasks are complete, go to **Admin → 📸 Voting**
2. Click **Open Voting** — players see a `📸 Vote` link appear in the home nav
3. Players visit `/vote.html` to view the gallery and cast their vote
   - Author names are hidden during voting (anonymous)
   - Each player gets exactly one vote per session; own photo is disabled
4. Click **Close Voting & Award Bonuses** — the `award_vote_bonuses` RPC runs:
   - +50 participation bonus to everyone who voted
   - +10 × vote count to each photo submitter
   - +100 / +60 / +30 podium bonus for top 3
   - Gallery then reveals author names and vote counts

### QR Code format for photo task stations
```
https://crit-treasure-hunt-26.vercel.app/unlock.html?task=<task_id>
```

---

## Mafia Hunt Side-Game

Mafia Hunt is a hidden-role social deduction game that runs **in parallel** with the treasure hunt. Players keep doing tasks, scanning QR codes, and competing on the leaderboard — while secretly trying to figure out who is a spy and who is a civilian. The two games share the same score, so a successful elimination puts you ahead on the leaderboard; a wrong accusation drops you.

### Concept

When the admin starts Mafia Hunt, every player is secretly assigned one of two roles:

| Role | Proportion | Objective |
|------|-----------|-----------|
| 🕵️ **Spy** | ~20% of players | Blend in. Eliminate civilians without being caught. |
| 👤 **Civilian** | ~80% of players | Find the spies. Accuse and expose them. |

Players **do not know each other's roles**. The only way to find out is to talk, observe behaviour during the treasure hunt, and take a calculated guess. Roles are stored in the database — the frontend never sends role data to players other than their own.

### How a Round Works

1. The admin opens `/admin.html → 🕵️ Mafia Hunt` and clicks **Start Mafia Mode**
2. Roles are assigned randomly to everyone who has played at least one task in the active session
3. A `🕵️ Mafia` link appears in every player's bottom navigation bar
4. Players open `/mafia.html` to see their secret role, alive status, and kill count
5. To make a move, a player enters another player's **student ID** and hits ⚔️ Attack
6. The server resolves the attack instantly and returns the result
7. Players must wait **15 minutes** before attacking again
8. The game ends when the admin clicks **End Mafia Mode**

### Attack Outcomes

The result depends on the roles of both attacker and target:

| Attacker | Target | Result | Points |
|----------|--------|--------|--------|
| 🕵️ Spy | 👤 Civilian | Civilian is eliminated. Spy survives. | Spy **+100** |
| 🕵️ Spy | 🕵️ Spy | Attacker Spy is exposed and eliminated. | Attacker **−75** |
| 👤 Civilian | 🕵️ Spy | Spy is exposed and eliminated. Civilian survives. | Civilian **+100** |
| 👤 Civilian | 👤 Civilian | Target Civilian is eliminated. Attacker loses points. | Attacker **−75** |

Spies win by eliminating civilians. Civilians win by identifying and exposing all spies. The game does not enforce a formal win condition — it ends when the admin decides, and the leaderboard reflects the cumulative effect.

### What Dead Players Can and Cannot Do

Elimination from Mafia Hunt is **not** elimination from the event.

| Action | Alive player | Eliminated player |
|--------|-------------|------------------|
| Continue treasure hunt tasks | ✅ | ✅ |
| Earn points from task completion | ✅ | ✅ |
| Appear on leaderboard | ✅ | ✅ |
| Make Mafia attacks | ✅ | ❌ |
| Be targeted by other players | ✅ | ❌ (server rejects) |

Dead players keep all their treasure hunt points. They just can't attack or be attacked in Mafia Hunt anymore.

### Scoring Integration

Mafia Hunt points are added directly to the same `users.score` and `session_scores.score` columns used by the treasure hunt. There is no separate leaderboard — a well-played Mafia Hunt gives a competitive edge on the main board.

| Event | Points |
|-------|--------|
| Successful elimination (correct target) | +100 |
| Wrong accusation (incorrect target) | −75 |

### The 15-Minute Cooldown

Every player has exactly one attack per 15 minutes. The countdown is displayed on `/mafia.html` and updates every second. The limit is enforced server-side — the `mafia_attack` RPC checks `MAX(created_at)` from `mafia_actions` and raises an exception if the cooldown has not elapsed. Frontend enforcement alone is not sufficient because the RPC can be called directly.

### Anonymous Event Feed

A public activity feed on `/mafia.html` shows events as they happen, without revealing who did what:

```
⚠️ A civilian was eliminated.
⚠️ A spy was exposed.
⚠️ Someone made a fatal mistake.
```

This creates tension and keeps all players engaged even if they haven't attacked yet. The feed is served by the `get_mafia_feed` SECURITY DEFINER RPC, which joins role data internally and returns only the anonymised message string — no names, no IDs.

### Role Secrecy

The `mafia_roles` table has a strict RLS policy: each authenticated user can only `SELECT` their own row. The database never returns another player's role to any client. The admin panel uses a separate `admin_get_mafia_state` SECURITY DEFINER RPC (callable by any authenticated user, but only surfaced in the passcode-gated admin page) to display the full role table.

### Admin Controls — Admin → 🕵️ Mafia Hunt

| Button | What It Does |
|--------|-------------|
| **Start Mafia Mode** | Randomly assigns roles (20% spy / 80% civilian) to all session players; sets `mafia_active = true`; shows Mafia nav link to all players. Disabled if no active session. |
| **End Mafia Mode** | Sets `mafia_active = false`; hides Mafia nav link. Roles and actions are preserved in the database for post-event analysis. |
| **Reset** | Deletes all `mafia_roles` and `mafia_actions` rows for the session; sets `mafia_active = false`. Use this to start a fresh round. |

The admin panel also shows a live table of all players' roles, alive status, and kill counts — visible only to the admin.

### Security

All game rules are enforced inside the `mafia_attack` SECURITY DEFINER RPC on the PostgreSQL server. The frontend cannot bypass any check:

- **Alive check** — dead players' calls are rejected before any other logic runs
- **Cooldown** — uses `MAX(created_at)` from `mafia_actions`; wall-clock time, not a client timestamp
- **Self-target** — rejected if `target.id = auth.uid()`
- **Enrollment** — both attacker and target must have a role row in the current session
- **Double-kill** — rejected if target's `is_alive` is already `false`
- **Scoring** — uses direct `UPDATE` on `users` and `session_scores` (the `add_score` RPC has an `auth.uid()` guard that prevents awarding points to other users, so direct SQL is required — the same approach used by `award_vote_bonuses`)

---

## Post-Event Data Export (Python/pandas)

```bash
pip install supabase pandas
```

```python
from supabase import create_client
import pandas as pd

sb = create_client('https://YOUR_PROJECT.supabase.co', 'YOUR_SERVICE_ROLE_KEY')

tables = ['users', 'tasks', 'attempts', 'announcements']
for name in tables:
    response = sb.table(name).select('*').execute()
    df = pd.DataFrame(response.data)
    df.to_csv(f'{name}.csv', index=False)
    print(f"Exported {len(df)} rows → {name}.csv")
```

Use the **service_role** key (not anon key) for data export — find it in Project Settings → API.

---

## Security Notes

- The admin passcode lives in `app-settings.js` (client-side). This is acceptable for a one-day event where the admin URL is kept private.
- Supabase RLS prevents players from modifying other users' scores directly. Score updates go through a `SECURITY DEFINER` Postgres function that validates the caller's identity.
- The `claim_first_solver` function uses a `FOR UPDATE` lock to prevent race conditions when multiple players finish a task simultaneously.
- For a permanent deployment, consider using Supabase Edge Functions for sensitive admin operations.

---

## License

MIT — free for educational use.

## update 11/5/26
Here's a summary of what was implemented:

Database (applied live to your Supabase project):

tasks.is_public column added — controls whether a task shows without a QR scan
unlocked_tasks table created with RLS, indexes, and realtime enabled
unlock_task() SECURITY DEFINER RPC deployed — validates task is active, prevents duplicates, returns a status string
New files:

public/unlock.html — QR landing page
public/js/pages/unlock-page.js — validates → unlocks → redirects to task
public/js/db/unlocked-tasks.js — full DB layer for unlock operations
Modified files:

game-page.js — tasks split into visible (public/unlocked) and locked (dashed cards)
task-page.js — unlock guard blocks direct URL access; admins bypass it
task-manager.js — "Public task" checkbox in the task create/edit modal
game.css — .task-card--locked style
game.html — QR scanner now also follows /unlock.html URLs
supabase-schema.sql — migration block appended for fresh deployments
QR code format for printing:


https://crit-treasure-hunt-26.vercel.app/unlock.html?task=<task_id>

https://crit-treasure-hunt-26.vercel.app/unlock.html?task=task-01-test01

https://crit-treasure-hunt-26.vercel.app/unlock.html?task=task-01-test01


## update 3:15pm 11/5/26

Here's a summary of what was implemented:

DB layer (6 files modified):

game-state.js — added getActiveSessionId() helper
leaderboard.js — fetchLeaderboard(sessionId) reads session_leaderboard view; onLeaderboardChange(sessionId, callback) listens to session_scores
users.js — hasCompletedTask checks session_scores when sessionId provided; addScore passes p_session_id to RPC
attempts.js — submitAttempt spreads the whole attempt object (picks up session_id); countWrongAttempts and claimFirstSolver both accept sessionId
unlocked-tasks.js — all 4 functions accept sessionId = null
announcements.js — sendAnnouncement includes session_id in insert
Page files (3 modified):

task-page.js — fetches sessionId after auth, threads through all 6 DB calls
game-page.js — fetches sessionId, passes to unlock calls
leaderboard-page.js — fetches sessionId, passes to listener
Admin files (3 modified + 1 created):

announcement-manager.js — fetches sessionId before sendAnnouncement
session-manager.js — new panel (create/activate/list sessions)
admin-page.js — added 🎮 Sessions tab wired to renderSessionManager
Schema: MIGRATION v3 block appended to supabase-schema.sql for documentation. All SQL was already applied live to the DB in the previous session.

## update 11/5/26 — Community photo voting system

New files:

public/vote.html — player-facing photo gallery; shows photos anonymously while voting is open, reveals author names and vote counts when closed
public/js/pages/vote-page.js — gallery renderer, vote handler, realtime updates
public/js/db/photo-votes.js — DB layer: getPhotoSubmissions, getMyVote, castVote, onPhotoVotesChange
public/js/admin/voting-manager.js — admin panel: open/close voting, live vote-count table, award bonuses
public/css/vote.css — photo grid and card styles

Modified files:

admin-page.js — added 📸 Voting tab
game.html — added hidden 📸 Vote nav link (visible only when voting is open)
game-page.js — onGameStateChange toggles vote nav link visibility
app-settings.js — added voting bonus config block (participationBonus, perVoteBonus, podium1st/2nd/3rd)
supabase-schema.sql — MIGRATION v5 block appended

Database changes (applied live):

photo_votes table — id, voter_user_id, attempt_id (UUID), session_id; UNIQUE(voter_user_id, session_id); RLS enabled
voting_open BOOLEAN column added to game_state (default false)
award_vote_bonuses(p_session_id) SECURITY DEFINER RPC — awards participation (+50), per-vote (+10×votes), podium (+100/60/30), then sets voting_open = false
photo_votes added to supabase_realtime publication

Voting flow: Admin opens voting → players vote at /vote.html (one vote per session, own photo disabled) → Admin closes voting → bonuses awarded in batch via RPC → gallery reveals results.


## update 11/5/26 — Mafia Hunt Side-Game

New files:

- `public/mafia.html` — player-facing Mafia Hunt page: role card, attack form, cooldown timer, anonymous event feed
- `public/css/mafia.css` — page styles following the same design token conventions as the rest of the app
- `public/js/pages/mafia-page.js` — page controller: auth guard, inactive state, realtime role updates, attack submission, cooldown management
- `public/js/db/mafia.js` — full DB layer: `getMyRole`, `getLastAttackTime`, `submitAttack`, `getMafiaFeed`, `onMyRoleChange`, `adminGetMafiaState`, `startMafia`, `endMafia`, `resetMafia`
- `public/js/admin/mafia-manager.js` — admin panel: Start / End / Reset controls + live role table showing all players' roles, alive status, and kill counts

Modified files:

- `admin-page.js` — added `🕵️ Mafia Hunt` tab wired to `renderMafiaManager`
- `game.html` — added hidden `#mafia-nav-link` in bottom nav (shown only when `mafia_active = true`)
- `game-page.js` — `onGameStateChange` toggles mafia nav link visibility via `gs.mafia_active`
- `supabase-schema.sql` — MIGRATION v7 block appended

Database changes (applied live):

- `game_state.mafia_active BOOLEAN` column added (default false)
- `mafia_roles` table — one row per player per session; `CHECK (role IN ('spy','civilian'))`; UNIQUE `(user_id, session_id)`; RLS enabled (own row only)
- `mafia_actions` table — attack audit trail; RLS enabled (own attacks only)
- `start_mafia(session_id)` — randomly assigns 20% spy / 80% civilian to all session players; sets `mafia_active = true`
- `mafia_attack(target_student_id, session_id)` — SECURITY DEFINER; enforces alive check, 15-minute cooldown, self-target prevention, outcome matrix; awards/deducts points via direct SQL
- `get_mafia_feed(session_id, limit)` — SECURITY DEFINER; returns anonymised event strings without player identities
- `admin_get_mafia_state(session_id)` — returns full role table for admin panel only
- `admin_reset_mafia(session_id)` — deletes all roles and actions for the session, sets `mafia_active = false`

---

## update 11/5/26 — Arrow Hunt mini-game

New files:

- `public/js/games/arrow-hunt.js` — self-contained mini-game module: rotating log canvas game, container-scoped DOM, named event listener cleanup, `export function run(task, container, onComplete)` interface

Modified files:

- `public/css/task.css` — Arrow Hunt styles appended with `.ah-*` namespace; all `position:fixed` replaced with `position:absolute` so the game renders inside the task container
- `public/js/pages/task-page.js` — `arrow_hunt: '/js/games/arrow-hunt.js'` added to `GAME_MODULE_MAP`
- `public/js/admin/task-manager.js` — `'arrow_hunt'` added to `TASK_TYPES` (shows in the type dropdown when creating/editing tasks)
- `supabase-schema.sql` — MIGRATION v8 block appended

Database changes (applied live):

- `tasks` CHECK constraint on `type` column dropped and recreated to include `'arrow_hunt'`

Game behaviour:

- Player taps/clicks to fire arrows into a rotating log; arrows must not overlap
- Collision (arrow tips within `collision_tolerance` degrees) → wrong attempt counted, player retries internally without leaving the task page
- All arrows placed without collision → `onComplete({ correct: true, timeTakenSec, wrongAttempts, score })` — standard scoring formula applies
- `startTime` is set once when the game begins and is never reset on internal retries, so `timeTakenSec` covers the full attempt including any retries
- Full cleanup on exit: `cancelAnimationFrame`, event listener removal, score popup DOM cleanup

---

## update 13/5/26 — Tribe Finder task type

New files:

- `public/js/games/tribe-finder.js` — game module: assignment fetch on mount, tribe card display, `tribe_size - 1` student ID inputs, wrong-attempt cooldown countdown, success overlay, `export async function run(task, container, onComplete)`
- `public/js/db/tribe-finder.js` — DB layer: `getOrAssignTribe`, `submitTribeGroup`, `adminGetTribeState`, `adminResetTribe` (all call SECURITY DEFINER RPCs)
- `public/js/admin/tribe-finder-manager.js` — admin panel: tribe distribution table, full player table, per-task reset button

Modified files:

- `public/css/task.css` — Tribe Finder styles appended with `.tf__*` namespace
- `public/js/pages/task-page.js` — `tribe_finder: '/js/games/tribe-finder.js'` added to `GAME_MODULE_MAP`
- `public/js/admin/task-manager.js` — `'tribe_finder'` added to `TASK_TYPES` (shows in type dropdown)
- `public/js/pages/admin-page.js` — `'tribe-finder'` tab added, `case 'tribe-finder':` lazy import in `loadPanel`, `tabLabel` entry added
- `supabase-schema.sql` — MIGRATION v9 block appended

Database changes (applied live):

- `tribe_assignments` table — one row per player per task per session; UNIQUE `(user_id, task_id, session_id)`; RLS enabled (own row only); added to `supabase_realtime` publication
- `tribe_submissions` table — submission audit trail; RLS enabled (own rows only)
- `get_or_assign_tribe(task_id, session_id)` — SECURITY DEFINER; returns or creates tribe assignment; race-safe via `ON CONFLICT DO NOTHING`; returns cooldown remaining from last failed submission
- `submit_tribe_group(task_id, session_id, member_student_ids[])` — SECURITY DEFINER; validates all submitted IDs share the same tribe label; on wrong: deducts −50 pts via direct SQL + returns cooldown; on correct: marks all matched players `completed_at`
- `admin_get_tribe_state(task_id, session_id)` — returns full assignment table joined with user names for admin panel
- `admin_reset_tribe(task_id, session_id)` — deletes all assignments and submissions for the given task and session
- `tasks` CHECK constraint on `type` dropped and recreated to include `'tribe_finder'`

Game behaviour:

- Assignment is made on first access (not pre-loaded); tribe is kept secret until the player tells others themselves
- Wrong submission deducts points immediately server-side and starts a cooldown; player waits before retrying
- Correct submission marks submitter and all named members as completed in one RPC call
- Players found by others see an already-completed notice on re-entry; no double award

---

## analysis for new games 8:20am 11/5/26

Games Folder Architecture Analysis
The interface contract
Every game file exports exactly one function with an identical signature:


export function run(task, container, onComplete)
task — the full task row from Supabase (.config, .description, .time_limit_sec, .hint, etc.)
container — the <div id="game-container"> DOM node to render into
onComplete({ correct, timeTakenSec, wrongAttempts }) — called once when the game ends
That's the entire API. Games know nothing about users, sessions, Supabase, or scoring. task-page.js owns all of that after onComplete fires.

Is it modular enough to add new games?
Yes — with exactly 3 registration steps:

Step	File	What to change
1	task-page.js:18	Add entry to GAME_MODULE_MAP
2	task-manager.js:73	Add to TASK_TYPES array
3	supabase-schema.sql + live DB	ALTER TABLE tasks DROP CONSTRAINT ...; ALTER TABLE tasks ADD CHECK (type IN (..., 'new_type'))
Then create public/js/games/new-game.js and add styles to task.css. Nothing else changes — scoring, sessions, auth, leaderboard, vote gallery, attempts recording are all completely untouched.

What each game does and doesn't touch
Concern	Games	task-page.js	Notes
Supabase / DB	Never	Always	Games are pure DOM
Session ID	Never	Always	Fully isolated
Scoring formula	Never	Always	Games just pass time + wrong count
CSS	Own namespace	No	quiz__*, puzzle__*, memory__* etc.
Timer cleanup	Own setInterval	No	See concern below
What to be concerned about
1. The DB CHECK constraint is the hardest part


-- supabase-schema.sql line 23
type TEXT NOT NULL CHECK (type IN ('quiz','memory_match','fast_tap','puzzle','photo'))
PostgreSQL doesn't support ADD VALUE to a CHECK constraint — you have to drop and recreate it. If you add a new type to the JS but forget the migration, the admin will get a silent 23514 check_violation error when trying to create a task of that type. This is the only step that can't be done with a simple file edit.

2. esc() is duplicated across three files

puzzle.js and photo-challenge.js each define an identical local esc() function. quiz.js has the same thing named escQ(). ui.js already exports escapeHTML. It's harmless duplication but worth knowing when reading the code.

3. Memory and fast-tap don't honour a missing time_limit_sec the same way

memory-match.js line 17: task.time_limit_sec || 90 — if admin leaves the timer blank, memory match always runs for 90 seconds. There's no "no timer" mode.
fast-tap.js line 19: cfg.time_window_sec || (task.time_limit_sec || 15) — same pattern, defaults to 15 seconds.
quiz.js, puzzle.js: timer is genuinely optional — if (timeLimitSec > 0).
So if you add a new game, be deliberate about whether a missing time_limit_sec should mean no timer or a default timer.

4. No teardown/cleanup hook

Games start setInterval timers but there's no way for task-page.js to cancel them if the player navigates away mid-game (e.g. hits the browser back button). The intervals keep ticking until the tab is closed or garbage collected. For a one-day supervised event with short game durations this is harmless, but worth knowing for any longer-lived deployment.

5. The photo type has special handling in task-page.js


// task-page.js line 125
const { correct, timeTakenSec, wrongAttempts = 0, photoBlob } = result;
Photo is the only game that passes extra data back via onComplete. If you add a game that needs similar special output (e.g. a GPS coordinate, a drawn image, a recorded audio clip), you'd add a field to the onComplete payload and a corresponding handler block in task-page.js — the destructuring-with-defaults pattern makes this safe and non-breaking for all other games.

Adding a new game: what's affected vs. safe
Affected	Safe / untouched
task-page.js (GAME_MODULE_MAP + optional result handler)	scoring.js
task-manager.js (TASK_TYPES array)	attempts.js, users.js, all DB modules
task.css (new CSS classes)	Leaderboard, vote gallery, sessions
supabase-schema.sql + live DB (CHECK constraint migration)	Auth, router, admin panels other than task-manager
New games/your-game.js file	All existing game files
Bottom line: the system is clean and ready to extend. The one non-obvious friction point is the DB CHECK constraint — make a note to always include the schema migration when adding a new game type.

