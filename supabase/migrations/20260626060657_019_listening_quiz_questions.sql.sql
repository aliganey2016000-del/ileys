-- Add listening quiz questions with audio samples
INSERT INTO public.quiz_questions (id, quiz_id, question_type, question_text, question_audio_url, hint, explanation, points) VALUES
  ('650e8400-e29b-41d4-a716-446655440030', '550e8400-e29b-41d4-a716-446655440004', 'listening', 'What did the speaker say?', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3', 'Listen carefully to the audio', 'This tests your listening comprehension skills.', 10),
  ('650e8400-e29b-41d4-a716-446655440031', '550e8400-e29b-41d4-a716-446655440004', 'listening', 'Choose the correct transcription:', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3', 'Pay attention to the pronunciation', 'Transcription practice improves spelling and pronunciation awareness.', 10),
  ('650e8400-e29b-41d4-a716-446655440032', '550e8400-e29b-41d4-a716-446655440004', 'listening', 'What is the speaker describing?', 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3', 'Focus on keywords in the audio', 'Understanding context clues helps with comprehension.', 10);

INSERT INTO public.quiz_options (question_id, option_text, is_correct, sort_order) VALUES
  -- Question 30 options
  ('650e8400-e29b-41d4-a716-446655440030', 'The weather is beautiful today.', true, 1),
  ('650e8400-e29b-41d4-a716-446655440030', 'The weather is terrible today.', false, 2),
  ('650e8400-e29b-41d4-a716-446655440030', 'The weather will change tomorrow.', false, 3),
  ('650e8400-e29b-41d4-a716-446655440030', 'I do not like the weather.', false, 4),
  
  -- Question 31 options
  ('650e8400-e29b-41d4-a716-446655440031', 'She is going to the library.', true, 1),
  ('650e8400-e29b-41d4-a716-446655440031', 'She is going to the laboratory.', false, 2),
  ('650e8400-e29b-41d4-a716-446655440031', 'She is going to the cafeteria.', false, 3),
  ('650e8400-e29b-41d4-a716-446655440031', 'She is going home.', false, 4),
  
  -- Question 32 options
  ('650e8400-e29b-41d4-a716-446655440032', 'A new restaurant opening', false, 1),
  ('650e8400-e29b-41d4-a716-446655440032', 'A book they just read', true, 2),
  ('650e8400-e29b-41d4-a716-446655440032', 'A movie they watched', false, 3),
  ('650e8400-e29b-41d4-a716-446655440032', 'A vacation they took', false, 4);

-- Add time limit to the listening quiz
UPDATE public.quizzes SET time_limit_seconds = 300 WHERE id = '550e8400-e29b-41d4-a716-446655440004';

-- Also add time limits to other quizzes for demonstration
UPDATE public.quizzes SET time_limit_seconds = 180 WHERE id = '550e8400-e29b-41d4-a716-446655440001';
UPDATE public.quizzes SET time_limit_seconds = 240 WHERE id = '550e8400-e29b-41d4-a716-446655440002';
UPDATE public.quizzes SET time_limit_seconds = 120 WHERE id = '550e8400-e29b-41d4-a716-446655440003';
