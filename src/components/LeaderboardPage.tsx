import { useState, useEffect, useMemo } from 'react';
import { Crown, Medal, Trophy, TrendingUp, Flame, Star, Sparkles, Loader2, ChevronUp } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LeaderboardEntry {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_xp: number;
  current_level: number;
  streak_days: number;
  rank: number;
}

type TimeFilter = 'today' | 'week' | 'month';

const TABS: { key: TimeFilter; label: string; icon: React.ElementType }[] = [
  { key: 'today', label: 'Today', icon: Star },
  { key: 'week', label: 'This Week', icon: TrendingUp },
  { key: 'month', label: 'This Month', icon: Crown },
];

export function LeaderboardPage({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<TimeFilter>('today');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadLeaderboard();
  }, [activeTab]);

  async function loadLeaderboard() {
    setLoading(true);
    setError(null);
    try {
      // Calculate date range based on tab
      const now = new Date();
      let startDate: Date;

      if (activeTab === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (activeTab === 'week') {
        const dayOfWeek = now.getDay();
        const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        startDate = new Date(now.getFullYear(), now.getMonth(), diff);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      }

      // Fetch XP transactions within date range, aggregated by user
      const { data: xpData, error: xpErr } = await supabase
        .from('xp_transactions')
        .select('user_id, amount, created_at')
        .gte('created_at', startDate.toISOString())
        .lte('created_at', now.toISOString());

      if (xpErr) throw xpErr;

      // Aggregate XP by user
      const xpByUser = new Map<string, number>();
      for (const tx of xpData || []) {
        const current = xpByUser.get(tx.user_id) || 0;
        xpByUser.set(tx.user_id, current + tx.amount);
      }

      // Get user stats and profiles for users with XP
      const userIds = Array.from(xpByUser.keys());

      if (userIds.length === 0) {
        setEntries([]);
        setLoading(false);
        return;
      }

      const { data: profilesData, error: profilesErr } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', userIds);

      if (profilesErr) throw profilesErr;

      const { data: statsData, error: statsErr } = await supabase
        .from('user_stats')
        .select('user_id, current_level, streak_days')
        .in('user_id', userIds);

      if (statsErr) throw statsErr;

      // Combine data
      const statsMap = new Map((statsData || []).map(s => [s.user_id, s]));
      const profilesMap = new Map((profilesData || []).map(p => [p.id, p]));

      const leaderboardData: LeaderboardEntry[] = userIds.map(user_id => {
        const profile = profilesMap.get(user_id);
        const stats = statsMap.get(user_id);
        return {
          user_id,
          full_name: profile?.full_name || 'Anonymous',
          avatar_url: profile?.avatar_url || null,
          total_xp: xpByUser.get(user_id) || 0,
          current_level: stats?.current_level || 1,
          streak_days: stats?.streak_days || 0,
          rank: 0,
        };
      });

      // Sort by XP and assign ranks
      leaderboardData.sort((a, b) => b.total_xp - a.total_xp);
      leaderboardData.forEach((entry, index) => {
        entry.rank = index + 1;
      });

      setEntries(leaderboardData);
    } catch (e: any) {
      setError(e.message || 'Failed to load leaderboard');
    } finally {
      setLoading(false);
    }
  }

  // Find current user's rank
  const userRank = useMemo(() => {
    return entries.find(e => e.user_id === userId)?.rank || null;
  }, [entries, userId]);

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Trophy className="w-7 h-7 text-amber-500" />
            Leaderboard
          </h1>
          <p className="text-slate-500 mt-1">See the top performing students</p>
        </div>
        {userRank && (
          <div className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl shadow-lg">
            <ChevronUp className="w-4 h-4" />
            <span className="text-sm font-semibold">Your Rank: #{userRank}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
        {TABS.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-white shadow-md text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${isActive ? 'text-amber-500' : ''}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-500 mt-3 text-sm">Loading rankings...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center justify-center py-12 text-rose-600 bg-rose-50 rounded-2xl border border-rose-200">
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Trophy className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No activity yet</h3>
          <p className="text-slate-500 mt-1 text-sm">Complete lessons or quizzes to appear on the leaderboard!</p>
        </div>
      )}

      {/* Leaderboard */}
      {!loading && !error && entries.length > 0 && (
        <div className="space-y-6">
          {/* Podium Section - Top 3 */}
          {entries.length >= 1 && (
            <PodiumSection entries={entries.slice(0, 3)} userId={userId} />
          )}

          {/* Rest of Rankings */}
          {entries.length > 3 && (
            <RankingsList entries={entries.slice(3)} userId={userId} />
          )}
        </div>
      )}
    </div>
  );
}

// Podium display - shows top 3 with special styling
function PodiumSection({ entries, userId }: { entries: LeaderboardEntry[]; userId: string }) {
  const [first, second, third] = entries;

  return (
    <div className="bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 rounded-3xl p-6 shadow-2xl">
      {/* Podium Header */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 rounded-full">
          <Crown className="w-5 h-5 text-amber-400" />
          <span className="text-amber-300 font-semibold text-sm">Top Performers</span>
        </div>
      </div>

      {/* Podium Display - 2nd, 1st, 3rd order visually */}
      <div className="flex items-end justify-center gap-3 sm:gap-6">
        {/* 2nd Place - Left */}
        {second && (
          <PodiumCard
            entry={second}
            position={2}
            isCurrentUser={second.user_id === userId}
            height="h-32 sm:h-40"
          />
        )}

        {/* 1st Place - Center (Tallest) */}
        {first && (
          <PodiumCard
            entry={first}
            position={1}
            isCurrentUser={first.user_id === userId}
            height="h-40 sm:h-52"
          />
        )}

        {/* 3rd Place - Right */}
        {third && (
          <PodiumCard
            entry={third}
            position={3}
            isCurrentUser={third.user_id === userId}
            height="h-28 sm:h-32"
          />
        )}
      </div>
    </div>
  );
}

function PodiumCard({ entry, position, isCurrentUser, height }: {
  entry: LeaderboardEntry;
  position: number;
  isCurrentUser: boolean;
  height: string;
}) {
  const positionConfig = {
    1: {
      bg: 'from-amber-400 to-yellow-500',
      medal: 'bg-gradient-to-br from-amber-400 to-yellow-500 shadow-lg shadow-amber-500/30',
      ring: 'ring-amber-400',
      glow: 'shadow-amber-500/30',
      label: '1st',
      medalIcon: Crown,
    },
    2: {
      bg: 'from-slate-300 to-slate-400',
      medal: 'bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg shadow-slate-400/30',
      ring: 'ring-slate-400',
      glow: 'shadow-slate-400/20',
      label: '2nd',
      medalIcon: Medal,
    },
    3: {
      bg: 'from-amber-600 to-orange-600',
      medal: 'bg-gradient-to-br from-amber-600 to-orange-600 shadow-lg shadow-orange-600/30',
      ring: 'ring-orange-500',
      glow: 'shadow-orange-600/20',
      label: '3rd',
      medalIcon: Medal,
    },
  };

  const config = positionConfig[position as keyof typeof positionConfig];
  const MedalIcon = config.medalIcon;

  return (
    <div className={`relative ${height} flex flex-col items-center`}>
      {/* Avatar */}
      <div className={`relative mb-2 ${isCurrentUser ? 'ring-4 ring-blue-500 rounded-full' : ''}`}>
        <div className={`w-16 sm:w-20 h-16 sm:h-20 rounded-full bg-gradient-to-br ${config.bg} p-0.5 shadow-xl ${config.glow}`}>
          {entry.avatar_url ? (
            <img
              src={entry.avatar_url}
              alt={entry.full_name}
              className="w-full h-full rounded-full object-cover border-2 border-white/20"
            />
          ) : (
            <div className="w-full h-full rounded-full bg-slate-700 flex items-center justify-center">
              <span className="text-2xl sm:text-3xl font-bold text-white">
                {entry.full_name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
        </div>

        {/* Medal Badge */}
        <div className={`absolute -bottom-1 -right-1 w-7 h-7 sm:w-8 sm:h-8 ${config.medal} rounded-full flex items-center justify-center border-2 border-white`}>
          <MedalIcon className="w-4 h-4 text-white" />
        </div>
      </div>

      {/* Name & Stats */}
      <div className="text-center mt-1">
        <p className={`text-sm sm:text-base font-bold truncate max-w-[100px] sm:max-w-[120px] ${isCurrentUser ? 'text-blue-400' : 'text-white'}`}>
          {entry.full_name}
          {isCurrentUser && <span className="text-xs ml-1">(You)</span>}
        </p>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span className="text-xs sm:text-sm font-semibold text-amber-300">{entry.total_xp.toLocaleString()} XP</span>
        </div>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className="text-xs text-slate-400">Lv.{entry.current_level}</span>
          {entry.streak_days > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-orange-400">
              <Flame className="w-3 h-3" />{entry.streak_days}d
            </span>
          )}
        </div>
      </div>

      {/* Position Label */}
      <div className={`mt-auto w-full bg-gradient-to-t ${config.bg} to-transparent pt-6 pb-2 rounded-t-xl opacity-80`}>
        <p className="text-center text-white font-bold text-lg">{config.label}</p>
      </div>
    </div>
  );
}

function RankingsList({ entries, userId }: { entries: LeaderboardEntry[]; userId: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-blue-500" />
          Full Rankings
        </h3>
      </div>
      <div className="divide-y divide-slate-100">
        {entries.map((entry, index) => (
          <RankingRow
            key={entry.user_id}
            entry={entry}
            isCurrentUser={entry.user_id === userId}
          />
        ))}
      </div>
    </div>
  );
}

function RankingRow({ entry, isCurrentUser }: { entry: LeaderboardEntry; isCurrentUser: boolean }) {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${isCurrentUser ? 'bg-blue-50/50 border-l-4 border-l-blue-500' : ''} hover:bg-slate-50 transition-colors`}>
      {/* Rank */}
      <div className="w-8 text-center flex-shrink-0">
        <span className={`text-lg font-bold ${isCurrentUser ? 'text-blue-600' : 'text-slate-400'}`}>
          #{entry.rank}
        </span>
      </div>

      {/* Avatar */}
      <div className="relative flex-shrink-0">
        {entry.avatar_url ? (
          <img
            src={entry.avatar_url}
            alt={entry.full_name}
            className={`w-10 h-10 rounded-full object-cover ${isCurrentUser ? 'ring-2 ring-blue-500' : ''}`}
          />
        ) : (
          <div className={`w-10 h-10 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center ${isCurrentUser ? 'ring-2 ring-blue-500' : ''}`}>
            <span className="text-sm font-bold text-white">{entry.full_name.charAt(0).toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Name & Stats */}
      <div className="flex-1 min-w-0">
        <p className={`font-semibold truncate ${isCurrentUser ? 'text-blue-700' : 'text-slate-800'}`}>
          {entry.full_name}
          {isCurrentUser && <span className="ml-2 text-xs bg-blue-500 text-white px-1.5 py-0.5 rounded-full">You</span>}
        </p>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-slate-500">Level {entry.current_level}</span>
          {entry.streak_days > 0 && (
            <span className="flex items-center gap-0.5 text-xs text-orange-500">
              <Flame className="w-3 h-3" />{entry.streak_days} day streak
            </span>
          )}
        </div>
      </div>

      {/* XP */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="font-bold text-slate-800">{entry.total_xp.toLocaleString()}</span>
        <span className="text-xs text-slate-400">XP</span>
      </div>
    </div>
  );
}
