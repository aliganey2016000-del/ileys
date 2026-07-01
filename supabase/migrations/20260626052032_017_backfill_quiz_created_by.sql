-- Backfill created_by on quizzes that were inserted without it.
-- The RLS policy on quiz_questions requires quizzes.created_by = auth.uid(),
-- so questions could not be inserted for these quizzes.
-- We set created_by to the most recent admin/teacher profile.

UPDATE quizzes
SET created_by = (
  SELECT id FROM profiles
  WHERE role IN ('admin', 'teacher')
  ORDER BY created_at DESC
  LIMIT 1
)
WHERE created_by IS NULL;
