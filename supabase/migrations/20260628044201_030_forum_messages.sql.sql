-- Forum messages table for platform-wide chat
CREATE TABLE forum_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ,
  parent_id UUID REFERENCES forum_messages(id) ON DELETE CASCADE
);

-- Create index for efficient querying
CREATE INDEX idx_forum_messages_created_at ON forum_messages(created_at DESC);
CREATE INDEX idx_forum_messages_user_id ON forum_messages(user_id);

-- Enable RLS
ALTER TABLE forum_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies - all authenticated users can read and write
CREATE POLICY "forum_select_all" ON forum_messages FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "forum_insert_own" ON forum_messages FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "forum_update_own" ON forum_messages FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "forum_delete_own" ON forum_messages FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER forum_messages_updated_at
  BEFORE UPDATE ON forum_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();