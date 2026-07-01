import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  TrendingUp, BookOpen, CheckCircle, Clock, ChevronRight,
  ChevronLeft, Star, Target, Zap, Trophy, BarChart3, PlayCircle,
  FileQuestion, ArrowLeft, GraduationCap, Circle, AlertCircle,
  Loader2, Award, Flame, BarChart2,
} from 'lucide-react';
import { supabase, CourseCompletion } from '../lib/supabase';
import { CourseCertificate, CertificatePreviewCard } from './CourseCertificate';
import { useGamification } from '../lib/useGamification';
import { useAuth } from '../lib/AuthContext';
import { notifyCourseComplete } from '../lib/notifications';

interface EnrollmentRow {
  id: string;
  student_id: string;
  course_id: string;
  progress: number;
  enrolled_at: string;
  last_accessed_at: string | null;
  course_title: string;
  course_thumbnail: string | null;
  course_difficulty: string | null;
  course_duration_hours: number | null;
}

interface TopicRow {
  id: string;
  course_id: string;
  title: string;
  summary: string | null;
  sort_order: number;
}

interface TopicItemRow {
  id: string;
  topic_id: string;
  type: string;
  title: string;
  sort_order: number;
  quiz_id: string | null;
}

interface QuizAttemptRow {
  id: string;
  quiz_id: string;
  student_id: string;
  score: number;
  max_score: number;
  percentage: number;
  passed: boolean;
  time_taken_seconds: number | null;
  attempt_number: number;
  completed_at: string | null;
}

interface ItemProgressRow {
  id: string;
  item_id: string;
  student_id: string;
  completed: boolean;
  completed_at: string | null;
}

const DIFFICULTY_META: Record<string, { gradient: string; bg: string; text: string; border: string; emoji: string }> = {
  beginner: { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', emoji: '🌱' },
  intermediate: { gradient: 'from-sky-500 to-blue-600', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', emoji: '⚡' },
  advanced: { gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', emoji: '🚀' },
  expert: { gradient: 'from-rose-500 to-red-600', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', emoji: '🏆' },
};

function getDifficultyMeta(level: string | null) {
  if (!level) return { gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', emoji: '📚' };
  return DIFFICULTY_META[level.toLowerCase()] ?? { gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', emoji: '📚' };
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDuration(seconds: number | null) {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

interface StudentCourseProgressProps {
  enrollment: EnrollmentRow;
  onBack: () => void;
}

export function StudentCourseProgress({ enrollment, onBack }: StudentCourseProgressProps) {
  const { user, profile } = useAuth();
  const { awardXP } = useGamification(user?.id);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [topicItems, setTopicItems] = useState<TopicItemRow[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptRow[]>([]);
  const [itemProgress, setItemProgress] = useState<ItemProgressRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completion, setCompletion] = useState<CourseCompletion | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  // Local progress computed from item completions (overrides enrollment.progress from props)
  const [computedProgress, setComputedProgress] = useState(enrollment.progress);

  useEffect(() => {
    loadCourseDetail();
  }, [enrollment.course_id, enrollment.student_id]);

  // Recompute progress whenever items or their completion state changes
  useEffect(() => {
    if (topicItems.length === 0) return;
    const done = itemProgress.filter(p => p.completed).length;
    const pct = Math.round((done / topicItems.length) * 100);
    setComputedProgress(pct);
  }, [topicItems, itemProgress]);

  // Check for an existing completion record on load
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('course_completions')
        .select('*')
        .eq('student_id', enrollment.student_id)
        .eq('course_id', enrollment.course_id)
        .maybeSingle();
      if (data) setCompletion(data as CourseCompletion);
    })();
  }, [enrollment.course_id, enrollment.student_id]);

  // Trigger completion when computed progress hits 100%
  useEffect(() => {
    if (computedProgress >= 100 && !completion && user) {
      awardCompletion();
    }
  }, [computedProgress, completion, user]);

  // Award completion XP and create completion record
  const awardCompletion = useCallback(async () => {
    if (!user || completion) return;
    const xpBonus = Math.round((enrollment.course_duration_hours ?? 5) * 20);
    await awardXP(xpBonus, 'Course completion bonus!', 'course', enrollment.course_id);
    const { data: newCompletion, error: insErr } = await supabase
      .from('course_completions')
      .insert({ student_id: user.id, course_id: enrollment.course_id, xp_awarded: xpBonus })
      .select()
      .single();
    if (!insErr && newCompletion) {
      setCompletion(newCompletion as CourseCompletion);
      notifyCourseComplete(user.id, enrollment.course_title, xpBonus);
    }
  }, [user, completion, enrollment, awardXP]);

  // Mark a single item as complete, then sync progress to DB
  const markItemComplete = useCallback(async (itemId: string) => {
    if (!user) return;
    const existing = itemProgress.find(p => p.item_id === itemId);
    if (existing?.completed) return; // already done

    let updatedProgress: ItemProgressRow[];

    if (existing) {
      await supabase
        .from('course_item_progress')
        .update({ completed: true, completed_at: new Date().toISOString() })
        .eq('id', existing.id);
      updatedProgress = itemProgress.map(p =>
        p.item_id === itemId ? { ...p, completed: true, completed_at: new Date().toISOString() } : p
      );
    } else {
      const { data: inserted } = await supabase
        .from('course_item_progress')
        .insert({ item_id: itemId, student_id: user.id, completed: true, completed_at: new Date().toISOString() })
        .select()
        .single();
      updatedProgress = inserted
        ? [...itemProgress, inserted as ItemProgressRow]
        : [...itemProgress, { id: crypto.randomUUID(), item_id: itemId, student_id: user.id, completed: true, completed_at: new Date().toISOString() }];
    }

    setItemProgress(updatedProgress);

    // Recalculate and persist progress
    const done = updatedProgress.filter(p => p.completed).length;
    const total = topicItems.length;
    const newPct = total > 0 ? Math.round((done / total) * 100) : 0;
    setComputedProgress(newPct);

    await supabase
      .from('course_enrollments')
      .update({ progress: newPct, last_accessed_at: new Date().toISOString() })
      .eq('id', enrollment.id);

    if (newPct >= 100 && !completion) {
      awardCompletion();
    }
  }, [user, itemProgress, topicItems, enrollment.id, completion, awardCompletion]);

  async function loadCourseDetail() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // Load topics
      const { data: topicData, error: topicErr } = await supabase
        .from('course_topics')
        .select('id, course_id, title, summary, sort_order')
        .eq('course_id', enrollment.course_id)
        .order('sort_order', { ascending: true });
      if (topicErr) throw topicErr;
      const tRows: TopicRow[] = (topicData || []).map((t: any) => ({ ...t }));
      setTopics(tRows);

      // Load items
      let itemRows: TopicItemRow[] = [];
      if (tRows.length > 0) {
        const { data: itemData, error: itemErr } = await supabase
          .from('course_topic_items')
          .select('id, topic_id, type, title, sort_order, quiz_id')
          .in('topic_id', tRows.map(t => t.id))
          .order('sort_order', { ascending: true });
        if (itemErr) throw itemErr;
        itemRows = (itemData || []).map((i: any) => ({ ...i }));
        setTopicItems(itemRows);
      }

      // Load quiz attempts
      const quizIds = itemRows.filter(i => i.quiz_id).map(i => i.quiz_id!);
      let attemptRows: QuizAttemptRow[] = [];
      if (quizIds.length > 0) {
        const { data: attemptData, error: attemptErr } = await supabase
          .from('quiz_attempts')
          .select('id, quiz_id, student_id, score, max_score, percentage, passed, time_taken_seconds, attempt_number, completed_at')
          .eq('student_id', enrollment.student_id)
          .in('quiz_id', quizIds)
          .order('created_at', { ascending: false });
        if (attemptErr) throw attemptErr;
        attemptRows = (attemptData || []).map((a: any) => ({ ...a }));
        setQuizAttempts(attemptRows);
      }

      // Load existing item progress
      let progressRows: ItemProgressRow[] = [];
      if (itemRows.length > 0) {
        const { data: progressData, error: progressErr } = await supabase
          .from('course_item_progress')
          .select('id, item_id, student_id, completed, completed_at')
          .eq('student_id', enrollment.student_id)
          .in('item_id', itemRows.map(i => i.id));
        if (progressErr) throw progressErr;
        progressRows = (progressData || []).map((p: any) => ({ ...p }));
      }

      // Auto-sync: mark quiz items complete when student has a passing attempt
      const bestByQuizLoad = new Map<string, QuizAttemptRow>();
      for (const a of attemptRows) {
        const ex = bestByQuizLoad.get(a.quiz_id);
        if (!ex || a.percentage > ex.percentage) bestByQuizLoad.set(a.quiz_id, a);
      }

      const upserts: ItemProgressRow[] = [...progressRows];
      const toInsert: { item_id: string; student_id: string; completed: boolean; completed_at: string }[] = [];

      for (const item of itemRows) {
        if (!item.quiz_id) continue;
        const best = bestByQuizLoad.get(item.quiz_id);
        if (!best?.passed) continue;
        const already = progressRows.find(p => p.item_id === item.id);
        if (already?.completed) continue;

        toInsert.push({ item_id: item.id, student_id: user.id, completed: true, completed_at: best.completed_at ?? new Date().toISOString() });
      }

      if (toInsert.length > 0) {
        const { data: newRows } = await supabase
          .from('course_item_progress')
          .upsert(toInsert, { onConflict: 'item_id,student_id', ignoreDuplicates: false })
          .select();
        if (newRows) {
          for (const row of newRows as ItemProgressRow[]) {
            const idx = upserts.findIndex(p => p.item_id === row.item_id);
            if (idx >= 0) upserts[idx] = row; else upserts.push(row);
          }
        }
      }

      setItemProgress(upserts);

      // Recalculate and persist progress after sync
      if (itemRows.length > 0) {
        const done = upserts.filter(p => p.completed).length;
        const newPct = Math.round((done / itemRows.length) * 100);
        setComputedProgress(newPct);
        await supabase
          .from('course_enrollments')
          .update({ progress: newPct, last_accessed_at: new Date().toISOString() })
          .eq('id', enrollment.id);
      }
    } catch (e: any) {
      setError(e.message ?? 'Failed to load course details');
    } finally {
      setLoading(false);
    }
  }

  // Compute stats
  const stats = useMemo(() => {
    const totalItems = topicItems.length;
    const lessonItems = topicItems.filter(i => i.type === 'lesson' || i.type === 'video');
    const quizItems = topicItems.filter(i => i.type === 'quiz' && i.quiz_id);
    const totalQuizzes = quizItems.length;

    const completedItems = itemProgress.filter(p => p.completed).length;
    const completedLessons = lessonItems.filter(i => itemProgress.find(p => p.item_id === i.id && p.completed)).length;

    // Best attempt per quiz
    const bestByQuiz = new Map<string, QuizAttemptRow>();
    for (const a of quizAttempts) {
      const existing = bestByQuiz.get(a.quiz_id);
      if (!existing || a.percentage > existing.percentage) {
        bestByQuiz.set(a.quiz_id, a);
      }
    }
    const quizzesPassed = Array.from(bestByQuiz.values()).filter(a => a.passed).length;
    const avgScore = bestByQuiz.size > 0
      ? Math.round(Array.from(bestByQuiz.values()).reduce((sum, a) => sum + a.percentage, 0) / bestByQuiz.size)
      : 0;
    const totalAttempts = quizAttempts.length;

    return {
      totalItems,
      totalLessons: lessonItems.length,
      totalQuizzes,
      quizzesPassed,
      avgScore,
      totalAttempts,
      bestByQuiz,
      completedItems,
      completedLessons,
    };
  }, [topicItems, quizAttempts, itemProgress]);

  const meta = getDifficultyMeta(enrollment.course_difficulty);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 mt-3 text-sm">Loading course progress...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Progress
        </button>
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to My Progress
      </button>

      {/* Course header banner */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-800 to-slate-900 shadow-xl">
        {enrollment.course_thumbnail && (
          <div className="absolute inset-0 opacity-20">
            <img src={enrollment.course_thumbnail} alt="" className="w-full h-full object-cover" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/30 to-transparent" />
        <div className="relative p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
          {enrollment.course_thumbnail ? (
            <img src={enrollment.course_thumbnail} alt={enrollment.course_title} className="w-20 h-20 rounded-2xl object-cover shadow-lg flex-shrink-0" />
          ) : (
            <div className={`w-20 h-20 rounded-2xl bg-gradient-to-br ${meta.gradient} flex items-center justify-center text-3xl shadow-lg flex-shrink-0`}>
              {meta.emoji}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-md text-xs font-semibold ${meta.bg} ${meta.text}`}>{enrollment.course_difficulty ?? 'General'}</span>
              <span className="text-xs text-slate-400 flex items-center gap-1"><Clock className="w-3 h-3" />{enrollment.course_duration_hours ?? 0}h</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">{enrollment.course_title}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-slate-300">
              <span className="flex items-center gap-1">
                <CalendarIcon className="w-3.5 h-3.5" />
                Enrolled {formatDate(enrollment.enrolled_at)}
              </span>
              {enrollment.last_accessed_at && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  Last accessed {formatDate(enrollment.last_accessed_at)}
                </span>
              )}
            </div>
          </div>
          {/* Overall progress ring */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <ProgressRing percentage={computedProgress} size={80} />
            <span className="text-xs text-slate-400 mt-1.5">Overall</span>
          </div>
        </div>
      </div>

      {/* Certificate preview if completed */}
      {completion && (
        <CertificatePreviewCard
          studentName={profile?.full_name ?? user?.user_metadata?.full_name ?? 'Student'}
          courseTitle={enrollment.course_title}
          completedAt={completion.completed_at}
          certificateId={completion.certificate_id}
          onView={() => setShowCertificate(true)}
        />
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DetailStatCard icon={PlayCircle} label="Lessons" value={`${stats.completedLessons}/${stats.totalLessons}`} sub="completed" color="blue" />
        <DetailStatCard icon={FileQuestion} label="Quizzes" value={`${stats.quizzesPassed}/${stats.totalQuizzes}`} sub="passed" color="emerald" />
        <DetailStatCard icon={BarChart3} label="Avg. Score" value={`${stats.avgScore}%`} sub="across quizzes" color="amber" />
        <DetailStatCard icon={Zap} label="Attempts" value={stats.totalAttempts} sub="total tries" color="rose" />
      </div>

      {/* Progress Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h3 className="font-semibold text-slate-800 mb-3 flex items-center gap-2">
          <Target className="w-4 h-4 text-blue-500" />
          Progress Summary
        </h3>
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-600">{stats.completedItems} of {stats.totalItems} items completed</span>
          <span className={`text-sm font-bold ${computedProgress >= 100 ? 'text-emerald-600' : 'text-blue-600'}`}>{computedProgress}%</span>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${computedProgress >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
            style={{ width: `${Math.max(computedProgress, 2)}%` }}
          />
        </div>
      </div>

      {/* Topics with items */}
      {topics.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <BookOpen className="w-7 h-7 text-slate-400" />
          </div>
          <h3 className="text-base font-semibold text-slate-700">No course content yet</h3>
          <p className="text-slate-500 mt-1 text-sm">This course doesn't have topics or lessons published.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {topics.map((topic, idx) => {
            const items = topicItems.filter(i => i.topic_id === topic.id);
            return (
              <TopicSection
                key={topic.id}
                topic={topic}
                items={items}
                index={idx}
                bestByQuiz={stats.bestByQuiz}
                allAttempts={quizAttempts.filter(a => items.some(i => i.quiz_id === a.quiz_id))}
                itemProgress={itemProgress}
                onMarkComplete={markItemComplete}
              />
            );
          })}
        </div>
      )}

      {/* Certificate modal */}
      {showCertificate && completion && (
        <CourseCertificate
          studentName={profile?.full_name ?? user?.user_metadata?.full_name ?? 'Student'}
          courseTitle={enrollment.course_title}
          completedAt={completion.completed_at}
          certificateId={completion.certificate_id}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}

function ProgressRing({ percentage, size = 60 }: { percentage: number; size?: number }) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const color = percentage >= 100 ? '#10b981' : percentage >= 50 ? '#3b82f6' : percentage > 0 ? '#f59e0b' : '#cbd5e1';

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-bold text-white">{percentage}%</span>
      </div>
    </div>
  );
}

function DetailStatCard({ icon: Icon, label, value, sub, color }: { icon: React.ElementType; label: string; value: string | number; sub: string; color: string }) {
  const colorMap: Record<string, { bg: string; text: string; ring: string }> = {
    blue: { bg: 'bg-blue-50', text: 'text-blue-600', ring: 'ring-blue-100' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-600', ring: 'ring-emerald-100' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-600', ring: 'ring-amber-100' },
    rose: { bg: 'bg-rose-50', text: 'text-rose-600', ring: 'ring-rose-100' },
  };
  const c = colorMap[color] ?? colorMap.blue;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 hover:shadow-md transition-shadow">
      <div className={`w-10 h-10 rounded-xl ${c.bg} ${c.text} flex items-center justify-center mb-3 ring-4 ${c.ring}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-sm font-medium text-slate-700">{label}</p>
      <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}

function TopicSection({ topic, items, index, bestByQuiz, allAttempts, itemProgress, onMarkComplete }: {
  topic: TopicRow;
  items: TopicItemRow[];
  index: number;
  bestByQuiz: Map<string, QuizAttemptRow>;
  allAttempts: QuizAttemptRow[];
  itemProgress: ItemProgressRow[];
  onMarkComplete: (itemId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(true);
  const [marking, setMarking] = useState<string | null>(null);

  const completedCount = items.filter(i => itemProgress.find(p => p.item_id === i.id && p.completed)).length;
  const progressPercent = items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Topic header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 truncate">{topic.title}</h3>
          {topic.summary && <p className="text-xs text-slate-400 truncate mt-0.5">{topic.summary}</p>}
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="text-right">
            <span className="text-xs font-semibold text-blue-600">{progressPercent}%</span>
            <p className="text-[10px] text-slate-400">{completedCount}/{items.length} done</p>
          </div>
          <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </button>

      {/* Items */}
      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-50">
          {items.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400 text-center">No items in this topic.</p>
          ) : (
            items.map((item, iIdx) => {
              const isQuiz = item.type === 'quiz' && item.quiz_id;
              const best = isQuiz ? bestByQuiz.get(item.quiz_id!) : undefined;
              const isCompleted = itemProgress.find(p => p.item_id === item.id)?.completed;

              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isCompleted
                      ? 'bg-emerald-50 text-emerald-600'
                      : isQuiz
                        ? 'bg-amber-50 text-amber-600'
                        : 'bg-blue-50 text-blue-600'
                  }`}>
                    {isCompleted ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : isQuiz ? (
                      <FileQuestion className="w-4 h-4" />
                    ) : (
                      <PlayCircle className="w-4 h-4" />
                    )}
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${isCompleted ? 'text-emerald-700' : 'text-slate-700'}`}>{item.title}</p>
                    <p className="text-xs text-slate-400 capitalize">{item.type}</p>
                  </div>

                  {/* Status / Grade */}
                  {isQuiz ? (
                    <QuizGradeBadge attempt={best} attempts={allAttempts.filter(a => a.quiz_id === item.quiz_id)} />
                  ) : isCompleted ? (
                    <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                      <CheckCircle className="w-3 h-3" />
                      Completed
                    </span>
                  ) : (
                    <button
                      onClick={async () => {
                        setMarking(item.id);
                        await onMarkComplete(item.id);
                        setMarking(null);
                      }}
                      disabled={marking === item.id}
                      className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {marking === item.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <CheckCircle className="w-3 h-3" />
                      )}
                      Mark Done
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function QuizGradeBadge({ attempt, attempts }: { attempt?: QuizAttemptRow; attempts: QuizAttemptRow[] }) {
  if (!attempt) {
    return (
      <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-medium">
        <Circle className="w-3 h-3" />
        Not attempted
      </span>
    );
  }

  const passed = attempt.passed;
  const grade = attempt.percentage;

  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className="text-xs text-slate-400 hidden sm:inline">{attempts.length} {attempts.length === 1 ? 'try' : 'tries'}</span>
      <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
        passed
          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
          : 'bg-rose-50 text-rose-700 border border-rose-200'
      }`}>
        {passed ? <CheckCircle className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
        <span>{grade}%</span>
      </div>
    </div>
  );
}

// Main progress page component - list of enrolled courses
interface StudentProgressPageProps {
  userId: string;
  onSelectCourse: (enrollment: EnrollmentRow) => void;
}

export function StudentProgressPage({ userId, onSelectCourse }: StudentProgressPageProps) {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEnrollments();
  }, [userId]);

  async function loadEnrollments() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('course_enrollments')
        .select(`
          id, student_id, course_id, progress, enrolled_at, last_accessed_at,
          course:courses!course_enrollments_course_id_fkey(title, thumbnail_url, difficulty_level, duration_hours)
        `)
        .eq('student_id', userId)
        .order('enrolled_at', { ascending: false });

      if (err) throw err;

      const rows: EnrollmentRow[] = (data || []).map((r: any) => ({
        id: r.id,
        student_id: r.student_id,
        course_id: r.course_id,
        progress: r.progress ?? 0,
        enrolled_at: r.enrolled_at,
        last_accessed_at: r.last_accessed_at,
        course_title: r.course?.title ?? 'Untitled Course',
        course_thumbnail: r.course?.thumbnail_url ?? null,
        course_difficulty: r.course?.difficulty_level ?? null,
        course_duration_hours: r.course?.duration_hours ?? null,
      }));

      setEnrollments(rows);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load enrollments');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-500 mt-3 text-sm">Loading your progress...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
        <AlertCircle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  // Calculate summary stats
  const totalCourses = enrollments.length;
  const completedCourses = enrollments.filter(e => e.progress >= 100).length;
  const inProgressCourses = enrollments.filter(e => e.progress > 0 && e.progress < 100).length;
  const avgProgress = enrollments.length > 0
    ? Math.round(enrollments.reduce((a, e) => a + e.progress, 0) / enrollments.length)
    : 0;

  return (
    <div className="space-y-6 animate-fadeInUp">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <TrendingUp className="w-7 h-7 text-blue-600" />
          My Progress
        </h1>
        <p className="text-slate-500 mt-1">Track your learning journey across all enrolled courses</p>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={GraduationCap} label="Enrolled Courses" value={totalCourses} color="blue" />
        <StatCard icon={Trophy} label="Completed" value={completedCourses} color="emerald" />
        <StatCard icon={PlayCircle} label="In Progress" value={inProgressCourses} color="amber" />
        <StatCard icon={Target} label="Avg. Progress" value={`${avgProgress}%`} color="rose" />
      </div>

      {/* Empty */}
      {enrollments.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No courses enrolled yet</h3>
          <p className="text-slate-500 mt-1 text-sm">Browse the course market to start learning!</p>
        </div>
      )}

      {/* Course cards grid */}
      {enrollments.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {enrollments.map(enrollment => (
            <EnrollmentCard key={enrollment.id} enrollment={enrollment} onClick={() => onSelectCourse(enrollment)} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string | number; color: string }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600 text-blue-600 bg-blue-50',
    emerald: 'from-emerald-500 to-emerald-600 text-emerald-600 bg-emerald-50',
    amber: 'from-amber-500 to-amber-600 text-amber-600 bg-amber-50',
    rose: 'from-rose-500 to-rose-600 text-rose-600 bg-rose-50',
  };
  const c = colorMap[color] ?? colorMap.blue;
  const [grad] = c.split(' text-');
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${grad} flex items-center justify-center text-white shadow-md`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
          <p className="text-xs text-slate-500 font-medium">{label}</p>
        </div>
      </div>
    </div>
  );
}

function EnrollmentCard({ enrollment, onClick }: { enrollment: EnrollmentRow; onClick: () => void }) {
  const meta = getDifficultyMeta(enrollment.course_difficulty);
  const progress = enrollment.progress;

  return (
    <button
      onClick={onClick}
      className="group text-left bg-white rounded-2xl border border-slate-200 overflow-hidden hover:shadow-xl hover:shadow-slate-200/60 hover:-translate-y-1 transition-all duration-300"
    >
      {/* Thumbnail */}
      <div className="relative h-32 overflow-hidden">
        {enrollment.course_thumbnail ? (
          <img src={enrollment.course_thumbnail} alt={enrollment.course_title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        ) : (
          <div className={`w-full h-full bg-gradient-to-br ${meta.gradient} flex items-center justify-center`}>
            <BookOpen className="w-10 h-10 text-white/80" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3">
          <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold bg-white/90 ${meta.text} backdrop-blur-sm`}>
            {meta.emoji} {enrollment.course_difficulty ?? 'General'}
          </span>
        </div>
        {progress >= 100 && (
          <div className="absolute top-3 right-3">
            <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-bold bg-emerald-500 text-white">
              <Trophy className="w-3 h-3" /> Complete
            </span>
          </div>
        )}
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-bold text-base leading-tight line-clamp-2">{enrollment.course_title}</h3>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-slate-500">Progress</span>
            <span className={`text-xs font-bold ${progress >= 100 ? 'text-emerald-600' : progress > 0 ? 'text-blue-600' : 'text-slate-400'}`}>{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${progress >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : 'bg-gradient-to-r from-blue-500 to-indigo-500'}`}
              style={{ width: `${Math.max(progress, 2)}%` }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3.5 h-3.5" />
            <span>{enrollment.course_duration_hours ?? 0}h</span>
          </div>
          <span className="flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:gap-2 transition-all">
            View Details
            <ChevronRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </button>
  );
}
