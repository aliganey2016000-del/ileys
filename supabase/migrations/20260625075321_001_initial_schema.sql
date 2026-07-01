-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  avatar_url text,
  bio text,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Profiles policies
create policy "select_profiles" on public.profiles for select
  to authenticated using (true);

create policy "insert_own_profile" on public.profiles for insert
  to authenticated with check (auth.uid() = id);

create policy "update_own_profile" on public.profiles for update
  to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Levels table (English proficiency levels)
create table public.levels (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  label text not null,
  description text,
  color text,
  icon text,
  sort_order int not null default 0
);

-- Enable RLS
alter table public.levels enable row level security;

-- Levels policies (read-only for all authenticated users)
create policy "select_levels" on public.levels for select
  to authenticated using (true);

-- Lessons table
create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  title text not null,
  description text,
  content jsonb,
  duration_minutes int not null default 20,
  sort_order int not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.lessons enable row level security;

-- Lessons policies
create policy "select_published_lessons" on public.lessons for select
  to authenticated using (is_published = true or teacher_id = auth.uid() or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "insert_lessons_teacher" on public.lessons for insert
  to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin'))
  );

create policy "update_own_lessons" on public.lessons for update
  to authenticated using (
    teacher_id = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

create policy "delete_own_lessons" on public.lessons for delete
  to authenticated using (
    teacher_id = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Enrollments table
create table public.enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  level_id uuid not null references public.levels(id) on delete cascade,
  enrolled_at timestamptz not null default now(),
  unique(student_id, level_id)
);

-- Enable RLS
alter table public.enrollments enable row level security;

-- Enrollments policies
create policy "select_own_enrollments" on public.enrollments for select
  to authenticated using (
    student_id = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin')
    )
  );

create policy "insert_own_enrollment" on public.enrollments for insert
  to authenticated with check (student_id = auth.uid());

-- Lesson progress table
create table public.lesson_progress (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  score int default 0,
  completed boolean not null default false,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique(student_id, lesson_id)
);

-- Enable RLS
alter table public.lesson_progress enable row level security;

-- Lesson progress policies
create policy "select_own_progress" on public.lesson_progress for select
  to authenticated using (
    student_id = auth.uid() or exists (
      select 1 from public.profiles where id = auth.uid() and role in ('teacher', 'admin')
    )
  );

create policy "insert_own_progress" on public.lesson_progress for insert
  to authenticated with check (student_id = auth.uid());

create policy "update_own_progress" on public.lesson_progress for update
  to authenticated using (student_id = auth.uid()) with check (student_id = auth.uid());

-- Courses table
create table public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  thumbnail_url text,
  pricing_model text not null default 'free' check (pricing_model in ('free', 'paid')),
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  difficulty_level text default 'Beginner',
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.courses enable row level security;

-- Courses policies
create policy "select_published_courses" on public.courses for select
  to authenticated using (is_published = true or exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  ));

create policy "insert_courses_admin" on public.courses for insert
  to authenticated with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "update_courses_admin" on public.courses for update
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Course topics table
create table public.course_topics (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  summary text,
  sort_order int not null default 0
);

-- Enable RLS
alter table public.course_topics enable row level security;

create policy "select_course_topics" on public.course_topics for select
  to authenticated using (true);

create policy "manage_course_topics_admin" on public.course_topics for all
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Course topic items table
create table public.course_topic_items (
  id uuid primary key default gen_random_uuid(),
  topic_id uuid not null references public.course_topics(id) on delete cascade,
  type text not null default 'lesson' check (type in ('lesson', 'quiz', 'assignment')),
  title text not null,
  video_url text,
  content text,
  sort_order int not null default 0
);

-- Enable RLS
alter table public.course_topic_items enable row level security;

create policy "select_topic_items" on public.course_topic_items for select
  to authenticated using (true);

create policy "manage_topic_items_admin" on public.course_topic_items for all
  to authenticated using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Insert default levels
insert into public.levels (key, label, description, color, icon, sort_order) values
  ('elementary', 'Elementary', 'Build your foundation with essential grammar and vocabulary for everyday situations.', '#10b981', 'seedling', 1),
  ('pre-intermediate', 'Pre-Intermediate', 'Expand your skills with more complex sentences and conversational English.', '#0ea5e9', 'book-open', 2),
  ('intermediate', 'Intermediate', 'Master nuanced expressions and develop confidence in professional settings.', '#8b5cf6', 'zap', 3),
  ('upper-intermediate', 'Upper-Intermediate', 'Refine your fluency with advanced grammar and idiomatic language.', '#f59e0b', 'rocket', 4),
  ('advanced', 'Advanced', 'Achieve near-native proficiency with sophisticated vocabulary and cultural nuances.', '#ef4444', 'trophy', 5);

-- Insert a sample course
insert into public.courses (title, description, difficulty_level, is_published, pricing_model, visibility, thumbnail_url) values
  ('English Fundamentals', 'A comprehensive course covering all the basics of English language learning, from grammar to vocabulary building.', 'Beginner', true, 'free', 'public', 'https://images.pexels.com/photos/301926/pexels-photo-301926.jpeg?auto=compress&cs=tinysrgb&w=1600&h=800&fit=crop');

-- Insert sample topics for the course
insert into public.course_topics (course_id, title, summary, sort_order)
select id, 'Introduction to English', 'Get started with the basics of English language', 1
from public.courses where title = 'English Fundamentals';

insert into public.course_topics (course_id, title, summary, sort_order)
select id, 'Basic Grammar', 'Learn the fundamental grammar rules', 2
from public.courses where title = 'English Fundamentals';

-- Insert sample items for topic 1
insert into public.course_topic_items (topic_id, type, title, sort_order)
select id, 'lesson', 'Welcome to Ilesy Academy!', 1
from public.course_topics where title = 'Introduction to English';

insert into public.course_topic_items (topic_id, type, title, sort_order)
select id, 'lesson', 'The English Alphabet', 2
from public.course_topics where title = 'Introduction to English';

insert into public.course_topic_items (topic_id, type, title, sort_order)
select id, 'quiz', 'Alphabet Quiz', 3
from public.course_topics where title = 'Introduction to English';

-- Insert sample items for topic 2
insert into public.course_topic_items (topic_id, type, title, sort_order)
select id, 'lesson', 'Nouns and Verbs', 1
from public.course_topics where title = 'Basic Grammar';

insert into public.course_topic_items (topic_id, type, title, sort_order)
select id, 'lesson', 'Subject-Verb Agreement', 2
from public.course_topics where title = 'Basic Grammar';

insert into public.course_topic_items (topic_id, type, title, sort_order)
select id, 'assignment', 'Practice Writing Sentences', 3
from public.course_topics where title = 'Basic Grammar';
