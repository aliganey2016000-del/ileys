/*
# Create course_completions table

## Purpose
Records when a student completes a course, enabling certificate generation
and completion history tracking. Each completion gets a unique, verifiable
certificate ID.

## New Tables

### `course_completions`
| Column          | Type        | Description                                       |
|-----------------|-------------|---------------------------------------------------|
| id              | uuid PK     | Primary key                                       |
| student_id      | uuid FK     | References profiles(id), cascade on delete        |
| course_id       | uuid FK     | References courses(id), cascade on delete         |
| completed_at    | timestamptz | When the course was completed                    |
| certificate_id  | text UNIQUE | Human-readable verification code (e.g. LR-XXXX)  |
| xp_awarded      | integer     | XP bonus given for completion                     |

## Security (RLS)
- Enabled; only the owning student can read their completions.
- Any authenticated user may insert (completion is recorded client-side).
- No update/delete from client — completions are immutable history.
*/

CREATE TABLE IF NOT EXISTS course_completions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id      uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  completed_at   timestamptz NOT NULL DEFAULT now(),
  certificate_id text UNIQUE NOT NULL DEFAULT concat('LR-', upper(substr(md5(random()::text), 1, 8))),
  xp_awarded     integer NOT NULL DEFAULT 0,
  UNIQUE(student_id, course_id)
);

ALTER TABLE course_completions ENABLE ROW LEVEL SECURITY;

-- Students can read their own completions
DROP POLICY IF EXISTS "select_own_completions" ON course_completions;
CREATE POLICY "select_own_completions" ON course_completions
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- Any authenticated user may insert (progress tracking runs client-side)
DROP POLICY IF EXISTS "insert_own_completions" ON course_completions;
CREATE POLICY "insert_own_completions" ON course_completions
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = student_id);

-- No update or delete — completions are immutable

-- Index for quick lookup by student and course
CREATE INDEX IF NOT EXISTS idx_course_completions_student_course
  ON course_completions (student_id, course_id);
