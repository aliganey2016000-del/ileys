-- Add policy to allow anyone to view certificate details for verification
-- This is needed for the public certificate verification page

DROP POLICY IF EXISTS "select_own_completions" ON course_completions;

-- Allow students to see their own completions
CREATE POLICY "select_own_completions" ON course_completions
  FOR SELECT TO authenticated
  USING (auth.uid() = student_id);

-- Allow anyone to verify certificates by certificate_id (public verification)
CREATE POLICY "verify_certificates" ON course_completions
  FOR SELECT TO anon, authenticated
  USING (certificate_id IS NOT NULL);