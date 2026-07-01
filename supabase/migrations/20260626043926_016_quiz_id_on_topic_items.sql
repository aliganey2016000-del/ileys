-- Link course_topic_items quiz cards to the quizzes table
ALTER TABLE public.course_topic_items
  ADD COLUMN IF NOT EXISTS quiz_id UUID REFERENCES public.quizzes(id) ON DELETE SET NULL;