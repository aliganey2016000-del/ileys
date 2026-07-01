import { useEffect, useState, useMemo, useCallback } from 'react';
import {
  Activity, Users, Wifi, WifiOff, Search, RefreshCw,
  TrendingUp, BookOpen, FileQuestion, Trophy, Zap, Calendar,
  ChevronRight, ChevronLeft, Download, Filter,
  AlertCircle, Loader2, Monitor, PlayCircle, CheckCircle,
  GraduationCap, Swords, MessageSquare, LogIn, LogOut, Award,
  Clock, Video, FileText, UserPlus, Star, Flame, Target,
  BarChart3, Eye, ArrowUpRight, Sparkles, Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface PresenceRow {
  user_id: string;
  is_online: boolean;
  last_seen_at: string;
  last_activity: string;
  last_page: string;
  session_started_at: string | null;
  updated_at: string;
}

interface TimelineEvent {
  id: string;
  user_id: string;
  action: string;
  description: string;
  page: string;
  metadata: Record<string, any>;
  created_at: string;
  source: 'activity_log' | 'quiz_attempt' | 'enrollment' | 'completion' | 'xp' | 'study_session';
}

interface ProfileRow {
  id: string;
  full_name: string;
  role: string;
  avatar_url: string | null;
  email: string | null;
}

interface StudentWithPresence extends ProfileRow {
  presence: PresenceRow | null;
  event_count: number;
  last_activity_at: string | null;
  quiz_count: number;
  course_count: number;
  xp_total: number;
  engagement_score: number;
}

const OFFLINE_THRESHOLD_MS = 2 * 60 * 1000;

const ACTION_META: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  login:              { icon: LogIn,        color: 'text-emerald-600', bg: 'bg-emerald-50',  label: 'Signed in' },
  logout:             { icon: LogOut,       color: 'text-slate-500',   bg: 'bg-slate-100',   label: 'Signed out' },
  lesson_open:        { icon: PlayCircle,    color: 'text-blue-600',    bg: 'bg-blue-50',     label: 'Opened lesson' },
  lesson_complete:    { icon: CheckCircle,   color: 'text-emerald-600', bg: 'bg-emerald-50',  label: 'Completed lesson' },
  quiz_start:         { icon: FileQuestion,  color: 'text-amber-600',   bg: 'bg-amber-50',    label: 'Started quiz' },
  quiz_submit:        { icon: FileQuestion,  color: 'text-amber-600',   bg: 'bg-amber-50',    label: 'Submitted quiz' },
  quiz_attempt:       { icon: FileQuestion,  color: 'text-amber-600',   bg: 'bg-amber-50',    label: 'Quiz attempt' },
  course_enroll:      { icon: UserPlus,      color: 'text-indigo-600',  bg: 'bg-indigo-50',   label: 'Enrolled in course' },
  course_complete:    { icon: GraduationCap, color: 'text-emerald-600', bg: 'bg-emerald-50',  label: 'Completed course' },
  page_view:          { icon: Monitor,       color: 'text-slate-500',   bg: 'bg-slate-100',   label: 'Page view' },
  video_watch:        { icon: Video,         color: 'text-violet-600',  bg: 'bg-violet-50',   label: 'Watched video' },
  arena_join:         { icon: Swords,        color: 'text-rose-600',    bg: 'bg-rose-50',     label: 'Joined arena' },
  arena_complete:     { icon: Swords,        color: 'text-rose-600',    bg: 'bg-rose-50',     label: 'Completed arena' },
  forum_post:         { icon: MessageSquare, color: 'text-cyan-600',    bg: 'bg-cyan-50',     label: 'Forum post' },
  study_session:      { icon: Clock,         color: 'text-violet-600',  bg: 'bg-violet-50',   label: 'Study session' },
  certificate_earned: { icon: Award,         color: 'text-yellow-600',  bg: 'bg-yellow-50',   label: 'Certificate earned' },
  xp_earned:          { icon: Zap,           color: 'text-orange-600',  bg: 'bg-orange-50',   label: 'XP earned' },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? { icon: Activity, color: 'text-slate-500', bg: 'bg-slate-100', label: action };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'never';
  const diff = Date.now() - new Date(dateStr).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function AdminActivityReport() {
  const [students, setStudents] = useState<StudentWithPresence[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'online' | 'offline'>('all');
  const [selectedStudent, setSelectedStudent] = useState<StudentWithPresence | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [liveFeed, setLiveFeed] = useState<TimelineEvent[]>([]);
  const [feedLoading, setFeedLoading] = useState(true);
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d' | 'all'>('24h');
  const [activityFilter, setActivityFilter] = useState<string>('all');

  const loadData = useCallback(async () => {
    setRefreshing(true);
    try {
      const [
        profilesRes, presenceRes, activityCountRes,
        quizCountRes, enrollCountRes, xpRes,
      ] = await Promise.all([
        supabase.from('profiles').select('id, full_name, role, avatar_url, email').eq('role', 'student').order('full_name'),
        supabase.from('user_presence').select('*'),
        supabase.from('activity_log').select('user_id, action, created_at'),
        supabase.from('quiz_attempts').select('student_id'),
        supabase.from('course_enrollments').select('student_id'),
        supabase.from('user_stats').select('user_id, total_xp'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (presenceRes.error) throw presenceRes.error;

      const presenceMap = new Map<string, PresenceRow>();
      (presenceRes.data || []).forEach((p: any) => presenceMap.set(p.user_id, p));

      const countMap = new Map<string, number>();
      (activityCountRes.data || []).forEach((a: any) => countMap.set(a.user_id, (countMap.get(a.user_id) || 0) + 1));

      const quizMap = new Map<string, number>();
      (quizCountRes.data || []).forEach((a: any) => quizMap.set(a.student_id, (quizMap.get(a.student_id) || 0) + 1));

      const enrollMap = new Map<string, number>();
      (enrollCountRes.data || []).forEach((a: any) => enrollMap.set(a.student_id, (enrollMap.get(a.student_id) || 0) + 1));

      const xpMap = new Map<string, number>();
      (xpRes.data || []).forEach((a: any) => xpMap.set(a.user_id, a.total_xp || 0));

      const now = Date.now();
      const rows: StudentWithPresence[] = (profilesRes.data || []).map((p: any) => {
        const presence = presenceMap.get(p.id) || null;
        const isOnline = presence ? (now - new Date(presence.last_seen_at).getTime() < OFFLINE_THRESHOLD_MS) : false;
        const events = countMap.get(p.id) || 0;
        const quizzes = quizMap.get(p.id) || 0;
        const courses = enrollMap.get(p.id) || 0;
        const xp = xpMap.get(p.id) || 0;
        // Engagement score: weighted combination
        const engagement = Math.min(100, Math.round(events * 2 + quizzes * 5 + courses * 8 + xp / 50));
        return {
          ...p,
          presence: presence ? { ...presence, is_online: isOnline } : null,
          event_count: events,
          last_activity_at: presence?.last_seen_at || null,
          quiz_count: quizzes,
          course_count: courses,
          xp_total: xp,
          engagement_score: engagement,
        };
      });

      setStudents(rows);
      setError(null);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load activity data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadLiveFeed = useCallback(async () => {
    setFeedLoading(true);
    try {
      const since = dateRange === '24h' ? new Date(Date.now() - 24 * 3600 * 1000).toISOString()
        : dateRange === '7d' ? new Date(Date.now() - 7 * 86400 * 1000).toISOString()
        : dateRange === '30d' ? new Date(Date.now() - 30 * 86400 * 1000).toISOString()
        : null;

      const [activityRes, quizRes, enrollRes, completionRes, xpRes] = await Promise.all([
        supabase.from('activity_log').select('id, user_id, action, description, page, metadata, created_at')
          .order('created_at', { ascending: false }).limit(50),
        supabase.from('quiz_attempts').select('id, student_id, quiz_id, percentage, passed, completed_at, quizzes(title)')
          .order('completed_at', { ascending: false }).limit(30),
        supabase.from('course_enrollments').select('id, student_id, course_id, enrolled_at, courses(title)')
          .order('enrolled_at', { ascending: false }).limit(20),
        supabase.from('course_completions').select('id, student_id, course_id, completed_at, xp_awarded, courses(title)')
          .order('completed_at', { ascending: false }).limit(20),
        supabase.from('xp_transactions').select('id, user_id, amount, reason, source_type, created_at')
          .order('created_at', { ascending: false }).limit(30),
      ]);

      const events: TimelineEvent[] = [];
      const profileMap = new Map<string, string>();
      const profilesData = await supabase.from('profiles').select('id, full_name');
      (profilesData.data || []).forEach((p: any) => profileMap.set(p.id, p.full_name));

      (activityRes.data || []).forEach((a: any) => {
        events.push({ id: a.id, user_id: a.user_id, action: a.action, description: a.description || '', page: a.page || '', metadata: { ...a.metadata, student_name: profileMap.get(a.user_id) || 'Unknown' }, created_at: a.created_at, source: 'activity_log' });
      });
      (quizRes.data || []).forEach((q: any) => {
        events.push({ id: q.id, user_id: q.student_id, action: 'quiz_attempt', description: `Quiz "${q.quizzes?.title || 'Unknown'}" — ${q.percentage}% (${q.passed ? 'passed' : 'failed'})`, page: 'quiz', metadata: { percentage: q.percentage, passed: q.passed, student_name: profileMap.get(q.student_id) || 'Unknown' }, created_at: q.completed_at, source: 'quiz_attempt' });
      });
      (enrollRes.data || []).forEach((e: any) => {
        events.push({ id: e.id, user_id: e.student_id, action: 'course_enroll', description: `Enrolled in "${e.courses?.title || 'Unknown'}"`, page: 'my-courses', metadata: { student_name: profileMap.get(e.student_id) || 'Unknown' }, created_at: e.enrolled_at, source: 'enrollment' });
      });
      (completionRes.data || []).forEach((c: any) => {
        events.push({ id: c.id, user_id: c.student_id, action: 'course_complete', description: `Completed "${c.courses?.title || 'Unknown'}" (+${c.xp_awarded} XP)`, page: 'my-courses', metadata: { xp_awarded: c.xp_awarded, student_name: profileMap.get(c.student_id) || 'Unknown' }, created_at: c.completed_at, source: 'completion' });
      });
      (xpRes.data || []).forEach((x: any) => {
        events.push({ id: x.id, user_id: x.user_id, action: 'xp_earned', description: `+${x.amount} XP — ${x.reason || x.source_type || 'activity'}`, page: '', metadata: { amount: x.amount, student_name: profileMap.get(x.user_id) || 'Unknown' }, created_at: x.created_at, source: 'xp' });
      });

      events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const filtered = since ? events.filter(e => new Date(e.created_at).getTime() >= new Date(since).getTime()) : events;
      setLiveFeed(filtered.slice(0, 50));
    } catch {
      setLiveFeed([]);
    } finally {
      setFeedLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    loadLiveFeed();
  }, [loadLiveFeed]);

  const filtered = useMemo(() => {
    let list = students;
    if (filter === 'online') list = list.filter(s => s.presence?.is_online);
    if (filter === 'offline') list = list.filter(s => !s.presence?.is_online);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(s => s.full_name.toLowerCase().includes(q) || (s.email || '').toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.engagement_score - a.engagement_score);
  }, [students, filter, search]);

  const filteredFeed = useMemo(() => {
    if (activityFilter === 'all') return liveFeed;
    return liveFeed.filter(e => e.action === activityFilter);
  }, [liveFeed, activityFilter]);

  const stats = useMemo(() => {
    const online = students.filter(s => s.presence?.is_online).length;
    const offline = students.length - online;
    const totalEvents = students.reduce((a, s) => a + s.event_count, 0);
    const totalQuizzes = students.reduce((a, s) => a + s.quiz_count, 0);
    const avgEngagement = students.length > 0 ? Math.round(students.reduce((a, s) => a + s.engagement_score, 0) / students.length) : 0;
    return { total: students.length, online, offline, totalEvents, totalQuizzes, avgEngagement };
  }, [students]);

  const activityTypes = useMemo(() => {
    const types = new Set(liveFeed.map(e => e.action));
    return Array.from(types);
  }, [liveFeed]);

  const exportCSV = () => {
    const headers = ['Student', 'Email', 'Status', 'Engagement', 'Last Seen', 'Last Activity', 'Last Page', 'Events', 'Quizzes', 'Courses', 'XP'];
    const rows = filtered.map(s => [
      s.full_name, s.email || '',
      s.presence?.is_online ? 'Online' : 'Offline',
      String(s.engagement_score),
      s.presence?.last_seen_at ? formatTime(s.presence.last_seen_at) : 'Never',
      s.presence?.last_activity || '', s.presence?.last_page || '',
      String(s.event_count), String(s.quiz_count), String(s.course_count), String(s.xp_total),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `student-activity-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selectedStudent) {
    return (
      <StudentDetailReport
        student={selectedStudent}
        onBack={() => setSelectedStudent(null)}
        onExport={() => exportStudentCSV(selectedStudent)}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center shadow-lg shadow-rose-200">
              <Activity className="w-5 h-5 text-white" />
            </div>
            Activity Report
          </h1>
          <p className="text-slate-500 mt-1.5 text-sm">Real-time student presence, engagement & full activity timeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all">
            <Download size={15} /> Export CSV
          </button>
          <button onClick={loadData} disabled={refreshing} className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white text-sm font-semibold hover:bg-rose-700 disabled:opacity-60 transition-all shadow-lg shadow-rose-200">
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <StatCard icon={Users} label="Total Students" value={stats.total} color="blue" />
        <StatCard icon={Wifi} label="Online Now" value={stats.online} color="emerald" pulse={stats.online > 0} />
        <StatCard icon={WifiOff} label="Offline" value={stats.offline} color="slate" />
        <StatCard icon={Activity} label="Tracked Events" value={stats.totalEvents} color="amber" />
        <StatCard icon={FileQuestion} label="Quiz Attempts" value={stats.totalQuizzes} color="rose" />
        <StatCard icon={Flame} label="Avg Engagement" value={`${stats.avgEngagement}%`} color="orange" />
      </div>

      {/* Main grid: Student list + Live feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Student list - takes 2 columns on desktop */}
        <div className="lg:col-span-2 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search student name or email..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
              />
            </div>
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto">
              {(['all', 'online', 'offline'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                    filter === f ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50'
                  }`}>
                  {f === 'online' && <Wifi size={13} />}
                  {f === 'offline' && <WifiOff size={13} />}
                  {f === 'all' && <Filter size={13} />}
                  {f}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 bg-white rounded-2xl border border-slate-200">
              <Loader2 className="w-8 h-8 text-rose-500 animate-spin" />
              <p className="text-slate-500 mt-3 text-sm">Loading activity data...</p>
            </div>
          )}

          {error && !loading && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Desktop table */}
          {!loading && !error && (
            <>
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200">
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Student</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Engagement</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden lg:table-cell">Last Activity</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider hidden xl:table-cell">Last Page</th>
                        <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Last Seen</th>
                        <th className="px-4 py-3"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filtered.length === 0 ? (
                        <tr><td colSpan={7} className="px-4 py-12 text-center text-slate-400 text-sm">No students found.</td></tr>
                      ) : (
                        filtered.map(s => (
                          <tr key={s.id} onClick={() => setSelectedStudent(s)} className="hover:bg-slate-50 cursor-pointer transition-colors group">
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                {s.avatar_url ? (
                                  <img src={s.avatar_url} alt={s.full_name} className="w-9 h-9 rounded-full object-cover" />
                                ) : (
                                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-xs font-bold">
                                    {s.full_name.charAt(0).toUpperCase()}
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-800 truncate">{s.full_name}</p>
                                  <p className="text-xs text-slate-400 truncate">{s.email || 'No email'}</p>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              {s.presence?.is_online ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-semibold border border-emerald-200">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" /> Online
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
                                  <span className="w-2 h-2 rounded-full bg-slate-400" /> Offline
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${s.engagement_score >= 70 ? 'bg-emerald-500' : s.engagement_score >= 40 ? 'bg-amber-500' : 'bg-slate-300'}`} style={{ width: `${s.engagement_score}%` }} />
                                </div>
                                <span className="text-xs font-semibold text-slate-600">{s.engagement_score}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3 hidden lg:table-cell">
                              <p className="text-sm text-slate-600 truncate max-w-[180px]">{s.presence?.last_activity || '—'}</p>
                            </td>
                            <td className="px-4 py-3 hidden xl:table-cell">
                              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md font-mono">{s.presence?.last_page || '—'}</span>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-slate-500">{timeAgo(s.presence?.last_seen_at || null)}</span>
                            </td>
                            <td className="px-4 py-3">
                              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-rose-500 group-hover:translate-x-0.5 transition-all" />
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {filtered.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">No students found.</div>
                ) : (
                  filtered.map(s => (
                    <div key={s.id} onClick={() => setSelectedStudent(s)} className="bg-white rounded-2xl border border-slate-200 p-4 active:scale-[0.98] transition-transform cursor-pointer">
                      <div className="flex items-start gap-3">
                        {s.avatar_url ? (
                          <img src={s.avatar_url} alt={s.full_name} className="w-11 h-11 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-slate-400 to-slate-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                            {s.full_name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold text-slate-800 truncate">{s.full_name}</p>
                            {s.presence?.is_online ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-200 flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Online
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 text-slate-500 text-[10px] font-semibold flex-shrink-0">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" /> Offline
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 truncate mt-0.5">{s.email || 'No email'}</p>
                          {s.presence?.last_activity && (
                            <p className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                              <Activity size={11} className="text-rose-400" />
                              <span className="truncate">{s.presence.last_activity}</span>
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-2.5">
                            <div className="flex items-center gap-1.5 flex-1">
                              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className={`h-full rounded-full ${s.engagement_score >= 70 ? 'bg-emerald-500' : s.engagement_score >= 40 ? 'bg-amber-500' : 'bg-slate-300'}`} style={{ width: `${s.engagement_score}%` }} />
                              </div>
                              <span className="text-[10px] font-semibold text-slate-500">{s.engagement_score}%</span>
                            </div>
                            <span className="text-[10px] text-slate-400">{timeAgo(s.presence?.last_seen_at || null)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>

        {/* Live Activity Feed - takes 1 column */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden sticky top-4">
            <div className="p-4 border-b border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-rose-500" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  </div>
                  Live Activity
                </h3>
                <span className="text-xs text-slate-400">{filteredFeed.length} events</span>
              </div>
              {/* Date range filter */}
              <div className="flex items-center gap-1 bg-slate-50 rounded-lg p-0.5">
                {(['24h', '7d', '30d', 'all'] as const).map(r => (
                  <button key={r} onClick={() => setDateRange(r)}
                    className={`flex-1 px-2 py-1 rounded-md text-[10px] font-semibold uppercase transition-all ${
                      dateRange === r ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                    }`}>
                    {r}
                  </button>
                ))}
              </div>
              {/* Activity type filter */}
              {activityTypes.length > 0 && (
                <div className="flex items-center gap-1 mt-2 overflow-x-auto pb-1">
                  <button onClick={() => setActivityFilter('all')}
                    className={`px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition-all ${
                      activityFilter === 'all' ? 'bg-rose-100 text-rose-600' : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                    }`}>
                    All
                  </button>
                  {activityTypes.slice(0, 6).map(t => {
                    const meta = getActionMeta(t);
                    return (
                      <button key={t} onClick={() => setActivityFilter(t)}
                        className={`px-2 py-1 rounded-md text-[10px] font-semibold whitespace-nowrap transition-all ${
                          activityFilter === t ? `${meta.bg} ${meta.color}` : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                        }`}>
                        {meta.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {feedLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-5 h-5 text-rose-500 animate-spin" />
                </div>
              ) : filteredFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center px-4">
                  <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <Activity className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-500 font-medium">No recent activity</p>
                  <p className="text-xs text-slate-400 mt-1">Try changing the time range</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-100" />
                  <div className="space-y-0">
                    {filteredFeed.map((a, idx) => {
                      const meta = getActionMeta(a.action);
                      const Icon = meta.icon;
                      const studentName = a.metadata?.student_name || 'Unknown';
                      return (
                        <div key={a.id} className="relative flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                          <div className={`relative z-10 w-7 h-7 rounded-full ${meta.bg} ${meta.color} flex items-center justify-center flex-shrink-0 ring-4 ring-white`}>
                            <Icon size={12} />
                          </div>
                          <div className="flex-1 min-w-0 pt-0.5">
                            <p className="text-xs font-medium text-slate-800 leading-snug">
                              <span className="font-semibold">{studentName}</span>
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5 leading-snug">{a.description || meta.label}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <span className={`text-[9px] font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                              {a.page && <span className="text-[9px] text-slate-400 bg-slate-100 px-1 py-0.5 rounded font-mono">{a.page}</span>}
                              <span className="text-[10px] text-slate-400">{timeAgo(a.created_at)}</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, color, pulse }: { icon: React.ElementType; label: string; value: string | number; color: string; pulse?: boolean }) {
  const colorMap: Record<string, string> = {
    blue: 'from-blue-500 to-blue-600', emerald: 'from-emerald-500 to-emerald-600',
    slate: 'from-slate-400 to-slate-500', amber: 'from-amber-500 to-amber-600',
    rose: 'from-rose-500 to-rose-600', orange: 'from-orange-500 to-orange-600',
  };
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 hover:shadow-lg hover:shadow-slate-100 transition-all duration-300">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br ${colorMap[color]} flex items-center justify-center text-white shadow-md relative flex-shrink-0`}>
          <Icon className="w-5 h-5" />
          {pulse && <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />}
        </div>
        <div className="min-w-0">
          <p className="text-xl sm:text-2xl font-bold text-slate-900 truncate">{value}</p>
          <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate">{label}</p>
        </div>
      </div>
    </div>
  );
}

// ── Student Detail Report ──────────────────────────────────────────────────────
function StudentDetailReport({ student, onBack, onExport }: {
  student: StudentWithPresence;
  onBack: () => void;
  onExport: () => void;
}) {
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loadingTimeline, setLoadingTimeline] = useState(true);
  const [summary, setSummary] = useState<Record<string, number>>({});
  const [detailFilter, setDetailFilter] = useState<string>('all');

  useEffect(() => {
    loadStudentTimeline(student.id);
  }, [student.id]);

  const loadStudentTimeline = async (studentId: string) => {
    setLoadingTimeline(true);
    try {
      const [activityRes, quizAttemptsRes, enrollmentsRes, completionsRes, xpRes, studyRes] = await Promise.all([
        supabase.from('activity_log').select('*').eq('user_id', studentId).order('created_at', { ascending: false }).limit(500),
        supabase.from('quiz_attempts').select('id, quiz_id, score, max_score, percentage, passed, completed_at, created_at, quizzes(title)').eq('student_id', studentId).order('completed_at', { ascending: false }).limit(200),
        supabase.from('course_enrollments').select('id, course_id, enrolled_at, courses(title)').eq('student_id', studentId).order('enrolled_at', { ascending: false }).limit(100),
        supabase.from('course_completions').select('id, course_id, completed_at, certificate_id, xp_awarded, courses(title)').eq('student_id', studentId).order('completed_at', { ascending: false }).limit(100),
        supabase.from('xp_transactions').select('id, amount, reason, source_type, created_at').eq('user_id', studentId).order('created_at', { ascending: false }).limit(200),
        supabase.from('study_sessions').select('id, deck_id, cards_studied, cards_mastered, duration_seconds, xp_earned, created_at, vocabulary_decks(name)').eq('user_id', studentId).order('created_at', { ascending: false }).limit(100),
      ]);

      const events: TimelineEvent[] = [];

      (activityRes.data || []).forEach((a: any) => {
        events.push({ id: a.id, user_id: a.user_id, action: a.action, description: a.description || '', page: a.page || '', metadata: a.metadata || {}, created_at: a.created_at, source: 'activity_log' });
      });
      (quizAttemptsRes.data || []).forEach((q: any) => {
        events.push({ id: q.id, user_id: studentId, action: 'quiz_attempt', description: `Quiz "${q.quizzes?.title || 'Unknown'}" — ${q.percentage}% (${q.passed ? 'passed' : 'failed'})`, page: 'quiz', metadata: { quiz_id: q.quiz_id, score: q.score, max_score: q.max_score, percentage: q.percentage, passed: q.passed }, created_at: q.completed_at || q.created_at, source: 'quiz_attempt' });
      });
      (enrollmentsRes.data || []).forEach((e: any) => {
        events.push({ id: e.id, user_id: studentId, action: 'course_enroll', description: `Enrolled in "${e.courses?.title || 'Unknown course'}"`, page: 'my-courses', metadata: { course_id: e.course_id }, created_at: e.enrolled_at, source: 'enrollment' });
      });
      (completionsRes.data || []).forEach((c: any) => {
        events.push({ id: c.id, user_id: studentId, action: 'course_complete', description: `Completed "${c.courses?.title || 'Unknown course'}" (+${c.xp_awarded} XP)`, page: 'my-courses', metadata: { course_id: c.course_id, certificate_id: c.certificate_id, xp_awarded: c.xp_awarded }, created_at: c.completed_at, source: 'completion' });
        events.push({ id: `cert-${c.id}`, user_id: studentId, action: 'certificate_earned', description: `Certificate earned for "${c.courses?.title || 'Unknown course'}"`, page: 'my-courses', metadata: { certificate_id: c.certificate_id, course_id: c.course_id }, created_at: c.completed_at, source: 'completion' });
      });
      (xpRes.data || []).forEach((x: any) => {
        events.push({ id: x.id, user_id: studentId, action: 'xp_earned', description: `+${x.amount} XP — ${x.reason || x.source_type || 'activity'}`, page: '', metadata: { amount: x.amount, reason: x.reason, source_type: x.source_type }, created_at: x.created_at, source: 'xp' });
      });
      (studyRes.data || []).forEach((s: any) => {
        events.push({ id: s.id, user_id: studentId, action: 'study_session', description: `Study session — ${s.cards_studied} cards, ${Math.round((s.duration_seconds || 0) / 60)}m, +${s.xp_earned} XP`, page: 'vocabulary', metadata: { deck_id: s.deck_id, deck_name: s.vocabulary_decks?.name, cards_studied: s.cards_studied, cards_mastered: s.cards_mastered, duration_seconds: s.duration_seconds }, created_at: s.created_at, source: 'study_session' });
      });

      events.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setTimeline(events);

      const counts: Record<string, number> = {};
      events.forEach(e => { counts[e.action] = (counts[e.action] || 0) + 1; });
      setSummary(counts);
    } catch {
      setTimeline([]);
    } finally {
      setLoadingTimeline(false);
    }
  };

  const summaryStats = useMemo(() => ({
    logins: summary.login || 0,
    lessons: summary.lesson_open || 0,
    lessonCompletes: summary.lesson_complete || 0,
    quizzes: summary.quiz_attempt || 0,
    quizStarts: summary.quiz_start || 0,
    courses: summary.course_enroll || 0,
    courseCompletes: summary.course_complete || 0,
    pageViews: summary.page_view || 0,
    videos: summary.video_watch || 0,
    studySessions: summary.study_session || 0,
    certificates: summary.certificate_earned || 0,
    xpEvents: summary.xp_earned || 0,
  }), [summary]);

  const filteredTimeline = useMemo(() => {
    if (detailFilter === 'all') return timeline;
    return timeline.filter(e => e.action === detailFilter);
  }, [timeline, detailFilter]);

  const detailActivityTypes = useMemo(() => {
    const types = new Set(timeline.map(e => e.action));
    return Array.from(types);
  }, [timeline]);

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors group">
        <ChevronLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
        Back to Activity Report
      </button>

      {/* Student header */}
      <div className="relative rounded-3xl overflow-hidden bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 shadow-xl">
        <div className="absolute inset-0 bg-gradient-to-br from-rose-600/20 via-transparent to-blue-600/10" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="relative p-5 sm:p-8 flex flex-col sm:flex-row sm:items-center gap-5">
          {student.avatar_url ? (
            <img src={student.avatar_url} alt={student.full_name} className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover shadow-lg flex-shrink-0" />
          ) : (
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center text-2xl sm:text-3xl font-bold text-white shadow-lg flex-shrink-0">
              {student.full_name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              {student.presence?.is_online ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Online
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-700 text-slate-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-500" /> Offline
                </span>
              )}
              <span className="text-xs text-slate-400">Last seen {timeAgo(student.presence?.last_seen_at || null)}</span>
            </div>
            <h1 className="text-lg sm:text-2xl font-bold text-white leading-tight">{student.full_name}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{student.email || 'No email on file'}</p>
            {student.presence?.last_activity && (
              <p className="text-sm text-slate-300 mt-2 flex items-center gap-1.5">
                <Activity size={13} className="text-rose-400" />
                Last: {student.presence.last_activity}
              </p>
            )}
          </div>
          <div className="flex-shrink-0 flex sm:flex-col gap-2">
            <button onClick={onExport} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold border border-white/20 transition-colors">
              <Download size={15} /> Export
            </button>
          </div>
        </div>
        {/* Engagement bar */}
        <div className="relative px-5 sm:px-8 pb-5 sm:pb-6">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-400 font-medium">Engagement Score</span>
            <span className="text-sm font-bold text-white">{student.engagement_score}%</span>
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${student.engagement_score >= 70 ? 'bg-gradient-to-r from-emerald-400 to-emerald-500' : student.engagement_score >= 40 ? 'bg-gradient-to-r from-amber-400 to-amber-500' : 'bg-gradient-to-r from-slate-400 to-slate-500'}`} style={{ width: `${student.engagement_score}%` }} />
          </div>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
        <MiniStat icon={LogIn} label="Logins" value={summaryStats.logins} color="emerald" />
        <MiniStat icon={PlayCircle} label="Lessons" value={summaryStats.lessons} color="blue" />
        <MiniStat icon={Video} label="Videos" value={summaryStats.videos} color="violet" />
        <MiniStat icon={FileQuestion} label="Quizzes" value={summaryStats.quizzes} color="amber" />
        <MiniStat icon={UserPlus} label="Enrolled" value={summaryStats.courses} color="indigo" />
        <MiniStat icon={GraduationCap} label="Completed" value={summaryStats.courseCompletes} color="rose" />
        <MiniStat icon={Monitor} label="Page Views" value={summaryStats.pageViews} color="slate" />
        <MiniStat icon={Clock} label="Study" value={summaryStats.studySessions} color="violet" />
        <MiniStat icon={Award} label="Certs" value={summaryStats.certificates} color="yellow" />
        <MiniStat icon={Zap} label="XP Events" value={summaryStats.xpEvents} color="orange" />
        <MiniStat icon={CheckCircle} label="Lessons Done" value={summaryStats.lessonCompletes} color="emerald" />
        <MiniStat icon={Star} label="Quiz Starts" value={summaryStats.quizStarts} color="amber" />
      </div>

      {/* Activity timeline */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-slate-900 flex items-center gap-2 text-sm sm:text-base">
              <Activity className="w-5 h-5 text-rose-500" />
              Full Activity Timeline
              <span className="text-sm font-normal text-slate-400">({filteredTimeline.length} events)</span>
            </h3>
          </div>
          {/* Activity type filter chips */}
          {detailActivityTypes.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button onClick={() => setDetailFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                  detailFilter === 'all' ? 'bg-rose-600 text-white shadow-sm' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}>
                All ({timeline.length})
              </button>
              {detailActivityTypes.map(t => {
                const meta = getActionMeta(t);
                const count = timeline.filter(e => e.action === t).length;
                return (
                  <button key={t} onClick={() => setDetailFilter(t)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-all ${
                      detailFilter === t ? `${meta.bg} ${meta.color} ring-1 ring-current` : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}>
                    {meta.label} ({count})
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {loadingTimeline ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 text-rose-500 animate-spin" />
          </div>
        ) : filteredTimeline.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Activity className="w-7 h-7 text-slate-400" />
            </div>
            <h3 className="text-base font-semibold text-slate-700">No activity recorded yet</h3>
            <p className="text-slate-500 mt-1 text-sm">This student hasn't performed any tracked actions.</p>
          </div>
        ) : (
          <div className="relative max-h-[600px] overflow-y-auto">
            <div className="absolute left-5 top-0 bottom-0 w-px bg-slate-200" />
            <div className="space-y-0">
              {filteredTimeline.map((a) => {
                const meta = getActionMeta(a.action);
                const Icon = meta.icon;
                const sourceBadge: Record<string, { label: string; color: string }> = {
                  activity_log: { label: 'live', color: 'bg-rose-100 text-rose-600' },
                  quiz_attempt: { label: 'DB', color: 'bg-amber-100 text-amber-600' },
                  enrollment: { label: 'DB', color: 'bg-indigo-100 text-indigo-600' },
                  completion: { label: 'DB', color: 'bg-emerald-100 text-emerald-600' },
                  xp: { label: 'DB', color: 'bg-orange-100 text-orange-600' },
                  study_session: { label: 'DB', color: 'bg-violet-100 text-violet-600' },
                };
                const sb = sourceBadge[a.source] || { label: '', color: '' };
                return (
                  <div key={a.id} className="relative flex items-start gap-3 sm:gap-4 px-4 sm:px-5 py-3 hover:bg-slate-50 transition-colors">
                    <div className={`relative z-10 w-8 h-8 rounded-full ${meta.bg} ${meta.color} flex items-center justify-center flex-shrink-0 ring-4 ring-white`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-slate-800 leading-snug">{a.description || meta.label}</p>
                          <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                            <span className={`text-[10px] font-bold uppercase tracking-wide ${meta.color}`}>{meta.label}</span>
                            <span className={`text-[9px] font-bold px-1 py-0.5 rounded ${sb.color}`}>{sb.label}</span>
                            {a.page && (
                              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded font-mono">{a.page}</span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] sm:text-xs text-slate-400 flex-shrink-0">{formatTime(a.created_at)}</span>
                      </div>
                      {a.metadata && Object.keys(a.metadata).length > 0 && (
                        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                          {Object.entries(a.metadata).filter(([k]) => k !== 'student_name').slice(0, 5).map(([k, v]) => (
                            <span key={k} className="text-[10px] text-slate-500 bg-slate-50 border border-slate-100 px-1.5 py-0.5 rounded">
                              {k}: {String(v).slice(0, 30)}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600', blue: 'bg-blue-50 text-blue-600',
    amber: 'bg-amber-50 text-amber-600', rose: 'bg-rose-50 text-rose-600',
    violet: 'bg-violet-50 text-violet-600', yellow: 'bg-yellow-50 text-yellow-600',
    indigo: 'bg-indigo-50 text-indigo-600', slate: 'bg-slate-100 text-slate-600',
    orange: 'bg-orange-50 text-orange-600',
  };
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-2.5 sm:p-3 text-center hover:shadow-md transition-shadow">
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg ${colorMap[color]} flex items-center justify-center mx-auto mb-1.5 sm:mb-2`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-lg sm:text-xl font-bold text-slate-900">{value}</p>
      <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium uppercase tracking-wide">{label}</p>
    </div>
  );
}

function exportStudentCSV(student: StudentWithPresence) {
  const headers = ['Student', 'Email', 'Status', 'Engagement', 'Quizzes', 'Courses', 'XP', 'Events', 'Last Seen'];
  const rows = [[
    student.full_name, student.email || '',
    student.presence?.is_online ? 'Online' : 'Offline',
    String(student.engagement_score),
    String(student.quiz_count), String(student.course_count), String(student.xp_total),
    String(student.event_count),
    student.presence?.last_seen_at ? formatTime(student.presence.last_seen_at) : 'Never',
  ]];
  const csv = [headers, ...rows].map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${student.full_name.replace(/\s+/g, '_')}-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
