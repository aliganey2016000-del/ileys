import { useState, useEffect, useCallback } from 'react';
import { supabase, UserStats, Achievement, UserAchievement } from './supabase';
import { notifyAchievement, notifyLevelUp, notifyQuizPassed, notifyStreakMilestone, notifyStreakBroken, notifyStreakAtRisk } from './notifications';
import { smsStreakAtRisk, smsStreakBroken } from './sms';

const STREAK_MILESTONES = [7, 14, 30, 60, 100, 200, 365];

function todayUTC(): string {
  return new Date().toISOString().split('T')[0];
}

function yesterdayUTC(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

export interface GamificationState {
  stats: UserStats | null;
  achievements: Achievement[];
  userAchievements: UserAchievement[];
  loading: boolean;
  levelUpData: { level: number; xpGained: number } | null;
  newAchievement: Achievement | null;
  xpPopup: { amount: number; reason: string } | null;
  streakAtRisk: boolean;
}

export function useGamification(userId: string | undefined) {
  const [state, setState] = useState<GamificationState>({
    stats: null,
    achievements: [],
    userAchievements: [],
    loading: true,
    levelUpData: null,
    newAchievement: null,
    xpPopup: null,
    streakAtRisk: false,
  });

  useEffect(() => {
    if (!userId) return;

    (async () => {
      const { data: existingStats } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      let stats = existingStats;

      if (!stats) {
        const { data: newStats, error } = await supabase
          .from('user_stats')
          .insert({ user_id: userId })
          .select()
          .single();

        if (!error && newStats) {
          stats = newStats;
        }
      }

      const { data: achievements } = await supabase
        .from('achievements')
        .select('*')
        .eq('is_active', true)
        .order('sort_order');

      const { data: userAchievements } = await supabase
        .from('user_achievements')
        .select('*, achievement:achievements(*)')
        .eq('user_id', userId);

      const loadedStats = stats as UserStats | null;
      let atRisk = false;
      if (loadedStats?.last_activity_date && loadedStats.streak_days > 0) {
        const lastDate = (loadedStats.last_activity_date as string).split('T')[0];
        if (lastDate === yesterdayUTC()) {
          atRisk = true;
          notifyStreakAtRisk(userId, loadedStats.streak_days);
          // SMS streak-at-risk alert
          smsStreakAtRisk(userId, loadedStats.streak_days).catch(console.warn);
        }
      }

      setState(prev => ({
        ...prev,
        stats: loadedStats,
        achievements: achievements || [],
        userAchievements: (userAchievements as unknown as UserAchievement[]) || [],
        loading: false,
        streakAtRisk: atRisk,
      }));
    })();
  }, [userId]);

  const awardXP = useCallback(async (amount: number, reason: string, sourceType: string = 'manual', sourceId?: string) => {
    if (!userId || amount <= 0) return;

    const previousStreak = state.stats?.streak_days ?? 0;

    setState(prev => ({ ...prev, xpPopup: { amount, reason } }));
    setTimeout(() => {
      setState(prev => ({ ...prev, xpPopup: null }));
    }, 1500);

    const { data, error } = await supabase.rpc('add_user_xp', {
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
      p_source_type: sourceType,
      p_source_id: sourceId || null,
    });

    if (error) {
      console.error('Error awarding XP:', error);
      return;
    }

    if (data && data.length > 0) {
      const { level_up, new_level, xp_gained } = data[0];
      if (level_up) {
        setState(prev => ({ ...prev, levelUpData: { level: new_level, xpGained: xp_gained } }));
        notifyLevelUp(userId, new_level);
      }
    }

    const { data: newStats } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (newStats) {
      const newStreak = (newStats as UserStats).streak_days;

      if (previousStreak > 1 && newStreak === 1) {
        notifyStreakBroken(userId, previousStreak);
        smsStreakBroken(userId, previousStreak).catch(console.warn);
      }

      if (STREAK_MILESTONES.includes(newStreak) && newStreak > previousStreak) {
        notifyStreakMilestone(userId, newStreak);
      }

      setState(prev => ({ ...prev, stats: newStats as UserStats, streakAtRisk: false }));
    }
  }, [userId, state.stats?.streak_days]);

  const checkAchievements = useCallback(async () => {
    if (!userId || !state.stats) return;

    const earnedIds = new Set(state.userAchievements.map(ua => ua.achievement_id));
    const newAchievements: Achievement[] = [];

    for (const achievement of state.achievements) {
      if (earnedIds.has(achievement.id)) continue;

      let shouldAward = false;

      switch (achievement.key) {
        case 'first_lesson':
          shouldAward = state.stats.total_lessons_completed >= 1;
          break;
        case 'lesson_streak_3':
          shouldAward = state.stats.streak_days >= 3;
          break;
        case 'lesson_streak_7':
          shouldAward = state.stats.streak_days >= 7;
          break;
        case 'lesson_streak_30':
          shouldAward = state.stats.streak_days >= 30;
          break;
        case 'quiz_master':
          shouldAward = state.stats.total_quizzes_passed >= 10;
          break;
        case 'level_5':
          shouldAward = state.stats.current_level >= 5;
          break;
        case 'level_10':
          shouldAward = state.stats.current_level >= 10;
          break;
        case 'level_25':
          shouldAward = state.stats.current_level >= 25;
          break;
      }

      if (shouldAward) {
        const { error } = await supabase
          .from('user_achievements')
          .insert({
            user_id: userId,
            achievement_id: achievement.id,
          });

        if (!error) {
          newAchievements.push(achievement);
          await awardXP(achievement.xp_reward, `Achievement: ${achievement.name}`, 'achievement', achievement.id);
          notifyAchievement(userId, achievement.name, achievement.xp_reward);
        }
      }
    }

    if (newAchievements.length > 0) {
      setState(prev => ({
        ...prev,
        newAchievement: newAchievements[0],
        userAchievements: [
          ...prev.userAchievements,
          ...newAchievements.map(a => ({
            id: crypto.randomUUID(),
            user_id: userId,
            achievement_id: a.id,
            earned_at: new Date().toISOString(),
            achievement: a,
          })),
        ],
      }));

      setTimeout(() => {
        setState(prev => ({ ...prev, newAchievement: null }));
      }, 5000);
    }

    const { data: userAchievements } = await supabase
      .from('user_achievements')
      .select('*, achievement:achievements(*)')
      .eq('user_id', userId);

    if (userAchievements) {
      setState(prev => ({ ...prev, userAchievements: userAchievements as unknown as UserAchievement[] }));
    }
  }, [userId, state.stats, state.achievements, state.userAchievements, awardXP]);

  const completeLesson = useCallback(async (lessonId: string, durationMinutes: number = 5) => {
    if (!userId) return;

    const xp = 25 + Math.floor(durationMinutes / 5) * 5;
    await awardXP(xp, 'Lesson completed', 'lesson', lessonId);

    await supabase
      .from('user_stats')
      .update({
        total_lessons_completed: (state.stats?.total_lessons_completed || 0) + 1,
        total_time_minutes: (state.stats?.total_time_minutes || 0) + durationMinutes,
      })
      .eq('user_id', userId);

    setTimeout(() => checkAchievements(), 500);
  }, [userId, state.stats, awardXP, checkAchievements]);

  const passQuiz = useCallback(async (quizId: string, score: number, maxScore: number, quizTitle?: string) => {
    if (!userId) return;

    const percentage = (score / maxScore) * 100;
    const isPerfect = percentage >= 100;

    let xp = 15;
    if (percentage >= 80) xp = 30;
    if (percentage >= 90) xp = 45;
    if (isPerfect) xp = 60;

    await awardXP(xp, isPerfect ? 'Perfect quiz score!' : 'Quiz passed', 'quiz', quizId);
    notifyQuizPassed(userId, quizTitle || 'Quiz', Math.round(percentage), xp);

    await supabase
      .from('user_stats')
      .update({
        total_quizzes_passed: (state.stats?.total_quizzes_passed || 0) + 1,
      })
      .eq('user_id', userId);

    setTimeout(() => checkAchievements(), 500);
  }, [userId, state.stats, awardXP, checkAchievements]);

  const clearLevelUp = useCallback(() => {
    setState(prev => ({ ...prev, levelUpData: null }));
  }, []);

  const clearAchievement = useCallback(() => {
    setState(prev => ({ ...prev, newAchievement: null }));
  }, []);

  return {
    ...state,
    awardXP,
    completeLesson,
    passQuiz,
    checkAchievements,
    clearLevelUp,
    clearAchievement,
    streakAtRisk: state.streakAtRisk,
  };
}
