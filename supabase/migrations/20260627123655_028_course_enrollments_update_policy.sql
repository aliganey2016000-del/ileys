-- Allow students to update their own enrollment progress
CREATE POLICY "update_own_course_enrollments" ON course_enrollments
  FOR UPDATE TO authenticated
  USING (auth.uid() = student_id)
  WITH CHECK (auth.uid() = student_id);
