import { useEffect, useState } from 'react';
import {
  Swords, Plus, Clock, Trophy, Users, Calendar, ChevronRight,
  Loader2, AlertCircle, Trash2, Play, Square, CheckCircle, X,
  BookOpen, Zap, Edit, Eye, Medal, User, Crown,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { notifyArenaInvite } from '../lib/notifications';
import { smsArenaLive } from '../lib/sms';

interface Course {
  id: string;
  title: string;
}

interface Quiz {
  id: string;
  title: string;
  course_id: string; // derived from course_topic_items join
  passing_score: number;
  xp_reward: number;
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
}

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
}

interface ArenaParticipant {
  id: string;
  student_id: string;
  student_name: string;
  score: number | null;
  rank: number | null;
  joined_at: string;
  completed_at: string | null;
  quiz_attempt_id?: string | null;
}

interface QuizAnswerDetail {
  id: string;
  question_id: string;
  question_text: string;
  question_type: string;
  selected_option_id: string | null;
  text_answer: string | null;
  is_correct: boolean;
  points_earned: number;
  correct_answer: string;
  student_answer: string;
}

type AdminView = 'list' | 'create' | 'edit' | 'results';

export function AdminArenaPage() {
  const [view, setView] = useState<AdminView>('list');
  const [arenas, setArenas] = useState<Arena[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingArena, setEditingArena] = useState<Arena | null>(null);
  const [resultsArena, setResultsArena] = useState<Arena | null>(null);
  const [resultsParticipants, setResultsParticipants] = useState<ArenaParticipant[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [arenasRes, coursesRes, categoriesRes] = await Promise.all([
        supabase.from('arenas').select('*').order('created_at', { ascending: false }),
        supabase.from('courses').select('id, title'),
        supabase.from('categories').select('id, name, icon, color'),
      ]);

      if (arenasRes.error) throw arenasRes.error;
      if (coursesRes.error) throw coursesRes.error;
      if (categoriesRes.error) throw categoriesRes.error;

      // Load quizzes linked to courses through course_topic_items -> course_topics
      const { data: quizLinks, error: quizLinksErr } = await supabase
        .from('course_topic_items')
        .select(`
          quiz_id,
          topic:course_topics!course_topic_items_topic_id_fkey(course_id),
          quiz:quizzes!course_topic_items_quiz_id_fkey(id, title, passing_score, xp_reward)
        `)
        .not('quiz_id', 'is', null);

      if (quizLinksErr) throw quizLinksErr;

      // Build quizzes with course_id derived from the join
      const quizzesWithCourse: Quiz[] = (quizLinks || [])
        .filter(link => link.quiz && link.topic)
        .map(link => ({
          id: (link.quiz as any).id,
          title: (link.quiz as any).title,
          course_id: (link.topic as any).course_id,
          passing_score: (link.quiz as any).passing_score || 0,
          xp_reward: (link.quiz as any).xp_reward || 0,
        }));

      // Deduplicate in case a quiz appears in multiple topics of the same course
      const seen = new Set<string>();
      const quizzesRes = { data: quizzesWithCourse.filter(q => {
        const key = `${q.id}-${q.course_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }) };

      // Get participant counts
      const arenaIds = (arenasRes.data || []).map(a => a.id);
      let participantCounts: Record<string, number> = {};
      if (arenaIds.length > 0) {
        const { data: participantsData } = await supabase
          .from('arena_participants')
          .select('arena_id')
          .in('arena_id', arenaIds);
        if (participantsData) {
          for (const p of participantsData) {
            participantCounts[p.arena_id] = (participantCounts[p.arena_id] || 0) + 1;
          }
        }
      }

      const coursesMap = new Map((coursesRes.data || []).map(c => [c.id, c]));
      const quizzesMap = new Map((quizzesRes.data || []).map(q => [q.id, q]));
      const categoriesMap = new Map((categoriesRes.data || []).map(c => [c.id, c]));

      const arenasData: Arena[] = (arenasRes.data || []).map(a => ({
        ...a,
        course_title: coursesMap.get(a.course_id)?.title,
        quiz_title: a.quiz_id ? quizzesMap.get(a.quiz_id)?.title : null,
        category_name: a.category_id ? categoriesMap.get(a.category_id)?.name : null,
        participant_count: participantCounts[a.id] || 0,
      }));

      setArenas(arenasData);
      setCourses(coursesRes.data || []);
      setQuizzes(quizzesRes.data || []);
      setCategories(categoriesRes.data || []);
    } catch (e: any) {
      setError(e.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function updateArenaStatus(arenaId: string, status: string) {
    const updates: any = { status, updated_at: new Date().toISOString() };
    if (status === 'active') {
      updates.actual_start = new Date().toISOString();
    } else if (status === 'completed') {
      updates.actual_end = new Date().toISOString();
    }

    const { error } = await supabase
      .from('arenas')
      .update(updates)
      .eq('id', arenaId);

    if (!error) {
      setArenas(prev => prev.map(a => a.id === arenaId ? { ...a, ...updates } : a));

      // Notify enrolled students when arena goes live
      if (status === 'active') {
        const arena = arenas.find(a => a.id === arenaId);
        if (arena?.course_id) {
          const { data: enrollments } = await supabase
            .from('course_enrollments')
            .select('student_id')
            .eq('course_id', arena.course_id);

          const studentIds = (enrollments ?? []).map(e => e.student_id);
          await Promise.allSettled(
            studentIds.map(id => notifyArenaInvite(id, arena.title))
          );
          // SMS all opted-in enrolled students
          smsArenaLive(studentIds, arena.title).catch(console.warn);
        }
      }
    }
  }

  async function deleteArena(arenaId: string) {
    if (!confirm('Are you sure you want to delete this arena?')) return;
    const { error } = await supabase.from('arenas').delete().eq('id', arenaId);
    if (!error) {
      setArenas(prev => prev.filter(a => a.id !== arenaId));
    }
  }

  async function openResults(arena: Arena) {
    setResultsArena(arena);
    setResultsParticipants([]);
    setView('results');
    setResultsLoading(true);

    try {
      const { data: participants, error: participantsErr } = await supabase
        .from('arena_participants')
        .select('id, student_id, score, rank, joined_at, completed_at')
        .eq('arena_id', arena.id)
        .order('rank', { ascending: true, nullsFirst: false })
        .order('score', { ascending: false, nullsFirst: false });

      if (participantsErr) throw participantsErr;

      if (participants && participants.length > 0) {
        const studentIds = participants.map(p => p.student_id);
        const attemptsQuery = arena.quiz_id
          ? supabase.from('quiz_attempts')
              .select('id, student_id')
              .eq('quiz_id', arena.quiz_id)
              .in('student_id', studentIds)
              .order('completed_at', { ascending: false })
          : Promise.resolve({ data: [] });

        const [profilesRes, attemptsRes] = await Promise.all([
          supabase.from('profiles').select('id, full_name').in('id', studentIds),
          attemptsQuery,
        ]);

        const profileMap = new Map((profilesRes.data || []).map((p: any) => [p.id, p.full_name]));
        // Keep FIRST occurrence per student (data sorted DESC, so first = most recent)
        const attemptMap = new Map<string, string>();
        for (const a of ((attemptsRes as any).data || [])) {
          if (!attemptMap.has(a.student_id)) attemptMap.set(a.student_id, a.id);
        }

        const participantsWithName: ArenaParticipant[] = participants.map(p => ({
          id: p.id,
          student_id: p.student_id,
          student_name: profileMap.get(p.student_id) || 'Unknown',
          score: p.score,
          rank: p.rank,
          joined_at: p.joined_at,
          completed_at: p.completed_at,
          quiz_attempt_id: attemptMap.get(p.student_id) || null,
        }));

        setResultsParticipants(participantsWithName);
      }
    } catch (e) {
      console.error('Failed to load results:', e);
    } finally {
      setResultsLoading(false);
    }
  }

  function closeResults() {
    setView('list');
    setResultsArena(null);
    setResultsParticipants([]);
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 mt-3 text-sm">Loading arenas...</p>
      </div>
    );
  }

  if (view === 'create' || view === 'edit') {
    return (
      <ArenaForm
        mode={view}
        arena={editingArena}
        courses={courses}
        quizzes={quizzes}
        categories={categories}
        onBack={() => { setView('list'); setEditingArena(null); }}
        onSuccess={(arena) => {
          if (view === 'create') {
            setArenas(prev => [arena, ...prev]);
          } else {
            setArenas(prev => prev.map(a => a.id === arena.id ? arena : a));
          }
          setView('list');
          setEditingArena(null);
        }}
      />
    );
  }

  if (view === 'results' && resultsArena) {
    return (
      <ArenaResultsView
        arena={resultsArena}
        participants={resultsParticipants}
        loading={resultsLoading}
        onClose={closeResults}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Swords className="w-7 h-7 text-violet-600" />
            Live Arena
          </h1>
          <p className="text-slate-500 mt-1">Create and manage live quiz competitions</p>
        </div>
        <button
          onClick={() => setView('create')}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl shadow-lg shadow-violet-200 hover:shadow-xl transition-all"
        >
          <Plus className="w-4 h-4" />
          Create Arena
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {arenas.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-violet-100 flex items-center justify-center mb-4">
            <Swords className="w-8 h-8 text-violet-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No arenas created yet</h3>
          <p className="text-slate-500 mt-1 text-sm">Create your first arena to start live competitions!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {arenas.map(arena => (
            <ArenaCard
              key={arena.id}
              arena={arena}
              onStart={() => updateArenaStatus(arena.id, 'active')}
              onComplete={() => updateArenaStatus(arena.id, 'completed')}
              onEdit={() => { setEditingArena(arena); setView('edit'); }}
              onDelete={() => deleteArena(arena.id)}
              onOpenResults={() => openResults(arena)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Results View (Full Page) — Participants list
function ArenaResultsView({
  arena,
  participants,
  loading,
  onClose,
}: {
  arena: Arena;
  participants: ArenaParticipant[];
  loading: boolean;
  onClose: () => void;
}) {
  const [detailStudent, setDetailStudent] = useState<ArenaParticipant | null>(null);

  if (detailStudent) {
    return (
      <ArenaStudentDetailView
        arena={arena}
        participant={detailStudent}
        allParticipants={participants}
        onBack={() => setDetailStudent(null)}
        onClose={onClose}
      />
    );
  }

  const totalScore = participants.reduce((s, p) => s + (p.score ?? 0), 0);
  const completed = participants.filter(p => p.completed_at).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={onClose}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Arenas
        </button>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
          arena.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700'
        }`}>
          {arena.status}
        </span>
      </div>

      {/* Hero Banner */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
            <Trophy className="w-7 h-7" />
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{arena.title}</h1>
            {arena.description && <p className="text-violet-200 text-sm mt-1">{arena.description}</p>}
          </div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-white/20">
          <div className="text-center">
            <div className="text-2xl font-bold">{participants.length}</div>
            <div className="text-violet-200 text-xs mt-0.5">Participants</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{completed}</div>
            <div className="text-violet-200 text-xs mt-0.5">Completed</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{arena.points_reward}</div>
            <div className="text-violet-200 text-xs mt-0.5">Pts Reward</div>
          </div>
        </div>
      </div>

      {/* Top 3 Podium */}
      {!loading && participants.length >= 2 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            Top Rankings
          </h2>
          <div className="flex items-end justify-center gap-3">
            {/* 2nd place */}
            {participants[1] && (
              <div className="flex-1 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center mx-auto mb-2">
                  <Medal className="w-6 h-6 text-slate-500" />
                </div>
                <div className="bg-slate-100 rounded-t-xl py-4 px-2">
                  <div className="font-bold text-slate-800 text-sm truncate">{participants[1].student_name}</div>
                  <div className="text-xl font-bold text-slate-600 mt-1">{participants[1].score ?? '-'}</div>
                  <div className="text-xs text-slate-500">pts</div>
                </div>
                <div className="bg-slate-400 text-white text-xs font-bold py-1 rounded-b-xl">2nd</div>
              </div>
            )}
            {/* 1st place */}
            {participants[0] && (
              <div className="flex-1 text-center -mt-4">
                <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-2 ring-4 ring-amber-300">
                  <Crown className="w-7 h-7 text-amber-500" />
                </div>
                <div className="bg-amber-50 rounded-t-xl py-6 px-2">
                  <div className="font-bold text-slate-800 text-sm truncate">{participants[0].student_name}</div>
                  <div className="text-2xl font-bold text-amber-600 mt-1">{participants[0].score ?? '-'}</div>
                  <div className="text-xs text-slate-500">pts</div>
                </div>
                <div className="bg-amber-500 text-white text-xs font-bold py-1 rounded-b-xl">1st</div>
              </div>
            )}
            {/* 3rd place */}
            {participants[2] && (
              <div className="flex-1 text-center mt-2">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center mx-auto mb-2">
                  <Medal className="w-5 h-5 text-orange-500" />
                </div>
                <div className="bg-orange-50 rounded-t-xl py-3 px-2">
                  <div className="font-bold text-slate-800 text-sm truncate">{participants[2].student_name}</div>
                  <div className="text-xl font-bold text-orange-600 mt-1">{participants[2].score ?? '-'}</div>
                  <div className="text-xs text-slate-500">pts</div>
                </div>
                <div className="bg-orange-400 text-white text-xs font-bold py-1 rounded-b-xl">3rd</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Full Leaderboard */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4" />
            All Participants
          </h2>
          <span className="text-xs text-slate-500">Click a student to see detailed answers</span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-violet-500 animate-spin" />
            <p className="text-slate-500 mt-3 text-sm">Loading participants...</p>
          </div>
        ) : participants.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Users className="w-10 h-10 text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm">No participants joined this arena</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {participants.map((p, idx) => {
              const rankNum = p.rank ?? idx + 1;
              const isTop3 = rankNum <= 3;
              return (
                <button
                  key={p.id}
                  onClick={() => setDetailStudent(p)}
                  className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-violet-50 active:bg-violet-100 transition-colors group"
                >
                  {/* Rank Badge */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                    rankNum === 1 ? 'bg-amber-500 text-white' :
                    rankNum === 2 ? 'bg-slate-400 text-white' :
                    rankNum === 3 ? 'bg-orange-400 text-white' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {isTop3 ? (
                      rankNum === 1 ? <Crown className="w-4 h-4" /> :
                      <Medal className="w-4 h-4" />
                    ) : rankNum}
                  </div>

                  {/* Student Info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">{p.student_name}</div>
                    <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                      {p.completed_at ? (
                        <span className="text-emerald-600 font-medium">Completed</span>
                      ) : (
                        <span className="text-rose-500 font-medium">Did not complete</span>
                      )}
                      {p.completed_at && (
                        <span>{new Date(p.completed_at).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl font-bold text-slate-900">{p.score ?? '-'}</div>
                    <div className="text-xs text-slate-500">points</div>
                  </div>

                  {/* Arrow */}
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-violet-600 transition-colors flex-shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Student Detail View — full page Q&A breakdown
function ArenaStudentDetailView({
  arena,
  participant,
  allParticipants,
  onBack,
  onClose,
}: {
  arena: Arena;
  participant: ArenaParticipant;
  allParticipants: ArenaParticipant[];
  onBack: () => void;
  onClose: () => void;
}) {
  const [answers, setAnswers] = useState<QuizAnswerDetail[]>([]);
  const [loadingAnswers, setLoadingAnswers] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnswers();
  }, [participant.id]);

  async function fetchAnswers() {
    if (!arena.quiz_id) return;

    setLoadingAnswers(true);
    setLoadError(null);
    try {
      // Always look up the most recent attempt live (highest attempt_number)
      // This handles students who replayed the quiz during the arena
      const { data: latestAttempt, error: attemptErr } = await supabase
        .from('quiz_attempts')
        .select('id')
        .eq('quiz_id', arena.quiz_id)
        .eq('student_id', participant.student_id)
        .order('attempt_number', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (attemptErr) throw attemptErr;
      if (!latestAttempt) {
        setAnswers([]);
        setLoadingAnswers(false);
        return;
      }

      const attemptId = latestAttempt.id;

      const { data: rawAnswers, error: answersErr } = await supabase
        .from('quiz_answers')
        .select(`
          id, question_id, selected_option_id, text_answer, is_correct, points_earned,
          quiz_questions!inner(id, question_text, question_type)
        `)
        .eq('attempt_id', attemptId);

      if (answersErr) throw answersErr;

      if (!rawAnswers || rawAnswers.length === 0) {
        setAnswers([]);
        return;
      }

      const questionIds = rawAnswers.map(a => a.question_id);
      const { data: questionsWithOptions, error: optsErr } = await supabase
        .from('quiz_questions')
        .select('id, quiz_options(id, option_text, is_correct, match_key, sort_order)')
        .in('id', questionIds);

      if (optsErr) throw optsErr;

      const optionsMap = new Map(
        (questionsWithOptions || []).map(q => [q.id, (q.quiz_options as any[]) || []])
      );

      const details: QuizAnswerDetail[] = rawAnswers.map(a => {
        const question = a.quiz_questions as any;
        const qType: string = question?.question_type || 'unknown';
        const options: any[] = optionsMap.get(a.question_id) || [];

        let studentAnswer = '-';
        let correctAnswer = '-';

        if (qType === 'matching_pair') {
          // Build a lookup map: option id → option text
          const optionTextMap = new Map(options.map((o: any) => [o.id, o.option_text]));

          // Student answer: parse JSON {leftId: rightId, ...}
          if (a.text_answer) {
            try {
              const pairs: Record<string, string> = JSON.parse(a.text_answer);
              studentAnswer = Object.entries(pairs)
                .map(([leftId, rightId]) =>
                  `${optionTextMap.get(leftId) ?? '?'} → ${optionTextMap.get(rightId) ?? '?'}`
                )
                .join('\n');
            } catch {
              studentAnswer = a.text_answer;
            }
          }

          // Correct answer: group by match_key, sort by sort_order → left → right
          const byKey = new Map<string, any[]>();
          for (const o of options) {
            if (!byKey.has(o.match_key)) byKey.set(o.match_key, []);
            byKey.get(o.match_key)!.push(o);
          }
          const correctPairs: string[] = [];
          for (const items of byKey.values()) {
            const sorted = [...items].sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0));
            if (sorted.length >= 2) {
              correctPairs.push(`${sorted[0].option_text} → ${sorted[1].option_text}`);
            }
          }
          correctAnswer = correctPairs.join('\n') || '-';
        } else {
          // Multiple choice / fill_blank / listen_write / flash_card
          const correctOption = options.find((o: any) => o.is_correct);
          correctAnswer = correctOption?.option_text || '-';

          if (a.selected_option_id) {
            const sel = options.find((o: any) => o.id === a.selected_option_id);
            studentAnswer = sel?.option_text || '-';
          } else if (a.text_answer) {
            studentAnswer = a.text_answer;
          }
        }

        return {
          id: a.id,
          question_id: a.question_id,
          question_text: question?.question_text || 'Unknown question',
          question_type: qType,
          selected_option_id: a.selected_option_id,
          text_answer: a.text_answer,
          is_correct: a.is_correct,
          points_earned: a.points_earned,
          correct_answer: correctAnswer,
          student_answer: studentAnswer,
        };
      });

      setAnswers(details);
    } catch (e: any) {
      setLoadError(e.message || 'Failed to load answers');
    } finally {
      setLoadingAnswers(false);
    }
  }

  const correctCount = answers.filter(a => a.is_correct).length;
  const totalPoints = answers.reduce((s, a) => s + a.points_earned, 0);
  const rank = allParticipants.findIndex(p => p.id === participant.id) + 1;

  const rankColor =
    rank === 1 ? 'from-amber-500 to-yellow-400' :
    rank === 2 ? 'from-slate-400 to-slate-300' :
    rank === 3 ? 'from-orange-500 to-orange-400' :
    'from-violet-600 to-purple-500';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors font-medium"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Results
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500 truncate">{participant.student_name}</span>
      </div>

      {/* Student Hero */}
      <div className={`bg-gradient-to-r ${rankColor} rounded-2xl p-6 text-white`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-white/25 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold truncate">{participant.student_name}</h1>
            <p className="text-white/70 text-sm mt-1">{arena.title}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <div className="text-4xl font-black">#{participant.rank ?? rank}</div>
            <div className="text-white/70 text-xs">Rank</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-5 pt-4 border-t border-white/20">
          <div className="text-center">
            <div className="text-2xl font-bold">{participant.score ?? '-'}</div>
            <div className="text-white/70 text-xs mt-0.5">Arena Score</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">{answers.length > 0 ? `${correctCount}/${answers.length}` : '-'}</div>
            <div className="text-white/70 text-xs mt-0.5">Correct</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold">
              {answers.length > 0 ? `${Math.round((correctCount / answers.length) * 100)}%` : '-'}
            </div>
            <div className="text-white/70 text-xs mt-0.5">Accuracy</div>
          </div>
        </div>
      </div>

      {/* Answers */}
      {!arena.quiz_id ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No quiz assigned to this arena</p>
        </div>
      ) : loadingAnswers ? (
        <div className="bg-white rounded-2xl border border-slate-200 flex flex-col items-center justify-center py-16">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-slate-500 mt-3 text-sm">Loading answers...</p>
        </div>
      ) : loadError ? (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{loadError}</span>
        </div>
      ) : answers.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="font-semibold text-slate-600">No answers recorded</p>
          <p className="text-sm text-slate-400 mt-1">
            This student had already completed this quiz before the arena — their previous attempt was reused and no new answers were saved.
            Future arena attempts will be tracked correctly.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary bar */}
          <div className="flex items-center justify-between px-1">
            <h2 className="font-semibold text-slate-800">
              Quiz Answers
              <span className="text-slate-400 font-normal ml-2 text-sm">({answers.length} questions)</span>
            </h2>
            <div className="flex items-center gap-3 text-sm">
              <span className="flex items-center gap-1 text-emerald-600 font-medium">
                <CheckCircle className="w-4 h-4" />{correctCount} correct
              </span>
              <span className="flex items-center gap-1 text-rose-500 font-medium">
                <X className="w-4 h-4" />{answers.length - correctCount} wrong
              </span>
            </div>
          </div>

          {answers.map((answer, idx) => (
            <div
              key={answer.id}
              className={`bg-white rounded-2xl border-2 overflow-hidden ${
                answer.is_correct ? 'border-emerald-200' : 'border-rose-200'
              }`}
            >
              {/* Question header */}
              <div className={`px-5 py-3 flex items-center justify-between ${
                answer.is_correct ? 'bg-emerald-50' : 'bg-rose-50'
              }`}>
                <div className="flex items-center gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    answer.is_correct ? 'bg-emerald-500' : 'bg-rose-500'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {answer.question_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {answer.is_correct ? (
                    <span className="flex items-center gap-1 text-emerald-600 font-bold text-sm">
                      <CheckCircle className="w-5 h-5" /> Correct
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-rose-600 font-bold text-sm">
                      <X className="w-5 h-5" /> Wrong
                    </span>
                  )}
                  <span className={`text-sm font-bold ml-2 ${answer.is_correct ? 'text-emerald-600' : 'text-rose-400'}`}>
                    +{answer.points_earned} pts
                  </span>
                </div>
              </div>

              {/* Question body */}
              <div className="px-5 py-4 space-y-4">
                <p className="font-semibold text-slate-800 text-base leading-snug">{answer.question_text}</p>

                {answer.question_type === 'matching_pair' ? (
                  /* Matching pair: show each pair as rows side by side */
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 text-center">Student Answer</div>
                      <div className="text-xs font-bold uppercase tracking-wide text-slate-500 text-center">Correct Answer</div>
                    </div>
                    {answer.student_answer.split('\n').map((pair, pIdx) => {
                      const correctPair = answer.correct_answer.split('\n')[pIdx] ?? '-';
                      const isMatch = pair === correctPair;
                      return (
                        <div key={pIdx} className="grid grid-cols-2 gap-2">
                          <div className={`rounded-lg px-3 py-2 text-sm font-semibold text-center ${
                            isMatch ? 'bg-emerald-50 border border-emerald-200 text-emerald-700' : 'bg-rose-50 border border-rose-200 text-rose-700'
                          }`}>
                            {pair}
                          </div>
                          <div className="rounded-lg px-3 py-2 text-sm font-semibold text-center bg-emerald-50 border border-emerald-200 text-emerald-700">
                            {correctPair}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Student answer */}
                    <div className={`rounded-xl p-3 border ${
                      answer.is_correct
                        ? 'bg-emerald-50 border-emerald-200'
                        : 'bg-rose-50 border-rose-200'
                    }`}>
                      <div className="text-xs font-bold uppercase tracking-wide mb-1 text-slate-500">
                        Student Answer
                      </div>
                      <div className={`font-semibold ${answer.is_correct ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {answer.student_answer}
                      </div>
                    </div>

                    {/* Correct answer — always shown */}
                    <div className="rounded-xl p-3 bg-emerald-50 border border-emerald-200">
                      <div className="text-xs font-bold uppercase tracking-wide mb-1 text-slate-500">
                        Correct Answer
                      </div>
                      <div className="font-semibold text-emerald-700">
                        {answer.correct_answer}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ArenaCard({ arena, onStart, onComplete, onEdit, onDelete, onOpenResults }: {
  arena: Arena;
  onStart: () => void;
  onComplete: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onOpenResults: () => void;
}) {
  const statusConfig = {
    upcoming: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', label: 'Upcoming', icon: Clock },
    active: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', label: 'Active', icon: Play },
    completed: { bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200', label: 'Completed', icon: CheckCircle },
    cancelled: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', label: 'Cancelled', icon: X },
  };

  const config = statusConfig[arena.status as keyof typeof statusConfig] || statusConfig.upcoming;
  const StatusIcon = config.icon;

  return (
    <div className={`bg-white rounded-2xl border ${config.border} overflow-hidden shadow-sm hover:shadow-md transition-all`}>
      {/* Status banner */}
      <div className={`${config.bg} px-4 py-2 flex items-center justify-between`}>
        <div className="flex items-center gap-2">
          <StatusIcon className={`w-4 h-4 ${config.text}`} />
          <span className={`text-sm font-semibold ${config.text}`}>{config.label}</span>
        </div>
        <span className="text-xs text-slate-500">{arena.participant_count} joined</span>
      </div>

      {/* Content */}
      <div className="p-5 space-y-4">
        <div>
          <h3 className="font-bold text-lg text-slate-800">{arena.title}</h3>
          {arena.description && (
            <p className="text-sm text-slate-500 mt-1 line-clamp-2">{arena.description}</p>
          )}
        </div>

        {/* Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <BookOpen className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 truncate">{arena.course_title || 'No course'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Zap className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600 truncate">{arena.quiz_title || 'No quiz'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-slate-600">{Math.floor(arena.time_limit_seconds / 60)} min</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Trophy className="w-4 h-4 text-amber-500" />
            <span className="text-slate-600">{arena.points_reward} pts</span>
          </div>
        </div>

        {/* Schedule */}
        {arena.scheduled_start && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>Scheduled: {new Date(arena.scheduled_start).toLocaleString()}</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          {arena.status === 'upcoming' && (
            <>
              <button
                onClick={onStart}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-emerald-500 text-white font-semibold rounded-lg hover:bg-emerald-600 transition-colors"
              >
                <Play className="w-4 h-4" />
                Start
              </button>
              <button
                onClick={onEdit}
                className="p-2 bg-slate-100 text-slate-600 rounded-lg hover:bg-slate-200 transition-colors"
              >
                <Edit className="w-4 h-4" />
              </button>
            </>
          )}
          {arena.status === 'active' && (
            <button
              onClick={onComplete}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-600 text-white font-semibold rounded-lg hover:bg-slate-700 transition-colors"
            >
              <Square className="w-4 h-4" />
              End Arena
            </button>
          )}
          {arena.status === 'completed' && (
            <button
              onClick={onOpenResults}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-slate-100 text-slate-600 font-semibold rounded-lg hover:bg-slate-200 transition-colors"
            >
              <Eye className="w-4 h-4" />
              View Results
            </button>
          )}
          {arena.status !== 'active' && (
            <button
              onClick={onDelete}
              className="p-2 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ArenaForm({
  mode,
  arena,
  courses,
  quizzes,
  categories,
  onBack,
  onSuccess,
}: {
  mode: 'create' | 'edit';
  arena: Arena | null;
  courses: Course[];
  quizzes: Quiz[];
  categories: Category[];
  onBack: () => void;
  onSuccess: (arena: Arena) => void;
}) {
  const [title, setTitle] = useState(arena?.title || '');
  const [description, setDescription] = useState(arena?.description || '');
  const [courseId, setCourseId] = useState(arena?.course_id || '');
  const [quizId, setQuizId] = useState(arena?.quiz_id || '');
  const [categoryId, setCategoryId] = useState(arena?.category_id || '');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(arena ? Math.floor(arena.time_limit_seconds / 60) : 10);
  const [pointsReward, setPointsReward] = useState(arena?.points_reward || 100);
  const [maxParticipants, setMaxParticipants] = useState(arena?.max_participants || 50);
  const [scheduledStart, setScheduledStart] = useState(
    arena?.scheduled_start ? new Date(arena.scheduled_start).toISOString().slice(0, 16) : ''
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter quizzes by selected course
  const filteredQuizzes = courseId
    ? quizzes.filter(q => q.course_id === courseId)
    : [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = {
        title,
        description: description || null,
        course_id: courseId,
        quiz_id: quizId || null,
        category_id: categoryId || null,
        time_limit_seconds: timeLimitMinutes * 60,
        points_reward: pointsReward,
        max_participants: maxParticipants,
        scheduled_start: scheduledStart ? new Date(scheduledStart).toISOString() : null,
      };

      let result;
      if (mode === 'edit' && arena) {
        const { data: updated, error: err } = await supabase
          .from('arenas')
          .update({ ...data, updated_at: new Date().toISOString() })
          .eq('id', arena.id)
          .select()
          .single();
        if (err) throw err;
        result = updated;
      } else {
        const { data: created, error: err } = await supabase
          .from('arenas')
          .insert({ ...data, created_by: (await supabase.auth.getUser()).data.user?.id })
          .select()
          .single();
        if (err) throw err;
        result = created;
      }

      // Get additional data for display
      const course = courses.find(c => c.id === result.course_id);
      const quiz = quizzes.find(q => q.id === result.quiz_id);
      const category = categories.find(c => c.id === result.category_id);

      onSuccess({
        ...result,
        course_title: course?.title,
        quiz_title: quiz?.title,
        category_name: category?.name,
        participant_count: 0,
      });
    } catch (e: any) {
      setError(e.message || 'Failed to save arena');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
        <ChevronRight className="w-4 h-4 rotate-180" />
        Back to Arenas
      </button>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 bg-gradient-to-r from-violet-500 to-purple-600">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Swords className="w-6 h-6" />
            {mode === 'create' ? 'Create New Arena' : 'Edit Arena'}
          </h2>
          <p className="text-violet-100 text-sm mt-1">Set up a live quiz competition for students</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Arena Title *</label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="e.g., Knowledge Championship"
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe the competition..."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Course & Quiz */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Course *</label>
              <select
                value={courseId}
                onChange={e => { setCourseId(e.target.value); setQuizId(''); }}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
              >
                <option value="">Select a course</option>
                {courses.map(c => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Quiz</label>
              <select
                value={quizId}
                onChange={e => setQuizId(e.target.value)}
                disabled={!courseId}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select a quiz</option>
                {filteredQuizzes.map(q => (
                  <option key={q.id} value={q.id}>{q.title}</option>
                ))}
              </select>
              {courseId && filteredQuizzes.length === 0 && (
                <p className="text-xs text-amber-600 mt-1">No quizzes available for this course</p>
              )}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Category (Optional)</label>
            <select
              value={categoryId}
              onChange={e => setCategoryId(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent bg-white"
            >
              <option value="">All students can join</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <p className="text-xs text-slate-400 mt-1">Limit participation to students of a specific category</p>
          </div>

          {/* Time & Points */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Time Limit (minutes) *</label>
              <input
                type="number"
                value={timeLimitMinutes}
                onChange={e => setTimeLimitMinutes(parseInt(e.target.value) || 10)}
                min={1}
                max={180}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Points Reward *</label>
              <input
                type="number"
                value={pointsReward}
                onChange={e => setPointsReward(parseInt(e.target.value) || 100)}
                min={10}
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">Max Participants</label>
              <input
                type="number"
                value={maxParticipants}
                onChange={e => setMaxParticipants(parseInt(e.target.value) || 50)}
                min={1}
                max={1000}
                className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Scheduled Start */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">Scheduled Start (Optional)</label>
            <input
              type="datetime-local"
              value={scheduledStart}
              onChange={e => setScheduledStart(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onBack}
              className="flex-1 py-3 bg-slate-100 text-slate-700 font-semibold rounded-xl hover:bg-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !title || !courseId}
              className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Swords className="w-4 h-4" />
                  {mode === 'create' ? 'Create Arena' : 'Save Changes'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

