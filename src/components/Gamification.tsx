import { useState, useEffect, useRef } from 'react';
import { supabase, UserStats, Achievement, UserAchievement, XPTransaction } from '../lib/supabase';
import { Flame, Star, Trophy, Zap, Award, TrendingUp, Crown, Sparkles, X, ChevronRight, Clock, Target, BookOpen } from 'lucide-react';

// ── XP & Level Bar ─────────────────────────────────────────────────────────────
export function XPLevelBar({ stats, compact = false }: { stats: UserStats | null; compact?: boolean }) {
  const [animatedXp, setAnimatedXp] = useState(0);
  const prevXp = useRef(0);

  useEffect(() => {
    if (stats) {
      const diff = stats.total_xp - prevXp.current;
      if (diff > 0) {
        const steps = 20;
        const increment = diff / steps;
        let current = prevXp.current;
        const interval = setInterval(() => {
          current += increment;
          if (current >= stats.total_xp) {
            setAnimatedXp(stats.total_xp);
            clearInterval(interval);
          } else {
            setAnimatedXp(Math.floor(current));
          }
        }, 30);
        return () => clearInterval(interval);
      }
      setAnimatedXp(stats.total_xp);
      prevXp.current = stats.total_xp;
    }
  }, [stats?.total_xp]);

  if (!stats) return null;

  const progress = ((stats.total_xp % stats.xp_to_next_level) / stats.xp_to_next_level) * 100;
  const levelProgress = stats.total_xp - (stats.xp_to_next_level * (Math.pow(1.2, stats.current_level - 1) - 1) / 0.2);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-200">
          <span className="text-white font-black text-xs">{stats.current_level}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
        <span className="text-xs text-slate-500 font-medium">{animatedXp} XP</span>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-xl shadow-orange-200">
              <span className="text-white font-black text-xl">{stats.current_level}</span>
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-lg flex items-center justify-center shadow border border-slate-100">
              <Star size={11} className="text-amber-500 fill-amber-500" />
            </div>
          </div>
          <div>
            <p className="font-bold text-slate-800">Level {stats.current_level}</p>
            <p className="text-xs text-slate-500">{animatedXp.toLocaleString()} Total XP</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Next Level</p>
          <p className="font-semibold text-slate-700">{stats.xp_to_next_level - (stats.total_xp % stats.xp_to_next_level)} XP</p>
        </div>
      </div>
      <div className="relative">
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 rounded-full transition-all duration-1000 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute inset-0 bg-white/30 animate-shimmer" />
          </div>
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-slate-400">
          <span>Level {stats.current_level}</span>
          <span>Level {stats.current_level + 1}</span>
        </div>
      </div>
    </div>
  );
}

// ── Streak Fire ─────────────────────────────────────────────────────────────────
export function StreakDisplay({ stats, atRisk = false }: { stats: UserStats | null; atRisk?: boolean }) {
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (stats && stats.streak_days > 0) {
      const interval = setInterval(() => {
        setPulse(true);
        setTimeout(() => setPulse(false), 500);
      }, atRisk ? 1200 : 3000);
      return () => clearInterval(interval);
    }
  }, [stats?.streak_days, atRisk]);

  if (!stats) return null;

  const isHotStreak = stats.streak_days >= 7;
  const isOnFire = stats.streak_days >= 30;

  const bg = atRisk
    ? 'from-amber-400 via-yellow-400 to-orange-400'
    : isOnFire
      ? 'from-red-500 via-orange-500 to-amber-400'
      : isHotStreak
        ? 'from-orange-400 to-amber-400'
        : 'from-slate-800 to-slate-900';

  return (
    <div className={`relative bg-gradient-to-br ${bg} rounded-2xl p-4 text-white overflow-hidden`}>
      {/* At-risk animated border */}
      {atRisk && (
        <div className="absolute inset-0 rounded-2xl border-2 border-white/40 animate-pulse pointer-events-none" />
      )}
      {(isHotStreak || isOnFire) && !atRisk && (
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-1/2 left-0 w-full h-px bg-gradient-to-r from-transparent via-white to-transparent animate-pulse" />
        </div>
      )}
      <div className="relative flex items-center gap-3">
        <div className={`relative ${pulse ? 'animate-bounce' : ''}`}>
          <Flame
            size={40}
            className={`${atRisk ? 'text-white opacity-70' : isOnFire ? 'text-yellow-300' : isHotStreak ? 'text-orange-300' : 'text-orange-400'} drop-shadow-lg`}
          />
          {atRisk && (
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-60" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white/80" />
            </span>
          )}
          {isOnFire && !atRisk && (
            <Sparkles size={16} className="absolute -top-1 -right-1 text-yellow-200 animate-ping" />
          )}
        </div>
        <div>
          <div className="flex items-baseline gap-1">
            <span className="text-3xl font-black">{stats.streak_days}</span>
            <span className="text-sm opacity-80">day streak</span>
          </div>
          <p className={`text-xs mt-0.5 font-medium ${atRisk ? 'text-white' : 'opacity-60'}`}>
            {atRisk
              ? 'Study today to keep it alive!'
              : stats.streak_days > 0
                ? `Best: ${stats.longest_streak} days`
                : 'Start learning today!'}
          </p>
        </div>
      </div>
      {atRisk && (
        <div className="relative mt-2 bg-white/20 rounded-xl px-3 py-1.5 text-[11px] font-semibold text-white flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          Complete a lesson now to save your streak
        </div>
      )}
      {!atRisk && stats.last_activity_date && (
        <p className="text-[10px] opacity-50 mt-2 relative">
          Last activity: {new Date(stats.last_activity_date).toLocaleDateString()}
        </p>
      )}
    </div>
  );
}

// ── Achievement Badge ───────────────────────────────────────────────────────────
export function AchievementBadge({ achievement, earned, size = 'md', onClick }: {
  achievement: Achievement;
  earned?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}) {
  const sizeClasses = {
    sm: 'w-12 h-12',
    md: 'w-16 h-16',
    lg: 'w-20 h-20'
  };

  const iconSizes = { sm: 20, md: 28, lg: 36 };

  return (
    <button
      onClick={onClick}
      className={`relative ${sizeClasses[size]} rounded-2xl ${earned ? `bg-gradient-to-br ${achievement.color}` : 'bg-slate-100'} flex items-center justify-center shadow-lg ${earned ? 'shadow-amber-200/50' : ''} transition-all hover:scale-105 ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      style={!earned ? { filter: 'grayscale(100%) opacity(0.5)' } : {}}
    >
      <span className={`text-${iconSizes[size]/4}xl ${earned ? 'text-white' : 'text-slate-400'}`}>
        {achievement.icon}
      </span>
      {earned && (
        <div className="absolute -top-1 -right-1 w-4 h-4 bg-white rounded-full flex items-center justify-center shadow border border-slate-100">
          <Star size={10} className="text-amber-500 fill-amber-500" />
        </div>
      )}
    </button>
  );
}

// ── Achievement Card ────────────────────────────────────────────────────────────
function AchievementCard({ achievement, userAchievement }: {
  achievement: Achievement;
  userAchievement?: UserAchievement;
}) {
  const earned = !!userAchievement;

  return (
    <div className={`relative bg-white rounded-2xl border ${earned ? 'border-amber-200 shadow-lg shadow-amber-100' : 'border-slate-200'} p-4 transition-all hover:shadow-md`}>
      {earned && (
        <div className="absolute top-2 right-2">
          <div className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">Earned</div>
        </div>
      )}
      <div className="flex items-start gap-3">
        <AchievementBadge achievement={achievement} earned={earned} size="md" />
        <div className="flex-1 min-w-0">
          <h3 className={`font-bold ${earned ? 'text-slate-800' : 'text-slate-400'}`}>{achievement.name}</h3>
          <p className={`text-xs ${earned ? 'text-slate-600' : 'text-slate-400'}`}>{achievement.description}</p>
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
              <Zap size={12} /> +{achievement.xp_reward} XP
            </div>
            {earned && userAchievement && (
              <span className="text-[10px] text-slate-400">
                {new Date(userAchievement.earned_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Achievements Gallery Modal ──────────────────────────────────────────────────
export function AchievementsGallery({ userId, onClose }: { userId: string; onClose?: () => void }) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAchievement, setSelectedAchievement] = useState<Achievement | null>(null);

  useEffect(() => {
    (async () => {
      const [{ data: a }, { data: ua }] = await Promise.all([
        supabase.from('achievements').select('*').eq('is_active', true).order('sort_order'),
        supabase.from('user_achievements').select('*, achievement:achievements(*)').eq('user_id', userId)
      ]);
      if (a) setAchievements(a);
      if (ua) setUserAchievements(ua as unknown as UserAchievement[]);
      setLoading(false);
    })();
  }, [userId]);

  const earnedIds = new Set(userAchievements.map(ua => ua.achievement_id));
  const earned = achievements.filter(a => earnedIds.has(a.id));
  const locked = achievements.filter(a => !earnedIds.has(a.id));

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 animate-pulse">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="h-32 rounded-2xl bg-slate-100" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Achievements</h2>
          <p className="text-sm text-slate-500">{earned.length} of {achievements.length} unlocked</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1.5 bg-amber-100 text-amber-700 text-sm font-bold rounded-full">
            {earned.length} Earned
          </div>
        </div>
      </div>

      {earned.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Earned</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {earned.map(a => {
              const ua = userAchievements.find(u => u.achievement_id === a.id);
              return <AchievementCard key={a.id} achievement={a} userAchievement={ua} />;
            })}
          </div>
        </div>
      )}

      {locked.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Locked</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {locked.map(a => <AchievementCard key={a.id} achievement={a} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Leaderboard ─────────────────────────────────────────────────────────────────
export function Leaderboard({ limit = 10 }: { limit?: number }) {
  const [entries, setEntries] = useState<(UserStats & { profiles: { full_name: string; avatar_url: string | null } })[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'all' | 'week' | 'month'>('all');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('user_stats')
        .select('*, profiles!user_stats_user_id_fkey(full_name, avatar_url)')
        .order('total_xp', { ascending: false })
        .limit(limit);

      if (data && !error) {
        setEntries(data as unknown as (UserStats & { profiles: { full_name: string; avatar_url: string | null } })[]);
      }
      setLoading(false);
    })();
  }, [limit, timeframe]);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 animate-pulse">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-12 rounded-xl bg-slate-100 mb-2" />
        ))}
      </div>
    );
  }

  const getRankStyle = (rank: number) => {
    if (rank === 1) return { bg: 'bg-gradient-to-r from-amber-400 to-yellow-500', text: 'text-white', icon: Crown };
    if (rank === 2) return { bg: 'bg-gradient-to-r from-slate-300 to-slate-400', text: 'text-white', icon: Trophy };
    if (rank === 3) return { bg: 'bg-gradient-to-r from-amber-600 to-orange-700', text: 'text-white', icon: Award };
    return { bg: 'bg-slate-100', text: 'text-slate-600', icon: null };
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy size={18} className="text-amber-500" />
          <h3 className="font-bold text-slate-800">Leaderboard</h3>
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-0.5">
          {(['all', 'week', 'month'] as const).map(tf => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-2 py-1 text-xs font-medium rounded-md transition-colors ${
                timeframe === tf ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tf === 'all' ? 'All Time' : tf === 'week' ? 'This Week' : 'This Month'}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y divide-slate-100">
        {entries.map((entry, idx) => {
          const rank = idx + 1;
          const style = getRankStyle(rank);
          const RankIcon = style.icon;

          return (
            <div key={entry.id} className={`flex items-center gap-3 px-4 py-3 ${rank <= 3 ? 'bg-amber-50/30' : ''} transition-colors hover:bg-slate-50`}>
              <div className={`w-8 h-8 rounded-xl ${style.bg} flex items-center justify-center font-black text-sm ${style.text}`}>
                {RankIcon ? <RankIcon size={16} /> : rank}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 text-sm truncate">{entry.profiles?.full_name || 'Anonymous'}</p>
                <p className="text-xs text-slate-500">Level {entry.current_level} · {entry.streak_days} day streak</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-800">{entry.total_xp.toLocaleString()}</p>
                <p className="text-[10px] text-slate-400">XP</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Quick Stats Grid ────────────────────────────────────────────────────────────
export function QuickStatsGrid({ stats }: { stats: UserStats | null }) {
  if (!stats) return null;

  const statsItems = [
    { icon: BookOpen, label: 'Lessons', value: stats.total_lessons_completed, color: 'text-blue-500', bg: 'bg-blue-100' },
    { icon: Target, label: 'Quizzes Passed', value: stats.total_quizzes_passed, color: 'text-emerald-500', bg: 'bg-emerald-100' },
    { icon: Clock, label: 'Time Spent', value: `${Math.floor(stats.total_time_minutes / 60)}h ${stats.total_time_minutes % 60}m`, color: 'text-violet-500', bg: 'bg-violet-100' },
    { icon: Flame, label: 'Best Streak', value: `${stats.longest_streak} days`, color: 'text-orange-500', bg: 'bg-orange-100' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {statsItems.map(({ icon: Icon, label, value, color, bg }) => (
        <div key={label} className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 hover:shadow-md transition-shadow">
          <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center`}>
            <Icon size={18} className={color} />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-800">{value}</p>
            <p className="text-[11px] text-slate-500">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Level Up Celebration Modal ──────────────────────────────────────────────────
export function LevelUpModal({ level, xpGained, onClose }: { level: number; xpGained: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm p-8 text-center relative overflow-hidden animate-scaleIn">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-100/50 to-transparent pointer-events-none" />

        {/* Confetti effect */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(20)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-10px`,
                backgroundColor: ['#fbbf24', '#f97316', '#ef4444', '#8b5cf6', '#3b82f6'][Math.floor(Math.random() * 5)],
                animationDelay: `${Math.random() * 0.5}s`,
                animationDuration: `${1 + Math.random()}s`
              }}
            />
          ))}
        </div>

        <div className="relative">
          <div className="w-24 h-24 mx-auto mb-4 rounded-3xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 flex items-center justify-center shadow-2xl shadow-orange-300">
            <span className="text-white font-black text-4xl">{level}</span>
          </div>

          <div className="flex items-center justify-center gap-1 text-amber-500 mb-2">
            {[...Array(5)].map((_, i) => (
              <Star key={i} size={20} className="fill-amber-400" />
            ))}
          </div>

          <h2 className="text-2xl font-black text-slate-800 mb-1">Level Up!</h2>
          <p className="text-slate-500 mb-4">You've reached Level {level}</p>

          <div className="flex items-center justify-center gap-2 text-amber-600 font-bold mb-6">
            <Zap size={20} className="fill-amber-400" />
            <span>+{xpGained} XP Earned</span>
          </div>

          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            Awesome!
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Achievement Unlocked Toast ─────────────────────────────────────────────────
export function AchievementToast({ achievement, onClose }: { achievement: Achievement; onClose: () => void }) {
  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[90] animate-slide-up">
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl p-4 shadow-2xl flex items-center gap-4 min-w-[300px]">
        <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${achievement.color} flex items-center justify-center shadow-lg`}>
          <span className="text-2xl">{achievement.icon}</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-400 font-bold mb-0.5">
            <Sparkles size={10} /> Achievement Unlocked
          </div>
          <p className="font-bold">{achievement.name}</p>
          <p className="text-xs text-slate-400">{achievement.description}</p>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-white">
          <X size={18} />
        </button>
      </div>
    </div>
  );
}

// ── XP Gain Popup ───────────────────────────────────────────────────────────────
export function XPGainPopup({ amount, reason }: { amount: number; reason: string }) {
  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[100] animate-xp-pop pointer-events-none">
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-full shadow-2xl">
          <Zap size={24} className="animate-pulse" />
          <span className="text-2xl font-black">+{amount} XP</span>
        </div>
        <p className="mt-2 text-sm text-slate-600 font-medium">{reason}</p>
      </div>
    </div>
  );
}
