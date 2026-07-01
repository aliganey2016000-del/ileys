-- Interactive Quiz Tables

-- Quiz Definitions (teachers create these)
CREATE TABLE public.quizzes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  lesson_id UUID REFERENCES public.lessons(id) ON DELETE CASCADE,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  quiz_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (quiz_type IN ('multiple_choice', 'matching', 'fill_blank', 'listening', 'mixed')),
  time_limit_seconds INTEGER,
  passing_score INTEGER NOT NULL DEFAULT 70,
  max_attempts INTEGER DEFAULT 3,
  shuffle_questions BOOLEAN DEFAULT true,
  show_correct_answers BOOLEAN DEFAULT true,
  xp_reward INTEGER DEFAULT 30,
  bonus_xp_perfect INTEGER DEFAULT 30,
  is_published BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quiz Questions
CREATE TABLE public.quiz_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  question_type TEXT NOT NULL DEFAULT 'multiple_choice' CHECK (question_type IN ('multiple_choice', 'true_false', 'fill_blank', 'matching_pair', 'listening', 'ordering')),
  question_text TEXT NOT NULL,
  question_audio_url TEXT,
  image_url TEXT,
  hint TEXT,
  explanation TEXT,
  points INTEGER NOT NULL DEFAULT 10,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Question Options (for multiple choice, matching, ordering)
CREATE TABLE public.quiz_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  option_text TEXT NOT NULL,
  option_audio_url TEXT,
  image_url TEXT,
  is_correct BOOLEAN DEFAULT false,
  match_key TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Quiz Attempts (student submissions)
CREATE TABLE public.quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id UUID NOT NULL REFERENCES public.quizzes(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 0,
  percentage INTEGER NOT NULL DEFAULT 0,
  passed BOOLEAN DEFAULT false,
  time_taken_seconds INTEGER,
  attempt_number INTEGER NOT NULL DEFAULT 1,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(quiz_id, student_id, attempt_number)
);

-- Quiz Answers (individual question responses)
CREATE TABLE public.quiz_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id UUID NOT NULL REFERENCES public.quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.quiz_questions(id) ON DELETE CASCADE,
  selected_option_id UUID REFERENCES public.quiz_options(id) ON DELETE SET NULL,
  text_answer TEXT,
  is_correct BOOLEAN,
  points_earned INTEGER DEFAULT 0,
  answered_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quiz_answers ENABLE ROW LEVEL SECURITY;

-- Quizzes Policies
CREATE POLICY "select_published_quizzes" ON public.quizzes FOR SELECT
  TO authenticated USING (is_published = true OR created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')
  ));

CREATE POLICY "insert_quizzes_teachers" ON public.quizzes FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher'))
  );

CREATE POLICY "update_own_quizzes" ON public.quizzes FOR UPDATE
  TO authenticated USING (created_by = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

-- Questions Policies
CREATE POLICY "select_questions" ON public.quiz_questions FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM quizzes WHERE id = quiz_id AND (is_published = true OR created_by = auth.uid())
  ));

CREATE POLICY "insert_questions_teachers" ON public.quiz_questions FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM quizzes WHERE id = quiz_id AND created_by = auth.uid()
  ));

-- Options Policies
CREATE POLICY "select_options" ON public.quiz_options FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM quiz_questions q JOIN quizzes cz ON q.quiz_id = cz.id 
    WHERE q.id = question_id AND (cz.is_published = true OR cz.created_by = auth.uid())
  ));

CREATE POLICY "insert_options_teachers" ON public.quiz_options FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM quiz_questions q JOIN quizzes cz ON q.quiz_id = cz.id 
    WHERE q.id = question_id AND cz.created_by = auth.uid()
  ));

-- Attempts Policies
CREATE POLICY "select_own_attempts" ON public.quiz_attempts FOR SELECT
  TO authenticated USING (student_id = auth.uid() OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')
  ));

CREATE POLICY "insert_own_attempts" ON public.quiz_attempts FOR INSERT
  TO authenticated WITH CHECK (student_id = auth.uid());

CREATE POLICY "update_own_attempts" ON public.quiz_attempts FOR UPDATE
  TO authenticated USING (student_id = auth.uid());

-- Answers Policies
CREATE POLICY "select_own_answers" ON public.quiz_answers FOR SELECT
  TO authenticated USING (EXISTS (
    SELECT 1 FROM quiz_attempts WHERE id = attempt_id AND (student_id = auth.uid() OR EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'teacher')
    ))
  ));

CREATE POLICY "insert_own_answers" ON public.quiz_answers FOR INSERT
  TO authenticated WITH CHECK (EXISTS (
    SELECT 1 FROM quiz_attempts WHERE id = attempt_id AND student_id = auth.uid()
  ));

-- Sample quizzes for English learning
INSERT INTO public.quizzes (id, title, description, quiz_type, passing_score, xp_reward, is_published, sort_order) VALUES
  ('550e8400-e29b-41d4-a716-446655440001', 'English Grammar Basics', 'Test your understanding of basic English grammar', 'multiple_choice', 70, 40, true, 1),
  ('550e8400-e29b-41d4-a716-446655440002', 'Vocabulary Match', 'Match words with their correct definitions', 'matching', 70, 35, true, 2),
  ('550e8400-e29b-41d4-a716-446655440003', 'Fill the Gaps', 'Complete the sentences with the right words', 'fill_blank', 70, 45, true, 3),
  ('550e8400-e29b-41d4-a716-446655440004', 'Listening Comprehension', 'Listen and answer questions', 'listening', 60, 50, true, 4);

-- Grammar questions
INSERT INTO public.quiz_questions (id, quiz_id, question_type, question_text, explanation, points) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 'multiple_choice', 'Which sentence uses the correct verb form?', 'Third person singular in present simple requires -s or -es', 10),
  ('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 'multiple_choice', 'Choose the correct past tense: "Yesterday she ___ to the store."', '"Went" is the irregular past tense of "go"', 10),
  ('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 'multiple_choice', 'Which is the correct question form?', 'Use "do/does" for present simple questions', 10),
  ('650e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 'multiple_choice', 'Select the sentence with correct article usage:', '"An" is used before vowel sounds, "a" before consonant sounds', 10),
  ('650e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 'multiple_choice', 'Which sentence is in present perfect tense?', 'Present perfect uses "have/has + past participle"', 10);

-- Grammar question options
INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  ('650e8400-e29b-41d4-a716-446655440001', 'She go to school every day.', false, 1),
  ('650e8400-e29b-41d4-a716-446655440001', 'She goes to school every day.', true, 2),
  ('650e8400-e29b-41d4-a716-446655440001', 'She going to school every day.', false, 3),
  ('650e8400-e29b-41d4-a716-446655440001', 'She gone to school every day.', false, 4),
  
  ('650e8400-e29b-41d4-a716-446655440002', 'goed', false, 1),
  ('650e8400-e29b-41d4-a716-446655440002', 'gone', false, 2),
  ('650e8400-e29b-41d4-a716-446655440002', 'went', true, 3),
  ('650e8400-e29b-41d4-a716-446655440002', 'going', false, 4),
  
  ('650e8400-e29b-41d4-a716-446655440003', 'Where you live?', false, 1),
  ('650e8400-e29b-41d4-a716-446655440003', 'Where do you live?', true, 2),
  ('650e8400-e29b-41d4-a716-446655440003', 'Where you do live?', false, 3),
  ('650e8400-e29b-41d4-a716-446655440003', 'Do where you live?', false, 4),
  
  ('650e8400-e29b-41d4-a716-446655440004', 'I saw a elephant at the zoo.', false, 1),
  ('650e8400-e29b-41d4-a716-446655440004', 'I saw an elephant at the zoo.', true, 2),
  ('650e8400-e29b-41d4-a716-446655440004', 'I saw the elephant at zoo.', false, 3),
  ('650e8400-e29b-41d4-a716-446655440004', 'I saw elephant at the zoo.', false, 4),
  
  ('650e8400-e29b-41d4-a716-446655440005', 'She is working tomorrow.', false, 1),
  ('650e8400-e29b-41d4-a716-446655440005', 'She has worked here for five years.', true, 2),
  ('650e8400-e29b-41d4-a716-446655440005', 'She will working next week.', false, 3),
  ('650e8400-e29b-41d4-a716-446655440005', 'She was worked yesterday.', false, 4);

-- Vocabulary matching questions
INSERT INTO public.quiz_questions (id, quiz_id, question_type, question_text, points) VALUES
  ('650e8400-e29b-41d4-a716-446655440010', '550e8400-e29b-41d4-a716-446655440002', 'matching_pair', 'Match the word with its definition:', 20);

INSERT INTO public.quiz_options (question_id, option_text, match_key, sort_order) VALUES
  ('650e8400-e29b-41d4-a716-446655440010', 'Ambitious', 'A', 1),
  ('650e8400-e29b-41d4-a716-446655440010', 'Having a strong desire to succeed', 'A', 5),
  ('650e8400-e29b-41d4-a716-446655440010', 'Persevere', 'B', 2),
  ('650e8400-e29b-41d4-a716-446655440010', 'To continue despite difficulties', 'B', 6),
  ('650e8400-e29b-41d4-a716-446655440010', 'Eloquent', 'C', 3),
  ('650e8400-e29b-41d4-a716-446655440010', 'Fluent and persuasive in speaking', 'C', 7),
  ('650e8400-e29b-41d4-a716-446655440010', 'Diligent', 'D', 4),
  ('650e8400-e29b-41d4-a716-446655440010', 'Hardworking and careful', 'D', 8);

-- Fill in the blank questions
INSERT INTO public.quiz_questions (id, quiz_id, question_type, question_text, hint, explanation, points) VALUES
  ('650e8400-e29b-41d4-a716-446655440020', '550e8400-e29b-41d4-a716-446655440003', 'fill_blank', 'Complete: "She ___ been working here since 2020."', 'Present perfect continuous', 'Use "has" for third person singular in present perfect', 10),
  ('650e8400-e29b-41d4-a716-446655440021', '550e8400-e29b-41d4-a716-446655440003', 'fill_blank', 'Fill the gap: "If I ___ rich, I would travel the world."', 'Second conditional', '"Were" is used in all persons for the if-clause in second conditional', 10),
  ('650e8400-e29b-41d4-a716-446655440022', '550e8400-e29b-41d4-a716-446655440003', 'fill_blank', 'Complete: "The book was ___ by a famous author."', 'Passive voice', 'Past participle of "write" is "written"', 10);

INSERT INTO public.quiz_options (question_id, option_text, is_correct) VALUES
  ('650e8400-e29b-41d4-a716-446655440020', 'has', true),
  ('650e8400-e29b-41d4-a716-446655440021', 'were', true),
  ('650e8400-e29b-41d4-a716-446655440022', 'written', true);