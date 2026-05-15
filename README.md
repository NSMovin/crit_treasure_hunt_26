# Treasure Hunt Live

A production-tested, mobile-first web application for large-group university events. Supports QR-based challenge stations, real-time scoring, social deduction mini-games, and a live admin dashboard — with no backend servers.

---

## Live Event Summary

Treasure Hunt Live was deployed for the **ADS Department Tour 2026** at a live university event.

- 100+ concurrent participants on mobile devices
- Real-time leaderboard serving live score updates throughout the event
- Multiple active QR challenge stations running simultaneously
- Mafia Hunt and Tribe Finder social games operating in parallel with the main hunt
- Photo voting gallery with live vote counts and podium scoring
- Full moderation and ban controls used live by event organizers
- Zero downtime across the full event duration

---

## Features

- **QR challenge system** — scan a code, unlock a task, earn points
- **7 mini-game types** — quiz, memory match, fast tap, puzzle/riddle, photo, arrow hunt, tribe finder
- **Mafia Hunt side-game** — hidden role social deduction running in parallel
- **Photo voting gallery** — submit photos, vote anonymously, reveal results
- **Real-time leaderboard** — individual and team rankings with live updates
- **Admin dashboard** — 10-panel control center for full event management
- **Dual-layer moderation** — session bans (leaderboard filter) and game bans (block gameplay)
- **Live announcements** — push messages to all players instantly
- **Hint system** — per-task hints released on admin command
- **Session management** — multiple independent game sessions

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript (ES Modules) |
| Build | Vite |
| Auth | Supabase Anonymous Authentication |
| Database | Supabase PostgreSQL |
| Realtime | Supabase Realtime (postgres_changes) |
| Storage | Supabase Storage (photo uploads) |
| Hosting | Vercel |
| SDK | Supabase JS v2 (CDN UMD build) |

---

## Architecture Overview

```
Browser (Mobile / Desktop)
  └── Vercel CDN (static build from dist/)
        └── Vite-bundled ES modules
              ├── Supabase JS SDK (CDN)
              │     ├── Anonymous Auth
              │     ├── PostgreSQL (via REST + RPC)
              │     └── Realtime (WebSocket channels)
              └── Supabase Storage (photo uploads)
```

All business logic that touches scores, roles, or bans runs inside **SECURITY DEFINER** PostgreSQL functions. The frontend never writes directly to sensitive tables — every mutation goes through an RPC that validates `auth.uid()` server-side.

```
Client action
  → Supabase RPC (SECURITY DEFINER)
      → Row-Level Security policies
          → PostgreSQL tables
```

---

## Environment Variables

Three environment variables are required. Copy `.env.example` to `.env` and fill in your values.

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL — find in Project Settings → API |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon/public key — find in Project Settings → API |
| `VITE_ADMIN_PASSCODE` | Passcode for the `/admin.html` dashboard — keep strong and private |

> **Note on the anon key:** Supabase anon keys are intentionally public — they identify your project, not your identity. Row-Level Security policies enforce what anonymous users can and cannot access. Do **not** confuse the anon key with the service_role key; the service_role key bypasses all RLS and must never be in frontend code.

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone https://github.com/your-org/crit-treasure-hunt-26.git
cd crit-treasure-hunt-26
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Choose a region close to your event venue
3. Wait for initialization (~2 minutes)

### 4. Run the database schema

1. Supabase dashboard → **SQL Editor** → **New query**
2. Paste the full contents of `supabase-schema.sql`
3. Click **Run** — this creates all tables, RLS policies, realtime subscriptions, and RPCs

### 5. Create the photos Storage bucket

1. Supabase dashboard → **Storage** → **New bucket**
2. Name: `photos` | Public: **ON**
3. In SQL Editor, run the storage policy lines at the bottom of `supabase-schema.sql`

### 6. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your Supabase URL, anon key, and a strong admin passcode.

### 7. Run locally

```bash
npm run dev
```

The dev server starts at `http://localhost:5173`.

### 8. Verify realtime

Supabase dashboard → **Database** → **Replication** — confirm `users`, `tasks`, `announcements`, and `game_state` appear under the `supabase_realtime` publication.

If any are missing:
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE users;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE announcements;
ALTER PUBLICATION supabase_realtime ADD TABLE game_state;
```

---

## Deployment — Vercel

### Option A: Git integration (recommended)

1. Push your repository to GitHub
2. Go to [vercel.com](https://vercel.com) → **New Project** → import the repo
3. In **Environment Variables**, add all three variables from your `.env`:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_ADMIN_PASSCODE`
4. Click **Deploy** — Vercel runs `npm run build` and serves `dist/`

### Option B: Vercel CLI

```bash
npm install -g vercel
vercel login
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_ANON_KEY
vercel env add VITE_ADMIN_PASSCODE
vercel --prod
```

> **Important:** Environment variables must be set in the Vercel dashboard before deploying. Without them, the build succeeds but `import.meta.env.*` values will be `undefined` at runtime.

---

## Pre-Event Checklist

### Before participants arrive

1. Open `https://your-project.vercel.app/admin.html`
2. Enter your admin passcode
3. **Sessions** → create a new session for the event
4. **Settings** → set valid team names (one per line) → Save
5. **Tasks** → create all task stations (see Game Systems below for config formats)
6. Print QR codes:
   - Public tasks: `https://your-project.vercel.app/task.html?id=<task_id>`
   - QR-locked tasks: `https://your-project.vercel.app/unlock.html?task=<task_id>`
7. Keep game paused (Settings → **Game Active = OFF**) until start time

### During the event

1. **Activate Game** in Settings
2. Activate individual tasks when stations are ready
3. Release hints from the Hints panel as needed
4. Send live announcements to all players
5. Monitor players in the Players panel
6. Watch the live leaderboard at `/leaderboard.html`

---

## Game Systems

### Mini-Games

All mini-games implement the same interface: `export function run(task, container, onComplete)`. The `task-page.js` orchestrator handles auth, scoring, and DB writes after `onComplete` fires. Games know nothing about users or sessions.

#### Quiz

Single question or chained multi-question format. Wrong answers count toward the penalty formula.

```json
{
  "questions": [
    {
      "question": "What does AI stand for?",
      "options": ["Artificial Intelligence", "Automated Internet", "Advanced Interface", "Algorithmic Input"],
      "correct_index": 0
    }
  ]
}
```

Single-question shorthand (omit `questions` array):
```json
{
  "question": "What year was this university founded?",
  "options": ["1990", "1998", "2002", "2010"],
  "correct_index": 1
}
```

#### Memory Match

Find all matching pairs. Defaults to 6 pairs in a 4-column grid.

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

#### Fast Tap

Tap only the target color, as fast as possible.

```json
{
  "target_color": "#e74c3c",
  "distractors": ["#3498db", "#2ecc71", "#f39c12"],
  "tap_count": 10,
  "time_window_sec": 15
}
```

#### Puzzle / Riddle

Set the riddle text in the task `description` field. Answer is checked server-free (client-side string comparison).

```json
{
  "answer": "fibonacci",
  "case_sensitive": false,
  "allow_partial": false
}
```

#### Photo Challenge

Player takes or uploads a photo. Photo is compressed client-side (≤150 KB) then uploaded to Supabase Storage.

```json
{
  "prompt": "Take a selfie in front of the main fountain!"
}
```

#### Arrow Hunt

Canvas mini-game. A rotating log spins on screen — tap to fire arrows. Arrows must not overlap. When all arrows are placed cleanly, the task is won.

```json
{
  "target_rotation_speed": 1.8,
  "arrow_count": 10,
  "speed_increase_per_arrow": 0.18,
  "collision_tolerance": 12,
  "reverse_at_arrow": 5
}
```

All fields are optional. Omit the config block entirely (`{}`) to use the defaults above.

| Field | Default | Effect |
|---|---|---|
| `target_rotation_speed` | `1.8` | Degrees per frame at start |
| `arrow_count` | `10` | Arrows required to win |
| `speed_increase_per_arrow` | `0.18` | Speed added per arrow stuck |
| `collision_tolerance` | `12` | Min degrees between arrow tips |
| `reverse_at_arrow` | `5` | Log reverses direction at this arrow |

#### Tribe Finder

Social deduction task. Players are secretly assigned to hidden tribes and must find their group members through real-world conversation, then submit everyone's student IDs for server validation.

```json
{
  "tribe_size": 4,
  "tribe_labels": ["Phoenix", "Kraken", "Titan", "Nova", "Shadow", "Eclipse"],
  "cooldown_minutes": 2
}
```

| Field | Default | Effect |
|---|---|---|
| `tribe_size` | `4` | Total players per tribe, including the submitter |
| `tribe_labels` | 6 labels (Phoenix … Eclipse) | Tribe names shown to players |
| `cooldown_minutes` | `2` | Wait after a wrong submission |

**How it works:**
1. Player scans QR → server assigns them to the tribe with fewest members (race-safe)
2. Player sees their tribe name but not who else is in it
3. They must find `tribe_size - 1` other participants and ask for their student IDs
4. They submit those IDs — server validates every ID belongs to a player in the same tribe
5. Wrong group → −50 pts applied immediately, cooldown starts
6. Correct group → all matched players marked completed; standard scoring applies

Players who are found by someone else's correct submission are auto-completed — they do not need to submit separately.

**Admin monitoring:** Admin → 🏕️ Tribe Finder shows tribe distribution, all player assignments, and completion status. Use **Reset** to clear a task and start fresh.

---

### Mafia Hunt

Hidden-role side-game running in parallel with the main treasure hunt. Players secretly play as Spies or Civilians and try to deduce or eliminate each other. Results directly affect the main leaderboard.

| Role | Proportion | Objective |
|---|---|---|
| 🕵️ Spy | ~20% | Eliminate civilians without being exposed |
| 👤 Civilian | ~80% | Identify and expose spies |

**Attack outcomes:**

| Attacker | Target | Result | Points |
|---|---|---|---|
| Spy | Civilian | Civilian eliminated | Spy +100 |
| Spy | Spy | Attacker exposed and eliminated | Attacker −75 |
| Civilian | Spy | Spy exposed and eliminated | Civilian +100 |
| Civilian | Civilian | Target eliminated, wrong guess | Attacker −75 |

15-minute cooldown enforced server-side between attacks. Eliminated players keep all treasure hunt points and continue earning them — they just cannot attack or be attacked.

**Admin controls:** Admin → 🕵️ Mafia Hunt → Start / End / Reset. The admin panel shows all roles, alive status, and kill counts.

---

### Photo Voting

After photo challenge tasks complete:
1. Admin → 📸 Voting → **Open Voting**
2. A Vote link appears in all players' nav bars
3. Players visit `/vote.html` — author names are hidden during voting
4. Each player gets one vote per session; own photo is disabled
5. Admin → **Close Voting & Award Bonuses** — the `award_vote_bonuses` RPC runs:
   - +50 participation bonus (everyone who voted)
   - +10 × vote count (per photo submitter)
   - +100 / +60 / +30 podium bonus (top 3 vote-getters)
   - Gallery reveals author names and vote totals

Voting bonuses are configurable in `app-settings.js → voting`.

---

## Scoring Formula

### Task completion

```
Final Score = base_points + speed_bonus + first_solver_bonus − wrong_attempt_penalty
```

| Component | Default |
|---|---|
| `base_points` | Set per task in admin |
| `speed_bonus` | Up to 50% of base, proportional to time remaining |
| `first_solver_bonus` | +50 pts flat |
| `wrong_attempt_penalty` | −10 pts per wrong attempt |

All values configurable in `public/js/app-settings.js → scoring`.

---

## Admin Features

Access at `/admin.html` → enter passcode (set via `VITE_ADMIN_PASSCODE` env var).

| Panel | Purpose |
|---|---|
| 📋 Tasks | Create, edit, activate/deactivate tasks; release hints |
| 👥 Players | Monitor all players, scores, and activity |
| 📢 Announcements | Push live messages to all players |
| 💡 Hints | Per-task hint release toggle |
| ⚙️ Settings | Game active toggle, end time, valid team names |
| 🎮 Sessions | Create and manage independent game sessions |
| 📸 Voting | Open/close voting; award bonuses |
| 🕵️ Mafia Hunt | Start/end Mafia mode; view all roles live |
| 🏕️ Tribe Finder | Monitor tribe assignments and completions; reset tasks |
| 🛡️ Moderation | Search players; apply session bans or game bans; reset scores |

**Moderation system — two ban layers:**
- **Session ban** — hides the player from the leaderboard for the current session; gameplay continues (scores preserved for admin review)
- **Game ban** — globally blocks the player from all scoring actions and mini-game submissions; enforced by RLS and server RPCs

---

## Database Schema

### Core tables

| Table | Purpose |
|---|---|
| `users` | Player profiles: name, student ID, team, total score |
| `tasks` | Task definitions with type, config JSON, points, hints |
| `attempts` | Completion audit trail: result, score delta, time taken |
| `session_scores` | Per-session scores (separate from global `users.score`) |
| `game_sessions` | Independent game sessions |
| `game_state` | Single-row global state (active session, voting open, mafia active) |
| `announcements` | Live messages pushed to all players |
| `unlocked_tasks` | QR-scanned unlocks per player per session |
| `photo_votes` | One vote per player per session |
| `mafia_roles` | Spy / Civilian assignments per session (RLS: own row only) |
| `mafia_actions` | Attack audit trail with 15-minute cooldown enforcement |
| `tribe_assignments` | Tribe assignments per player per task per session |
| `tribe_submissions` | Submission audit trail for cooldown enforcement |
| `session_players` | Session ban flags per player per session |

### Key RPCs (all SECURITY DEFINER)

| RPC | Purpose |
|---|---|
| `add_score` | Awards task points; validates caller identity; enforces game ban |
| `claim_first_solver` | Race-safe first-solver claim with `FOR UPDATE` lock |
| `mafia_attack` | Resolves attack, enforces cooldown and alive checks |
| `get_or_assign_tribe` | Returns or creates tribe assignment; race-safe |
| `submit_tribe_group` | Validates tribe group; applies penalty or marks completion |
| `award_vote_bonuses` | Batch-awards photo voting bonuses in one transaction |
| `admin_set_game_ban` | Sets global gameplay ban on a user |
| `admin_set_session_ban` | Sets session-scoped leaderboard ban |

---

## Security Notes

**Supabase anon key** — intentionally public. Supabase is designed for client-side anon keys; all access control is enforced by Row-Level Security policies in PostgreSQL.

**Admin passcode** — stored in `VITE_ADMIN_PASSCODE`, injected at build time by Vite. This provides basic access control for a supervised single-day event. For a permanent deployment, replace with Supabase Auth-based admin roles.

**Score integrity** — all score mutations go through SECURITY DEFINER RPCs that verify `auth.uid()` on the server. Players cannot award points to themselves or others directly.

**Moderation enforcement** — game bans are checked inside `add_score`, `mafia_attack`, `submit_tribe_group`, and `get_or_assign_tribe`. Even if a banned player bypasses the client-side check, the RPC rejects the action.

**Secret rotation checklist** — do this before each new event:
- [ ] Generate a new admin passcode and update `VITE_ADMIN_PASSCODE` in Vercel
- [ ] If the Supabase project is shared, rotate the anon key in Project Settings → API
- [ ] Confirm `.env` is in `.gitignore` and has never been committed (`git log --all -- .env`)

---

## Screenshots

> Screenshots from the ADS Department Tour 2026 event will be added here.

| | |
|---|---|
| Leaderboard (live) | *(placeholder)* |
| Task UI — Quiz | *(placeholder)* |
| Task UI — Arrow Hunt | *(placeholder)* |
| Task UI — Tribe Finder | *(placeholder)* |
| Admin Dashboard | *(placeholder)* |
| Photo Voting Gallery | *(placeholder)* |
| Mafia Hunt player page | *(placeholder)* |

---

## Project Structure

```
crit_treasure_hunt_26/
├── package.json             # Vite dev/build scripts
├── vite.config.js           # Vite config: root=public, all HTML entry points
├── vercel.json              # Vercel build + output config
├── .env.example             # Environment variable template
├── supabase-schema.sql      # Full DB schema (run once in Supabase SQL Editor)
│
└── public/                  # Vite root — all pages served from here
    ├── index.html           # Sign-in and profile setup
    ├── game.html            # Player dashboard (task list, score)
    ├── task.html            # Task runner (QR codes land here)
    ├── unlock.html          # QR landing page → unlocks task
    ├── leaderboard.html     # Real-time leaderboard (public)
    ├── vote.html            # Community photo voting gallery
    ├── mafia.html           # Mafia Hunt player page
    ├── admin.html           # Admin dashboard (passcode-gated)
    ├── 404.html             # Custom 404 page
    │
    ├── css/
    │   ├── base.css         # Design tokens + reset
    │   ├── components.css   # Buttons, inputs, toasts, modals
    │   ├── layout.css       # Header, nav, announcements
    │   ├── game.css         # Player dashboard styles
    │   ├── task.css         # Task runner + all mini-game styles
    │   ├── leaderboard.css
    │   ├── vote.css
    │   ├── mafia.css
    │   └── admin.css
    │
    └── js/
        ├── supabase-client.js   # Supabase init (uses VITE_SUPABASE_* env vars)
        ├── app-settings.js      # Event config + scoring constants
        ├── auth.js              # Anonymous auth + profile management
        ├── router.js            # Auth guards + page redirects
        ├── scoring.js           # Score formula (pure, no side effects)
        ├── image-compress.js    # Canvas-based photo compression
        ├── storage.js           # Supabase Storage photo upload
        ├── ui.js                # Toast, modal, spinner, escapeHTML
        │
        ├── db/                  # Supabase query modules
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
        │   ├── tribe-finder.js
        │   └── moderation.js
        │
        ├── games/               # Mini-game modules (run/onComplete contract)
        │   ├── quiz.js
        │   ├── memory-match.js
        │   ├── fast-tap.js
        │   ├── puzzle.js
        │   ├── photo-challenge.js
        │   ├── arrow-hunt.js
        │   └── tribe-finder.js
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
            ├── tribe-finder-manager.js
            └── moderation-manager.js
```

### Adding a new mini-game (3 steps)

1. **`task-page.js`** — add an entry to `GAME_MODULE_MAP`
2. **`admin/task-manager.js`** — add the type string to `TASK_TYPES`
3. **`supabase-schema.sql` + live DB** — drop and recreate the `tasks_type_check` CHECK constraint to include the new type

Then create `public/js/games/your-game.js` and add CSS to `task.css`. No other files need to change.

---

## Post-Event Data Export

```bash
pip install supabase pandas
```

```python
from supabase import create_client
import pandas as pd

# Use the service_role key (never the anon key) for full data access
sb = create_client('https://YOUR_PROJECT.supabase.co', 'YOUR_SERVICE_ROLE_KEY')

for name in ['users', 'tasks', 'attempts', 'session_scores']:
    rows = sb.table(name).select('*').execute().data
    pd.DataFrame(rows).to_csv(f'{name}.csv', index=False)
    print(f"Exported {len(rows)} rows → {name}.csv")
```

---

## Crit-Team Contributors

| Name | Role |
|---|---|
| Naeem Shovon Shuvro (261035005) | Lead Developer |
| Shovon Chowdhury (261035044) | Lead Developer |
| — | UI / UX Design |
| Mahbub Alam Masum (261035004) | Event Coordination |
| — | QA / Testing |

---

## License

MIT — free for educational and non-commercial use.