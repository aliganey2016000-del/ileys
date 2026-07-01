-- Create categories table
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  icon TEXT DEFAULT 'Folder',
  color TEXT DEFAULT 'from-blue-500 to-cyan-500',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "select_categories" ON categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_categories" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_categories" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_categories" ON categories FOR DELETE TO authenticated USING (true);

-- Add category_id to profiles
ALTER TABLE profiles ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Add category_id to courses
ALTER TABLE courses ADD COLUMN category_id UUID REFERENCES categories(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX idx_courses_category ON courses(category_id);
CREATE INDEX idx_profiles_category ON profiles(category_id);

-- Insert some default categories
INSERT INTO categories (name, slug, description, icon, color, sort_order) VALUES
  ('General English', 'general-english', 'General English language courses', 'Globe', 'from-blue-500 to-cyan-500', 1),
  ('Business English', 'business-english', 'Professional and business communication', 'Briefcase', 'from-purple-500 to-violet-600', 2),
  ('Academic English', 'academic-english', 'Academic writing and research skills', 'GraduationCap', 'from-emerald-500 to-teal-600', 3),
  ('Exam Preparation', 'exam-prep', 'IELTS, TOEFL, and other exam prep', 'Award', 'from-amber-500 to-orange-600', 4);
