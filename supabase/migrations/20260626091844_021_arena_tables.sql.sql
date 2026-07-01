-- Create arenas table
CREATE TABLE arenas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  time_limit_seconds INTEGER NOT NULL DEFAULT 600,
  points_reward INTEGER NOT NULL DEFAULT 100,
  created_by UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  scheduled_start TIMESTAMPTZ,
  scheduled_end TIMESTAMPTZ,
  actual_start TIMESTAMPTZ,
  actual_end TIMESTAMPTZ,
  max_participants INTEGER DEFAULT 50,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create arena participants table
CREATE TABLE arena_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID REFERENCES arenas(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  score INTEGER DEFAULT 0,
  rank INTEGER,
  completed_at TIMESTAMPTZ,
  UNIQUE(arena_id, student_id)
);

-- Create arena quiz attempts (to track attempts during arena)
CREATE TABLE arena_quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  arena_id UUID REFERENCES arenas(id) ON DELETE CASCADE NOT NULL,
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  quiz_id UUID REFERENCES quizzes(id) ON DELETE SET NULL,
  score INTEGER DEFAULT 0,
  max_score INTEGER DEFAULT 0,
  percentage INTEGER DEFAULT 0,
  time_taken_seconds INTEGER,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(arena_id, student_id)
);

-- Enable RLS
ALTER TABLE arenas ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE arena_quiz_attempts ENABLE ROW LEVEL SECURITY;

-- Policies for arenas
CREATE POLICY "select_arenas" ON arenas FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_arenas_admin" ON arenas FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "update_arenas_admin" ON arenas FOR UPDATE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "delete_arenas_admin" ON arenas FOR DELETE
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Policies for arena_participants
CREATE POLICY "select_arena_participants" ON arena_participants FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_arena_participants" ON arena_participants FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

CREATE POLICY "update_arena_participants" ON arena_participants FOR UPDATE
  TO authenticated USING (auth.uid() = student_id);

-- Policies for arena_quiz_attempts
CREATE POLICY "select_arena_attempts" ON arena_quiz_attempts FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_arena_attempts" ON arena_quiz_attempts FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = student_id);

CREATE POLICY "update_arena_attempts" ON arena_quiz_attempts FOR UPDATE
  TO authenticated USING (auth.uid() = student_id);

-- Create indexes for performance
CREATE INDEX idx_arenas_status ON arenas(status);
CREATE INDEX idx_arenas_course ON arenas(course_id);
CREATE INDEX idx_arenas_created_by ON arenas(created_by);
CREATE INDEX idx_arena_participants_arena ON arena_participants(arena_id);
CREATE INDEX idx_arena_participants_student ON arena_participants(student_id);
CREATE INDEX idx_arena_attempts_arena ON arena_quiz_attempts(arena_id);
CREATE INDEX idx_arena_attempts_student ON arena_quiz_attempts(student_id);