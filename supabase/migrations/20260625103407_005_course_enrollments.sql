-- Course enrollments table
CREATE TABLE course_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  progress INTEGER DEFAULT 0,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  last_accessed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, course_id)
);

-- Course progress tracking for individual items
CREATE TABLE course_item_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES course_topic_items(id) ON DELETE CASCADE,
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  UNIQUE(student_id, item_id)
);

-- Enable RLS
ALTER TABLE course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE course_item_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for course_enrollments
CREATE POLICY "select_own_course_enrollments" ON course_enrollments FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

CREATE POLICY "insert_own_course_enrollments" ON course_enrollments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

-- RLS Policies for course_item_progress  
CREATE POLICY "select_own_item_progress" ON course_item_progress FOR SELECT
  TO authenticated USING (auth.uid() = student_id);

CREATE POLICY "insert_own_item_progress" ON course_item_progress FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

CREATE POLICY "update_own_item_progress" ON course_item_progress FOR UPDATE
  TO authenticated USING (auth.uid() = student_id);