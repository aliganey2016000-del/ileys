/*
# Add Lesson Display Mode (Classic/Interactive) and Block Progress Tracking

## Purpose
This migration adds support for two lesson display modes:
1. **Classic Mode**: Students read the entire lesson as a continuous page (traditional scroll experience)
2. **Interactive Mode**: Lessons are broken into blocks with step-by-step progression and quiz verification

## Changes

### 1. Lessons Table - Add Display Mode
- Added `display_mode` column (text) with values: 'classic' or 'interactive'
- Default is 'classic' to maintain backward compatibility
- Added constraint to ensure valid display mode values

### 2. Lesson Block Progress Table (NEW)
- `lesson_block_progress`: Tracks student progress through interactive lesson blocks
- Columns:
  - `id`: UUID primary key
  - `student_id`: Reference to profiles (student taking the lesson)
  - `lesson_id`: Reference to the lesson
  - `current_block_index`: Current block position (0-indexed)
  - `completed_blocks`: JSONB array of completed block IDs
  - `block_answers`: JSONB object storing student answers per block
  - `completed`: Boolean indicating if lesson is finished
  - `completed_at`: Timestamp of completion
  - `updated_at`: Last update timestamp
- Unique constraint on (student_id, lesson_id) to prevent duplicates

### 3. Security (RLS)
- Enabled RLS on `lesson_block_progress`
- Students can only read/write their own progress
- Teachers/Admins can view student progress for their lessons
*/

-- Add display_mode column to lessons table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'display_mode'
  ) THEN
    ALTER TABLE public.lessons ADD COLUMN display_mode text NOT NULL DEFAULT 'classic';
    ALTER TABLE public.lessons ADD CONSTRAINT valid_display_mode 
      CHECK (display_mode IN ('classic', 'interactive'));
  END IF;
END $$;

-- Create lesson_block_progress table
CREATE TABLE IF NOT EXISTS public.lesson_block_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  lesson_id uuid NOT NULL REFERENCES public.lessons(id) ON DELETE CASCADE,
  current_block_index int NOT NULL DEFAULT 0,
  completed_blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  block_answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT unique_student_lesson_progress UNIQUE (student_id, lesson_id)
);

-- Enable RLS on lesson_block_progress
ALTER TABLE public.lesson_block_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for lesson_block_progress
DROP POLICY IF EXISTS "select_own_block_progress" ON public.lesson_block_progress;
CREATE POLICY "select_own_block_progress" ON public.lesson_block_progress FOR SELECT
  TO authenticated USING (
    student_id = auth.uid() 
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('teacher', 'admin')
    )
  );

DROP POLICY IF EXISTS "insert_own_block_progress" ON public.lesson_block_progress;
CREATE POLICY "insert_own_block_progress" ON public.lesson_block_progress FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "update_own_block_progress" ON public.lesson_block_progress;
CREATE POLICY "update_own_block_progress" ON public.lesson_block_progress FOR UPDATE
  TO authenticated USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_lesson_block_progress_student ON public.lesson_block_progress(student_id);
CREATE INDEX IF NOT EXISTS idx_lesson_block_progress_lesson ON public.lesson_block_progress(lesson_id);