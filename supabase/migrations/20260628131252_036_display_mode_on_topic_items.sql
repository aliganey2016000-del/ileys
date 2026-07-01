ALTER TABLE public.course_topic_items
  ADD COLUMN IF NOT EXISTS display_mode text NOT NULL DEFAULT 'classic';

ALTER TABLE public.course_topic_items
  DROP CONSTRAINT IF EXISTS valid_topic_item_display_mode;

ALTER TABLE public.course_topic_items
  ADD CONSTRAINT valid_topic_item_display_mode
  CHECK (display_mode IN ('classic', 'interactive'));
