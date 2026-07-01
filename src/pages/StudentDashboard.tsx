import { useEffect, useState } from 'react';
import {
  LayoutDashboard, BookOpen, CheckCircle, Star, Clock, Lock, Play,
  TrendingUp, ArrowRight, Award, RotateCcw, ChevronRight, ChevronLeft,
  Flame, GraduationCap, BarChart2, ArrowLeft, Users, Trophy,
  Volume2, Globe, MessageSquare, PenTool, Headphones, Layers, Video, ChevronDown,
  Store, Sparkles, Swords, User, Share2, Camera, Settings, Download,
  PlayCircle, Bot, Phone, Bell, Image as ImageIcon, HelpCircle,
} from 'lucide-react';
import SidebarLayout, { NavItem } from '../components/SidebarLayout';
import { useAuth } from '../lib/AuthContext';
import { supabase, Level, Lesson, LessonProgress, Enrollment, ContentBlock } from '../lib/supabase';
import { logActivity } from '../lib/usePresence';
import CourseMarketPage from './CourseMarketPage';
import { XPLevelBar, StreakDisplay, QuickStatsGrid, Leaderboard, AchievementsGallery, LevelUpModal, AchievementToast, XPGainPopup } from '../components/Gamification';
import { useGamification } from '../lib/useGamification';
import { QuizContainer, QuizListCard } from '../components/InteractiveQuiz';
import { StudentProgressPage, StudentCourseProgress } from '../components/StudentCourseProgress';
import { LeaderboardPage } from '../components/LeaderboardPage';
import { StudentArenaPage } from './StudentArenaPage';
import { Quiz, QuizQuestion, QuizOption, QuizAttempt, CourseCompletion } from '../lib/supabase';
import { CourseCertificate, CertificatePreviewCard } from '../components/CourseCertificate';
import { AiTutorPage } from '../components/AiTutor';
import ForumPage from './ForumPage';
import CourseForum from '../components/CourseForum';

type StudentPage = 'overview' | 'market' | 'my-courses' | 'progress' | 'leaderboard' | 'arena' | 'profile' | 'certificates' | 'forum';

const LEVEL_META: Record<string, {
  gradient: string;
  lightGradient: string;
  textColor: string;
  bgColor: string;
  borderColor: string;
  shadowColor: string;
  badgeClass: string;
  coverImage: string;
  emoji: string;
  accentHex: string;
}> = {
  elementary: {
    gradient: 'from-emerald-500 to-teal-600',
    lightGradient: 'from-emerald-50 to-teal-50',
    textColor: 'text-emerald-700',
    bgColor: 'bg-emerald-50',
    borderColor: 'border-emerald-200',
    shadowColor: 'shadow-emerald-100',
    badgeClass: 'bg-emerald-100 text-emerald-700',
    coverImage: 'https://images.pexels.com/photos/256395/pexels-photo-256395.jpeg?auto=compress&cs=tinysrgb&w=800&h=450&fit=crop',
    emoji: '🌱',
    accentHex: '#10b981',
  },
  'pre-intermediate': {
    gradient: 'from-sky-500 to-blue-600',
    lightGradient: 'from-sky-50 to-blue-50',
    textColor: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    shadowColor: 'shadow-blue-100',
    badgeClass: 'bg-blue-100 text-blue-700',
    coverImage: 'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=800&h=450&fit=crop',
    emoji: '📖',
    accentHex: '#0ea5e9',
  },
  intermediate: {
    gradient: 'from-violet-500 to-purple-700',
    lightGradient: 'from-violet-50 to-purple-50',
    textColor: 'text-violet-700',
    bgColor: 'bg-violet-50',
    borderColor: 'border-violet-200',
    shadowColor: 'shadow-violet-100',
    badgeClass: 'bg-violet-100 text-violet-700',
    coverImage: 'https://images.pexels.com/photos/301926/pexels-photo-301926.jpeg?auto=compress&cs=tinysrgb&w=800&h=450&fit=crop',
    emoji: '⚡',
    accentHex: '#8b5cf6',
  },
  'upper-intermediate': {
    gradient: 'from-amber-500 to-orange-600',
    lightGradient: 'from-amber-50 to-orange-50',
    textColor: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    shadowColor: 'shadow-amber-100',
    badgeClass: 'bg-amber-100 text-amber-700',
    coverImage: 'https://images.pexels.com/photos/267669/pexels-photo-267669.jpeg?auto=compress&cs=tinysrgb&w=800&h=450&fit=crop',
    emoji: '🚀',
    accentHex: '#f59e0b',
  },
  advanced: {
    gradient: 'from-rose-500 to-red-700',
    lightGradient: 'from-rose-50 to-red-50',
    textColor: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    shadowColor: 'shadow-rose-100',
    badgeClass: 'bg-rose-100 text-rose-700',
    coverImage: 'https://images.pexels.com/photos/1438072/pexels-photo-1438072.jpeg?auto=compress&cs=tinysrgb&w=800&h=450&fit=crop',
    emoji: '🏆',
    accentHex: '#f43f5e',
  },
};

const LEVEL_SKILLS: Record<string, { icon: React.ElementType; label: string }[]> = {
  elementary:          [{ icon: MessageSquare, label: 'Basic Concepts' }, { icon: BookOpen, label: 'Foundations' }, { icon: Volume2, label: 'Communication Basics' }, { icon: PenTool, label: 'Simple Practice' }],
  'pre-intermediate':  [{ icon: Globe, label: 'Everyday Topics' }, { icon: Headphones, label: 'Listening Skills' }, { icon: MessageSquare, label: 'Short Discussions' }, { icon: PenTool, label: 'Writing Skills' }],
  intermediate:        [{ icon: MessageSquare, label: 'Fluent Discussion' }, { icon: BookOpen, label: 'Complex Topics' }, { icon: PenTool, label: 'Essays & Projects' }, { icon: Globe, label: 'Research & Analysis' }],
  'upper-intermediate':[{ icon: Trophy, label: 'Academic Skills' }, { icon: MessageSquare, label: 'Debates & Arguments' }, { icon: PenTool, label: 'Professional Writing' }, { icon: Globe, label: 'Critical Thinking' }],
  advanced:            [{ icon: Trophy, label: 'Expert Level' }, { icon: MessageSquare, label: 'Advanced Analysis' }, { icon: PenTool, label: 'Research Writing' }, { icon: Globe, label: 'Professional Skills' }],
};

const LEVEL_DESCRIPTION: Record<string, string> = {
  elementary:          'Perfect for beginners. Build a solid foundation in your chosen subject area.',
  'pre-intermediate':  'Expand your knowledge and tackle everyday topics with confidence.',
  intermediate:        'Develop deeper understanding with complex topics and practical applications.',
  'upper-intermediate':'Master academic and professional skills, engage in debates, and handle complex challenges.',
  advanced:            'Achieve expert-level mastery with advanced analysis, professional skills, and critical thinking.',
};

const navItems: NavItem[] = [
  { key: 'overview',    label: 'Overview',    icon: LayoutDashboard },
  { key: 'my-courses',  label: 'My Courses',  icon: GraduationCap },
  { key: 'market',      label: 'Course Market', icon: Store },
  { key: 'progress',    label: 'Progress',    icon: TrendingUp },
  { key: 'certificates',label: 'Certificates',icon: Award },
  { key: 'leaderboard', label: 'Leaderboard', icon: Trophy },
  { key: 'arena',       label: 'Live Arena',  icon: Swords },
  { key: 'forum',       label: 'Community Chat', icon: MessageSquare },
  { key: 'profile',     label: 'Profile',     icon: User },
];

const VOCAB = [
  { word: 'Ambitious',   phonetic: '/æmˈbɪʃəs/',    meaning: 'Having a strong desire to succeed',  example: 'She is an ambitious student.',         level: 'Intermediate' },
  { word: 'Persevere',   phonetic: '/ˌpɜːsɪˈvɪər/', meaning: 'To continue despite difficulty',      example: 'You must persevere to achieve goals.', level: 'Upper-Int.' },
  { word: 'Eloquent',    phonetic: '/ˈelɪkwənt/',    meaning: 'Fluent and persuasive in speaking',   example: 'The speaker was very eloquent.',        level: 'Advanced' },
  { word: 'Diligent',    phonetic: '/ˈdɪlɪdʒənt/',   meaning: 'Hardworking and careful',             example: 'He is a diligent learner.',             level: 'Intermediate' },
  { word: 'Acknowledge', phonetic: '/əkˈnɒlɪdʒ/',    meaning: 'To accept or admit the truth',        example: 'She acknowledged her mistake.',         level: 'Pre-Int.' },
  { word: 'Greet',       phonetic: '/ɡriːt/',         meaning: 'To say hello to someone',             example: 'He greeted his teacher warmly.',        level: 'Elementary' },
];

const QUIZ = [
  { q: 'Choose the correct sentence:', options: ['She go to school every day.', 'She goes to school every day.', 'She going to school every day.', 'She gone to school every day.'], answer: 1, explanation: 'Third person singular uses "goes" in simple present tense.' },
  { q: 'What is the past tense of "write"?', options: ['Writed', 'Wrote', 'Written', 'Writ'], answer: 1, explanation: '"Write" is irregular — the past tense is "wrote".' },
  { q: 'Which word means "very happy"?', options: ['Sad', 'Angry', 'Elated', 'Tired'], answer: 2, explanation: '"Elated" means extremely happy or pleased.' },
  { q: 'Fill in: She __ studying for two hours.', options: ['is', 'was', 'has been', 'have been'], answer: 2, explanation: '"Has been studying" is present perfect continuous.' },
  { q: 'Which is a correct question form?', options: ['Where you live?', 'Where do you live?', 'Where you do live?', 'Do where you live?'], answer: 1, explanation: 'Use "do/does" to form present simple questions.' },
];

// ── Mobile Bottom Navigation ────────────────────────────────────────────────────
interface MobileBottomNavProps {
  items: NavItem[];
  active: string;
  onNavigate: (key: string) => void;
}

function MobileBottomNav({ items, active, onNavigate }: MobileBottomNavProps) {
  const bottomItems = items.filter(i => ['overview', 'my-courses', 'market', 'arena', 'profile'].includes(i.key));

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 pb-safe">
      <div className="flex items-center justify-around h-16 px-2">
        {bottomItems.map(item => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => onNavigate(item.key)}
              className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px] ${
                isActive ? 'text-blue-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <div className={`relative ${isActive ? 'scale-110' : ''} transition-transform`}>
                <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge > 9 ? '9+' : item.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${isActive ? 'font-bold' : ''}`}>
                {item.key === 'my-courses' ? 'Courses' : item.key === 'arena' ? 'Arena' : item.label}
              </span>
              {isActive && (
                <div className="absolute bottom-0 w-8 h-0.5 bg-blue-600 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

// ── Student Certificates Page ────────────────────────────────────────────────────────
interface CertificateRecord {
  completion: CourseCompletion;
  courseTitle: string;
}

type ViewCertificatePayload = { completion: CourseCompletion; courseTitle: string };

function StudentCertificatesPage({ onViewCertificate }: { onViewCertificate: (data: ViewCertificatePayload) => void }) {
  const { user, profile } = useAuth();
  const [records, setRecords] = useState<CertificateRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('course_completions')
        .select('*, courses:course_id(title)')
        .eq('student_id', user.id)
        .order('completed_at', { ascending: false });

      if (data) {
        setRecords(data.map((row: any) => ({
          completion: {
            id: row.id,
            student_id: row.student_id,
            course_id: row.course_id,
            completed_at: row.completed_at,
            certificate_id: row.certificate_id,
            xp_awarded: row.xp_awarded,
          },
          courseTitle: row.courses?.title ?? 'Unknown Course',
        })));
      }
      setLoading(false);
    })();
  }, [user]);

  const studentName = profile?.full_name ?? user?.user_metadata?.full_name ?? 'Student';

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Award className="w-7 h-7 text-amber-500" />
          My Certificates
        </h1>
        <p className="text-slate-500 mt-1">Download and share your course completion certificates</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {!loading && records.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-slate-100 flex items-center justify-center mb-4">
            <Award className="w-10 h-10 text-slate-300" />
          </div>
          <h3 className="text-lg font-semibold text-slate-700">No certificates yet</h3>
          <p className="text-slate-500 mt-1 text-sm">Complete a course to earn your first certificate!</p>
        </div>
      )}

      {!loading && records.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {records.map(({ completion, courseTitle }) => (
            <CertificatePreviewCard
              key={completion.id}
              studentName={studentName}
              courseTitle={courseTitle}
              completedAt={completion.completed_at}
              certificateId={completion.certificate_id}
              onView={() => onViewCertificate({ completion, courseTitle })}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Student Profile Page ────────────────────────────────────────────────────────
interface StudentProfilePageProps {
  profile: any;
  stats: {
    total_xp: number;
    current_level: number;
    streak_days: number;
    total_lessons_completed: number;
    total_quizzes_completed: number;
    total_time_spent_minutes: number;
  } | null;
  achievements: { id: string; name: string; description: string; icon: string; xp_reward: number }[];
  userAchievements: { achievement_id: string; earned_at: string }[];
  completedLessons: number;
  totalLessons: number;
  enrolledCourses: number;
}

// ── Phone & SMS Settings Card ─────────────────────────────────────────────
function PhoneSettingsCard() {
  const { user } = useAuth();
  const [phone, setPhone] = useState('');
  const [smsEnabled, setSmsEnabled] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from('profiles')
      .select('phone_number, sms_notifications_enabled')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPhone(data.phone_number ?? '');
          setSmsEnabled(data.sms_notifications_enabled ?? true);
        }
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    await supabase
      .from('profiles')
      .update({ phone_number: phone.trim() || null, sms_notifications_enabled: smsEnabled })
      .eq('id', user.id);
    setSaving(false);
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
            <Phone size={16} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">SMS Notifications</p>
            <p className="text-xs text-slate-500">Receive alerts via text message</p>
          </div>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs font-semibold text-blue-600 hover:text-blue-700 px-3 py-1.5 rounded-lg hover:bg-blue-50 transition-colors"
          >
            Edit
          </button>
        )}
      </div>
      <div className="px-5 py-4 space-y-4">
        {/* Phone number */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 mb-1.5">Mobile Number</label>
          {editing ? (
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="+252 61 234 5678"
              className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition"
            />
          ) : (
            <p className="text-sm text-slate-700 py-2.5 px-3 rounded-xl bg-slate-50">
              {phone || <span className="text-slate-400 italic">Not set</span>}
            </p>
          )}
          <p className="text-xs text-slate-400 mt-1">Format: +252611234567 (Somalia) or international E.164</p>
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-between py-2">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-slate-500" />
            <div>
              <p className="text-sm font-medium text-slate-700">SMS Alerts Enabled</p>
              <p className="text-xs text-slate-400">New courses, quizzes, streak warnings</p>
            </div>
          </div>
          <button
            onClick={() => { if (editing) setSmsEnabled(v => !v); }}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              smsEnabled ? 'bg-green-500' : 'bg-slate-300'
            } ${!editing ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                smsEnabled ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Save / Cancel */}
        {editing && (
          <div className="flex gap-2 pt-1">
            <button
              onClick={save}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-bold transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="flex-1 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
        {saved && (
          <p className="text-xs text-green-600 font-semibold flex items-center gap-1">
            <CheckCircle size={13} /> Saved successfully
          </p>
        )}
      </div>
    </div>
  );
}

function StudentProfilePage({
  profile, stats, achievements, userAchievements, completedLessons, totalLessons, enrolledCourses,
}: StudentProfilePageProps) {
  const [copied, setCopied] = useState(false);

  const level = stats?.current_level ?? 1;
  const xp = stats?.total_xp ?? 0;
  const streak = stats?.streak_days ?? 0;

  const progressPct = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

  const shareUrl = `https://ilesyacademy.app/u/${profile?.id?.slice(0, 8) ?? 'user'}`;
  const shareText = `I'm on Level ${level} with ${xp.toLocaleString()} XP and a ${streak}-day streak on Ilesy Academy! 🚀`;

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: 'My Ilesy Academy Progress', text: shareText, url: shareUrl });
    } else {
      navigator.clipboard.writeText(shareText + '\n' + shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6 animate-fadeInUp pb-24 lg:pb-0">
      {/* Profile Header Card */}
      <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 rounded-3xl p-6 sm:p-8 text-white shadow-xl shadow-blue-200/50">
        <div className="absolute inset-0 dot-grid opacity-15 pointer-events-none" />
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -bottom-8 left-1/3 w-40 h-40 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row items-center gap-6">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-white/20 border-4 border-white/30 flex items-center justify-center text-4xl font-black text-white shadow-xl">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="absolute -bottom-1 -right-1 w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center text-white font-black text-sm shadow-lg border-2 border-white">
              {level}
            </div>
          </div>

          {/* Info */}
          <div className="text-center sm:text-left flex-1 min-w-0">
            <h1 className="text-2xl sm:text-3xl font-bold">{profile?.full_name ?? 'Learner'}</h1>
            <p className="text-blue-100/80 text-sm mt-1">{profile?.email ?? ''}</p>
            <div className="flex flex-wrap justify-center sm:justify-start gap-3 mt-4">
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                <p className="text-blue-100/70 text-[10px] font-medium">Level</p>
                <p className="text-white font-bold text-lg">{level}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                <p className="text-blue-100/70 text-[10px] font-medium">Total XP</p>
                <p className="text-white font-bold text-lg">{xp.toLocaleString()}</p>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-2">
                <p className="text-blue-100/70 text-[10px] font-medium">Streak</p>
                <p className="text-white font-bold text-lg">{streak}d 🔥</p>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2.5 bg-white/20 hover:bg-white/30 border border-white/30 rounded-xl text-sm font-semibold transition-all"
            >
              {copied ? <CheckCircle size={16} /> : <Share2 size={16} />}
              {copied ? 'Copied!' : 'Share'}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="relative mt-6 pt-6 border-t border-white/20">
          <div className="flex justify-between items-center mb-2">
            <span className="text-blue-100/70 text-xs font-medium">Overall Progress</span>
            <span className="text-white font-bold text-sm">{progressPct}%</span>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-white/80 to-cyan-200 rounded-full transition-all duration-1000"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <p className="text-blue-100/50 text-[10px] mt-1.5">{completedLessons} of {totalLessons} lessons completed</p>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: BookOpen,    label: 'Courses Enrolled', value: enrolledCourses,       color: 'from-emerald-400 to-teal-500',   bg: 'bg-emerald-50',  border: 'border-emerald-100' },
          { icon: CheckCircle, label: 'Lessons Done',    value: completedLessons,      color: 'from-blue-400 to-blue-600',     bg: 'bg-blue-50',    border: 'border-blue-100' },
          { icon: Award,       label: 'Quizzes Passed',  value: stats?.total_quizzes_completed ?? 0, color: 'from-violet-400 to-purple-600', bg: 'bg-violet-50',  border: 'border-violet-100' },
          { icon: Clock,       label: 'Time Spent',      value: `${Math.floor((stats?.total_time_spent_minutes ?? 0) / 60)}h`, color: 'from-orange-400 to-amber-500', bg: 'bg-orange-50', border: 'border-orange-100' },
        ].map((s, i) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border ${s.border} shadow-sm`}>
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-3 shadow-sm`}>
              <s.icon size={18} className="text-white" />
            </div>
            <p className="text-2xl font-black text-slate-800">{s.value}</p>
            <p className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Phone & SMS Settings */}
      <PhoneSettingsCard />

      {/* Achievements Section */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
              <h2 className="font-bold text-slate-900">Achievements</h2>
            </div>
            <span className="text-sm font-medium text-slate-400">
              {userAchievements.length} / {achievements.length}
            </span>
          </div>
        </div>

        {userAchievements.length === 0 ? (
          <div className="p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Award size={28} className="text-slate-300" />
            </div>
            <p className="text-slate-500 font-medium">No achievements yet</p>
            <p className="text-slate-400 text-sm mt-1">Complete lessons and quizzes to earn badges!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 p-5">
            {userAchievements.map(ua => {
              const ach = achievements.find(a => a.id === ua.achievement_id);
              if (!ach) return null;
              return (
                <div
                  key={ua.achievement_id}
                  className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-100 rounded-xl p-3 text-center"
                >
                  <div className="text-3xl mb-2">{ach.icon}</div>
                  <p className="text-sm font-bold text-slate-800">{ach.name}</p>
                  <p className="text-[10px] text-slate-500 mt-0.5">{ach.xp_reward} XP</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Share Card */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-6 text-white">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center flex-shrink-0">
            <Trophy size={28} className="text-white" />
          </div>
          <div className="text-center sm:text-left flex-1">
            <h3 className="font-bold text-lg">Share Your Progress!</h3>
            <p className="text-slate-400 text-sm mt-1">Let friends know about your learning journey</p>
          </div>
          <button
            onClick={handleShare}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-500 hover:bg-blue-400 rounded-xl font-semibold transition-all"
          >
            <Share2 size={16} />
            Share Profile
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Course Card ──────────────────────────────────────────────────────────────
function CourseCard({
  level, lessons, progress, enrollments, onOpen, onEnroll,
}: {
  level: Level;
  lessons: Lesson[];
  progress: LessonProgress[];
  enrollments: Enrollment[];
  onOpen: () => void;
  onEnroll: (e: React.MouseEvent) => void;
}) {
  const m        = LEVEL_META[level.key] ?? LEVEL_META['elementary'];
  const lls      = lessons.filter(l => l.level_id === level.id);
  const done     = lls.filter(l => progress.find(p => p.lesson_id === l.id && p.completed)).length;
  const pct      = lls.length ? Math.round((done / lls.length) * 100) : 0;
  const enrolled = enrollments.some(e => e.level_id === level.id);
  const totalMin = lls.reduce((a, l) => a + l.duration_minutes, 0);
  const isFinished = enrolled && lls.length > 0 && done === lls.length;

  return (
    <div
      onClick={onOpen}
      className="group relative bg-white rounded-3xl overflow-hidden border border-slate-100 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-transparent"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      {/* Cover image */}
      <div className="relative h-44 overflow-hidden">
        <img
          src={m.coverImage}
          alt={level.label}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        {/* Dark gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        {/* Colour tint */}
        <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-25`} />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="text-xs font-bold text-white/90 bg-black/30 backdrop-blur-sm px-2.5 py-1 rounded-full">
            Level {level.sort_order ?? '—'}
          </span>
          {isFinished ? (
            <span className="flex items-center gap-1 text-xs font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-full">
              <Trophy size={10} /> Completed
            </span>
          ) : enrolled ? (
            <span className="text-xs font-bold text-white bg-blue-500 px-2.5 py-1 rounded-full">In Progress</span>
          ) : null}
        </div>

        {/* Title block */}
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl drop-shadow-lg">{m.emoji}</span>
            <div>
              <h3 className="font-black text-white text-lg leading-tight drop-shadow-sm">{level.label}</h3>
              <p className="text-white/70 text-xs mt-0.5">{lls.length} lessons · {totalMin}m total</p>
            </div>
          </div>
        </div>
      </div>

      {/* Card body */}
      <div className="p-5">
        {/* Description */}
        <p className="text-slate-500 text-sm leading-relaxed line-clamp-2 mb-4 min-h-[2.5rem]">
          {LEVEL_DESCRIPTION[level.key] ?? level.description}
        </p>

        {/* Skill chips */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {(LEVEL_SKILLS[level.key] ?? []).slice(0, 3).map(s => (
            <span key={s.label} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${m.badgeClass}`}>
              <s.icon size={10} />
              {s.label}
            </span>
          ))}
        </div>

        {/* Progress or enroll */}
        {enrolled ? (
          <div className="space-y-2.5">
            <div className="flex justify-between items-center text-xs text-slate-500">
              <span>{done} of {lls.length} lessons done</span>
              <span className={`font-bold text-sm ${m.textColor}`}>{pct}%</span>
            </div>
            <div className="relative h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className={`absolute inset-y-0 left-0 bg-gradient-to-r ${m.gradient} rounded-full transition-all duration-700`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <button
              onClick={e => { e.stopPropagation(); onOpen(); }}
              className={`w-full mt-1 py-2.5 bg-gradient-to-r ${m.gradient} text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-opacity`}
            >
              {isFinished
                ? <><Trophy size={15} /> Review Course</>
                : <><Play size={13} className="fill-white" /> Continue Learning</>
              }
              <ArrowRight size={14} className="ml-auto" />
            </button>
          </div>
        ) : (
          <button
            onClick={onEnroll}
            className={`w-full py-2.5 bg-gradient-to-r ${m.gradient} text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all hover:shadow-lg group-hover:gap-3`}
            style={{ boxShadow: `0 4px 14px ${m.accentHex}40` }}
          >
            Enroll Free — Start Now
            <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Quiz Viewer ───────────────────────────────────────────────────────────────
function QuizViewer({ item, onComplete, onBack }: {
  item: any;
  onComplete: () => void;
  onBack: () => void;
}) {
  const { user } = useAuth();
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [options, setOptions] = useState<QuizOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!item.quiz_id) {
      setError('This quiz has not been configured yet. Please check back later.');
      setLoading(false);
      return;
    }
    (async () => {
      const [qz, qq, qo] = await Promise.all([
        supabase.from('quizzes').select('*').eq('id', item.quiz_id).single(),
        supabase.from('quiz_questions').select('*').eq('quiz_id', item.quiz_id).order('sort_order'),
        supabase.from('quiz_options').select('*').order('sort_order'),
      ]);
      if (qz.error || !qz.data) {
        setError('Could not load quiz.');
        setLoading(false);
        return;
      }
      const questionIds = (qq.data ?? []).map((q: any) => q.id);
      const filteredOptions = (qo.data ?? []).filter((o: any) => questionIds.includes(o.question_id));
      setQuiz(qz.data as Quiz);
      setQuestions((qq.data ?? []) as QuizQuestion[]);
      setOptions(filteredOptions as QuizOption[]);
      setLoading(false);
    })();
  }, [item.quiz_id]);

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="min-h-full bg-slate-50">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium">
              <ArrowLeft size={18} /> Back
            </button>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-6 text-center">
          <p className="text-slate-500">{error ?? 'Quiz not found.'}</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-full bg-slate-50">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
            <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium">
              <ArrowLeft size={18} /> Back
            </button>
            <h2 className="font-semibold text-slate-900 truncate">{quiz.title}</h2>
          </div>
        </div>
        <div className="max-w-2xl mx-auto p-6 text-center">
          <p className="text-slate-500">No questions have been added to this quiz yet.</p>
        </div>
      </div>
    );
  }

  return (
    <QuizContainer
      quiz={quiz}
      questions={questions}
      options={options}
      userId={user!.id}
      onComplete={(score, maxScore) => {
        const passed = Math.round((score / maxScore) * 100) >= quiz.passing_score;
        if (passed) onComplete();
      }}
      onBack={onBack}
    />
  );
}

// ── Assignment Viewer ─────────────────────────────────────────────────────────
function AssignmentViewer({ item, progress, onComplete, onBack }: {
  item: any;
  progress: any;
  onComplete: () => void;
  onBack: () => void;
}) {
  const [submission, setSubmission] = useState('');
  const [submitted, setSubmitted] = useState(!!progress?.completed);

  const handleSubmit = () => {
    if (!submission.trim()) return;
    setSubmitted(true);
    onComplete();
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-blue-50 to-indigo-50">
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <button onClick={onBack} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium">
            <ArrowLeft size={18} /> Back
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-slate-900 truncate">{item.title}</h2>
          </div>
          {submitted && (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              <CheckCircle size={12} /> Submitted
            </span>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 sm:p-6">
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 bg-gradient-to-r from-blue-500 to-indigo-600">
            <div className="flex items-center gap-3 mb-2">
              <PenTool size={24} className="text-white" />
              <h3 className="font-bold text-xl text-white">Assignment</h3>
            </div>
            <p className="text-blue-100 text-sm">Complete the assignment below and submit your work</p>
          </div>

          {/* Instructions */}
          <div className="p-6 border-b border-slate-100">
            <h4 className="font-semibold text-slate-900 mb-3">Instructions</h4>
            <div className="lesson-content text-sm">
              {item.content ? (
                <div dangerouslySetInnerHTML={{ __html: item.content }} />
              ) : (
                <p>Complete this assignment to demonstrate your understanding of the lesson material. Write your response below.</p>
              )}
            </div>
          </div>

          {/* Submission */}
          <div className="p-6">
            {submitted ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={28} className="text-emerald-600" />
                </div>
                <h4 className="font-bold text-lg text-slate-900 mb-2">Assignment Submitted!</h4>
                <p className="text-slate-500 mb-6">Your assignment has been submitted successfully.</p>
                <button
                  onClick={onBack}
                  className="px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg transition-all"
                >
                  Continue Learning
                </button>
              </div>
            ) : (
              <>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Your Response</label>
                <textarea
                  value={submission}
                  onChange={(e) => setSubmission(e.target.value)}
                  rows={8}
                  placeholder="Write your assignment response here..."
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
                <div className="mt-4 flex justify-end">
                  <button
                    onClick={handleSubmit}
                    disabled={!submission.trim()}
                    className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-semibold rounded-xl hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Submit Assignment <ArrowRight size={18} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Duolingo-Style Course Path ───────────────────────────────────────────────────────
function DuolingoPath({
  topics,
  itemProgress,
  isEnrolled,
  loading,
  onOpenItem,
  onClaimCertificate,
  claiming,
  hasCompletion,
}: {
  topics: any[];
  itemProgress: any[];
  isEnrolled: boolean;
  loading: boolean;
  onOpenItem: (item: any) => void;
  onClaimCertificate: () => void;
  claiming: boolean;
  hasCompletion: boolean;
}) {
  // Unit themes: exact Duolingo palette — bright solid colors on dark bg
  const unitThemes = [
    { banner: '#58CC02', bannerDark: '#46A302', node: '#58CC02', nodeDark: '#46A302', nodeShadow: 'rgba(88,204,2,0.5)'  },
    { banner: '#1CB0F6', bannerDark: '#0A90D4', node: '#1CB0F6', nodeDark: '#0A90D4', nodeShadow: 'rgba(28,176,246,0.5)' },
    { banner: '#FF9600', bannerDark: '#CC7800', node: '#FF9600', nodeDark: '#CC7800', nodeShadow: 'rgba(255,150,0,0.5)'  },
    { banner: '#FF4B4B', bannerDark: '#CC3B3B', node: '#FF4B4B', nodeDark: '#CC3B3B', nodeShadow: 'rgba(255,75,75,0.5)'  },
    { banner: '#CE82FF', bannerDark: '#A855F7', node: '#CE82FF', nodeDark: '#A855F7', nodeShadow: 'rgba(206,130,255,0.5)' },
    { banner: '#00CD9C', bannerDark: '#009E78', node: '#00CD9C', nodeDark: '#009E78', nodeShadow: 'rgba(0,205,156,0.5)'  },
  ];

  // Duolingo zigzag: center → left → center → right → center
  const zigzag = [50, 28, 50, 72, 50, 28, 50, 72, 50, 28, 50, 72, 50, 72, 50, 28];

  const allItems = topics.flatMap((t: any) => t.items || []);
  const completedCount = allItems.filter((item: any) =>
    itemProgress.some((p: any) => p.item_id === item.id && p.completed)
  ).length;
  const totalCount = allItems.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const firstIncompleteIdx = allItems.findIndex((item: any) =>
    !itemProgress.some((p: any) => p.item_id === item.id && p.completed)
  );

  let globalIdx = 0;

  if (loading) {
    return (
      <div style={{ background: '#131f24', borderRadius: 24, padding: 40 }} className="flex justify-center">
        <div className="w-10 h-10 border-4 border-[#58CC02] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (topics.length === 0) {
    return (
      <div style={{ background: '#131f24', borderRadius: 24, padding: 60 }} className="flex flex-col items-center text-center">
        <BookOpen size={40} className="mb-3 opacity-30 text-slate-400" />
        <p className="text-sm font-medium text-slate-400">No curriculum added yet</p>
      </div>
    );
  }

  return (
    <div style={{ background: '#131f24', borderRadius: 24, overflow: 'hidden' }}>
      {/* ── Top progress strip ── */}
      <div style={{ background: '#1d2f38', borderBottom: '1px solid #253540', padding: '14px 20px' }}
        className="flex items-center justify-between sticky top-0 z-20">
        <div>
          <p style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Course Progress</p>
          <p style={{ color: '#7d9dac', fontSize: 11, marginTop: 2 }}>
            {completedCount} of {totalCount} lessons done
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div style={{ width: 120, height: 8, background: '#253540', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${progressPct}%`,
              background: '#58CC02', borderRadius: 99,
              transition: 'width 0.5s ease',
            }} />
          </div>
          <span style={{ color: '#58CC02', fontWeight: 800, fontSize: 13 }}>{progressPct}%</span>
        </div>
      </div>

      {/* ── Units ── */}
      <div style={{ padding: '0 0 40px 0' }}>
        {topics.map((topic: any, tIdx: number) => {
          const theme = unitThemes[tIdx % unitThemes.length];
          const items = topic.items || [];
          const unitCompleted = items.length > 0 && items.every((item: any) =>
            itemProgress.some((p: any) => p.item_id === item.id && p.completed)
          );

          return (
            <div key={topic.id}>
              {/* ── Unit Banner — exact Duolingo style ── */}
              <div style={{
                background: theme.banner,
                margin: '32px 16px 24px',
                borderRadius: 16,
                overflow: 'hidden',
                boxShadow: `0 4px 0 ${theme.bannerDark}`,
                display: 'flex',
                alignItems: 'stretch',
              }}>
                {/* Left icon block */}
                <div style={{
                  width: 56,
                  background: 'rgba(0,0,0,0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {unitCompleted
                    ? <Trophy size={24} color="#fff" />
                    : <BookOpen size={24} color="#fff" />
                  }
                </div>
                {/* Text block */}
                <div style={{ padding: '12px 14px', flex: 1 }}>
                  <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Section 1, Unit {tIdx + 1}
                  </p>
                  <p style={{ color: '#fff', fontSize: 15, fontWeight: 800, marginTop: 2, lineHeight: 1.3 }}>
                    {topic.title}
                  </p>
                  {topic.summary && (
                    <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 4 }}>{topic.summary}</p>
                  )}
                </div>
                {/* Guidebook button */}
                <div style={{
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  flexShrink: 0,
                }}>
                  <div style={{
                    background: 'rgba(255,255,255,0.2)',
                    borderRadius: 10,
                    padding: '6px 12px',
                    border: '2px solid rgba(255,255,255,0.4)',
                  }}>
                    <p style={{ color: '#fff', fontSize: 11, fontWeight: 700 }}>
                      {items.length} {items.length === 1 ? 'lesson' : 'lessons'}
                    </p>
                  </div>
                </div>
              </div>

              {/* ── Lesson nodes path ── */}
              <div style={{ position: 'relative', minHeight: items.length * 110 }}>
                {items.length === 0 ? (
                  <p style={{ textAlign: 'center', color: '#4a6070', fontSize: 12, padding: '20px 0' }}>
                    No lessons in this unit
                  </p>
                ) : (
                  items.map((item: any, iIdx: number) => {
                    const isCompleted = itemProgress.some((p: any) => p.item_id === item.id && p.completed);
                    const isCurrent = globalIdx === firstIncompleteIdx && isEnrolled && !isCompleted;
                    const isLocked = !isEnrolled;
                    const xPct = zigzag[iIdx % zigzag.length];
                    const itemIdx = globalIdx++;
                    const canClick = isEnrolled && (isCompleted || isCurrent || itemIdx < firstIncompleteIdx || firstIncompleteIdx === -1);

                    // Node style
                    let nodeBg = theme.node;
                    let nodeBorder = theme.nodeDark;
                    let nodeOpacity = 1;
                    let innerIcon = <Star size={28} color="#fff" fill="#fff" />;

                    if (isLocked) {
                      nodeBg = '#2c3e4a';
                      nodeBorder = '#1e2d38';
                      nodeOpacity = 0.7;
                      innerIcon = <Star size={28} color="#4a6070" fill="#4a6070" />;
                    } else if (isCompleted) {
                      nodeBg = theme.node;
                      nodeBorder = theme.nodeDark;
                      innerIcon = <Star size={28} color="#fff" fill="#fff" />;
                    } else if (!isCurrent) {
                      nodeBg = '#2c3e4a';
                      nodeBorder = '#1e2d38';
                      innerIcon = <Star size={28} color="#4a6070" fill="#4a6070" />;
                    }

                    return (
                      <div
                        key={item.id}
                        style={{
                          position: 'absolute',
                          left: `${xPct}%`,
                          top: iIdx * 110 + 10,
                          transform: 'translateX(-50%)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          width: 120,
                        }}
                      >
                        {/* "START" tooltip bubble for current lesson */}
                        {isCurrent && (
                          <div style={{
                            background: '#fff',
                            borderRadius: 12,
                            padding: '6px 14px',
                            marginBottom: 8,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                            position: 'relative',
                            animation: 'bounce 1s infinite',
                          }}>
                            <p style={{ color: theme.node, fontWeight: 800, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                              {item.type === 'quiz' ? 'Quiz!' : item.type === 'assignment' ? 'Task!' : 'Start!'}
                            </p>
                            {/* Arrow */}
                            <div style={{
                              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
                              width: 12, height: 12, background: '#fff',
                              clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
                            }} />
                          </div>
                        )}

                        {/* Node button */}
                        <button
                          disabled={!canClick}
                          onClick={() => canClick && onOpenItem(item)}
                          style={{
                            width: 68, height: 68,
                            borderRadius: '50%',
                            background: nodeBg,
                            border: `4px solid ${nodeBorder}`,
                            opacity: nodeOpacity,
                            cursor: canClick ? 'pointer' : 'default',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            position: 'relative',
                            transition: 'transform 0.15s ease, opacity 0.2s',
                            boxShadow: isCompleted || isCurrent
                              ? `0 4px 0 ${nodeBorder}, 0 6px 20px ${theme.nodeShadow}`
                              : '0 4px 0 #1a2a33',
                            outline: 'none',
                          }}
                          onMouseEnter={e => { if (canClick) (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; }}
                          onMouseDown={e => { if (canClick) (e.currentTarget as HTMLElement).style.transform = 'scale(0.95)'; }}
                          onMouseUp={e => { if (canClick) (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)'; }}
                        >
                          {innerIcon}

                          {/* Animated dashed ring for current lesson */}
                          {isCurrent && (
                            <svg
                              width="92" height="92"
                              style={{ position: 'absolute', top: -16, left: -16, pointerEvents: 'none' }}
                              viewBox="0 0 92 92"
                            >
                              <circle
                                cx="46" cy="46" r="40"
                                fill="none"
                                stroke={theme.node}
                                strokeWidth="4"
                                strokeDasharray="14 8"
                                strokeLinecap="round"
                                style={{ animation: 'spin 4s linear infinite', transformOrigin: '46px 46px' }}
                              />
                            </svg>
                          )}

                          {/* Video badge */}
                          {item.video_url && !isLocked && (
                            <div style={{
                              position: 'absolute', bottom: -2, right: -2,
                              width: 20, height: 20, borderRadius: '50%',
                              background: '#fff', border: '2px solid #131f24',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <PlayCircle size={11} color="#FF4B4B" />
                            </div>
                          )}
                        </button>

                        {/* Label */}
                        <p style={{
                          color: isLocked ? '#3a5060' : isCurrent ? '#fff' : isCompleted ? theme.node : '#7d9dac',
                          fontSize: 11,
                          fontWeight: 700,
                          textAlign: 'center',
                          marginTop: 8,
                          lineHeight: 1.3,
                          maxWidth: 100,
                        }}>
                          {item.title || `Untitled ${item.type}`}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Spacer after nodes */}
              <div style={{ height: 20 }} />
            </div>
          );
        })}

        {/* Course complete — certificate claim card */}
        {totalCount > 0 && completedCount === totalCount && (
          <div className="mt-6">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 via-teal-500 to-cyan-500 p-6 sm:p-8 shadow-2xl shadow-emerald-200">
              {/* Decorative orbs */}
              <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/15 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-20 -left-12 w-44 h-44 bg-teal-300/20 rounded-full blur-3xl pointer-events-none" />

              {/* Confetti dots */}
              <div className="absolute top-4 left-8 w-2 h-2 bg-amber-300 rounded-full opacity-80 animate-pulse" />
              <div className="absolute top-8 right-12 w-2.5 h-2.5 bg-white rounded-full opacity-70 animate-pulse" style={{ animationDelay: '0.3s' }} />
              <div className="absolute bottom-10 right-8 w-2 h-2 bg-amber-200 rounded-full opacity-80 animate-pulse" style={{ animationDelay: '0.6s' }} />

              <div className="relative flex flex-col sm:flex-row items-center gap-5 sm:gap-6">
                {/* Trophy icon */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 ring-4 ring-white/30 shadow-xl">
                  <Trophy size={40} className="text-white drop-shadow-lg" />
                </div>

                {/* Text + CTA */}
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                    <span className="text-[10px] font-black uppercase tracking-wider text-emerald-100 bg-white/20 px-2.5 py-1 rounded-full">
                      Achievement Unlocked
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white leading-tight mb-1">
                    Course Complete!
                  </h3>
                  <p className="text-emerald-50 text-sm sm:text-base mb-4">
                    You finished all {totalCount} lessons. Claim your certificate of completion!
                  </p>

                  <button
                    onClick={onClaimCertificate}
                    disabled={claiming}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-emerald-700 font-bold rounded-2xl text-sm shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {claiming ? (
                      <>
                        <div className="w-4 h-4 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                        Generating...
                      </>
                    ) : hasCompletion ? (
                      <>
                        <Award size={18} />
                        View Your Certificate
                      </>
                    ) : (
                      <>
                        <Award size={18} />
                        Claim Your Certificate
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Keyframe for spinning ring */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes bounce {
          0%,100% { transform: translateY(0); }
          50%      { transform: translateY(-6px); }
        }
      `}</style>
    </div>
  );
}

// ── Course Detail View (Student) ────────────────────────────────────────────────────
function CourseDetailView({
  course,
  userId,
  isEnrolled,
  onBack,
  onEnroll,
  onOpenForum,
}: {
  course: any;
  userId: string;
  isEnrolled: boolean;
  onBack: () => void;
  onEnroll: () => void;
  onOpenForum: () => void;
}) {
  const { user, profile } = useAuth();
  const studentName = profile?.full_name ?? user?.user_metadata?.full_name ?? 'Student';
  const [topics, setTopics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<'overview' | 'curriculum'>('overview');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [openItem, setOpenItem] = useState<any | null>(null);
  const [itemProgress, setItemProgress] = useState<any[]>([]);
  const [completion, setCompletion] = useState<CourseCompletion | null>(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [showAiTutor, setShowAiTutor] = useState(false);

  // Create or fetch the completion record, then show the certificate
  const claimCertificate = async () => {
    if (claiming) return;
    if (completion) { setShowCertificate(true); return; }
    setClaiming(true);
    try {
      // Check if one was already created (avoid duplicate insert)
      const { data: existing } = await supabase
        .from('course_completions')
        .select('*')
        .eq('student_id', userId)
        .eq('course_id', course.id)
        .maybeSingle();
      if (existing) {
        setCompletion(existing as CourseCompletion);
        setShowCertificate(true);
        return;
      }
      const { data: created, error } = await supabase
        .from('course_completions')
        .insert({ student_id: userId, course_id: course.id, xp_awarded: 0 })
        .select()
        .single();
      if (!error && created) {
        setCompletion(created as CourseCompletion);
        setShowCertificate(true);
        logActivity({
          action: 'course_complete',
          description: `Completed course & earned certificate`,
          page: 'my-courses',
          metadata: { course_id: course.id, completion_id: created.id },
        });
        logActivity({
          action: 'certificate_earned',
          description: `Certificate earned for "${course.title}"`,
          page: 'my-courses',
          metadata: { course_id: course.id, certificate_id: created.certificate_id },
        });
      }
    } finally {
      setClaiming(false);
    }
  };

  useEffect(() => {
    (async () => {
      // Fetch topics
      const { data: topicsData } = await supabase
        .from('course_topics')
        .select('*')
        .eq('course_id', course.id)
        .order('sort_order');

      // Fetch items separately and group by topic
      const { data: itemsData } = await supabase
        .from('course_topic_items')
        .select('*')
        .in('topic_id', (topicsData ?? []).map(t => t.id))
        .order('sort_order');

      // Group items by topic
      const topicsWithItems = (topicsData ?? []).map(topic => ({
        ...topic,
        items: (itemsData ?? []).filter(item => item.topic_id === topic.id)
      }));

      setTopics(topicsWithItems);
      if (topicsWithItems.length > 0) {
        setExpanded(new Set([topicsWithItems[0].id]));
      }

      // Fetch item progress filtered to this course's items only
      const courseItemIds = (itemsData ?? []).map((i: any) => i.id);
      if (courseItemIds.length > 0) {
        const { data: progressData } = await supabase
          .from('course_item_progress')
          .select('*')
          .eq('student_id', userId)
          .in('item_id', courseItemIds);
        setItemProgress(progressData ?? []);
      } else {
        setItemProgress([]);
      }

      setLoading(false);
    })();
  }, [course.id, userId]);

  // Check for existing course completion record
  useEffect(() => {
    if (!isEnrolled) return;
    supabase
      .from('course_completions')
      .select('*')
      .eq('student_id', userId)
      .eq('course_id', course.id)
      .maybeSingle()
      .then(({ data }) => { if (data) setCompletion(data as CourseCompletion); });
  }, [course.id, userId, isEnrolled]);

  const totalItems = topics.reduce((a, t) => a + (t.items?.length ?? 0), 0);
  const videoCount = topics.flatMap(t => t.items ?? []).filter((i: any) => i.video_url).length;
  const totalDuration = (course.duration_hours ?? 0) * 60 + (course.duration_minutes ?? 0);
  const hours = Math.floor(totalDuration / 60);
  const mins = totalDuration % 60;
  const cover = course.thumbnail_url || 'https://images.pexels.com/photos/301926/pexels-photo-301926.jpeg?auto=compress&cs=tinysrgb&w=1600&h=800&fit=crop';

  const courseItemIds = new Set(topics.flatMap(t => t.items ?? []).map((i: any) => i.id));
  const completedItemIds = new Set(
    itemProgress.filter(p => p.completed && courseItemIds.has(p.item_id)).map(p => p.item_id)
  );
  const completedItems = Math.min(completedItemIds.size, totalItems);
  const progressPercent = totalItems > 0 ? Math.min(100, Math.round((completedItems / totalItems) * 100)) : 0;

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setExpanded(expanded.size > 0 ? new Set() : new Set(topics.map(t => t.id)));

  const markItemComplete = async (itemId: string) => {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from('course_item_progress')
      .upsert(
        { student_id: userId, item_id: itemId, completed: true, completed_at: now },
        { onConflict: 'student_id,item_id' }
      );
    if (error) {
      console.error('markItemComplete failed:', error);
      return;
    }
    // Update local state and sync enrollment progress
    setItemProgress(prev => {
      const updated = prev.find(p => p.item_id === itemId)
        ? prev.map(p => p.item_id === itemId ? { ...p, completed: true, completed_at: now } : p)
        : [...prev, { id: crypto.randomUUID(), student_id: userId, item_id: itemId, completed: true, completed_at: now }];

      const allIds = new Set(topics.flatMap(t => t.items ?? []).map((i: any) => i.id));
      const doneCount = new Set(updated.filter(p => p.completed && allIds.has(p.item_id)).map(p => p.item_id)).size;
      const total = allIds.size;
      const newPct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

      // Persist progress to course_enrollments
      supabase
        .from('course_enrollments')
        .update({ progress: newPct, last_accessed_at: now })
        .eq('student_id', userId)
        .eq('course_id', course.id)
        .then(() => {});

      return updated;
    });
  };

  // Lesson Viewer
  if (openItem && openItem.type === 'lesson') {
    function toEmbedUrl(url: string): string {
      // Already an embed URL
      if (url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/video/')) return url;
      // youtu.be short link
      const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
      // youtube.com/watch or m.youtube.com/watch
      const watchMatch = url.match(/(?:youtube\.com|youtu\.be).*[?&]v=([a-zA-Z0-9_-]{11})/);
      if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
      // Vimeo
      const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
      if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      return url;
    }
    const isLessonDone = !!itemProgress.find(p => p.item_id === openItem.id)?.completed;
    return (
      <div className="min-h-full bg-slate-50">
        {/* Sticky top bar */}
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setOpenItem(null)}
              className="flex items-center gap-1.5 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors shrink-0"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-400 truncate">{course.title}</p>
              <h2 className="font-semibold text-slate-900 text-sm truncate leading-tight">{openItem.title}</h2>
            </div>
            {isLessonDone && (
              <span className="shrink-0 flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
                <CheckCircle size={12} /> Completed
              </span>
            )}
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-0 sm:px-4 py-6 space-y-4">
          {/* Video section (only if video exists) */}
          {openItem.video_url && (
            <div className="rounded-2xl overflow-hidden shadow-lg bg-slate-900 aspect-video">
              <iframe src={toEmbedUrl(openItem.video_url!)} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
          )}

          {/* Lesson card */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            {/* Lesson header banner — responsive title card with AI Tutor */}
            <div className="relative bg-gradient-to-br from-blue-600 via-indigo-600 to-violet-700 px-5 sm:px-7 py-5 sm:py-6 overflow-hidden">
              {/* Decorative blobs */}
              <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/10 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -bottom-16 -left-10 w-36 h-36 bg-indigo-400/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative flex items-start gap-3 sm:gap-4">
                {/* Icon */}
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shrink-0 ring-1 ring-white/30">
                  <BookOpen size={22} className="text-white" />
                </div>

                {/* Title + meta */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-blue-200 bg-white/15 px-2 py-0.5 rounded-full">
                      Lesson
                    </span>
                    {isLessonDone && (
                      <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-100 bg-emerald-500/30 border border-emerald-300/40 px-2 py-0.5 rounded-full">
                        <CheckCircle size={10} /> Completed
                      </span>
                    )}
                  </div>
                  <h1 className="text-lg sm:text-xl font-bold text-white leading-snug break-words">
                    {openItem.title}
                  </h1>
                  <p className="text-blue-200 text-xs sm:text-sm mt-1 flex items-center gap-1.5">
                    <BookOpen size={12} className="shrink-0" />
                    <span className="truncate">{course.title}</span>
                  </p>
                </div>

                {/* Ask AI Tutor button — inline in header */}
                <button
                  onClick={() => setShowAiTutor(true)}
                  className="group shrink-0 flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2.5 sm:py-3 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur-sm border border-white/30 hover:border-white/50 transition-all duration-300 hover:scale-105 active:scale-95"
                  title="Ask AI Tutor"
                >
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shrink-0 shadow-md group-hover:scale-110 transition-transform">
                    <Bot size={16} className="text-white" />
                  </div>
                  <span className="hidden sm:block">
                    <span className="flex items-center gap-1 text-white font-bold text-xs leading-none">
                      Ask AI Tutor
                      <Sparkles size={11} className="text-amber-300" />
                    </span>
                    <span className="text-blue-200 text-[10px] leading-tight block mt-0.5 max-w-[140px] truncate">
                      Questions about this lesson
                    </span>
                  </span>
                </button>
              </div>
            </div>

            {/* Featured image */}
            {openItem.featured_image_url && (
              <div className="border-b border-slate-100">
                <img
                  src={openItem.featured_image_url}
                  alt={openItem.title}
                  className="w-full max-h-72 object-cover"
                />
              </div>
            )}

            {/* Content */}
            <div className="p-3 sm:p-6">
              {openItem.content ? (
                <div className="lesson-content w-full" dangerouslySetInnerHTML={{ __html: openItem.content }} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center mb-3">
                    <BookOpen size={24} className="text-slate-400" />
                  </div>
                  <p className="font-medium text-slate-600">Content coming soon</p>
                  <p className="text-slate-400 text-sm mt-1">The teacher is preparing this lesson.</p>
                </div>
              )}
            </div>

            {/* Footer action — completion */}
            <div className="px-5 sm:px-7 pb-6 pt-5 border-t border-slate-100">
              {isLessonDone ? (
                <div className="flex items-center gap-2.5 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <CheckCircle size={20} className="text-emerald-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-emerald-700 text-sm">Lesson Completed</p>
                    <p className="text-emerald-600 text-xs">Great work! Keep up the momentum.</p>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => markItemComplete(openItem.id)}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                  <CheckCircle size={18} /> Mark as Complete
                </button>
              )}
            </div>
          </div>
        </div>

        {/* AI Tutor full-page overlay */}
        {showAiTutor && (
          <AiTutorPage
            lessonTitle={openItem.title}
            lessonContent={openItem.content ?? ''}
            onClose={() => setShowAiTutor(false)}
          />
        )}
      </div>
    );
  }

  // Quiz Viewer
  if (openItem && openItem.type === 'quiz') {
    return (
      <QuizViewer
        item={openItem}
        onComplete={() => markItemComplete(openItem.id)}
        onBack={() => setOpenItem(null)}
      />
    );
  }

  // Assignment Viewer
  if (openItem && openItem.type === 'assignment') {
    return (
      <AssignmentViewer
        item={openItem}
        progress={itemProgress.find(p => p.item_id === openItem.id)}
        onComplete={() => markItemComplete(openItem.id)}
        onBack={() => setOpenItem(null)}
      />
    );
  }

  const diffBg =
    course.difficulty_level === 'Beginner' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
    course.difficulty_level === 'Intermediate' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
    'bg-rose-500/20 text-rose-300 border-rose-500/30';

  return (
    <div className="min-h-full pb-10 bg-slate-50">
      {/* Course Info Header — beautiful, responsive, appears first */}
      <div className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex-shrink-0">
        {/* Background image with overlay */}
        <img src={cover} alt={course.title} className="absolute inset-0 w-full h-full object-cover opacity-20 scale-105" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/80 to-slate-900/60" />

        {/* Decorative orbs */}
        <div className="absolute -top-20 -right-20 w-72 h-72 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          {/* Back button + breadcrumb */}
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm font-medium"
            >
              <ArrowLeft size={16} /> Back to Courses
            </button>
            <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
              <span>Courses</span>
              <ChevronRight size={10} />
              <span className="capitalize">{course.difficulty_level || 'All Levels'}</span>
              <ChevronRight size={10} />
              <span className="text-slate-300 truncate max-w-[200px]">{course.title}</span>
            </div>
          </div>

          {/* Main info grid — title + meta on left, thumbnail on right */}
          <div className="flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-center">
            {/* Left: title + badges */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${diffBg}`}>
                  {course.difficulty_level || 'All Levels'}
                </span>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${course.pricing_model === 'free' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
                  {course.pricing_model === 'free' ? 'Free' : `Paid · ${Number(course.price || 0).toFixed(2)}`}
                </span>
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border bg-white/10 text-white border-white/20">
                  {course.visibility === 'public' ? <Globe size={10} /> : <Lock size={10} />}
                  <span className="capitalize">{course.visibility}</span>
                </span>
                {isEnrolled && (
                  <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-emerald-500 text-white border border-emerald-400">
                    <CheckCircle size={10} /> Enrolled
                  </span>
                )}
                {isEnrolled && (
                  <button
                    onClick={onOpenForum}
                    className="flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-full bg-blue-500 hover:bg-blue-600 text-white border border-blue-400 transition-colors shadow-sm"
                  >
                    <MessageSquare size={11} /> Course Forum
                  </button>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-white leading-tight mb-3 tracking-tight">
                {course.title}
              </h1>

              {course.description && (
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mb-4 line-clamp-2">
                  {course.description}
                </p>
              )}

              {/* Inline stats — responsive grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 max-w-2xl">
                {[
                  { icon: Layers, label: 'Sections', value: String(topics.length) },
                  { icon: BookOpen, label: 'Lessons', value: String(totalItems) },
                  { icon: Video, label: 'Videos', value: String(videoCount) },
                  { icon: Clock, label: 'Duration', value: hours > 0 ? `${hours}h ${mins}m` : `${mins}m` },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-center gap-2.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl px-3 py-2.5">
                    <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
                      <Icon size={15} className="text-slate-300" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] text-slate-400 font-medium leading-none uppercase tracking-wider">{label}</p>
                      <p className="font-bold text-white text-sm leading-tight mt-0.5 truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar (if enrolled) */}
              {isEnrolled && totalItems > 0 && (
                <div className="mt-4 max-w-2xl">
                  <div className="flex justify-between text-xs text-slate-400 mb-1.5">
                    <span>Your progress</span>
                    <span className="font-bold text-emerald-400">{progressPercent}%</span>
                  </div>
                  <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{completedItems} of {totalItems} lessons completed</p>
                </div>
              )}
            </div>

            {/* Right: thumbnail + CTA (hidden on mobile, shown on lg+) */}
            <div className="hidden lg:block w-80 xl:w-96 flex-shrink-0">
              <div className="relative rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 group">
                <div className="relative h-52 bg-slate-800 overflow-hidden">
                  <img src={cover} alt={course.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <button
                      onClick={() => setActiveSection('curriculum')}
                      className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform"
                    >
                      <Play size={24} className="text-rose-600 fill-rose-50" />
                    </button>
                  </div>
                </div>
                {/* CTA below thumbnail */}
                <div className="p-4 bg-slate-800/80 backdrop-blur-sm">
                  {isEnrolled ? (
                    progressPercent >= 100 ? (
                      <button
                        onClick={claimCertificate}
                        disabled={claiming}
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-bold rounded-xl text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        <Award size={16} />
                        {claiming ? 'Generating...' : completion ? 'View Certificate' : 'Claim Certificate'}
                      </button>
                    ) : (
                      <button
                        onClick={() => setActiveSection('curriculum')}
                        className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-500 text-white font-bold rounded-xl text-sm shadow-lg hover:shadow-xl transition-all"
                      >
                        Continue Learning
                      </button>
                    )
                  ) : (
                    <button
                      onClick={onEnroll}
                      className="w-full py-3 bg-gradient-to-r from-rose-600 to-red-500 text-white font-bold rounded-xl text-sm shadow-lg hover:shadow-xl hover:scale-[1.02] transition-all"
                    >
                      Enroll Now — {course.pricing_model === 'free' ? 'Free' : `${Number(course.price || 0).toFixed(2)}`}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-8 pb-28 lg:pb-8 lg:flex lg:gap-8 lg:items-start">
        {/* Left: main content */}
        <div className="flex-1 min-w-0 space-y-6">

          {/* Tab nav (mobile only) */}
          <div className="flex lg:hidden gap-1 bg-slate-100 p-1 rounded-2xl">
            {(['overview', 'curriculum'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveSection(tab)}
                className={`flex-1 py-2 text-sm font-semibold rounded-xl capitalize transition-all ${
                  activeSection === tab ? 'bg-white shadow text-slate-800' : 'text-slate-500'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* About */}
          <div className={`${activeSection === 'overview' ? 'block' : 'hidden'} lg:block`}>
            {course.description && (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
                <h2 className="font-bold text-slate-800 text-base mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 bg-rose-500 rounded-full inline-block" />
                  About this course
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">{course.description}</p>
              </div>
            )}
          </div>

          {/* What you'll learn */}
          <div className={`${activeSection === 'overview' ? 'block' : 'hidden'} lg:block`}>
            <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
              <h2 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-blue-500 rounded-full inline-block" />
                What you will learn
              </h2>
              {course.what_will_learn ? (
                <div className="prose prose-sm text-slate-600" dangerouslySetInnerHTML={{ __html: course.what_will_learn.replace(/\n/g, '<br/>') }} />
              ) : (
                <div className="grid sm:grid-cols-2 gap-2.5">
                  {[
                    `Master the fundamentals of ${course.title}`,
                    'Build real-world skills you can apply immediately',
                    'Progress from basics to advanced concepts',
                    'Access structured learning materials',
                    'Test your knowledge with quizzes',
                    'Earn a certificate of completion',
                  ].map(item => (
                    <div key={item} className="flex items-start gap-2.5">
                      <CheckCircle size={15} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-slate-700">{item}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Requirements */}
          {course.requirements && (
            <div className={`${activeSection === 'overview' ? 'block' : 'hidden'} lg:block`}>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
                <h2 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-amber-500 rounded-full inline-block" />
                  Requirements
                </h2>
                <div className="prose prose-sm text-slate-600" dangerouslySetInnerHTML={{ __html: course.requirements.replace(/\n/g, '<br/>') }} />
              </div>
            </div>
          )}

          {/* Target Audience */}
          {course.target_audience && (
            <div className={`${activeSection === 'overview' ? 'block' : 'hidden'} lg:block`}>
              <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm">
                <h2 className="font-bold text-slate-800 text-base mb-4 flex items-center gap-2">
                  <span className="w-1 h-5 bg-violet-500 rounded-full inline-block" />
                  Who this course is for
                </h2>
                <div className="prose prose-sm text-slate-600" dangerouslySetInnerHTML={{ __html: course.target_audience.replace(/\n/g, '<br/>') }} />
              </div>
            </div>
          )}

          {/* Curriculum — Duolingo-style path */}
          <div className={`${activeSection === 'curriculum' ? 'block' : 'hidden'} lg:block`}>
            <DuolingoPath
              topics={topics}
              itemProgress={itemProgress}
              isEnrolled={isEnrolled}
              loading={loading}
              onOpenItem={(item) => setOpenItem(item)}
              onClaimCertificate={claimCertificate}
              claiming={claiming}
              hasCompletion={!!completion}
            />
          </div>
        </div>

      </div>

      {/* Certificate modal */}
      {showCertificate && (
        <CourseCertificate
          studentName={studentName}
          courseTitle={course.title}
          completedAt={completion?.completed_at ?? new Date().toISOString()}
          certificateId={completion?.certificate_id ?? ''}
          onClose={() => setShowCertificate(false)}
        />
      )}
    </div>
  );
}

// ── Content Block Renderer ──────────────────────────────────────────────────────────
function ContentBlockRenderer({
  block,
  index,
  interactive = false,
  selectedAnswer,
  showResult,
  onSelectAnswer,
}: {
  block: ContentBlock;
  index: number;
  interactive?: boolean;
  selectedAnswer?: number | null;
  showResult?: boolean;
  onSelectAnswer?: (a: number | null) => void;
}) {
  return (
    <div className="space-y-4">
      {block.type === 'text' && (
        <div className="prose prose-slate max-w-none">
          <div className="leading-relaxed whitespace-pre-wrap text-slate-700">
            {block.content}
          </div>
        </div>
      )}

      {block.type === 'image' && (
        <div className="space-y-3">
          {block.imageUrl && (
            <div className="rounded-xl overflow-hidden border border-slate-200">
              <img
                src={block.imageUrl}
                alt={block.imageAlt || 'Lesson image'}
                className="w-full max-h-96 object-cover"
              />
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <ImageIcon size={14} />
            <span>{block.imageAlt || 'Image'}</span>
          </div>
        </div>
      )}

      {block.type === 'video' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Video size={14} />
            <span>{block.videoTitle || 'Video'}</span>
          </div>
          {block.videoUrl && (
            <div className="aspect-video rounded-xl overflow-hidden bg-slate-900">
              <iframe
                src={block.videoUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}
        </div>
      )}

      {block.type === 'question' && (
        <div className="bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
              <HelpCircle size={16} className="text-amber-600" />
            </div>
            <p className="font-semibold text-slate-800 text-lg leading-snug">
              {block.question}
            </p>
          </div>

          <div className="space-y-2.5 ml-11">
            {(block.options ?? []).map((option, optIdx) => {
              const isSelected = selectedAnswer === optIdx;
              const isCorrect = block.correctAnswer === optIdx;
              const showCorrectness = showResult;

              return (
                <button
                  key={optIdx}
                  onClick={() => !showResult && onSelectAnswer?.(optIdx)}
                  disabled={showResult}
                  className={[
                    'w-full text-left px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium',
                    showCorrectness && isCorrect
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                      : showCorrectness && isSelected && !isCorrect
                      ? 'border-red-400 bg-red-50 text-red-700'
                      : isSelected
                      ? 'border-amber-400 bg-amber-50 text-amber-700'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-amber-300 hover:bg-amber-50/50',
                  ].join(' ')}
                >
                  <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-xs font-bold text-slate-600 mr-2">
                    {String.fromCharCode(65 + optIdx)}
                  </span>
                  {option}
                </button>
              );
            })}
          </div>

          {showResult && block.correctAnswer !== undefined && (
            <div className="mt-4 ml-11 p-3 bg-emerald-100 rounded-lg text-sm text-emerald-800">
              The correct answer is: {block.options?.[block.correctAnswer]}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lesson Detail ────────────────────────────────────────────────────────────
function CourseDetail({
  level, lessons, progress, enrollments,
  onBack, onEnroll, onComplete,
}: {
  level: Level;
  lessons: Lesson[];
  progress: LessonProgress[];
  enrollments: Enrollment[];
  onBack: () => void;
  onEnroll: () => void;
  onComplete: (id: string) => void;
}) {
  const m        = LEVEL_META[level.key] ?? LEVEL_META['elementary'];
  const lls      = lessons.filter(l => l.level_id === level.id).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  const enrolled = enrollments.some(e => e.level_id === level.id);
  const done     = lls.filter(l => progress.find(p => p.lesson_id === l.id && p.completed)).length;
  const pct      = lls.length ? Math.round((done / lls.length) * 100) : 0;
  const totalMin  = lls.reduce((a, l) => a + l.duration_minutes, 0);
  const [openLesson, setOpenLesson] = useState<Lesson | null>(null);
  const [currentBlockIndex, setCurrentBlockIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [completedBlocks, setCompletedBlocks] = useState<Set<string>>(new Set());

  const handleOpenLesson = (lesson: Lesson) => {
    setOpenLesson(lesson);
    setCurrentBlockIndex(0);
    setSelectedAnswer(null);
    setShowResult(false);
    setCompletedBlocks(new Set());
  };

  if (openLesson) {
    const lp = progress.find(p => p.lesson_id === openLesson.id);
    const isDone = !!lp?.completed;
    const blocks = openLesson.content ?? [];
    const isInteractive = openLesson.display_mode === 'interactive' && blocks.length > 0;
    const currentBlock = isInteractive ? blocks[currentBlockIndex] : null;

    const handleProceed = () => {
      if (!currentBlock) return;
      const newCompleted = new Set(completedBlocks);
      newCompleted.add(currentBlock.id);
      setCompletedBlocks(newCompleted);
      if (currentBlockIndex < blocks.length - 1) {
        setCurrentBlockIndex(currentBlockIndex + 1);
        setSelectedAnswer(null);
        setShowResult(false);
      }
    };

    const handleGoBack = () => {
      if (currentBlockIndex > 0) {
        setCurrentBlockIndex(currentBlockIndex - 1);
        setSelectedAnswer(null);
        setShowResult(false);
      }
    };

    const handleSubmitAnswer = () => {
      if (!currentBlock || selectedAnswer === null) return;
      setShowResult(true);
      const isCorrect = currentBlock.correctAnswer === selectedAnswer;
      if (isCorrect) {
        setTimeout(() => {
          handleProceed();
        }, 1500);
      }
    };

    return (
      <div className="min-h-full bg-slate-50">
        <div className="bg-white border-b border-slate-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
            <button onClick={() => setOpenLesson(null)} className="flex items-center gap-2 text-slate-600 hover:text-slate-900 text-sm font-medium">
              <ArrowLeft size={18} /> Back
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-slate-900 truncate">{openLesson.title}</h2>
              {isInteractive && (
                <span className="text-xs text-violet-600 flex items-center gap-1">
                  <Layers size={12} /> Interactive Mode
                </span>
              )}
            </div>
            {isDone && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full flex-shrink-0">
                <CheckCircle size={12} /> Completed
              </span>
            )}
          </div>
        </div>
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
            <div className={`px-6 py-5 bg-gradient-to-r ${m.gradient}`}>
              <div className="flex items-center gap-2 mb-1">
                {isInteractive ? <Layers size={20} className="text-white" /> : <BookOpen size={20} className="text-white" />}
                <h1 className="font-bold text-xl text-white">{openLesson.title}</h1>
              </div>
              {openLesson.description && (
                <p className="text-white/80 text-sm">{openLesson.description}</p>
              )}
            </div>

            {isInteractive ? (
              <div className="min-h-[400px] flex flex-col">
                <div className="px-6 py-4 bg-slate-50 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      Step {currentBlockIndex + 1} of {blocks.length}
                    </span>
                    <div className="flex items-center gap-1">
                      {blocks.map((block, idx) => (
                        <div
                          key={block.id}
                          className={`w-2 h-2 rounded-full transition-all ${
                            completedBlocks.has(block.id) ? 'bg-emerald-500' :
                            idx === currentBlockIndex ? 'bg-violet-500 ring-2 ring-violet-200' :
                            'bg-slate-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all duration-500"
                      style={{ width: `${(completedBlocks.size / blocks.length) * 100}%` }}
                    />
                  </div>
                </div>

                <div className="flex-1 px-6 py-6">
                  {currentBlock && (
                    <ContentBlockRenderer
                      block={currentBlock}
                      index={currentBlockIndex + 1}
                      interactive={currentBlock.type === 'question'}
                      selectedAnswer={selectedAnswer}
                      showResult={showResult}
                      onSelectAnswer={setSelectedAnswer}
                    />
                  )}
                </div>

                <div className="px-6 pb-6 pt-4 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-3">
                    <button
                      onClick={handleGoBack}
                      disabled={currentBlockIndex === 0}
                      className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 font-medium rounded-xl text-sm hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <ChevronLeft size={16} /> Previous
                    </button>

                    <div className="flex items-center gap-3">
                      {currentBlock?.type === 'question' ? (
                        showResult ? (
                          currentBlock.correctAnswer === selectedAnswer ? (
                            <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
                              <CheckCircle size={18} /> Correct! Moving on...
                            </div>
                          ) : (
                            <button
                              onClick={() => { setSelectedAnswer(null); setShowResult(false); }}
                              className="px-4 py-2.5 border border-red-200 text-red-600 font-medium rounded-xl text-sm hover:bg-red-50 transition-colors"
                            >
                              Try Again
                            </button>
                          )
                        ) : (
                          <button
                            onClick={handleSubmitAnswer}
                            disabled={selectedAnswer === null}
                            className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Submit Answer
                          </button>
                        )
                      ) : (currentBlockIndex >= blocks.length - 1 && completedBlocks.size >= blocks.length - 1) || isDone ? (
                        <button
                          onClick={() => { onComplete(openLesson.id); setOpenLesson(null); }}
                          className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm"
                        >
                          <CheckCircle size={16} /> Complete Lesson
                        </button>
                      ) : (
                        <button
                          onClick={handleProceed}
                          className="flex items-center gap-2 px-5 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl text-sm"
                        >
                          Proceed <ChevronRight size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="divide-y divide-slate-100">
                  {blocks.length === 0 ? (
                    <div className="p-12 text-center">
                      <BookOpen size={36} className="text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">Lesson content coming soon</p>
                      <p className="text-sm text-slate-400 mt-1">The teacher is preparing this lesson.</p>
                    </div>
                  ) : (
                    blocks.map((block, idx) => (
                      <div key={block.id} className="px-6 py-6">
                        <ContentBlockRenderer block={block} index={idx + 1} />
                      </div>
                    ))
                  )}
                </div>
                <div className="px-6 pb-6 pt-4 border-t border-slate-100 flex items-center gap-3">
                  <button
                    onClick={() => setOpenLesson(null)}
                    className="px-4 py-2.5 border border-slate-200 text-slate-700 font-medium rounded-xl text-sm hover:bg-slate-50 transition-colors"
                  >
                    Back
                  </button>
                  {!isDone && enrolled ? (
                    <button
                      onClick={() => { onComplete(openLesson.id); setOpenLesson(null); }}
                      className={`flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r ${m.gradient} text-white font-semibold rounded-xl text-sm hover:opacity-90 transition-all`}
                    >
                      <CheckCircle size={16} /> Mark as Complete
                    </button>
                  ) : isDone ? (
                    <span className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
                      <CheckCircle size={18} /> Lesson Completed
                    </span>
                  ) : null}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {/* ── Hero ── */}
      <div className="relative h-64 sm:h-72 overflow-hidden">
        <img src={m.coverImage} alt={level.label} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
        <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-30`} />

        {/* Back btn */}
        <button
          onClick={onBack}
          className="absolute top-5 left-5 flex items-center gap-2 px-3 py-1.5 bg-black/30 backdrop-blur-sm text-white/90 text-sm font-medium rounded-xl border border-white/10 hover:bg-black/50 transition-all"
        >
          <ArrowLeft size={15} /> Back to Courses
        </button>

        <div className="absolute bottom-0 left-0 right-0 px-6 pb-6">
          <span className="inline-block text-xs font-bold text-white/60 uppercase tracking-widest mb-2">
            Course · Level {level.sort_order}
          </span>
          <div className="flex items-end justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-4xl drop-shadow-lg">{m.emoji}</span>
              <h1 className="font-black text-3xl sm:text-4xl text-white leading-tight">{level.label}</h1>
            </div>
            {enrolled && (
              <div className="hidden sm:block text-right flex-shrink-0">
                <div className="text-3xl font-black text-white">{pct}%</div>
                <div className="text-white/50 text-xs">completed</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">

        {/* ── Info bar ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Stats */}
            <div className="flex flex-wrap gap-5 flex-1">
              {[
                { icon: BookOpen,    label: 'Lessons',      value: lls.length },
                { icon: Clock,       label: 'Total time',   value: `${totalMin}m` },
                { icon: CheckCircle, label: 'Completed',    value: done },
                { icon: Users,       label: 'Level',        value: level.label },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 text-sm text-slate-600">
                  <s.icon size={15} className={m.textColor} />
                  <span className="font-bold text-slate-900">{s.value}</span>
                  <span className="text-slate-400">{s.label}</span>
                </div>
              ))}
            </div>
            {/* CTA */}
            {!enrolled ? (
              <button
                onClick={onEnroll}
                className={`flex-shrink-0 px-6 py-2.5 bg-gradient-to-r ${m.gradient} text-white font-bold text-sm rounded-xl shadow-lg hover:opacity-90 transition-all hover:-translate-y-0.5`}
                style={{ boxShadow: `0 6px 20px ${m.accentHex}40` }}
              >
                Enroll Free
              </button>
            ) : (
              <span className={`flex-shrink-0 flex items-center gap-1.5 px-4 py-2 ${m.bgColor} ${m.textColor} text-sm font-bold rounded-xl border ${m.borderColor}`}>
                <CheckCircle size={15} /> Enrolled
              </span>
            )}
          </div>

          {enrolled && (
            <div className="mt-5 pt-5 border-t border-slate-100">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span>Course progress</span>
                <span className={`font-bold text-sm ${m.textColor}`}>{pct}%</span>
              </div>
              <div className="relative h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`absolute inset-y-0 left-0 bg-gradient-to-r ${m.gradient} rounded-full transition-all duration-700`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">{done} of {lls.length} lessons completed</p>
            </div>
          )}
        </div>

        {/* ── What you'll learn ── */}
        <div className={`rounded-2xl bg-gradient-to-br ${m.lightGradient} border ${m.borderColor} p-5`}>
          <h2 className="font-bold text-slate-900 mb-3">What you'll learn</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {(LEVEL_SKILLS[level.key] ?? []).map(s => (
              <div key={s.label} className="flex items-center gap-2.5 text-sm text-slate-700">
                <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${m.gradient} flex items-center justify-center flex-shrink-0`}>
                  <s.icon size={12} className="text-white" />
                </div>
                {s.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Lessons list ── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 text-lg">
              Course Content
            </h2>
            <span className="text-sm text-slate-400">{lls.length} lessons · {totalMin} min</span>
          </div>

          {lls.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-16 text-center">
              <BookOpen size={44} className="text-slate-200 mx-auto mb-4" />
              <p className="font-semibold text-slate-500">No lessons yet</p>
              <p className="text-slate-400 text-sm mt-1">Teachers are preparing content — check back soon!</p>
            </div>
          ) : (
            <div className="space-y-0 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {lls.map((lesson, i) => {
                const lp       = progress.find(p => p.lesson_id === lesson.id);
                const isDone   = !!lp?.completed;
                const isLocked = !enrolled;
                const isNext   = !isDone && !isLocked && lls.slice(0, i).every(l => progress.find(p => p.lesson_id === l.id && p.completed));

                return (
                  <div
                    key={lesson.id}
                    onClick={() => !isLocked && setOpenLesson(lesson)}
                    className={[
                      'group flex items-center gap-0 transition-all border-b border-slate-50 last:border-0',
                      isDone   ? 'bg-emerald-50/30 hover:bg-emerald-50/60 cursor-pointer' : '',
                      isLocked ? 'opacity-60 cursor-not-allowed' : '',
                      isNext   ? 'cursor-pointer hover:bg-blue-50/60' : '',
                      !isDone && !isLocked && !isNext ? 'cursor-pointer hover:bg-slate-50' : '',
                    ].join(' ')}
                  >
                    {/* Left accent bar */}
                    <div className={`w-1 self-stretch flex-shrink-0 transition-all ${isDone ? `bg-gradient-to-b ${m.gradient}` : isNext ? `bg-gradient-to-b ${m.gradient} opacity-40` : 'bg-transparent'}`} />

                    <div className="flex items-center gap-4 px-5 py-4 w-full">
                      {/* Icon */}
                      <div className={[
                        'w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all',
                        isDone   ? 'bg-emerald-100' : '',
                        isLocked ? 'bg-slate-100' : '',
                        isNext   ? `bg-gradient-to-br ${m.gradient} shadow-md group-hover:shadow-lg` : '',
                        !isDone && !isLocked && !isNext ? 'bg-slate-100 group-hover:bg-slate-200' : '',
                      ].join(' ')}>
                        {isDone   && <CheckCircle size={20} className="text-emerald-500" />}
                        {isLocked && <Lock size={16} className="text-slate-400" />}
                        {isNext   && <Play size={16} className="text-white fill-white" />}
                        {!isDone && !isLocked && !isNext && <Play size={16} className="text-slate-400" />}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <span className="text-xs text-slate-400 font-medium">Lesson {i + 1}</span>
                          {isDone && <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Completed</span>}
                          {isNext && <span className={`text-xs font-bold ${m.textColor} ${m.bgColor} px-1.5 py-0.5 rounded-md`}>Up Next</span>}
                        </div>
                        <h3 className={`font-semibold text-sm leading-snug ${isDone ? 'text-slate-500' : 'text-slate-900'}`}>
                          {lesson.title}
                        </h3>
                        {lesson.description && (
                          <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{lesson.description}</p>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-slate-400">
                            <Clock size={11} /> {lesson.duration_minutes} min
                          </span>
                          {isDone && lp?.score !== undefined && (
                            <span className="flex items-center gap-1 text-xs text-amber-500 font-medium">
                              <Star size={11} className="fill-amber-400 text-amber-400" /> {lp.score}%
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Right action */}
                      <div className="flex-shrink-0">
                        {isLocked && <Lock size={15} className="text-slate-300" />}
                        {isDone && (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle size={16} className="text-emerald-500" />
                          </div>
                        )}
                        {isNext && (
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r ${m.gradient} text-white text-xs font-bold rounded-xl`}>
                            Start <ArrowRight size={11} />
                          </div>
                        )}
                        {!isDone && !isLocked && !isNext && (
                          <ChevronRight size={16} className="text-slate-300 group-hover:text-slate-500 transition-colors" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function StudentDashboard() {
  const { profile, user } = useAuth();
  const [page, setPage]   = useState<StudentPage>('overview');

  const navigateTo = (k: string) => {
    setPage(k as StudentPage);
    logActivity({ action: 'page_view', description: `Visited ${k}`, page: k });
  };

  // Gamification hook
  const gamification = useGamification(user?.id);

  const [levels, setLevels]           = useState<Level[]>([]);
  const [lessons, setLessons]         = useState<Lesson[]>([]);
  const [progress, setProgress]       = useState<LessonProgress[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading]         = useState(true);
  const [openLevelId, setOpenLevelId] = useState<string | null>(null);
  const [openCourseId, setOpenCourseId] = useState<string | null>(null);
  const [showCourseForum, setShowCourseForum] = useState(false);
  const [courseSourcePage, setCourseSourcePage] = useState<StudentPage>('market');
  const [courses, setCourses] = useState<any[]>([]);
  const [myCategoryId, setMyCategoryId] = useState<string | null>(null);
  const [courseEnrollments, setCourseEnrollments] = useState<any[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string; color: string; icon: string }[]>([]);
  const [toast, setToast] = useState<'success' | null>(null);

  // Interactive quiz state
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizOptions, setQuizOptions] = useState<QuizOption[]>([]);
  const [quizAttempts, setQuizAttempts] = useState<QuizAttempt[]>([]);
  const [openQuizId, setOpenQuizId] = useState<string | null>(null);
  const [selectedProgressEnrollment, setSelectedProgressEnrollment] = useState<any | null>(null);
  const [courseCompletions, setCourseCompletions] = useState<CourseCompletion[]>([]);
  const [viewingCertificate, setViewingCertificate] = useState<{ completion: CourseCompletion; courseTitle: string } | null>(null);

  const [flippedCard, setFlippedCard] = useState<number | null>(null);
  const [quizIdx, setQuizIdx]         = useState(0);
  const [selected, setSelected]       = useState<number | null>(null);
  const [quizScore, setQuizScore]     = useState(0);
  const [quizDone, setQuizDone]       = useState(false);
  const [showExp, setShowExp]         = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [lvl, les, prog, enr, crs, cat, prof, courseEnr, qz, qq, qo, qa, completions] = await Promise.all([
        supabase.from('levels').select('*').order('sort_order'),
        supabase.from('lessons').select('*').eq('is_published', true).order('sort_order'),
        supabase.from('lesson_progress').select('*').eq('student_id', user.id),
        supabase.from('enrollments').select('*').eq('student_id', user.id),
        supabase.from('courses').select('*').eq('is_published', true).order('created_at', { ascending: false }),
        supabase.from('categories').select('id, name, color, icon, sort_order').order('sort_order', { ascending: true }),
        supabase.from('profiles').select('category_id').eq('id', user.id).single(),
        supabase.from('course_enrollments').select('*').eq('student_id', user.id),
        supabase.from('quizzes').select('*').eq('is_published', true).order('sort_order'),
        supabase.from('quiz_questions').select('*').order('sort_order'),
        supabase.from('quiz_options').select('*').order('sort_order'),
        supabase.from('quiz_attempts').select('*').eq('student_id', user.id),
        supabase.from('course_completions').select('*').eq('student_id', user.id),
      ]);
      setLevels(lvl.data ?? []);
      setLessons(les.data ?? []);
      setProgress(prog.data ?? []);
      setEnrollments(enr.data ?? []);
      setCourses(crs.data ?? []);
      setCategories(cat.data ?? []);
      setMyCategoryId(prof.data?.category_id ?? null);
      setCourseEnrollments(courseEnr.data ?? []);
      setQuizzes((qz.data as Quiz[]) ?? []);
      setQuizQuestions((qq.data as QuizQuestion[]) ?? []);
      setQuizOptions((qo.data as QuizOption[]) ?? []);
      setQuizAttempts((qa.data as QuizAttempt[]) ?? []);
      setCourseCompletions((completions.data as CourseCompletion[]) ?? []);
      setLoading(false);
    })();
  }, [user]);

  const enroll = async (levelId: string) => {
    if (!user) return;
    const already = enrollments.some(e => e.level_id === levelId);
    if (already) return;
    const { data } = await supabase
      .from('enrollments')
      .insert({ student_id: user.id, level_id: levelId })
      .select().maybeSingle();
    if (data) setEnrollments(p => [...p, data]);
  };

  const completeLesson = async (lessonId: string) => {
    if (!user) return;
    const now = new Date().toISOString();
    const { error } = await supabase.from('lesson_progress').upsert({
      student_id: user.id, lesson_id: lessonId,
      score: 100, completed: true, completed_at: now,
    }, { onConflict: 'student_id,lesson_id' });
    if (error) {
      console.error('completeLesson failed:', error);
      return;
    }
    setProgress(prev => {
      const exists = prev.find(p => p.lesson_id === lessonId);
      if (exists) {
        return prev.map(p => p.lesson_id === lessonId ? { ...p, completed: true, completed_at: now } : p);
      }
      return [...prev, { id: crypto.randomUUID(), student_id: user.id, lesson_id: lessonId, score: 100, completed: true, completed_at: now, updated_at: now }];
    });
    logActivity({
      action: 'lesson_complete',
      description: `Completed a lesson`,
      page: 'overview',
      metadata: { lesson_id: lessonId },
    });
  };

  const completedCount = progress.filter(p => p.completed).length;
  const overallPct     = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;
  const streak         = Math.min(completedCount * 2 + 1, 30);

  const enrolledCourses = courses.filter(c => courseEnrollments.some(e => e.course_id === c.id));
  const navItemsBadged = navItems.map(item =>
    item.key === 'my-courses' && enrolledCourses.length > 0
      ? { ...item, badge: enrolledCourses.length }
      : item
  );

  const handleQuiz = (idx: number) => {
    if (selected !== null) return;
    setSelected(idx); setShowExp(true);
    if (idx === QUIZ[quizIdx].answer) setQuizScore(s => s + 1);
  };
  const nextQ = () => {
    if (quizIdx + 1 >= QUIZ.length) { setQuizDone(true); return; }
    setQuizIdx(i => i + 1); setSelected(null); setShowExp(false);
  };
  const resetQuiz = () => { setQuizIdx(0); setSelected(null); setQuizScore(0); setQuizDone(false); setShowExp(false); };

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  // ── Course detail fullscreen ──────────────────────────────────────────────
  if (openLevelId) {
    const lv = levels.find(l => l.id === openLevelId);
    if (!lv) { setOpenLevelId(null); return null; }
    return (
      <SidebarLayout
        items={navItemsBadged} active="market"
        onNavigate={k => { navigateTo(k); setOpenLevelId(null); }}
        accentGradient="from-blue-500 to-cyan-500" accentText="text-blue-500"
      >
        <CourseDetail
          level={lv}
          lessons={lessons}
          progress={progress}
          enrollments={enrollments}
          onBack={() => setOpenLevelId(null)}
          onEnroll={() => enroll(lv.id)}
          onComplete={completeLesson}
        />
      </SidebarLayout>
    );
  }

  // ── New Course detail view ──────────────────────────────────────────────
  if (openCourseId && showCourseForum) {
    const course = courses.find(c => c.id === openCourseId);
    if (!course) { setShowCourseForum(false); return null; }
    return (
      <CourseForum
        courseId={course.id}
        courseTitle={course.title}
        onBack={() => setShowCourseForum(false)}
      />
    );
  }

  if (openCourseId) {
    const course = courses.find(c => c.id === openCourseId);
    if (!course) { setOpenCourseId(null); return null; }
    return (
      <SidebarLayout
        items={navItemsBadged} active={courseSourcePage}
        onNavigate={k => { navigateTo(k); setOpenCourseId(null); }}
        accentGradient="from-rose-500 to-pink-600" accentText="text-rose-500"
      >
        <CourseDetailView
          course={course}
          userId={user!.id}
          isEnrolled={courseEnrollments.some(e => e.course_id === course.id)}
          onBack={() => setOpenCourseId(null)}
          onEnroll={async () => {
            const { data } = await supabase
              .from('course_enrollments')
              .insert({ student_id: user!.id, course_id: course.id })
              .select()
              .maybeSingle();
            if (data) {
              setCourseEnrollments(p => [...p, data]);
              logActivity({
                action: 'course_enroll',
                description: `Enrolled in "${course.title}"`,
                page: 'my-courses',
                metadata: { course_id: course.id },
              });
            }
          }}
          onOpenForum={() => setShowCourseForum(true)}
        />
      </SidebarLayout>
    );
  }

  // ── Quiz fullscreen view ──────────────────────────────────────────────────
  if (openQuizId) {
    const quiz = quizzes.find(q => q.id === openQuizId);
    const questions = quizQuestions.filter(q => q.quiz_id === openQuizId);
    const options = quizOptions.filter(o => questions.some(q => q.id === o.question_id));

    if (!quiz || questions.length === 0) {
      setOpenQuizId(null);
      return null;
    }

    return (
      <SidebarLayout
        items={navItemsBadged} active="interactive-quizzes"
        onNavigate={k => { navigateTo(k); setOpenQuizId(null); }}
        accentGradient="from-violet-500 to-purple-600" accentText="text-violet-500"
      >
        <QuizContainer
          quiz={quiz}
          questions={questions}
          options={options}
          userId={user!.id}
          onComplete={(score, maxScore, xpEarned) => {
            gamification.awardXP(xpEarned, `Quiz: ${quiz.title}`, 'quiz', quiz.id);
            // Refetch attempts
            supabase
              .from('quiz_attempts')
              .select('*')
              .eq('student_id', user!.id)
              .then(({ data }) => {
                if (data) setQuizAttempts(data as QuizAttempt[]);
              });
          }}
          onBack={() => setOpenQuizId(null)}
        />
      </SidebarLayout>
    );
  }

  // ── Main layout ───────────────────────────────────────────────────────────
  return (
    <SidebarLayout
      items={navItemsBadged} active={page}
      onNavigate={k => { navigateTo(k); setSelectedProgressEnrollment(null); }}
      accentGradient="from-blue-500 to-cyan-500" accentText="text-blue-500"
      bottomNavItems={navItemsBadged}
      showBottomNav={true}
    >
      <div className="p-5 sm:p-7 max-w-5xl mx-auto">

        {/* ── OVERVIEW ────────────────────────────────────────────── */}
        {page === 'overview' && (
          <div className="space-y-6 sm:space-y-8 animate-fadeInUp">
            {/* ── Hero Greeting ─────────────────────────────────────────── */}
            <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-blue-500 to-cyan-500 rounded-3xl p-5 sm:p-7 text-white shadow-xl shadow-blue-200/50">
              <div className="absolute inset-0 dot-grid opacity-10 pointer-events-none" />
              <div className="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute -bottom-12 left-1/4 w-44 h-44 bg-cyan-400/20 rounded-full blur-2xl pointer-events-none" />

              <div className="relative flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-white/20 border border-white/20 flex items-center justify-center shadow-inner">
                  <GraduationCap size={24} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-blue-100 text-[11px] font-semibold uppercase tracking-wider">Good day!</p>
                  <h1 className="font-display text-xl sm:text-2xl font-bold leading-tight truncate">
                    Welcome back,{' '}
                    <span className="text-cyan-200">{profile?.full_name?.split(' ')[0] ?? 'Learner'}</span>!
                  </h1>
                </div>
              </div>

              <p className="relative text-blue-100/80 mt-3 text-sm">Continue your learning journey today.</p>

              <div className="relative flex flex-wrap gap-2 mt-4">
                <button
                  onClick={() => setPage('my-courses')}
                  className="flex items-center gap-2 bg-white text-blue-600 font-semibold text-sm px-4 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all"
                >
                  <Play size={14} className="fill-blue-600" /> Continue Learning
                </button>
                <button
                  onClick={() => setPage('market')}
                  className="flex items-center gap-2 bg-white/15 backdrop-blur-sm border border-white/20 text-white font-semibold text-sm px-4 py-2.5 rounded-xl hover:bg-white/25 transition-colors"
                >
                  <BookOpen size={14} /> Browse Courses
                </button>
              </div>

              {/* Overall progress bar */}
              <div className="relative mt-5 pt-4 border-t border-white/20">
                <div className="flex justify-between text-[11px] text-blue-100/80 mb-1.5">
                  <span className="font-medium">Overall Progress</span>
                  <span className="font-bold">{overallPct}%</span>
                </div>
                <div className="h-2 bg-white/20 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-white/70 to-cyan-200 rounded-full transition-all duration-700"
                    style={{ width: `${overallPct}%` }}
                  />
                </div>
                <p className="text-blue-100/50 text-[10px] mt-1.5">{completedCount} of {lessons.length} lessons completed</p>
              </div>
            </div>

            {/* ── Streak At-Risk Banner ─────────────────────────────────── */}
            {gamification.streakAtRisk && gamification.stats && gamification.stats.streak_days > 0 && (
              <div className="flex items-center gap-4 bg-gradient-to-r from-amber-400 to-orange-400 rounded-2xl px-5 py-4 shadow-lg shadow-amber-200/50 animate-fadeInUp">
                <div className="flex-shrink-0">
                  <div className="relative">
                    <Flame size={32} className="text-white drop-shadow" />
                    <span className="absolute -top-1 -right-1 flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-white" />
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-white text-sm">
                    Your {gamification.stats.streak_days}-day streak is at risk!
                  </p>
                  <p className="text-amber-100 text-xs mt-0.5">
                    You haven't studied yet today — complete a lesson or quiz to keep it alive.
                  </p>
                </div>
                <button
                  onClick={() => setPage('my-courses')}
                  className="flex-shrink-0 bg-white/20 hover:bg-white/30 text-white font-semibold text-xs px-4 py-2 rounded-xl transition-colors border border-white/30"
                >
                  Study Now
                </button>
              </div>
            )}

            {/* ── Unified Stats Grid ────────────────────────────────────── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {[
                { icon: CheckCircle,   label: 'Lessons Done',     value: completedCount,                       g: 'from-emerald-400 to-teal-500',   bg: 'bg-emerald-50',  border: 'border-emerald-100', text: 'text-emerald-700' },
                { icon: TrendingUp,    label: 'Overall Progress',  value: `${overallPct}%`,                     g: 'from-blue-400 to-blue-600',      bg: 'bg-blue-50',     border: 'border-blue-100',    text: 'text-blue-700' },
                { icon: Flame,         label: 'Day Streak',        value: `${streak}d`,                          g: 'from-orange-400 to-red-500',     bg: 'bg-orange-50',   border: 'border-orange-100',  text: 'text-orange-700' },
                { icon: GraduationCap, label: 'Courses Enrolled',  value: enrolledCourses.length,               g: 'from-violet-400 to-purple-600',  bg: 'bg-violet-50',   border: 'border-violet-100',  text: 'text-violet-700' },
              ].map((s, i) => (
                <div
                  key={s.label}
                  className={`${s.bg} rounded-2xl p-4 sm:p-5 border ${s.border} shadow-sm hover:-translate-y-0.5 hover:shadow-md transition-all stat-card`}
                  style={{ animationDelay: `${i * 0.07}s` }}
                >
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.g} flex items-center justify-center mb-3 shadow-sm`}>
                    <s.icon size={18} className="text-white" strokeWidth={2} />
                  </div>
                  <div className={`text-2xl sm:text-3xl font-black ${s.text}`}>{s.value}</div>
                  <div className="text-xs text-slate-500 font-medium mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>

            {/* ── Two-column: Achievements + XP/Level ────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-400 to-purple-600 flex items-center justify-center">
                      <Trophy size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800 text-sm">Achievements</p>
                      <p className="text-xs text-slate-500">{gamification.userAchievements.length} of {gamification.achievements.length} badges earned</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPage('achievements')}
                    className="text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1"
                  >
                    <Sparkles size={12} /> View All
                  </button>
                </div>
                <XPLevelBar stats={gamification.stats} />
              </div>

              <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                <StreakDisplay stats={gamification.stats} atRisk={gamification.streakAtRisk} />
              </div>
            </div>

            {/* ── Leaderboard ────────────────────────────────────────────── */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-6 rounded-full bg-gradient-to-b from-amber-400 to-orange-500" />
                  <h2 className="font-bold text-slate-900 flex items-center gap-2">
                    <Trophy size={16} className="text-amber-500" />
                    Top Learners
                  </h2>
                </div>
                <button
                  onClick={() => setPage('leaderboard')}
                  className="text-sm text-amber-600 font-semibold hover:text-amber-700 flex items-center gap-1 px-3 py-1.5 rounded-xl hover:bg-amber-50 transition-colors"
                >
                  Full Board <ChevronRight size={14} />
                </button>
              </div>
              <Leaderboard limit={5} />
            </div>
          </div>
        )}

        {/* ── COURSE MARKET ─────────────────────────────────────────── */}
        {page === 'market' && (
          <CourseMarketPage
            courses={courses.map(c => {
              const cat = categories.find(cat => cat.id === c.category_id);
              return { ...c, category_name: cat?.name, category_color: cat?.color };
            })}
            courseEnrollments={courseEnrollments}
            myCategoryId={myCategoryId}
            onOpenCourse={(id) => { setCourseSourcePage('market'); setOpenCourseId(id); }}
            onEnroll={async (courseId) => {
              const { error } = await supabase
                .from('course_enrollments')
                .insert({ student_id: user!.id, course_id: courseId });
              if (!error) {
                setCourseEnrollments(prev => [...prev, { student_id: user!.id, course_id: courseId, enrolled_at: new Date().toISOString() }]);
                logActivity({
                  action: 'course_enroll',
                  description: `Enrolled in course`,
                  page: 'market',
                  metadata: { course_id: courseId },
                });
                setToast('success');
                setTimeout(() => setToast(null), 3000);
              }
            }}
          />
        )}

        {/* ── MY COURSES ─────────────────────────────────────────────── */}
        {page === 'my-courses' && (
          <div className="space-y-7 animate-fadeInUp">

            {/* Header */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">My Courses</h1>
                <p className="text-slate-500 mt-1 text-sm">
                  {enrolledCourses.length === 0
                    ? 'No courses enrolled yet'
                    : `${enrolledCourses.length} course${enrolledCourses.length !== 1 ? 's' : ''} enrolled`}
                </p>
              </div>
              <button
                onClick={() => setPage('market')}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-md shadow-blue-200 transition-all hover:-translate-y-0.5 flex-shrink-0"
              >
                <BookOpen size={15} /> Browse More
              </button>
            </div>

            {enrolledCourses.length === 0 ? (
              /* ── Empty state ── */
              <div className="flex flex-col items-center justify-center py-24 bg-white rounded-3xl border border-dashed border-slate-200 text-center px-4">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center mb-5 shadow-inner">
                  <GraduationCap size={36} className="text-blue-400" />
                </div>
                <h2 className="text-lg font-bold text-slate-700 mb-2">No courses enrolled yet</h2>
                <p className="text-sm text-slate-400 max-w-xs mx-auto mb-6">
                  Browse the course catalogue and enroll to start your learning journey.
                </p>
                <button
                  onClick={() => setPage('market')}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-semibold rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl transition-all hover:-translate-y-0.5"
                >
                  Browse Courses <ArrowRight size={16} />
                </button>
              </div>
            ) : (
              /* ── Enrolled courses grid ── */
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {enrolledCourses.map(course => {
                  const cover = course.thumbnail_url || 'https://images.pexels.com/photos/301926/pexels-photo-301926.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop';
                  const enr = courseEnrollments.find((e: any) => e.course_id === course.id);
                  const enrolledDate = enr?.enrolled_at
                    ? new Date(enr.enrolled_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    : null;

                  const diffBadge =
                    course.difficulty_level === 'Beginner' ? 'bg-emerald-100 text-emerald-700' :
                    course.difficulty_level === 'Intermediate' ? 'bg-blue-100 text-blue-700' :
                    'bg-rose-100 text-rose-700';

                  return (
                    <div
                      key={course.id}
                      onClick={() => { setCourseSourcePage('my-courses'); setOpenCourseId(course.id); }}
                      className="group bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 cursor-pointer"
                    >
                      {/* Thumbnail */}
                      <div className="relative h-44 overflow-hidden">
                        <img
                          src={cover}
                          alt={course.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />

                        {/* Enrolled badge */}
                        <div className="absolute top-3 left-3">
                          <span className="flex items-center gap-1 text-[11px] font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-full shadow">
                            <CheckCircle size={10} /> Enrolled
                          </span>
                        </div>

                        {/* Difficulty badge */}
                        <div className="absolute top-3 right-3">
                          <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full shadow ${diffBadge}`}>
                            {course.difficulty_level || 'All Levels'}
                          </span>
                        </div>

                        {/* Title on image */}
                        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
                          <h3 className="font-black text-white text-base leading-tight line-clamp-2 drop-shadow-sm">
                            {course.title}
                          </h3>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-4">
                        {course.description && (
                          <p className="text-xs text-slate-500 line-clamp-2 mb-3 leading-relaxed">
                            {course.description}
                          </p>
                        )}

                        <div className="flex items-center gap-2 flex-wrap mb-4">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                            course.pricing_model === 'free' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                          }`}>
                            {course.pricing_model === 'free' ? 'Free' : `Premium · ${Number(course.price || 0).toFixed(2)}`}
                          </span>
                          {enrolledDate && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <Clock size={10} /> {enrolledDate}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={e => { e.stopPropagation(); setCourseSourcePage('my-courses'); setOpenCourseId(course.id); }}
                          className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md shadow-blue-100 group-hover:shadow-blue-200"
                        >
                          <Play size={13} className="fill-white" />
                          Continue Learning
                          <ArrowRight size={14} className="ml-auto group-hover:translate-x-0.5 transition-transform" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── PROGRESS ─────────────────────────────────────────────── */}
        {page === 'progress' && selectedProgressEnrollment && (
          <StudentCourseProgress
            enrollment={selectedProgressEnrollment}
            onBack={() => setSelectedProgressEnrollment(null)}
          />
        )}

        {page === 'progress' && !selectedProgressEnrollment && (
          <StudentProgressPage
            userId={user!.id}
            onSelectCourse={setSelectedProgressEnrollment}
          />
        )}

        {/* ── LEADERBOARD ─────────────────────────────────────────────── */}
        {page === 'leaderboard' && (
          <LeaderboardPage userId={user!.id} />
        )}

        {/* ── LIVE ARENA ─────────────────────────────────────────────── */}
        {page === 'arena' && (
          <StudentArenaPage userId={user!.id} />
        )}

        {/* ── COMMUNITY CHAT ─────────────────────────────────────────────── */}
        {page === 'forum' && (
          <ForumPage onBack={() => setPage('overview')} />
        )}

        {/* ── PROFILE ─────────────────────────────────────────────── */}
        {page === 'certificates' && (
          <StudentCertificatesPage
            onViewCertificate={setViewingCertificate}
          />
        )}

        {page === 'profile' && (
          <StudentProfilePage
            profile={profile}
            stats={gamification.stats}
            achievements={gamification.achievements}
            userAchievements={gamification.userAchievements}
            completedLessons={completedCount}
            totalLessons={lessons.length}
            enrolledCourses={enrolledCourses.length}
          />
        )}

      </div>

      {/* Gamification Modals */}
      {gamification.levelUpData && (
        <LevelUpModal
          level={gamification.levelUpData.level}
          xpGained={gamification.levelUpData.xpGained}
          onClose={gamification.clearLevelUp}
        />
      )}
      {gamification.newAchievement && (
        <AchievementToast
          achievement={gamification.newAchievement}
          onClose={gamification.clearAchievement}
        />
      )}
      {gamification.xpPopup && (
        <XPGainPopup amount={gamification.xpPopup.amount} reason={gamification.xpPopup.reason} />
      )}

      {/* Certificate modal */}
      {viewingCertificate && (
        <CourseCertificate
          studentName={profile?.full_name ?? user?.user_metadata?.full_name ?? 'Student'}
          courseTitle={viewingCertificate.courseTitle}
          completedAt={viewingCertificate.completion.completed_at}
          certificateId={viewingCertificate.completion.certificate_id}
          onClose={() => setViewingCertificate(null)}
        />
      )}
    </SidebarLayout>
  );
}
