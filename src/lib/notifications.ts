import { supabase, NotificationType } from './supabase';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  icon?: string;
  actionPage?: string;
}

export async function createNotification(params: CreateNotificationParams): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    body: params.body,
    icon: params.icon ?? iconForType(params.type),
    action_page: params.actionPage ?? null,
  });
  if (error) console.error('[notifications] insert failed:', error.message);
}

// Convenience wrappers used throughout the app

export function notifyAchievement(userId: string, name: string, xpReward: number) {
  return createNotification({
    userId,
    type: 'achievement',
    title: `Achievement Unlocked: ${name}`,
    body: `You earned +${xpReward} XP for this achievement.`,
    icon: 'Trophy',
    actionPage: 'progress',
  });
}

export function notifyLevelUp(userId: string, newLevel: number) {
  return createNotification({
    userId,
    type: 'level_up',
    title: `Level Up! You reached Level ${newLevel}`,
    body: 'Keep going — more rewards await at higher levels.',
    icon: 'Zap',
    actionPage: 'progress',
  });
}

export function notifyQuizPassed(userId: string, quizTitle: string, score: number, xp: number) {
  return createNotification({
    userId,
    type: 'quiz_passed',
    title: `Quiz Passed: ${quizTitle}`,
    body: `You scored ${score}% and earned +${xp} XP.`,
    icon: 'CheckCircle',
    actionPage: 'my-courses',
  });
}

export function notifyArenaInvite(userId: string, arenaTitle: string) {
  return createNotification({
    userId,
    type: 'arena_invite',
    title: 'Live Arena Session Starting!',
    body: `"${arenaTitle}" is now live — join now before it closes.`,
    icon: 'Swords',
    actionPage: 'arena',
  });
}

export function notifyArenaResult(userId: string, placement: number, totalPlayers: number, xp: number) {
  const medal = placement === 1 ? '1st' : placement === 2 ? '2nd' : placement === 3 ? '3rd' : `${placement}th`;
  return createNotification({
    userId,
    type: 'arena_result',
    title: `Arena finished — you placed ${medal}!`,
    body: `Out of ${totalPlayers} players. You earned +${xp} XP.`,
    icon: placement <= 3 ? 'Medal' : 'Swords',
    actionPage: 'arena',
  });
}

export function notifyLessonPublished(userId: string, lessonTitle: string, levelLabel: string) {
  return createNotification({
    userId,
    type: 'lesson_published',
    title: `New lesson available: ${lessonTitle}`,
    body: `Added to ${levelLabel} — start learning now.`,
    icon: 'BookOpen',
    actionPage: 'my-courses',
  });
}

export function notifyCourseComplete(userId: string, courseTitle: string, xp: number) {
  return createNotification({
    userId,
    type: 'course_complete',
    title: `Course Complete: ${courseTitle}`,
    body: `Congratulations! You earned +${xp} XP.`,
    icon: 'GraduationCap',
    actionPage: 'my-courses',
  });
}

export function notifyStreakMilestone(userId: string, days: number) {
  const label = days >= 365 ? 'Legendary! You are unstoppable.'
    : days >= 100 ? 'Incredible dedication. You are in elite territory.'
    : days >= 30  ? 'A full month of daily learning. Outstanding!'
    : days >= 14  ? 'Two weeks strong. Keep the fire burning!'
    : '7 days in a row. You are building a real habit!';
  return createNotification({
    userId,
    type: 'streak_milestone',
    title: `${days}-Day Streak Reached!`,
    body: label,
    icon: 'Flame',
    actionPage: 'overview',
  });
}

export function notifyStreakBroken(userId: string, lostDays: number) {
  return createNotification({
    userId,
    type: 'streak_broken',
    title: `${lostDays}-Day Streak Lost`,
    body: `Your streak was reset. Every champion has setbacks — start fresh today and build it back!`,
    icon: 'Flame',
    actionPage: 'my-courses',
  });
}

export async function notifyStreakAtRisk(userId: string, currentDays: number): Promise<void> {
  // Only send once per day — check sessionStorage to avoid spam
  const today = new Date().toISOString().split('T')[0];
  const key = `streak_at_risk_notif_${userId}_${today}`;
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(key)) return;
  if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, '1');

  return createNotification({
    userId,
    type: 'streak_at_risk',
    title: `Your ${currentDays}-Day Streak Is at Risk!`,
    body: `You haven't studied yet today. Complete any lesson or quiz to keep your streak alive.`,
    icon: 'Flame',
    actionPage: 'my-courses',
  });
}

function iconForType(type: NotificationType): string {
  switch (type) {
    case 'achievement':       return 'Trophy';
    case 'level_up':          return 'Zap';
    case 'quiz_passed':       return 'CheckCircle';
    case 'arena_invite':      return 'Swords';
    case 'arena_result':      return 'Medal';
    case 'course_complete':   return 'GraduationCap';
    case 'lesson_published':  return 'BookOpen';
    case 'streak_milestone':  return 'Flame';
    case 'streak_broken':     return 'Flame';
    case 'streak_at_risk':    return 'Flame';
    default:                  return 'Bell';
  }
}
