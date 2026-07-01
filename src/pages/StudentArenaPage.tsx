import { useEffect, useState, useMemo } from 'react';
import {
  Swords, Clock, Trophy, Users, ChevronRight,
  Loader2, AlertCircle, Play, CheckCircle, Zap, Timer,
  Crown, Medal, Target, BookOpen,
  Star, TrendingUp, XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { QuizContainer } from '../components/InteractiveQuiz';
import { Quiz, QuizQuestion, QuizOption } from '../lib/supabase';

interface Arena {
  id: string;
  title: string;
  description: string | null;
  course_id: string;
  quiz_id: string | null;
  category_id: string | null;
  time_limit_seconds: number;
  points_reward: number;
  status: string;
  scheduled_start: string | null;
  scheduled_end: string | null;
  max_participants: number;
  created_at: string;
  course_title?: string;
  quiz_title?: string;
  category_name?: string;
  participant_count?: number;
  is_joined?: boolean;
  user_score?: number;
  user_rank?: number;
  has_completed?: boolean;
}

interface Participant {
  id: string;
  arena_id: string;
  student_id: string;
  student_name: string;
  student_avatar: string | null;
  score: number;
  rank: number | null;
  completed_at: string | null;
}

interface ArenaAttempt {
  score: number;
  max_score: number;
  percentage: number;
  time_taken_seconds: number | null;
  completed_at: string | null;
}

type TabType = 'upcoming' | 'active' | 'past';

export function StudentArenaPage({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedArena, setSelectedArena] = useState<Arena | null>(null);
  const [showQuiz, setShowQuiz] = useState(false);

  useEffect(() => {
    loadArenas();
  }, [userId]);

  async function loadArenas() {
    setLoading(true);
    setError(null);
    try {
      // Get all arenas
      const { data: arenasData, error: arenasErr } = await supabase
        .from('arenas')
        .select('*')
        .order('created_at', { ascending: false });

      if (arenasErr) throw arenasErr;

      // Get user's category
      const { data: profileData } = await supabase
        .from('profiles')
        .select('category_id')
        .eq('id', userId)
        .single();

      const userCategoryId = profileData?.category_id;

      // Get participant counts and user's participation
      const arenaIds = (arenasData || []).map(a => a.id);
      let participantCounts: Record<string, number> = {};
      let userParticipations: Record<string, { score: number; rank: number | null; completed_at: string | null }> = {};

      if (arenaIds.length > 0) {
        const { data: participantsData } = await supabase
          .from('arena_participants')
          .select('arena_id, student_id, score, rank, completed_at')
          .in('arena_id', arenaIds);

        if (participantsData) {
          for (const p of participantsData) {
            participantCounts[p.arena_id] = (participantCounts[p.arena_id] || 0) + 1;
            if (p.student_id === userId) {
              userParticipations[p.arena_id] = {
                score: p.score,
                rank: p.rank,
                completed_at: p.completed_at,
              };
            }
          }
        }
      }

      // Get related data
      const { data: coursesData } = await supabase.from('courses').select('id, title');
      const { data: quizzesData } = await supabase.from('quizzes').select('id, title');
      const { data: categoriesData } = await supabase.from('categories').select('id, name');

      const coursesMap = new Map((coursesData || []).map(c => [c.id, c]));
      const quizzesMap = new Map((quizzesData || []).map(q => [q.id, q]));
      const categoriesMap = new Map((categoriesData || []).map(c => [c.id, c]));

      const processedArenas: Arena[] = (arenasData || []).map(a => {
        const participation = userParticipations[a.id];
        // Filter by category if arena has a category restriction
        const canJoin = !a.category_id || a.category_id === userCategoryId;

        return {
          ...a,
          course_title: coursesMap.get(a.course_id)?.title,
          quiz_title: a.quiz_id ? quizzesMap.get(a.quiz_id)?.title : null,
          category_name: a.category_id ? categoriesMap.get(a.category_id)?.name : null,
          participant_count: participantCounts[a.id] || 0,
          is_joined: !!participation,
          user_score: participation?.score || 0,
          user_rank: participation?.rank || undefined,
          has_completed: !!participation?.completed_at,
        };
      }).filter(a => !a.category_id || a.category_id === userCategoryId); // Only show arenas user can join

      setArenas(processedArenas);
    } catch (e: any) {
      setError(e.message || 'Failed to load arenas');
    } finally {
      setLoading(false);
    }
  }

  const filteredArenas = useMemo(() => {
    return arenas.filter(a => {
      if (activeTab === 'upcoming') return a.status === 'upcoming';
      if (activeTab === 'active') return a.status === 'active';
      if (activeTab === 'past') return a.status === 'completed' || a.status === 'cancelled';
      return true;
    });
  }, [arenas, activeTab]);

  async function joinArena(arena: Arena) {
    const { error: joinErr } = await supabase
      .from('arena_participants')
      .insert({ arena_id: arena.id, student_id: userId });

    if (joinErr) {
      console.error('Join arena error:', joinErr);
      return;
    }

    const updatedArena: Arena = {
      ...arena,
      is_joined: true,
      participant_count: (arena.participant_count || 0) + 1,
    };

    setArenas(prev => prev.map(a => a.id === arena.id ? updatedArena : a));
    setSelectedArena(updatedArena);
  }

  async function startArenaQuiz(arena: Arena) {
    setSelectedArena(arena);
    setShowQuiz(true);
  }

  if (showQuiz && selectedArena) {
    return (
      <ArenaQuizAttempt
        arena={selectedArena}
        userId={userId}
        onComplete={async (score, maxScore, _xpEarned) => {
          // Save arena attempt
          const percentage = Math.round((score / maxScore) * 100);

          await supabase
            .from('arena_quiz_attempts')
            .insert({
              arena_id: selectedArena.id,
              student_id: userId,
              quiz_id: selectedArena.quiz_id,
              score,
              max_score: maxScore,
              percentage,
              completed_at: new Date().toISOString(),
            });

          // Update participant score
          await supabase
            .from('arena_participants')
            .update({
              score: percentage,
              completed_at: new Date().toISOString(),
            })
            .eq('arena_id', selectedArena.id)
            .eq('student_id', userId);

          // Award XP
          const xpEarned = Math.round(selectedArena.points_reward * (percentage / 100));
          if (xpEarned > 0) {
            await supabase.from('xp_transactions').insert({
              user_id: userId,
              amount: xpEarned,
              reason: `Arena: ${selectedArena.title}`,
              source_type: 'arena',
              source_id: selectedArena.id,
            });
          }

          setShowQuiz(false);
          loadArenas();
        }}
        onBack={() => setShowQuiz(false)}
      />
    );
  }

  if (selectedArena && !showQuiz) {
    return (
      <ArenaDetail
        arena={selectedArena}
        userId={userId}
        onBack={() => setSelectedArena(null)}
        onJoin={() => joinArena(selectedArena)}
        onStartQuiz={() => startArenaQuiz(selectedArena)}
      />
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Swords className="w-7 h-7 text-violet-600" />
          Live Arena
        </h1>
        <p className="text-slate-500 mt-1">Compete with other students in live quiz battles!</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 p-1 bg-slate-100 rounded-2xl">
        {(['active', 'upcoming', 'past'] as TabType[]).map(tab => {
          const isActive = activeTab === tab;
          const count = arenas.filter(a => {
            if (tab === 'upcoming') return a.status === 'upcoming';
            if (tab === 'active') return a.status === 'active';
            if (tab === 'past') return a.status === 'completed' || a.status === 'cancelled';
            return false;
          }).length;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-white shadow-md text-slate-800'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab === 'active' && <Play className="w-4 h-4" />}
              {tab === 'upcoming' && <Clock className="w-4 h-4" />}
              {tab === 'past' && <CheckCircle className="w-4 h-4" />}
              <span className="capitalize">{tab}</span>
              <span className={`px-1.5 py-0.5 rounded text-xs ${isActive ? 'bg-violet-100 text-violet-600' : 'bg-slate-200 text-slate-500'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-slate-500 mt-3 text-sm">Loading arenas...</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {!loading && !error && filteredArenas.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Swords className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No {activeTab} arenas</h3>
          <p className="text-slate-500 mt-1 text-sm">
            {activeTab === 'active' && 'No live competitions right now. Check upcoming!'}
            {activeTab === 'upcoming' && 'No scheduled competitions yet. Check back soon!'}
            {activeTab === 'past' && "You haven't participated in any arenas yet."}
          </p>
        </div>
      )}

      {!loading && !error && filteredArenas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredArenas.map(arena => (
            <ArenaCard
              key={arena.id}
              arena={arena}
              onClick={() => setSelectedArena(arena)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ArenaCard({ arena, onClick }: { arena: Arena; onClick: () => void }) {
  const statusConfig = {
    upcoming: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: 'Upcoming', icon: Clock },
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Live Now', icon: Play },
    completed: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', label: 'Completed', icon: CheckCircle },
    cancelled: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Cancelled', icon: XCircle },
  };

  const config = statusConfig[arena.status as keyof typeof statusConfig] || statusConfig.upcoming;
  const StatusIcon = config.icon;

  return (
    <button
      onClick={onClick}
      className="text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all"
    >
      {/* Status banner */}
      <div className={`${config.bg} px-4 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${config.text}`} />
          <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
        </div>
        {arena.is_joined && (
          <span className="text-xs bg-white/80 px-2 py-0.5 rounded-full font-medium text-emerald-600">
            Joined
          </span>
        )}
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-lg text-slate-800">{arena.title}</h3>
          {arena.quiz_title && (
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              {arena.quiz_title}
            </p>
          )}
        </div>

        {/* Details */}
        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Timer className="w-4 h-4" />
            <span>{Math.floor(arena.time_limit_seconds / 60)} min</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span>{arena.points_reward} pts</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            <span>{arena.participant_count} joined</span>
          </div>
        </div>

        {/* User result for past arenas */}
        {arena.status === 'completed' && arena.is_joined && (
          <div className="flex items-center gap-3 p-3 bg-violet-50 rounded-xl">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {arena.user_rank || '#'}
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Your Rank</p>
              <p className="text-xs text-slate-500">Score: {arena.user_score}%</p>
            </div>
          </div>
        )}

        {/* Action hint */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <span className="text-xs text-slate-400">
            {arena.scheduled_start ? new Date(arena.scheduled_start).toLocaleDateString() : 'Not scheduled'}
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-violet-600">
            {arena.status === 'active' && !arena.is_joined ? 'Join Now' : 'View Details'}
            <ChevronRight className="w-4 h-4" />
          </span>
        </div>
      </div>
    </button>
  );
}

function ArenaDetail({
  arena,
  userId,
  onBack,
  onJoin,
  onStartQuiz,
}: {
  arena: Arena;
  userId: string;
  onBack: () => void;
  onJoin: () => void;
  onStartQuiz: () => void;
}) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportParticipant, setReportParticipant] = useState<Participant | null>(null);
  const [userAttempt, setUserAttempt] = useState<ArenaAttempt | null>(null);
  const [attemptLoading, setAttemptLoading] = useState(false);

  useEffect(() => {
    loadParticipants();
  }, [arena.id]);

  async function loadParticipants() {
    setLoading(true);
    const { data } = await supabase
      .from('arena_participants')
      .select(`
        id, arena_id, student_id, score, rank, completed_at,
        student:profiles!arena_participants_student_id_fkey(full_name, avatar_url)
      `)
      .eq('arena_id', arena.id)
      .order('score', { ascending: false });

    if (data) {
      setParticipants(data.map((p: any) => ({
        id: p.id,
        arena_id: p.arena_id,
        student_id: p.student_id,
        student_name: p.student?.full_name || 'Anonymous',
        student_avatar: p.student?.avatar_url || null,
        score: p.score || 0,
        rank: p.rank,
        completed_at: p.completed_at,
      })));
    }
    setLoading(false);
  }

  async function handleParticipantClick(p: Participant) {
    if (p.student_id !== userId || !p.completed_at) return;
    setReportParticipant(p);
    setAttemptLoading(true);
    const { data } = await supabase
      .from('arena_quiz_attempts')
      .select('score, max_score, percentage, time_taken_seconds, completed_at')
      .eq('arena_id', arena.id)
      .eq('student_id', userId)
      .maybeSingle();
    setUserAttempt(data || null);
    setAttemptLoading(false);
  }

  const userParticipant = participants.find(p => p.student_id === userId);
  const completedParticipants = participants.filter(p => p.completed_at);
  const canJoin = arena.status === 'active' && !arena.is_joined && participants.length < arena.max_participants;
  const canPlay = arena.status === 'active' && arena.is_joined && !arena.has_completed;

  return (
    <div className="space-y-6 animate-fadeInUp">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to Arenas
      </button>

      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl p-6 text-white shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-sm font-medium mb-3">
              {arena.status === 'active' ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Live Now
                </>
              ) : arena.status === 'upcoming' ? (
                <>
                  <Clock className="w-3.5 h-3.5" />
                  Upcoming
                </>
              ) : (
                <>
                  <CheckCircle className="w-3.5 h-3.5" />
                  Completed
                </>
              )}
            </span>
            <h1 className="text-2xl font-bold">{arena.title}</h1>
            {arena.description && (
              <p className="text-violet-200 mt-2 text-sm">{arena.description}</p>
            )}
          </div>
          <div className="text-right">
            <div className="flex items-center gap-2 text-violet-200 text-sm">
              <Timer className="w-4 h-4" />
              <span>{Math.floor(arena.time_limit_seconds / 60)} min</span>
            </div>
            <div className="flex items-center gap-2 text-amber-300 text-lg font-bold mt-1">
              <Trophy className="w-5 h-5" />
              <span>{arena.points_reward} pts</span>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-5 pt-5 border-t border-white/20">
          <div>
            <p className="text-2xl font-bold">{participants.length}</p>
            <p className="text-xs text-violet-200">Participants</p>
          </div>
          <div>
            <p className="text-2xl font-bold">{arena.max_participants - participants.length}</p>
            <p className="text-xs text-violet-200">Spots Left</p>
          </div>
          {arena.quiz_title && (
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              <span className="text-sm">{arena.quiz_title}</span>
            </div>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      {canJoin && (
        <button
          onClick={onJoin}
          className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <Target className="w-5 h-5" />
          Join Arena
        </button>
      )}

      {canPlay && (
        <button
          onClick={onStartQuiz}
          className="w-full py-4 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" />
          Start Quiz Battle
        </button>
      )}

      {arena.has_completed && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600" />
          <span className="text-emerald-700 font-medium">You completed this arena! Score: {arena.user_score}%</span>
        </div>
      )}

      {/* Leaderboard / Participants */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-violet-500" />
            Participants
          </h3>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
          </div>
        ) : participants.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-sm">
            No participants yet. {arena.status === 'active' && 'Be the first to join!'}
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {participants.map((p, idx) => {
              const isOwn = p.student_id === userId;
              const isClickable = isOwn && !!p.completed_at;
              const scoreColor = p.score >= 80 ? 'text-emerald-600' : p.score >= 50 ? 'text-amber-500' : 'text-rose-500';
              return (
                <div
                  key={p.id}
                  onClick={() => isClickable && handleParticipantClick(p)}
                  className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${
                    isOwn ? 'bg-violet-50' : ''
                  } ${isClickable ? 'cursor-pointer hover:bg-violet-100' : 'cursor-default'}`}
                >
                  <div className={`w-8 text-center font-bold flex-shrink-0 ${
                    idx === 0 ? 'text-amber-500' :
                    idx === 1 ? 'text-slate-400' :
                    idx === 2 ? 'text-amber-700' :
                    'text-slate-400'
                  }`}>
                    {idx === 0 && <Crown className="w-5 h-5 mx-auto" />}
                    {idx === 1 && <Medal className="w-5 h-5 mx-auto text-slate-400" />}
                    {idx === 2 && <Medal className="w-5 h-5 mx-auto text-amber-700" />}
                    {idx > 2 && <span className="text-sm">#{idx + 1}</span>}
                  </div>
                  {p.student_avatar ? (
                    <img src={p.student_avatar} alt={p.student_name} className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0 ${
                      isOwn ? 'bg-gradient-to-br from-violet-500 to-purple-600' : 'bg-gradient-to-br from-slate-400 to-slate-500'
                    }`}>
                      {p.student_name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-800 truncate text-sm">
                      {p.student_name}
                      {isOwn && <span className="ml-2 text-xs text-violet-600 font-semibold">(You)</span>}
                    </p>
                    <p className="text-xs mt-0.5">
                      {p.completed_at ? (
                        isOwn ? (
                          <span className="text-violet-500 font-medium">Tap to view your report</span>
                        ) : (
                          <span className="text-emerald-500 font-medium">Completed</span>
                        )
                      ) : (
                        <span className="text-slate-400">In progress...</span>
                      )}
                    </p>
                  </div>
                  {p.completed_at && (
                    <div className="text-right flex-shrink-0">
                      <span className={`text-lg font-bold ${scoreColor}`}>
                        {p.score}%
                      </span>
                      {isOwn && <ChevronRight className="w-4 h-4 text-violet-400 ml-1 inline" />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>


      {/* Own Report Full Page */}
      {reportParticipant && (
        <ArenaReportPage
          arena={arena}
          participant={reportParticipant}
          attempt={userAttempt}
          attemptLoading={attemptLoading}
          rank={participants.filter(p => p.completed_at).findIndex(p => p.student_id === userId) + 1}
          totalCompleted={completedParticipants.length}
          totalParticipants={participants.length}
          onBack={() => setReportParticipant(null)}
        />
      )}
    </div>
  );
}

function ArenaReportPage({
  arena,
  participant,
  attempt,
  attemptLoading,
  rank,
  totalCompleted,
  totalParticipants,
  onBack,
}: {
  arena: Arena;
  participant: Participant;
  attempt: ArenaAttempt | null;
  attemptLoading: boolean;
  rank: number;
  totalCompleted: number;
  totalParticipants: number;
  onBack: () => void;
}) {
  const score = participant.score;
  const grade = score >= 90 ? { label: 'Excellent', color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', stars: 5 }
    : score >= 75 ? { label: 'Great', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', stars: 4 }
    : score >= 60 ? { label: 'Good', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', stars: 3 }
    : score >= 40 ? { label: 'Fair', color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', stars: 2 }
    : { label: 'Needs Work', color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-200', stars: 1 };

  const beatenPercent = totalCompleted > 1 && rank > 0
    ? Math.round(((totalCompleted - rank) / (totalCompleted - 1)) * 100)
    : null;

  const xpEarned = Math.round(arena.points_reward * (score / 100));

  const formatTime = (seconds: number | null) => {
    if (!seconds) return null;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score / 100) * circumference;
  const strokeColor = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#f43f5e';

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailQuestions, setDetailQuestions] = useState<any[]>([]);
  const [detailAnswers, setDetailAnswers] = useState<any[]>([]);
  const [detailOptions, setDetailOptions] = useState<any[]>([]);

  useEffect(() => {
    loadDetails();
  }, []);

  const loadDetails = async () => {
    if (detailQuestions.length > 0) return;
    setDetailsLoading(true);
    try {
      // Find the quiz_attempts row for this student+quiz to get attempt_id
      const { data: qaRow } = await supabase
        .from('quiz_attempts')
        .select('id')
        .eq('student_id', participant.student_id)
        .eq('quiz_id', arena.quiz_id)
        .order('completed_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!qaRow) { return; }

      const [qRes, aRes] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('quiz_id', arena.quiz_id).order('sort_order', { ascending: true }),
        supabase.from('quiz_answers').select('*').eq('attempt_id', qaRow.id),
      ]);

      const questionIds = (qRes.data || []).map((q: any) => q.id);
      const oRes = questionIds.length > 0
        ? await supabase.from('quiz_options').select('*').in('question_id', questionIds).order('sort_order', { ascending: true })
        : { data: [] };

      setDetailQuestions(qRes.data || []);
      setDetailAnswers(aRes.data || []);
      setDetailOptions(oRes.data || []);
    } catch (e) {
      console.error('Failed to load details', e);
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50">
      {/* Top bar */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium">
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Arena
          </button>
          <div className="flex-1 flex items-center gap-2">
            <Swords className="w-5 h-5 text-violet-500" />
            <span className="font-semibold text-slate-800">{arena.title}</span>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        {/* Hero header */}
        <div className="bg-gradient-to-br from-violet-600 to-purple-700 rounded-3xl px-6 py-8 relative text-white overflow-hidden">
          <p className="text-violet-200 text-sm font-medium">Arena Report</p>
          <h2 className="text-xl font-bold mt-1">{arena.title}</h2>

          {/* Score ring */}
          <div className="flex justify-center mt-6">
            <div className="relative w-28 h-28">
              <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="10" />
                <circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={strokeColor}
                  strokeWidth="10"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-white">{score}%</span>
                <span className="text-xs text-violet-200">Score</span>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-4">
          {/* Grade badge */}
          <div className={`flex items-center justify-between p-4 rounded-2xl border ${grade.bg} ${grade.border}`}>
            <div>
              <p className="text-xs font-medium text-slate-500">Performance Grade</p>
              <p className={`text-xl font-bold mt-0.5 ${grade.color}`}>{grade.label}</p>
            </div>
            <div className="flex gap-0.5">
              {[1,2,3,4,5].map(n => (
                <Star key={n} className={`w-5 h-5 ${n <= grade.stars ? grade.color : 'text-slate-200'}`} fill={n <= grade.stars ? 'currentColor' : 'none'} />
              ))}
            </div>
          </div>

          {attemptLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
            </div>
          ) : (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Trophy className="w-4 h-4 text-amber-500" />
                    <span className="text-xs font-medium text-slate-500">Your Rank</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">
                    {rank > 0 ? `#${rank}` : '—'}
                    <span className="text-sm font-normal text-slate-400 ml-1">/ {totalCompleted}</span>
                  </p>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Zap className="w-4 h-4 text-violet-500" />
                    <span className="text-xs font-medium text-slate-500">XP Earned</span>
                  </div>
                  <p className="text-2xl font-bold text-violet-600">
                    +{xpEarned}
                    <span className="text-sm font-normal text-slate-400 ml-1">pts</span>
                  </p>
                </div>

                {attempt?.time_taken_seconds != null && (
                  <div className="bg-slate-50 rounded-2xl p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <Timer className="w-4 h-4 text-sky-500" />
                      <span className="text-xs font-medium text-slate-500">Time Taken</span>
                    </div>
                    <p className="text-xl font-bold text-slate-800">{formatTime(attempt.time_taken_seconds)}</p>
                  </div>
                )}

                <div className="bg-slate-50 rounded-2xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Users className="w-4 h-4 text-teal-500" />
                    <span className="text-xs font-medium text-slate-500">Participants</span>
                  </div>
                  <p className="text-2xl font-bold text-slate-800">{totalParticipants}</p>
                </div>
              </div>

              {/* Percentile banner */}
              {beatenPercent !== null && (
                <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-2xl p-4 text-white flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-violet-100 text-xs">Performance</p>
                    <p className="font-bold">
                      You outperformed <span className="text-amber-300">{beatenPercent}%</span> of participants
                    </p>
                  </div>
                </div>
              )}

              {/* Completion time */}
              {participant.completed_at && (
                <p className="text-center text-xs text-slate-400">
                  Completed on {new Date(participant.completed_at).toLocaleString()}
                </p>
              )}
            </>
          )}

          {/* Question details */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="w-5 h-5 text-slate-700" />
              <h3 className="font-bold text-slate-800 text-lg">Question Details</h3>
            </div>
            {detailsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 text-violet-400 animate-spin" />
              </div>
            ) : detailQuestions.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-4">No question details available for this attempt.</p>
            ) : (
              <div className="space-y-3">
                {detailQuestions.map((q, idx) => {
                  const ans = detailAnswers.find(a => a.question_id === q.id);
                  const qOpts = detailOptions.filter(o => o.question_id === q.id);
                  const correctOpt = qOpts.find(o => o.is_correct);
                  const userOpt = ans?.selected_option_id ? qOpts.find(o => o.id === ans.selected_option_id) : null;
                  const points = ans?.points_earned ?? 0;
                  const isCorrect = ans?.is_correct;
                  const isFillType = q.question_type === 'fill_blank' || q.question_type === 'listen_write';
                  const isMatchType = q.question_type === 'matching_pair';

                  let userAnswerText = '—';
                  if (isFillType) {
                    userAnswerText = ans?.text_answer || '—';
                  } else if (isMatchType && ans?.text_answer) {
                    try {
                      const matches = JSON.parse(ans.text_answer) as Record<string, string>;
                      userAnswerText = Object.entries(matches)
                        .map(([leftId, rightId]) => {
                          const left = qOpts.find(o => o.id === leftId);
                          const right = qOpts.find(o => o.id === rightId);
                          return `${left?.option_text || '?'} → ${right?.option_text || '?'}`;
                        })
                        .join(', ');
                    } catch { userAnswerText = ans.text_answer; }
                  } else if (userOpt) {
                    userAnswerText = userOpt.option_text;
                  }

                  let correctAnswerText = '—';
                  if (isFillType) {
                    correctAnswerText = qOpts.map(o => o.option_text).join(', ');
                  } else if (isMatchType) {
                    const leftItems = qOpts.filter(o => o.sort_order <= 4).sort((a, b) => a.sort_order - b.sort_order);
                    correctAnswerText = leftItems.map(left => {
                      const right = qOpts.find(o => o.match_key === left.match_key && o.id !== left.id);
                      return `${left.option_text} → ${right?.option_text || '?'}`;
                    }).join(', ');
                  } else if (correctOpt) {
                    correctAnswerText = correctOpt.option_text;
                  }

                  return (
                    <div key={q.id} className="rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="flex items-start gap-3 p-3 sm:p-4 bg-slate-50">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isCorrect ? 'bg-emerald-100 text-emerald-700' : ans ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'
                        }`}>
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-sm leading-snug">{q.question_text}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              isCorrect ? 'bg-emerald-100 text-emerald-700' : ans ? 'bg-red-100 text-red-600' : 'bg-slate-200 text-slate-500'
                            }`}>
                              {isCorrect ? 'Correct' : ans ? 'Wrong' : 'Skipped'}
                            </span>
                            <span className="text-[10px] font-bold text-amber-600 flex items-center gap-0.5">
                              <Zap className="w-3 h-3" /> {points} pts
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="px-3 sm:px-4 pb-3 sm:pb-4 pt-2 space-y-2">
                        {/* Student's answer */}
                        <div className={`flex items-start gap-2 p-2.5 rounded-xl ${
                          isCorrect ? 'bg-emerald-50 border border-emerald-200' : 'bg-red-50 border border-red-200'
                        }`}>
                          {isCorrect ? <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />}
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Your Answer</p>
                            <p className={`text-sm font-medium break-words ${isCorrect ? 'text-emerald-700' : 'text-red-700'}`}>
                              {userAnswerText}
                            </p>
                          </div>
                        </div>
                        {/* Correct answer (only if wrong) */}
                        {!isCorrect && (
                          <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50 border border-emerald-200">
                            <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Correct Answer</p>
                              <p className="text-sm font-medium text-emerald-700">
                                {correctAnswerText}
                              </p>
                            </div>
                          </div>
                        )}
                        {q.explanation && (
                          <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 mb-0.5">Explanation</p>
                            <p className="text-xs text-blue-800">{q.explanation}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ArenaQuizAttempt({
  arena,
  userId,
  onComplete,
  onBack,
}: {
  arena: Arena;
  userId: string;
  onComplete: (score: number, maxScore: number, xpEarned: number) => void;
  onBack: () => void;
}) {
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!arena.quiz_id) {
      setError('No quiz assigned to this arena');
      setLoading(false);
      return;
    }
    loadQuiz();
  }, [arena.quiz_id]);

  async function loadQuiz() {
    setLoading(true);
    try {
      const [quizRes, questionsRes, optionsRes] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', arena.quiz_id!).single(),
        supabase.from('quiz_questions').select('*').eq('quiz_id', arena.quiz_id!).order('sort_order'),
        supabase.from('quiz_options').select('*').order('sort_order'),
      ]);

      if (quizRes.error || !quizRes.data) throw new Error('Quiz not found');
      if (questionsRes.error) throw questionsRes.error;

      const questionIds = (questionsRes.data || []).map(q => q.id);
      const filteredOptions = (optionsRes.data || []).filter(o => questionIds.includes(o.question_id));

      setQuiz(quizRes.data);
      setQuestions(questionsRes.data || []);
      setOptions(filteredOptions);
    } catch (e: any) {
      setError(e.message || 'Failed to load quiz');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-violet-500 animate-spin mx-auto" />
          <p className="text-slate-500 mt-3">Loading quiz battle...</p>
        </div>
      </div>
    );
  }

  if (error || !quiz || questions.length === 0) {
    return (
      <div className="min-h-full bg-slate-50 p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 mb-6">
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back
        </button>
        <div className="bg-white rounded-2xl p-8 text-center">
          <AlertCircle className="w-12 h-12 text-rose-400 mx-auto mb-4" />
          <p className="text-slate-600">{error || 'Quiz not available'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-gradient-to-br from-violet-50 to-purple-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium">
            <ChevronRight className="w-4 h-4 rotate-180" />
            Exit
          </button>
          <div className="flex-1 flex items-center gap-2">
            <Swords className="w-5 h-5 text-violet-500" />
            <span className="font-semibold text-slate-800">{arena.title}</span>
          </div>
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
            <Trophy className="w-4 h-4" />
            {arena.points_reward} pts
          </div>
        </div>
      </div>

      <QuizContainer
        quiz={quiz}
        questions={questions}
        options={options}
        userId={userId}
        onComplete={onComplete}
        onBack={onBack}
        timeLimit={arena.time_limit_seconds}
      />
    </div>
  );
}
