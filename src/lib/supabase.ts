import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'student' | 'teacher' | 'admin';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  category_id: string | null;
  email: string | null;
  phone_number: string | null;
}

export interface Level {
  id: string;
  key: string;
  label: string;
  description: string;
  color: string;
  icon: string;
  sort_order: number;
}

export interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video' | 'question';
  content?: string;
  imageUrl?: string;
  imageAlt?: string;
  videoUrl?: string;
  videoTitle?: string;
  question?: string;
  options?: string[];
  correctAnswer?: number;
}

export interface Lesson {
  id: string;
  level_id: string;
  teacher_id: string | null;
  title: string;
  description: string | null;
  content: ContentBlock[] | null;
  duration_minutes: number;
  sort_order: number;
  is_published: boolean;
  display_mode: 'classic' | 'interactive';
  video_url: string | null;
  featured_image_url: string | null;
  created_at: string;
}

export interface LessonBlockProgress {
  id: string;
  student_id: string;
  lesson_id: string;
  current_block_index: number;
  completed_blocks: string[];
  block_answers: Record<string, { answer: string | number; correct: boolean }>;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
}

export interface Enrollment {
  id: string;
  student_id: string;
  level_id: string;
  enrolled_at: string;
}

export interface LessonProgress {
  id: string;
  student_id: string;
  lesson_id: string;
  score: number;
  completed: boolean;
  completed_at: string | null;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface UserStats {
  id: string;
  user_id: string;
  total_xp: number;
  current_level: number;
  xp_to_next_level: number;
  streak_days: number;
  longest_streak: number;
  last_activity_date: string | null;
  total_lessons_completed: number;
  total_quizzes_passed: number;
  total_time_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface Achievement {
  id: string;
  key: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  xp_reward: number;
  category: string;
  sort_order: number;
  is_active: boolean;
}

export interface UserAchievement {
  id: string;
  user_id: string;
  achievement_id: string;
  earned_at: string;
  achievement?: Achievement;
}

export interface XPTransaction {
  id: string;
  user_id: string;
  amount: number;
  reason: string;
  source_type: string;
  source_id: string | null;
  created_at: string;
}

export interface Quiz {
  id: string;
  title: string;
  description: string | null;
  course_id: string | null;
  lesson_id: string | null;
  created_by: string | null;
  quiz_type: 'multiple_choice' | 'matching' | 'fill_blank' | 'listening' | 'mixed';
  time_limit_seconds: number | null;
  passing_score: number;
  max_attempts: number | null;
  shuffle_questions: boolean;
  show_correct_answers: boolean;
  xp_reward: number;
  bonus_xp_perfect: number;
  is_published: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_type: 'multiple_choice' | 'true_false' | 'fill_blank' | 'matching_pair' | 'listening' | 'ordering' | 'listen_write' | 'flash_card';
  question_text: string;
  question_audio_url: string | null;
  image_url: string | null;
  hint: string | null;
  explanation: string | null;
  points: number;
  sort_order: number;
  created_at: string;
}

export interface QuizOption {
  id: string;
  question_id: string;
  option_text: string;
  option_audio_url: string | null;
  image_url: string | null;
  is_correct: boolean;
  match_key: string | null;
  sort_order: number;
  created_at: string;
}

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  time_taken_seconds: number | null;
  attempt_number: number;
  completed_at: string | null;
  created_at: string;
}

export interface QuizAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option_id: string | null;
  text_answer: string | null;
  is_correct: boolean | null;
  points_earned: number;
  answered_at: string;
}

export type NotificationType =
  | 'achievement'
  | 'level_up'
  | 'quiz_passed'
  | 'arena_invite'
  | 'arena_result'
  | 'course_complete'
  | 'lesson_published'
  | 'streak_milestone'
  | 'streak_broken'
  | 'streak_at_risk'
  | 'system';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  icon: string;
  action_page: string | null;
  is_read: boolean;
  created_at: string;
}

export interface CourseCompletion {
  id: string;
  student_id: string;
  course_id: string;
  completed_at: string;
  certificate_id: string;
  xp_awarded: number;
}

export interface ForumMessage {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string | null;
  parent_id: string | null;
  profile?: Profile;
}
