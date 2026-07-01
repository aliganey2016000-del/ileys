import { useEffect, useState, useMemo } from 'react';
import {
  TrendingUp, BookOpen, CheckCircle, Award, Clock, ChevronRight,
  ChevronLeft, Star, Target, Zap, Trophy, BarChart3, PlayCircle,
  FileQuestion, Calendar, ArrowLeft, Search, Users, GraduationCap,
  Circle, AlertCircle, Loader2, Filter,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface EnrollmentRow {
  id: string;
  student_id: string;
  course_id: string;
  progress: number;
  enrolled_at: string;
  last_accessed_at: string | null;
  student_name: string;
  student_avatar: string | null;
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

const DIFFICULTY_META: Record<string, { gradient: string; bg: string; text: string; border: string; emoji: string }> = {
  beginner: { gradient: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', emoji: '🌱' },
  intermediate: { gradient: 'from-sky-500 to-blue-600', bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200', emoji: '⚡' },
  advanced: { gradient: 'from-amber-500 to-orange-600', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', emoji: '🚀' },
  expert: { gradient: 'from-rose-500 to-red-600', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', emoji: '🏆' },
};

function getDifficultyMeta(level: string | null) {
  if (!level) return { gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', emoji: '📚' };
  return DIFFICULTY_META[level] ?? { gradient: 'from-slate-500 to-slate-600', bg: 'bg-slate-50', text: 'text-slate-700', border: 'border-slate-200', emoji: '📚' };
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

export default function AdminStudentProgress() {
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedEnrollment, setSelectedEnrollment] = useState<EnrollmentRow | null>(null);

  useEffect(() => {
    loadEnrollments();
  }, []);

  async function loadEnrollments() {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('course_enrollments')
        .select(`
          id, student_id, course_id, progress, enrolled_at, last_accessed_at,
          student:profiles!course_enrollments_student_id_fkey(full_name, avatar_url),
          course:courses!course_enrollments_course_id_fkey(title, thumbnail_url, difficulty_level, duration_hours)
        `)
        .order('enrolled_at', { ascending: false });

      if (err) throw err;

      const rows: EnrollmentRow[] = (data || []).map((r: any) => ({
        id: r.id,
        student_id: r.student_id,
        course_id: r.course_id,
        progress: r.progress ?? 0,
        enrolled_at: r.enrolled_at,
        last_accessed_at: r.last_accessed_at,
        student_name: r.student?.full_name ?? 'Unknown Student',
        student_avatar: r.student?.avatar_url ?? null,
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

  const filtered = useMemo(() => {
    if (!search.trim()) return enrollments;
    const q = search.toLowerCase();
    return enrollments.filter(e =>
      e.student_name.toLowerCase().includes(q) ||
      e.course_title.toLowerCase().includes(q)
    );
  }, [enrollments, search]);

  if (selectedEnrollment) {
    return (
      <StudentCourseProgress
        enrollment={selectedEnrollment}
        onBack={() => setSelectedEnrollment(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-7 h-7 text-blue-600" />
            Student Progress
          </h1>
          <p className="text-slate-500 mt-1">Track real-time progress across all enrolled courses</p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search student or course..."
            className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-full sm:w-64 transition-all"
          />
        </div>
      </div>

      {/* Stats summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users} label="Total Enrollments" value={enrollments.length} color="blue" />
        <StatCard icon={BookOpen} label="Active Courses" value={new Set(enrollments.map(e => e.course_id)).size} color="emerald" />
        <StatCard icon={GraduationCap} label="Students" value={new Set(enrollments.map(e => e.student_id)).size} color="amber" />
        <StatCard icon={Target} label="Avg. Progress" value={`${Math.round(enrollments.reduce((a, e) => a + e.progress, 0) / (enrollments.length || 1))}%`} color="rose" />
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <p className="text-slate-500 mt-3 text-sm">Loading enrollments...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <BookOpen className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No enrollments found</h3>
          <p className="text-slate-500 mt-1 text-sm">Students haven't enrolled in any courses yet.</p>
        </div>
      )}

      {/* Course cards grid */}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map(enrollment => (
            <EnrollmentCard key={enrollment.id} enrollment={enrollment} onClick={() => setSelectedEnrollment(enrollment)} />
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
  const [grad, text, bg] = c.split(' text-');
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
        <div className="absolute bottom-3 left-3 right-3">
          <h3 className="text-white font-bold text-base leading-tight line-clamp-2">{enrollment.course_title}</h3>
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Student */}
        <div className="flex items-center gap-2.5">
          {enrollment.student_avatar ? (
            <img src={enrollment.student_avatar} alt={enrollment.student_name} className="w-8 h-8 rounded-full object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold">
              {enrollment.student_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">{enrollment.student_name}</p>
            <p className="text-xs text-slate-400">Enrolled {formatDate(enrollment.enrolled_at)}</p>
          </div>
        </div>

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

// ============================================================
// Detail View: Student's progress in a specific course
// ============================================================

function StudentCourseProgress({ enrollment, onBack }: { enrollment: EnrollmentRow; onBack: () => void }) {
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [topicItems, setTopicItems] = useState<TopicItemRow[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttemptRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCourseDetail();
  }, [enrollment.course_id, enrollment.student_id]);

  async function loadCourseDetail() {
    setLoading(true);
    setError(null);
    try {
      // Load topics for this course
      const { data: topicData, error: topicErr } = await supabase
        .from('course_topics')
        .select('id, course_id, title, summary, sort_order')
        .eq('course_id', enrollment.course_id)
        .order('sort_order', { ascending: true });

      if (topicErr) throw topicErr;
      const tRows: TopicRow[] = (topicData || []).map((t: any) => ({ ...t }));
      setTopics(tRows);

      // Load topic items for all topics
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

      // Load quiz attempts for this student
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
    };
  }, [topicItems, quizAttempts]);

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
    <div className="space-y-6">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group">
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Progress
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
            <div className="flex items-center gap-2 mt-2">
              {enrollment.student_avatar ? (
                <img src={enrollment.student_avatar} alt={enrollment.student_name} className="w-6 h-6 rounded-full object-cover" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-[10px] font-bold">
                  {enrollment.student_name.charAt(0).toUpperCase()}
                </div>
              )}
              <span className="text-sm text-slate-300">{enrollment.student_name}</span>
            </div>
          </div>
          {/* Overall progress ring */}
          <div className="flex-shrink-0 flex flex-col items-center">
            <ProgressRing percentage={enrollment.progress} size={80} />
            <span className="text-xs text-slate-400 mt-1.5">Overall</span>
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <DetailStatCard icon={PlayCircle} label="Lessons" value={stats.totalLessons} sub="total items" color="blue" />
        <DetailStatCard icon={FileQuestion} label="Quizzes" value={stats.totalQuizzes} sub={`${stats.quizzesPassed} passed`} color="emerald" />
        <DetailStatCard icon={BarChart3} label="Avg. Score" value={`${stats.avgScore}%`} sub="across quizzes" color="amber" />
        <DetailStatCard icon={Zap} label="Attempts" value={stats.totalAttempts} sub="total tries" color="rose" />
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
              />
            );
          })}
        </div>
      )}
    </div>
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

function TopicSection({ topic, items, index, bestByQuiz, allAttempts }: {
  topic: TopicRow;
  items: TopicItemRow[];
  index: number;
  bestByQuiz: Map<string, QuizAttemptRow>;
  allAttempts: QuizAttemptRow[];
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* Topic header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 truncate">{topic.title}</h3>
          {topic.summary && <p className="text-xs text-slate-400 truncate mt-0.5">{topic.summary}</p>}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-400 font-medium">{items.length} items</span>
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

              return (
                <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/50 transition-colors">
                  {/* Icon */}
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isQuiz ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                  }`}>
                    {isQuiz ? <FileQuestion className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
                  </div>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{item.title}</p>
                    <p className="text-xs text-slate-400 capitalize">{item.type}</p>
                  </div>

                  {/* Status / Grade */}
                  {isQuiz ? (
                    <QuizGradeBadge attempt={best} attempts={allAttempts.filter(a => a.quiz_id === item.quiz_id)} />
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-slate-400">
                      <Circle className="w-3 h-3" />
                      <span>Lesson</span>
                    </span>
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
