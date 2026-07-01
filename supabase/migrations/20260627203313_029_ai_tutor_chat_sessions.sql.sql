-- Table for AI Tutor chat sessions
CREATE TABLE IF NOT EXISTS ai_tutor_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  lesson_title text NOT NULL,
  lesson_content text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Table for individual messages in sessions
CREATE TABLE IF NOT EXISTS ai_tutor_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES ai_tutor_sessions(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'assistant')),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_ai_tutor_sessions_user ON ai_tutor_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_tutor_messages_session ON ai_tutor_messages(session_id);

-- RLS
ALTER TABLE ai_tutor_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_tutor_messages ENABLE ROW LEVEL SECURITY;

-- Policies for ai_tutor_sessions
CREATE POLICY "select_own_sessions" ON ai_tutor_sessions FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_sessions" ON ai_tutor_sessions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_sessions" ON ai_tutor_sessions FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_sessions" ON ai_tutor_sessions FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Policies for ai_tutor_messages
CREATE POLICY "select_own_messages" ON ai_tutor_messages FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM ai_tutor_sessions 
      WHERE ai_tutor_sessions.id = ai_tutor_messages.session_id 
      AND ai_tutor_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own_messages" ON ai_tutor_messages FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM ai_tutor_sessions 
      WHERE ai_tutor_sessions.id = ai_tutor_messages.session_id 
      AND ai_tutor_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own_messages" ON ai_tutor_messages FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM ai_tutor_sessions 
      WHERE ai_tutor_sessions.id = ai_tutor_messages.session_id 
      AND ai_tutor_sessions.user_id = auth.uid()
    )
  );