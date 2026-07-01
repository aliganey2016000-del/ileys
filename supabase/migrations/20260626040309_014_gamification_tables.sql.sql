-- Gamification Tables for LMS

-- User XP and Stats
CREATE TABLE public.user_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_xp INTEGER NOT NULL DEFAULT 0,
  current_level INTEGER NOT NULL DEFAULT 1,
  xp_to_next_level INTEGER NOT NULL DEFAULT 100,
  streak_days INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_activity_date DATE,
  total_lessons_completed INTEGER NOT NULL DEFAULT 0,
  total_quizzes_passed INTEGER NOT NULL DEFAULT 0,
  total_time_minutes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Achievement Definitions
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'from-amber-400 to-yellow-500',
  xp_reward INTEGER NOT NULL DEFAULT 50,
  category TEXT NOT NULL DEFAULT 'general',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- User Achievements (earned)
CREATE TABLE public.user_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_id UUID NOT NULL REFERENCES public.achievements(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- XP Transactions Log
CREATE TABLE public.xp_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  reason TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_transactions ENABLE ROW LEVEL SECURITY;

-- User Stats Policies
CREATE POLICY "select_own_stats" ON public.user_stats FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "insert_own_stats" ON public.user_stats FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_stats" ON public.user_stats FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Achievements Policies (read-only for users)
CREATE POLICY "select_achievements" ON public.achievements FOR SELECT
  TO authenticated USING (is_active = true OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "manage_achievements_admin" ON public.achievements FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- User Achievements Policies
CREATE POLICY "select_own_achievements" ON public.user_achievements FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "insert_own_achievements" ON public.user_achievements FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- XP Transactions Policies
CREATE POLICY "select_own_xp" ON public.xp_transactions FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

CREATE POLICY "insert_own_xp" ON public.xp_transactions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

-- Insert default achievements
INSERT INTO public.achievements (key, name, description, icon, color, xp_reward, category, sort_order) VALUES
  ('first_lesson', 'First Steps', 'Complete your first lesson', 'Baby', 'from-emerald-400 to-teal-500', 25, 'learning', 1),
  ('lesson_streak_3', 'Getting Started', 'Complete 3 lessons in a row', 'Flame', 'from-orange-400 to-red-500', 50, 'streak', 2),
  ('lesson_streak_7', 'Week Warrior', 'Maintain a 7-day learning streak', 'Flame', 'from-orange-500 to-red-600', 100, 'streak', 3),
  ('lesson_streak_30', 'Monthly Master', 'Maintain a 30-day learning streak', 'Crown', 'from-amber-400 to-yellow-500', 500, 'streak', 4),
  ('quiz_master', 'Quiz Master', 'Pass 10 quizzes with 80%+ score', 'Trophy', 'from-yellow-400 to-amber-500', 150, 'quiz', 5),
  ('quiz_perfect', 'Perfectionist', 'Get 100% on a quiz', 'Star', 'from-purple-400 to-pink-500', 75, 'quiz', 6),
  ('vocabulary_50', 'Word Collector', 'Learn 50 new words', 'BookOpen', 'from-blue-400 to-indigo-500', 100, 'vocabulary', 7),
  ('vocabulary_100', 'Vocabulary Pro', 'Learn 100 new words', 'BookOpen', 'from-blue-500 to-indigo-600', 200, 'vocabulary', 8),
  ('early_bird', 'Early Bird', 'Complete a lesson before 8 AM', 'Sun', 'from-amber-300 to-orange-400', 30, 'special', 9),
  ('night_owl', 'Night Owl', 'Complete a lesson after 10 PM', 'Moon', 'from-indigo-400 to-purple-500', 30, 'special', 10),
  ('level_5', 'Rising Star', 'Reach learner level 5', 'TrendingUp', 'from-cyan-400 to-blue-500', 150, 'level', 11),
  ('level_10', 'Scholar', 'Reach learner level 10', 'GraduationCap', 'from-rose-400 to-red-500', 300, 'level', 12),
  ('level_25', 'Expert', 'Reach learner level 25', 'Award', 'from-yellow-500 to-amber-600', 1000, 'level', 13),
  ('social_learner', 'Social Learner', 'Leave your first comment', 'MessageCircle', 'from-green-400 to-emerald-500', 25, 'social', 14),
  ('course_complete', 'Course Graduate', 'Complete your first full course', 'Award', 'from-rose-500 to-pink-600', 200, 'learning', 15);

-- Function to update streak
CREATE OR REPLACE FUNCTION update_user_streak(p_user_id UUID)
RETURNS void AS $$
DECLARE
  v_last_date DATE;
  v_streak INTEGER;
  v_longest INTEGER;
BEGIN
  SELECT last_activity_date, streak_days, longest_streak
  INTO v_last_date, v_streak, v_longest
  FROM user_stats WHERE user_id = p_user_id;

  IF v_last_date IS NULL THEN
    -- First activity
    UPDATE user_stats SET 
      streak_days = 1,
      longest_streak = 1,
      last_activity_date = CURRENT_DATE
    WHERE user_id = p_user_id;
  ELSIF v_last_date = CURRENT_DATE THEN
    -- Already active today, do nothing
    NULL;
  ELSIF v_last_date = CURRENT_DATE - 1 THEN
    -- Consecutive day
    v_streak := v_streak + 1;
    UPDATE user_stats SET 
      streak_days = v_streak,
      longest_streak = GREATEST(v_longest, v_streak),
      last_activity_date = CURRENT_DATE
    WHERE user_id = p_user_id;
  ELSE
    -- Streak broken
    UPDATE user_stats SET 
      streak_days = 1,
      last_activity_date = CURRENT_DATE
    WHERE user_id = p_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to add XP and check level up
CREATE OR REPLACE FUNCTION add_user_xp(p_user_id UUID, p_amount INTEGER, p_reason TEXT, p_source_type TEXT DEFAULT 'manual', p_source_id UUID DEFAULT NULL)
RETURNS TABLE(level_up BOOLEAN, new_level INTEGER, xp_gained INTEGER) AS $$
DECLARE
  v_current_xp INTEGER;
  v_current_level INTEGER;
  v_xp_to_next INTEGER;
  v_new_xp INTEGER;
  v_new_level INTEGER;
  v_level_up BOOLEAN := false;
BEGIN
  -- Get current stats
  SELECT total_xp, current_level, xp_to_next_level
  INTO v_current_xp, v_current_level, v_xp_to_next
  FROM user_stats WHERE user_id = p_user_id;

  -- Insert transaction
  INSERT INTO xp_transactions (user_id, amount, reason, source_type, source_id)
  VALUES (p_user_id, p_amount, p_reason, p_source_type, p_source_id);

  -- Calculate new totals
  v_new_xp := v_current_xp + p_amount;
  v_new_level := v_current_level;

  -- Check for level up
  WHILE v_new_xp >= v_xp_to_next LOOP
    v_level_up := true;
    v_new_level := v_new_level + 1;
    v_xp_to_next := FLOOR(100 * POW(1.2, v_new_level))::INTEGER;
  END LOOP;

  -- Update stats
  UPDATE user_stats SET 
    total_xp = v_new_xp,
    current_level = v_new_level,
    xp_to_next_level = v_xp_to_next,
    updated_at = now()
  WHERE user_id = p_user_id;

  -- Update streak
  PERFORM update_user_streak(p_user_id);

  RETURN QUERY SELECT v_level_up, v_new_level, p_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;