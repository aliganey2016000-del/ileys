-- Add listen_write to quiz_questions question_type check constraint
ALTER TABLE public.quiz_questions
  DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check;

ALTER TABLE public.quiz_questions
  ADD CONSTRAINT quiz_questions_question_type_check
  CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank', 'matching_pair', 'listening', 'ordering', 'listen_write'));
