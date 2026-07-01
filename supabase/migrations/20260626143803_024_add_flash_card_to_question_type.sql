-- Add flash_card to the question_type check constraint
ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_question_type_check;
ALTER TABLE quiz_questions ADD CONSTRAINT quiz_questions_question_type_check CHECK (
  question_type = ANY (ARRAY[
    'multiple_choice'::text,
    'true_false'::text,
    'fill_blank'::text,
    'matching_pair'::text,
    'listening'::text,
    'ordering'::text,
    'listen_write'::text,
    'flash_card'::text
  ])
);