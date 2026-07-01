import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, BookOpen, Edit3, Trash2, Eye, EyeOff,
  Users, Clock, CheckCircle, BarChart2,
  GraduationCap, FileText, ChevronRight, ExternalLink, Layers,
  MessageSquare,
} from 'lucide-react';
import SidebarLayout, { NavItem } from '../components/SidebarLayout';
import { useAuth } from '../lib/AuthContext';
import { supabase, Level, Lesson } from '../lib/supabase';
import ForumPage from './ForumPage';

type TeacherPage = 'overview' | 'lessons' | 'students' | 'analytics' | 'forum';

const navItems: NavItem[] = [
  { key: 'overview',  label: 'Overview',   icon: LayoutDashboard },
  { key: 'lessons',   label: 'My Lessons', icon: BookOpen },
  { key: 'students',  label: 'Students',   icon: Users },
  { key: 'analytics', label: 'Analytics',  icon: BarChart2 },
  { key: 'forum',     label: 'Community Chat', icon: MessageSquare },
];

interface StudentRow {
  id: string;
  full_name: string;
  created_at: string;
  completions: number;
  enrollments: number;
}

export default function TeacherDashboard() {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const [page, setPage] = useState<TeacherPage>('overview');
  const [levels, setLevels] = useState<Level[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [lvlRes, lessRes, stuRes, enrRes, progRes] = await Promise.all([
        supabase.from('levels').select('*').order('sort_order'),
        supabase.from('lessons').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false }),
        supabase.from('profiles').select('*').eq('role', 'student').order('created_at', { ascending: false }),
        supabase.from('enrollments').select('*'),
        supabase.from('lesson_progress').select('*').eq('completed', true),
      ]);
      setLevels(lvlRes.data ?? []);
      setLessons(lessRes.data ?? []);

      const rawStudents = stuRes.data ?? [];
      const enrs = enrRes.data ?? [];
      const progs = progRes.data ?? [];
      const rows: StudentRow[] = rawStudents.map(s => ({
        id: s.id,
        full_name: s.full_name,
        created_at: s.created_at,
        enrollments: enrs.filter(e => e.student_id === s.id).length,
        completions: progs.filter(p => p.student_id === s.id).length,
      }));
      setStudents(rows);
      setLoading(false);
    })();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('lessons-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons', filter: `teacher_id=eq.${user.id}` },
        () => {
          supabase.from('lessons').select('*').eq('teacher_id', user.id).order('created_at', { ascending: false })
            .then(({ data }) => { if (data) setLessons(data); });
        })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const togglePublish = async (lesson: Lesson) => {
    await supabase.from('lessons').update({ is_published: !lesson.is_published }).eq('id', lesson.id);
    setLessons(prev => prev.map(l => l.id === lesson.id ? { ...l, is_published: !l.is_published } : l));
  };

  const deleteLesson = async (id: string) => {
    if (!confirm('Delete this lesson permanently?')) return;
    const { error } = await supabase.from('lessons').delete().eq('id', id);
    if (!error) setLessons(prev => prev.filter(l => l.id !== id));
  };

  const publishedCount = lessons.filter(l => l.is_published).length;

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <SidebarLayout
      items={navItems}
      active={page}
      onNavigate={k => setPage(k as TeacherPage)}
      accentGradient="from-violet-500 to-purple-600"
      accentText="text-violet-500"
    >
      <div className="p-6 max-w-5xl mx-auto">

        {/* ── OVERVIEW ── */}
        {page === 'overview' && (
          <div className="animate-fadeInUp space-y-6">
            <div>
              <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">
                Teacher Dashboard
              </h1>
              <p className="text-slate-500 text-sm mt-1">Hello, {profile?.full_name} — here's your teaching summary.</p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { icon: BookOpen,     label: 'Total Lessons',   value: lessons.length,                color: 'from-violet-400 to-purple-600' },
                { icon: CheckCircle,  label: 'Published',        value: publishedCount,                color: 'from-emerald-400 to-teal-500' },
                { icon: FileText,     label: 'Drafts',           value: lessons.length - publishedCount, color: 'from-amber-400 to-orange-500' },
                { icon: GraduationCap,label: 'Students',         value: students.length,               color: 'from-blue-400 to-blue-600' },
              ].map((s, i) => (
                <div key={s.label} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm animate-fadeInUp" style={{ animationDelay: `${i * 0.07}s` }}>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3`}>
                    <s.icon size={18} className="text-white" />
                  </div>
                  <div className="text-xl font-bold text-slate-900">{s.value}</div>
                  <div className="text-xs text-slate-500">{s.label}</div>
                </div>
              ))}
            </div>

            {/* Create first lesson CTA */}
            {lessons.length === 0 ? (
              <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl p-8 text-white">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center flex-shrink-0">
                    <Layers size={28} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">Create Your First Lesson</h3>
                    <p className="text-white/80 text-sm mb-4">Build rich lessons with text, images, videos, and interactive questions.</p>
                    <button
                      onClick={() => navigate('/teacher/lesson/new')}
                      className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-violet-600 text-sm font-semibold rounded-xl hover:bg-white/90 transition-all hover:-translate-y-0.5"
                    >
                      Open Lesson Builder <ExternalLink size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Recent lessons */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                    <h2 className="font-semibold text-slate-900">Recent Lessons</h2>
                    <button onClick={() => setPage('lessons')} className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">
                      View all <ChevronRight size={14} />
                    </button>
                  </div>
                  <div className="divide-y divide-slate-50">
                    {lessons.slice(0, 5).map(lesson => {
                      const level = levels.find(l => l.id === lesson.level_id);
                      const blockCount = lesson.content?.length || 0;
                      return (
                        <button
                          key={lesson.id}
                          onClick={() => navigate(`/teacher/lesson/${lesson.id}`)}
                          className="w-full px-5 py-3.5 flex items-center gap-3 hover:bg-slate-50 transition-colors text-left"
                        >
                          <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center ${lesson.is_published ? 'bg-emerald-100' : 'bg-amber-100'}`}>
                            {lesson.is_published ? <Eye size={14} className="text-emerald-600" /> : <EyeOff size={14} className="text-amber-600" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm truncate">{lesson.title}</p>
                            <p className="text-xs text-slate-400">{level?.label} - {blockCount} blocks - {lesson.duration_minutes}m</p>
                          </div>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${lesson.is_published ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                            {lesson.is_published ? 'Live' : 'Draft'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Top students preview */}
            {students.length > 0 && (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">Top Students</h2>
                  <button onClick={() => setPage('students')} className="text-sm text-violet-600 hover:text-violet-700 font-medium flex items-center gap-1">View all <ChevronRight size={14} /></button>
                </div>
                <div className="divide-y divide-slate-50">
                  {[...students].sort((a, b) => b.completions - a.completions).slice(0, 4).map((s, i) => (
                    <div key={s.id} className="px-5 py-3 flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-sm text-white ${['bg-yellow-400', 'bg-slate-400', 'bg-amber-700', 'bg-slate-300'][i] ?? 'bg-slate-200'}`}>
                        {i + 1}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {s.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{s.full_name}</p>
                        <p className="text-xs text-slate-400">{s.completions} lessons done</p>
                      </div>
                      <div className="text-xs font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full">{s.completions} pts</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── LESSONS ── */}
        {page === 'lessons' && (
          <div className="animate-fadeInUp space-y-5">
            <div className="flex items-center justify-between">
              <h1 className="font-display text-2xl font-bold text-slate-900">My Lessons</h1>
              <button
                onClick={() => navigate('/teacher/lesson/new')}
                className="flex items-center gap-2 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-violet-200 transition-all hover:-translate-y-0.5"
              >
                <BookOpen size={16} /> Build New Lesson
              </button>
            </div>

            {lessons.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-violet-100 to-purple-100 mx-auto mb-4 flex items-center justify-center">
                  <Layers size={36} className="text-violet-500" />
                </div>
                <p className="text-slate-900 font-semibold mb-1">No lessons yet</p>
                <p className="text-slate-500 text-sm mb-4">Use the lesson builder to create rich content with text, images, videos, and questions.</p>
                <button
                  onClick={() => navigate('/teacher/lesson/new')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700"
                >
                  Open Lesson Builder <ExternalLink size={16} />
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {lessons.map((lesson, i) => {
                  const level = levels.find(l => l.id === lesson.level_id);
                  const blockCount = lesson.content?.length || 0;
                  return (
                    <div key={lesson.id} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex items-center gap-4 hover:border-violet-100 transition-all animate-fadeInUp" style={{ animationDelay: `${i * 0.04}s` }}>
                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${lesson.is_published ? 'bg-emerald-100' : 'bg-amber-50'}`}>
                        {lesson.is_published ? <Eye size={18} className="text-emerald-600" /> : <EyeOff size={18} className="text-amber-500" />}
                      </div>
                      <button onClick={() => navigate(`/teacher/lesson/${lesson.id}`)} className="flex-1 min-w-0 text-left">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="font-semibold text-slate-900 text-sm truncate">{lesson.title}</h3>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${lesson.is_published ? 'text-emerald-700 bg-emerald-50' : 'text-amber-700 bg-amber-50'}`}>
                            {lesson.is_published ? 'Published' : 'Draft'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-400">
                          {level && <span className="text-violet-600 font-medium">{level.label}</span>}
                          {blockCount > 0 && <span className="flex items-center gap-1"><Layers size={11} /> {blockCount} blocks</span>}
                          <span className="flex items-center gap-1"><Clock size={11} /> {lesson.duration_minutes}m</span>
                        </div>
                      </button>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button onClick={() => togglePublish(lesson)} className={`p-2 rounded-lg transition-colors ${lesson.is_published ? 'text-amber-500 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`} title={lesson.is_published ? 'Unpublish' : 'Publish'}>
                          {lesson.is_published ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                        <button onClick={() => navigate(`/teacher/lesson/${lesson.id}`)} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors" title="Edit in Builder">
                          <Edit3 size={15} />
                        </button>
                        <button onClick={() => deleteLesson(lesson.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── STUDENTS ── */}
        {page === 'students' && (
          <div className="animate-fadeInUp space-y-5">
            <h1 className="font-display text-2xl font-bold text-slate-900">Students</h1>
            {students.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
                <Users size={40} className="text-slate-200 mx-auto mb-3" />
                <p className="text-slate-500">No students registered yet</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                  <h2 className="font-semibold text-slate-900">All Students ({students.length})</h2>
                </div>
                <div className="divide-y divide-slate-50">
                  {[...students].sort((a, b) => b.completions - a.completions).map((s) => (
                    <div key={s.id} className="px-5 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold flex-shrink-0">
                        {s.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">{s.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Joined {new Date(s.created_at).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-slate-500 flex-shrink-0">
                        <div className="text-center">
                          <div className="font-bold text-slate-900">{s.enrollments}</div>
                          <div>enrolled</div>
                        </div>
                        <div className="text-center">
                          <div className="font-bold text-violet-600">{s.completions}</div>
                          <div>completed</div>
                        </div>
                        <div className={`h-6 w-16 rounded-full overflow-hidden bg-slate-100`}>
                          <div className="h-full bg-gradient-to-r from-violet-400 to-purple-500 rounded-full" style={{ width: `${Math.min(s.completions * 10, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── ANALYTICS ── */}
        {page === 'analytics' && (
          <div className="animate-fadeInUp space-y-6">
            <h1 className="font-display text-2xl font-bold text-slate-900">Analytics</h1>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: 'Total Lessons',    value: lessons.length,                    gradient: 'from-violet-500 to-purple-600' },
                { label: 'Published',         value: publishedCount,                    gradient: 'from-emerald-400 to-teal-500' },
                { label: 'Publish Rate',      value: lessons.length ? `${Math.round((publishedCount / lessons.length) * 100)}%` : '0%', gradient: 'from-blue-400 to-blue-600' },
                { label: 'Total Students',    value: students.length,                   gradient: 'from-amber-400 to-orange-500' },
                { label: 'Total Completions', value: students.reduce((a, s) => a + s.completions, 0), gradient: 'from-rose-400 to-red-500' },
                { label: 'Avg per Student',   value: students.length ? (students.reduce((a, s) => a + s.completions, 0) / students.length).toFixed(1) : '0', gradient: 'from-cyan-400 to-blue-500' },
              ].map(s => (
                <div key={s.label} className={`rounded-2xl p-5 bg-gradient-to-br ${s.gradient} text-white shadow-md`}>
                  <div className="text-2xl font-black mb-1">{s.value}</div>
                  <div className="text-white/80 text-xs">{s.label}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="font-semibold text-slate-900">Lessons by Level</h2>
              </div>
              <div className="p-5 space-y-4">
                {levels.map(level => {
                  const count = lessons.filter(l => l.level_id === level.id).length;
                  const pubCount = lessons.filter(l => l.level_id === level.id && l.is_published).length;
                  const pct = lessons.length ? Math.round((count / lessons.length) * 100) : 0;
                  return (
                    <div key={level.id}>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="font-medium text-slate-700">{level.label}</span>
                        <span className="text-slate-400">{pubCount} published / {count} total</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-violet-400 to-purple-600 rounded-full transition-all duration-700" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── COMMUNITY CHAT ─────────────────────────────────────────────── */}
        {page === 'forum' && (
          <ForumPage onBack={() => setPage('overview')} />
        )}

      </div>
    </SidebarLayout>
  );
}
