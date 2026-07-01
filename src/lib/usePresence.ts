import { useEffect, useRef } from 'react';
import { supabase } from './supabase';

const HEARTBEAT_INTERVAL_MS = 60_000; // 1 minute
const OFFLINE_THRESHOLD_MS = 2 * 60_000; // 2 minutes

export type ActivityAction =
  | 'login' | 'logout'
  | 'lesson_open' | 'lesson_complete'
  | 'quiz_start' | 'quiz_submit'
  | 'course_enroll' | 'course_complete'
  | 'page_view'
  | 'arena_join' | 'arena_complete'
  | 'forum_post'
  | 'study_session'
  | 'certificate_earned';

interface LogActivityParams {
  action: ActivityAction;
  description?: string;
  page?: string;
  metadata?: Record<string, unknown>;
}

let currentUserId: string | null = null;

export function setActivityUser(userId: string | null) {
  currentUserId = userId;
}

export function logActivity({ action, description = '', page = '', metadata = {} }: LogActivityParams) {
  if (!currentUserId) return;
  supabase.from('activity_log').insert({
    user_id: currentUserId,
    action,
    description,
    page,
    metadata,
  }).then(() => {
    supabase.from('user_presence')
      .update({
        last_activity: description || action,
        last_page: page,
        last_seen_at: new Date().toISOString(),
        is_online: true,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', currentUserId)
      .then(() => {});
  }).catch(() => {});
}

export function usePresence(userId: string | undefined, fullName: string | undefined) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!userId) return;
    setActivityUser(userId);

    const upsertPresence = async (isOnline: boolean, activity = 'Online', page = '') => {
      const now = new Date().toISOString();
      await supabase.from('user_presence').upsert({
        user_id: userId,
        is_online: isOnline,
        last_seen_at: now,
        last_activity: activity,
        last_page: page,
        session_started_at: isOnline ? now : null,
        updated_at: now,
      }, { onConflict: 'user_id' });
    };

    upsertPresence(true, 'Signed in', 'dashboard');
    logActivity({ action: 'login', description: `${fullName ?? 'User'} signed in`, page: 'dashboard' });

    intervalRef.current = setInterval(() => {
      upsertPresence(true, 'Online', window.location.hash.replace('#', '') || 'dashboard');
    }, HEARTBEAT_INTERVAL_MS);

    const markOffline = () => {
      supabase.from('user_presence')
        .update({ is_online: false, last_seen_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .then(() => {});
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        upsertPresence(true, 'Active', window.location.hash.replace('#', '') || 'dashboard');
      } else {
        markOffline();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('beforeunload', markOffline);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('beforeunload', markOffline);
      markOffline();
      logActivity({ action: 'logout', description: `${fullName ?? 'User'} signed out` });
      setActivityUser(null);
    };
  }, [userId, fullName]);
}

export { OFFLINE_THRESHOLD_MS };
