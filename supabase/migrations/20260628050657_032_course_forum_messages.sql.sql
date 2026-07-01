/*
# Add created_by to courses + Course Forum Messages Table

## Purpose
1. Adds a `created_by` column to `courses` so we can identify the teacher who
   owns each course (needed for course-forum membership checks).
2. Adds a per-course discussion forum (`course_forum_messages`) so that students
   enrolled in a specific course, the course's teacher, and admins can chat
   together about that course. This is separate from the platform-wide community
   chat — each course gets its own private discussion scoped to its members.

## Modified Table

### `courses`
- `created_by` (uuid, nullable) — references profiles(id), cascade on delete.
  Nullable for backward compatibility with existing courses.

## New Table

### `course_forum_messages`
Stores chat messages scoped to a single course.

| Column       | Type        | Description                                                        |
|--------------|-------------|--------------------------------------------------------------------|
| id           | uuid PK     | Row identifier                                                     |
| course_id    | uuid FK     | References courses(id), cascade on delete                          |
| user_id      | uuid FK     | References profiles(id), cascade on delete (message author)        |
| content      | text        | Message body, 1–2000 chars                                         |
| created_at   | timestamptz | Server-assigned creation timestamp                                 |
| updated_at   | timestamptz | Updated timestamp (for edits), nullable                            |
| parent_id    | uuid FK     | Optional reply reference (self-referencing), cascade on delete     |

## Security (RLS)
- RLS enabled; table is locked to authenticated users.
- SELECT: allowed for course members — enrolled students, the course teacher,
  or any admin.
- INSERT: same membership check; author must be the authenticated user.
- UPDATE: only the message author can edit their own message.
- DELETE: only the message author can delete their own message.

Membership is determined by:
  1. Admin (profiles.role = 'admin') — full access to all course forums.
  2. Teacher — the course was created by this user (courses.created_by).
  3. Student — has a row in course_enrollments for this course.

## Indexes
- `idx_course_forum_messages_course_created` — speeds up per-course ordered fetch.
- `idx_course_forum_messages_user_id` — speeds up author-based queries.

## Realtime
- Table is added to the `supabase_realtime` publication so new messages appear
  instantly without polling.
*/

-- 1. Add created_by to courses
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'courses' AND column_name = 'created_by'
  ) THEN
    ALTER TABLE courses ADD COLUMN created_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 2. Create course_forum_messages table
CREATE TABLE course_forum_messages (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id   uuid        NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  parent_id   uuid        REFERENCES course_forum_messages(id) ON DELETE CASCADE
);

CREATE INDEX idx_course_forum_messages_course_created
  ON course_forum_messages (course_id, created_at ASC);
CREATE INDEX idx_course_forum_messages_user_id
  ON course_forum_messages (user_id);

ALTER TABLE course_forum_messages ENABLE ROW LEVEL SECURITY;

-- Helper: a user is a "course member" if they are admin, the course teacher,
-- or enrolled in the course.
CREATE OR REPLACE FUNCTION is_course_member(p_course_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id AND role = 'admin')
    OR
    EXISTS (SELECT 1 FROM courses WHERE id = p_course_id AND created_by = p_user_id)
    OR
    EXISTS (
      SELECT 1 FROM course_enrollments
      WHERE course_id = p_course_id AND student_id = p_user_id
    )
$$;

-- SELECT: course members can read
DROP POLICY IF EXISTS "course_forum_select_members" ON course_forum_messages;
CREATE POLICY "course_forum_select_members" ON course_forum_messages
  FOR SELECT TO authenticated
  USING (is_course_member(course_id, auth.uid()));

-- INSERT: course members can post; author must be self
DROP POLICY IF EXISTS "course_forum_insert_own" ON course_forum_messages;
CREATE POLICY "course_forum_insert_own" ON course_forum_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND is_course_member(course_id, auth.uid()));

-- UPDATE: only author can edit own message
DROP POLICY IF EXISTS "course_forum_update_own" ON course_forum_messages;
CREATE POLICY "course_forum_update_own" ON course_forum_messages
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- DELETE: only author can delete own message
DROP POLICY IF EXISTS "course_forum_delete_own" ON course_forum_messages;
CREATE POLICY "course_forum_delete_own" ON course_forum_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE course_forum_messages;
