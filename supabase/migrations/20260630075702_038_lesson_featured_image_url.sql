/*
# Add featured_image_url column to lessons table

1. Modified Tables
- `lessons`
  - Added `featured_image_url` (text, nullable) — stores a URL for the lesson's
    featured/cover image, surfaced via the new "Media & Attachments" panel in
    the Lesson Builder. Nullable because existing lessons and drafts have none.
2. Security
- No RLS policy changes. The lessons table already has owner-scoped policies
  (teacher_id-based) that cover the new column automatically.
3. Notes
- Idempotent: uses a DO $$ ... IF NOT EXISTS ... END $$ guard so re-running
  the migration is safe.
- No data is lost or transformed; the column is purely additive.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'lessons' AND column_name = 'featured_image_url'
  ) THEN
    ALTER TABLE public.lessons ADD COLUMN featured_image_url text;
  END IF;
END $$;
