import { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bell, X, Trophy, Zap, CheckCircle, Swords, GraduationCap,
  BookOpen, Medal, Star, Check, Trash2, Clock, Flame,
} from 'lucide-react';
import { supabase, Notification, NotificationType } from '../lib/supabase';

// ── Icon map ─────────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
  Trophy, Zap, CheckCircle, Swords, GraduationCap, BookOpen, Medal, Star, Bell, Flame,
};

const TYPE_STYLES: Record<NotificationType, { dot: string; bg: string }> = {
  achievement:       { dot: 'bg-amber-400',  bg: 'bg-amber-50'  },
  level_up:          { dot: 'bg-violet-500', bg: 'bg-violet-50' },
  quiz_passed:       { dot: 'bg-emerald-500',bg: 'bg-emerald-50'},
  arena_invite:      { dot: 'bg-rose-500',   bg: 'bg-rose-50'   },
  arena_result:      { dot: 'bg-blue-500',   bg: 'bg-blue-50'   },
  course_complete:   { dot: 'bg-teal-500',   bg: 'bg-teal-50'   },
  lesson_published:  { dot: 'bg-sky-500',    bg: 'bg-sky-50'    },
  streak_milestone:  { dot: 'bg-orange-500', bg: 'bg-orange-50' },
  streak_broken:     { dot: 'bg-slate-400',  bg: 'bg-slate-50'  },
  streak_at_risk:    { dot: 'bg-amber-400',  bg: 'bg-amber-50'  },
  system:            { dot: 'bg-slate-400',  bg: 'bg-slate-50'  },
};

// ── Hook ─────────────────────────────────────────────────────────────────────
export function useNotifications(userId: string | undefined) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as Notification[]) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    load();

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setNotifications(prev =>
          prev.map(n => n.id === payload.new.id ? { ...n, ...(payload.new as Notification) } : n)
        );
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, payload => {
        setNotifications(prev => prev.filter(n => n.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId, load]);

  const markRead = useCallback(async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
  }, []);

  const markAllRead = useCallback(async () => {
    if (!userId) return;
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    await supabase.from('notifications').update({ is_read: true })
      .eq('user_id', userId).eq('is_read', false);
  }, [userId]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    await supabase.from('notifications').delete().eq('id', id);
  }, []);

  const clearAll = useCallback(async () => {
    if (!userId) return;
    setNotifications([]);
    await supabase.from('notifications').delete().eq('user_id', userId);
  }, [userId]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return { notifications, loading, unreadCount, markRead, markAllRead, deleteNotification, clearAll };
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60)    return 'just now';
  if (diff < 3600)  return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface NotificationCenterProps {
  userId: string | undefined;
  onNavigate?: (page: string) => void;
  accentGradient?: string;
}

export function NotificationCenter({ userId, onNavigate, accentGradient = 'from-blue-500 to-blue-600' }: NotificationCenterProps) {
  const { notifications, unreadCount, markRead, markAllRead, deleteNotification, clearAll } = useNotifications(userId);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleClick = (n: Notification) => {
    markRead(n.id);
    if (n.action_page && onNavigate) {
      onNavigate(n.action_page);
      setOpen(false);
    }
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell button */}
      <button
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600 hover:text-slate-900"
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm animate-pulse-once">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-100 z-[9999] flex flex-col overflow-hidden animate-dropdown">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${accentGradient} flex items-center justify-center`}>
                <Bell size={14} className="text-white" />
              </div>
              <span className="font-semibold text-slate-900 text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="text-xs bg-rose-100 text-rose-600 font-bold px-2 py-0.5 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors"
                  title="Mark all as read"
                >
                  <Check size={12} /> All read
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-xs text-slate-400 hover:text-rose-500 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                  title="Clear all"
                >
                  <Trash2 size={13} />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors ml-1"
              >
                <X size={15} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto max-h-[420px]">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center px-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                  <Bell size={24} className="text-slate-300" />
                </div>
                <p className="text-sm font-medium text-slate-500">All caught up!</p>
                <p className="text-xs text-slate-400 mt-1">New notifications will appear here</p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-50">
                {notifications.map(n => {
                  const style = TYPE_STYLES[n.type as NotificationType] ?? TYPE_STYLES.system;
                  const IconComp = ICON_MAP[n.icon] ?? Bell;
                  return (
                    <li
                      key={n.id}
                      className={`group flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.is_read ? 'bg-blue-50/40' : ''}`}
                      onClick={() => handleClick(n)}
                    >
                      {/* Icon blob */}
                      <div className={`mt-0.5 w-9 h-9 rounded-xl ${style.bg} flex items-center justify-center flex-shrink-0`}>
                        <IconComp size={16} className={`${style.dot.replace('bg-', 'text-')}`} />
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm leading-snug ${!n.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-700'}`}>
                          {n.title}
                        </p>
                        {n.body && (
                          <p className="text-xs text-slate-500 mt-0.5 leading-relaxed line-clamp-2">{n.body}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock size={10} className="text-slate-300" />
                          <span className="text-[10px] text-slate-400">{timeAgo(n.created_at)}</span>
                          {!n.is_read && (
                            <span className={`w-1.5 h-1.5 rounded-full ${style.dot} ml-1`} />
                          )}
                        </div>
                      </div>

                      {/* Delete */}
                      <button
                        onClick={e => { e.stopPropagation(); deleteNotification(n.id); }}
                        className="opacity-0 group-hover:opacity-100 mt-0.5 p-1 rounded-lg text-slate-300 hover:text-rose-400 hover:bg-rose-50 transition-all flex-shrink-0"
                        title="Dismiss"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* Footer */}
          {notifications.length > 0 && (
            <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/50">
              <p className="text-[11px] text-slate-400 text-center">
                Showing {notifications.length} notification{notifications.length !== 1 ? 's' : ''} · last 50
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
