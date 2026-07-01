/*
# User presence + activity log

## Purpose
Gives admins a complete, real-time picture of what every student is doing:
  1. Who is online right now vs. offline (presence heartbeat).
  2. A bit-by-bit activity timeline per student (login, lesson opened,
     quiz started, quiz submitted, course enrolled, etc.).
  3. A single source of truth the admin "Activity Report" page reads from.

## New Tables

### `user_presence`
One row per user. Updated on a heartbeat (every ~60s) while the app is open,
and on login/logout. A user is considered "online" if `last_seen_at` is within
the last 2 minutes.

| column            | type        | description                                         |
|-------------------|-------------|-----------------------------------------------------|
| id                | uuid PK     | Row id                                              |
| user_id           | uuid UNIQUE | References auth.users, cascade on delete            |
| is_online         | boolean     | Best-effort online flag (true on heartbeat)          |
| last_seen_at      | timestamptz | Last heartbeat / activity timestamp                 |
| last_activity     | text        | Short human label of the last action ("Quiz: ABC")  |
| last_page         | text        | Last route/page the user was on                     |
| session_started_at| timestamptz | When the current session began (login)              |
| updated_at        | timestamptz | Row update timestamp                                |

### `activity_log`
Append-only event log. Every meaningful student action inserts a row here,
giving the admin a bit-by-bit timeline ("10:01 logged in", "10:03 opened quiz",
"10:07 submitted quiz 80%", etc.).

| column      | type        | description                                              |
|-------------|-------------|----------------------------------------------------------|
| id          | uuid PK     | Row id                                                   |
| user_id     | uuid FK     | References auth.users, cascade on delete                 |
| action      | text        | Event type: login | logout | lesson_open | lesson_complete |
|             |             |   quiz_start | quiz_submit | course_enroll | course_complete       |
|             |             |   page_view | arena_join | forum_post | study_session         |
| description | text        | Human-readable summary ("Quiz 'ABC' — 80% (passed)")     |
| page        | text        | Route/page key where the action happened                 |
| metadata    | jsonb       | Extra context (quiz_id, score, course_id, etc.)          |
| created_at  | timestamptz | Server-assigned event timestamp                          |

## Security (RLS)
- `user_presence`: authenticated users can read all presence rows (so the
  admin dashboard and student lists work); a user can upsert only their own
  row. No deletes from the client.
- `activity_log`: authenticated users can read all rows (admin report);
  any authenticated user can INSERT (so client-side actions can log
  themselves); no updates or deletes — the log is append-only.

## Indexes
- `idx_user_presence_online` — fast "who is online" query.
- `idx_activity_log_user_created` — per-user timeline.
- `idx_activity_log_created` — global recent-activity feed.
*/

-- ── user_presence ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_presence (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online          boolean     NOT NULL DEFAULT false,
  last_seen_at       timestamptz NOT NULL DEFAULT now(),
  last_activity      text        NOT NULL DEFAULT '',
  last_page          text        NOT NULL DEFAULT '',
  session_started_at timestamptz NULL,
  updated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_presence ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_presence_online
  ON user_presence (is_online, last_seen_at DESC);

-- Everyone authenticated can read presence (admin dashboard + student lists)
DROP POLICY IF EXISTS "select_user_presence" ON user_presence;
CREATE POLICY "select_user_presence" ON user_presence
  FOR SELECT TO authenticated USING (true);

-- A user can upsert only their own presence row
DROP POLICY IF EXISTS "upsert_own_presence" ON user_presence;
CREATE POLICY "upsert_own_presence" ON user_presence
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "update_own_presence" ON user_presence;
CREATE POLICY "update_own_presence" ON user_presence
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── activity_log ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action      text        NOT NULL,
  description text        NOT NULL DEFAULT '',
  page        text        NOT NULL DEFAULT '',
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_activity_log_user_created
  ON activity_log (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_created
  ON activity_log (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_activity_log_action
  ON activity_log (action, created_at DESC);

-- Everyone authenticated can read the activity log (admin report)
DROP POLICY IF EXISTS "select_activity_log" ON activity_log;
CREATE POLICY "select_activity_log" ON activity_log
  FOR SELECT TO authenticated USING (true);

-- Any authenticated user can insert their own activity events
DROP POLICY IF EXISTS "insert_activity_log" ON activity_log;
CREATE POLICY "insert_activity_log" ON activity_log
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Append-only: no updates or deletes from the client
