-- Fix RLS policies on quiz_questions and quiz_options
-- Problem: No DELETE or UPDATE policies existed, so editing/re-saving quizzes failed silently.
-- Also: admins should be able to manage all quiz content, not just the original creator.

-- ── quiz_questions: DELETE policy ──
DROP POLICY IF EXISTS delete_questions_teachers ON quiz_questions;
CREATE POLICY delete_questions_teachers ON quiz_questions FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_questions.quiz_id
        AND (quizzes.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM profiles
               WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
             ))
    )
  );

-- ── quiz_questions: UPDATE policy ──
DROP POLICY IF EXISTS update_questions_teachers ON quiz_questions;
CREATE POLICY update_questions_teachers ON quiz_questions FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_questions.quiz_id
        AND (quizzes.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM profiles
               WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
             ))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_questions.quiz_id
        AND (quizzes.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM profiles
               WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
             ))
    )
  );

-- ── quiz_questions: relax INSERT to allow admins too ──
DROP POLICY IF EXISTS insert_questions_teachers ON quiz_questions;
CREATE POLICY insert_questions_teachers ON quiz_questions FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM quizzes
      WHERE quizzes.id = quiz_questions.quiz_id
        AND (quizzes.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM profiles
               WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
             ))
    )
  );

-- ── quiz_options: DELETE policy ──
DROP POLICY IF EXISTS delete_options_teachers ON quiz_options;
CREATE POLICY delete_options_teachers ON quiz_options FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM quiz_questions q
      JOIN quizzes cz ON cz.id = q.quiz_id
      WHERE q.id = quiz_options.question_id
        AND (cz.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM profiles
               WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
             ))
    )
  );

-- ── quiz_options: UPDATE policy ──
DROP POLICY IF EXISTS update_options_teachers ON quiz_options;
CREATE POLICY update_options_teachers ON quiz_options FOR UPDATE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM quiz_questions q
      JOIN quizzes cz ON cz.id = q.quiz_id
      WHERE q.id = quiz_options.question_id
        AND (cz.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM profiles
               WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
             ))
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_questions q
      JOIN quizzes cz ON cz.id = q.quiz_id
      WHERE q.id = quiz_options.question_id
        AND (cz.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM profiles
               WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
             ))
    )
  );

-- ── quiz_options: relax INSERT to allow admins too ──
DROP POLICY IF EXISTS insert_options_teachers ON quiz_options;
CREATE POLICY insert_options_teachers ON quiz_options FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM quiz_questions q
      JOIN quizzes cz ON cz.id = q.quiz_id
      WHERE q.id = quiz_options.question_id
        AND (cz.created_by = auth.uid()
             OR EXISTS (
               SELECT 1 FROM profiles
               WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
             ))
    )
  );
