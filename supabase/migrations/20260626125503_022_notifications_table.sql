/*
# Create notifications table

## Purpose
Adds an in-app notification system so users receive real-time alerts for
key platform events: achievement unlocks, level-ups, quiz results, arena
invites/results, new content published by teachers, and system messages.

## New Tables

### `notifications`
Stores one notification row per recipient user.

| Column       | Type        | Description                                                  |
|--------------|-------------|--------------------------------------------------------------|
| id           | uuid PK     | Row identifier                                               |
| user_id      | uuid FK     | Recipient — references auth.users, cascade on delete         |
| type         | text        | Category: achievement | level_up | quiz_passed | arena_invite |
|              |             |   arena_result | course_complete | lesson_published | system      |
| title        | text        | Short headline shown in the notification                     |
| body         | text        | Full detail / supporting sentence                            |
| icon         | text        | Lucide icon name or emoji used by the UI                     |
| action_page  | text NULL   | Nav key to jump to when the notification is tapped           |
| is_read      | boolean     | False until the user dismisses or opens the notification     |
| created_at   | timestamptz | Server-assigned creation timestamp                           |

## Security (RLS)
- RLS enabled; table is locked to authenticated users.
- SELECT / UPDATE / DELETE: only the recipient (`auth.uid() = user_id`).
- INSERT: any authenticated user may create a notification for any recipient.
  This allows client-side gamification code (running as the student) to create
  self-notifications, AND allows teacher/admin dashboards to push notifications
  to students without a separate edge function.

## Index
- `idx_notifications_user_id_created_at` — speeds up the per-user ordered fetch.
- `idx_notifications_user_id_unread`     — speeds up the unread-count query.
*/

CREATE TABLE IF NOT EXISTS notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL DEFAULT 'system',
  title       text        NOT NULL,
  body        text        NOT NULL DEFAULT '',
  icon        text        NOT NULL DEFAULT 'Bell',
  action_page text        NULL,
  is_read     boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_created_at
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id_unread
  ON notifications (user_id, is_read)
  WHERE is_read = false;

-- Each user can read their own notifications
DROP POLICY IF EXISTS "select_own_notifications" ON notifications;
CREATE POLICY "select_own_notifications" ON notifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Any authenticated user may insert a notification (client-side gamification + teacher/admin push)
DROP POLICY IF EXISTS "insert_notifications" ON notifications;
CREATE POLICY "insert_notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Only the recipient may mark a notification read
DROP POLICY IF EXISTS "update_own_notifications" ON notifications;
CREATE POLICY "update_own_notifications" ON notifications
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Only the recipient may delete their notifications
DROP POLICY IF EXISTS "delete_own_notifications" ON notifications;
CREATE POLICY "delete_own_notifications" ON notifications
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);
