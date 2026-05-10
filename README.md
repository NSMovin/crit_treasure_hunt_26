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
    ├── leaderboard.html         # Real-time leaderboard (public)
    ├── admin.html               # Admin dashboard (passcode-gated)
    │
    ├── css/
    │   ├── base.css             # Reset + design tokens
    │   ├── components.css       # Buttons, inputs, toast, modal
    │   ├── layout.css           # Header, nav, announcements
    │   ├── game.css             # Player dashboard styles
    │   ├── task.css             # Task runner + all mini-games
    │   ├── leaderboard.css      # Leaderboard styles
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
        │   └── game-state.js
        │
        ├── games/               # Mini-game implementations
        │   ├── quiz.js
        │   ├── memory-match.js
        │   ├── fast-tap.js
        │   ├── puzzle.js
        │   └── photo-challenge.js
        │
        ├── pages/               # Page-level controllers
        │   ├── index-page.js
        │   ├── game-page.js
        │   ├── task-page.js
        │   ├── leaderboard-page.js
        │   └── admin-page.js
        │
        └── admin/               # Admin panel sub-modules
            ├── task-manager.js
            ├── announcement-manager.js
            ├── player-monitor.js
            └── hint-manager.js
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

### Quiz

```json
{
  "question": "What year was this university founded?",
  "options": ["1990", "1998", "2002", "2010"],
  "correct_index": 1
}
```

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

---

## Scoring Formula

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
| type | TEXT | quiz / memory_match / fast_tap / puzzle / photo |
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



