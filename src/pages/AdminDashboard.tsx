import { useEffect, useState, useRef } from 'react';
import {
  LayoutDashboard, Users, BookOpen, Shield, TrendingUp, Activity,
  CheckCircle, Search, UserX, BarChart2, Layers, Settings,
  GraduationCap, ChevronRight, Eye, EyeOff, Trash2,
  MoreVertical, Clock, FileText, AlertTriangle, X, Save,
  Crown, GraduationCap as StudentIcon,
  RefreshCw, Edit3, Plus, GripVertical, ChevronLeft, Copy, Monitor,
  Upload, Globe, Lock, BookMarked, Video, Paperclip, Image,
  UserPlus, Download, FileSpreadsheet,
  Bold, Italic, Underline, List, AlignLeft, AlignCenter, AlignRight, Link,
  ListOrdered, Quote, Link2Off, Minus, Code, Table2, ChevronDown, Sparkles,
  Folder, Tag, FolderOpen, HelpCircle, AlertCircle,
  Mic, MicOff, Headphones, Volume2, StopCircle, ChevronUp,
  Swords, PieChart, LineChart, ArrowUpRight, ArrowDownRight, Calendar, Target, Award, Flame,
  MessageSquare,
  MessageCircle,
  Settings2, Eraser, Loader2,
} from 'lucide-react';
import SidebarLayout, { NavItem } from '../components/SidebarLayout';
import { useAuth } from '../lib/AuthContext';
import { supabase, Profile } from '../lib/supabase';
import AdminStudentProgress from './AdminStudentProgress';
import ForumPage from './ForumPage';
import { AdminSMSPanel } from '../components/CourseForum';
import { AdminWhatsAppPanel } from '../components/AdminWhatsAppPanel';
import { AdminArenaPage } from './AdminArenaPage';
import { AdminAnalyticsPage } from '../components/AdminAnalyticsPage';
import AdminActivityReport from './AdminActivityReport';
import { notifyLessonPublished } from '../lib/notifications';
import { smsNewLessonByLevelId, smsNewQuiz, smsAdminBlast } from '../lib/sms';

type AdminPage = 'overview' | 'users' | 'content' | 'courses' | 'categories' | 'progress' | 'activity' | 'arena' | 'analytics' | 'settings' | 'forum';
type CourseBuilderStep = 1 | 2 | 3;

const LEVEL_META: Record<string, {
  gradient: string; lightBg: string; textColor: string;
  badgeClass: string; border: string; cover: string; emoji: string;
}> = {
  elementary:           { gradient: 'from-emerald-500 to-teal-600',  lightBg: 'bg-emerald-50', textColor: 'text-emerald-700', badgeClass: 'bg-emerald-100 text-emerald-700', border: 'border-emerald-200', cover: 'https://images.pexels.com/photos/256395/pexels-photo-256395.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop',    emoji: '🌱' },
  'pre-intermediate':   { gradient: 'from-sky-500 to-blue-600',      lightBg: 'bg-blue-50',    textColor: 'text-blue-700',    badgeClass: 'bg-blue-100 text-blue-700',    border: 'border-blue-200',    cover: 'https://images.pexels.com/photos/159711/books-bookstore-book-reading-159711.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop', emoji: '📖' },
  intermediate:         { gradient: 'from-violet-500 to-purple-700', lightBg: 'bg-violet-50',  textColor: 'text-violet-700',  badgeClass: 'bg-violet-100 text-violet-700', border: 'border-violet-200',  cover: 'https://images.pexels.com/photos/301926/pexels-photo-301926.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop',              emoji: '⚡' },
  'upper-intermediate': { gradient: 'from-amber-500 to-orange-600',  lightBg: 'bg-amber-50',   textColor: 'text-amber-700',   badgeClass: 'bg-amber-100 text-amber-700',   border: 'border-amber-200',   cover: 'https://images.pexels.com/photos/267669/pexels-photo-267669.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop',              emoji: '🚀' },
  advanced:             { gradient: 'from-rose-500 to-red-700',      lightBg: 'bg-rose-50',    textColor: 'text-rose-700',    badgeClass: 'bg-rose-100 text-rose-700',     border: 'border-rose-200',    cover: 'https://images.pexels.com/photos/1438072/pexels-photo-1438072.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop',            emoji: '🏆' },
};

const navItems: NavItem[] = [
  { key: 'overview',  label: 'Overview',       icon: LayoutDashboard },
  { key: 'analytics', label: 'Analytics',      icon: BarChart2 },
  { key: 'users',     label: 'Users',          icon: Users },
  { key: 'content',   label: 'Content',        icon: BookOpen },
  { key: 'courses',   label: 'Course Builder', icon: Layers },
  { key: 'categories',label: 'Categories',      icon: Folder },
  { key: 'progress',  label: 'Student Progress', icon: TrendingUp },
  { key: 'activity',  label: 'Activity Report',  icon: Activity },
  { key: 'arena',     label: 'Live Arena',     icon: Swords },
  { key: 'forum',     label: 'Community Chat', icon: MessageSquare },
  { key: 'whatsapp', label: 'WhatsApp',      icon: MessageCircle },
  { key: 'settings',  label: 'Settings',       icon: Settings },
];

interface LessonRow {
  id: string; title: string; is_published: boolean;
  level_key: string; level_label: string; level_id: string;
  teacher_name: string; duration_minutes: number; created_at: string;
  description: string;
}
interface LevelRow {
  id: string; key: string; label: string; description: string;
  sort_order: number; lesson_count: number; published_count: number;
}
interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string;
  color: string;
  sort_order: number;
  course_count: number;
  user_count: number;
}
interface CourseRow {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  pricing_model: string;
  price: number | null;
  visibility: string;
  difficulty_level: string;
  is_published: boolean;
  created_at: string;
  topic_count: number;
}

interface CourseFormData {
  title: string;
  description: string;
  thumbnail_url: string;
  intro_video_url: string;
  pricing_model: 'free' | 'paid';
  price: number;
  visibility: 'public' | 'private';
  difficulty_level: string;
  is_public: boolean;
  tags: string;
  category_id: string | null;
  what_will_learn: string;
  target_audience: string;
  duration_hours: number;
  duration_minutes_extra: number;
  materials_included: string;
  requirements: string;
}

interface TopicItem {
  tempId: string;
  type: 'lesson' | 'quiz' | 'assignment';
  title: string;
  editing: boolean;
  content: string;
  featured_image_url: string;
  video_url: string;
  video_hours: number;
  video_minutes: number;
  video_seconds: number;
  attachments: { name: string; url: string; size: string }[];
  quiz_id?: string | null;
  display_mode: 'classic' | 'interactive';
}

// ── Quiz Builder types ────────────────────────────────────────────────────────
interface QBOption {
  tempId: string;
  text: string;
  isCorrect: boolean;
  matchKey: string;
}

interface QBQuestion {
  tempId: string;
  dbId?: string;
  type: 'multiple_choice' | 'fill_blank' | 'matching_pair' | 'listening' | 'listen_write' | 'flash_card';
  questionText: string;
  explanation: string;
  hint: string;
  points: number;
  options: QBOption[];
  correctText: string;
  audioUrl: string;
  audioMode: 'url' | 'record' | 'tts';
  ttsText: string;
}

interface CurriculumTopic {
  tempId: string;
  title: string;
  summary: string;
  editing: boolean;
  items: TopicItem[];
}

// ── Shared ActionMenu ────────────────────────────────────────────────────────
interface ActionItem {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
  disabled?: boolean;
}
function ActionMenu({ items, align = 'right' }: { items: ActionItem[]; align?: 'right' | 'left' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        className="w-8 h-8 rounded-xl flex items-center justify-center bg-white/90 backdrop-blur-sm border border-slate-200 shadow-sm hover:bg-white hover:shadow-md transition-all text-slate-600"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} top-10 w-56 bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden z-50`}
          style={{ animation: 'fadeInUp 0.12s ease' }}
        >
          {items.map((item, i) => (
            <div key={i}>
              {item.divider && i > 0 && <div className="h-px bg-slate-100 mx-3 my-0.5" />}
              <button
                onClick={() => { if (!item.disabled) { item.onClick(); setOpen(false); } }}
                disabled={item.disabled}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium transition-colors text-left ${
                  item.disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : item.danger
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <item.icon size={15} className={item.disabled ? 'text-slate-300' : item.danger ? 'text-red-500' : 'text-slate-400'} />
                {item.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Delete confirm modal ─────────────────────────────────────────────────────
function DeleteModal({ title, body, onConfirm, onCancel }: { title: string; body: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl p-6 text-center">
        <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={26} className="text-red-500" />
        </div>
        <h2 className="font-bold text-slate-900 text-lg mb-1">{title}</h2>
        <p className="text-slate-500 text-sm mb-6">{body}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 border border-slate-200 text-slate-700 font-semibold rounded-xl hover:bg-slate-50 text-sm transition-colors">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-xl text-sm transition-colors">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Edit Lesson Modal ────────────────────────────────────────────────────────
function EditLessonModal({ lesson, levels, onSave, onClose }: {
  lesson: LessonRow;
  levels: LevelRow[];
  onSave: (id: string, data: { title: string; description: string; duration_minutes: number; level_id: string; is_published: boolean }) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: lesson.title,
    description: lesson.description,
    duration_minutes: lesson.duration_minutes,
    level_id: lesson.level_id,
    is_published: lesson.is_published,
  });
  const [saving, setSaving] = useState(false);
  const handleSave = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    await onSave(lesson.id, { ...form, title: form.title.trim() });
    setSaving(false);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">Edit Lesson</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Title</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Level</label>
            <select value={form.level_id} onChange={e => setForm(f => ({ ...f, level_id: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition bg-white">
              {levels.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3} className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Duration (min)</label>
              <input type="number" min={5} max={120} value={form.duration_minutes}
                onChange={e => setForm(f => ({ ...f, duration_minutes: +e.target.value }))}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, is_published: !f.is_published }))}
                  className={`w-10 h-6 rounded-full transition-colors relative cursor-pointer ${form.is_published ? 'bg-emerald-500' : 'bg-slate-200'}`}
                >
                  <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.is_published ? 'left-4' : 'left-0.5'}`} />
                </div>
                <span className="text-sm font-medium text-slate-700">Published</span>
              </label>
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
            <Save size={14} />{saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Edit User Modal ────────────────────────────────────────────────────────────
function EditUserModal({ user, categories, onSave, onClose }: {
  user: Profile;
  categories: CategoryRow[];
  onSave: (id: string, data: { full_name: string; role: UserRole; category_id: string | null; email: string | null; phone_number: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    full_name: user.full_name,
    role: user.role,
    category_id: user.category_id || null,
    email: user.email || '',
    phone_number: user.phone_number || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.full_name.trim()) return;
    setSaving(true);
    await onSave(user.id, {
      full_name: form.full_name.trim(),
      role: form.role,
      category_id: form.category_id,
      email: form.email.trim() || null,
      phone_number: form.phone_number.trim() || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">Edit User</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Full Name <span className="text-rose-500">*</span></label>
            <input value={form.full_name} onChange={set('full_name')} placeholder="Enter full name"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Role</label>
            <select value={form.role} onChange={set('role')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition bg-white">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Category <span className="text-slate-400 font-normal">(optional)</span></label>
            <select value={form.category_id || ''} onChange={e => setForm(f => ({ ...f, category_id: e.target.value || null }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition bg-white">
              <option value="">No Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={form.email} onChange={set('email')} type="email" placeholder="user@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Phone Number <span className="text-slate-400 font-normal">(optional)</span></label>
            <input value={form.phone_number} onChange={set('phone_number')} type="tel" placeholder="+252611234567"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition" />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
            <Save size={14} />{saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateUserModal({ categories, onSave, onClose }: {
  categories: CategoryRow[];
  onSave: (data: { full_name: string; role: UserRole; category_id: string | null; email: string | null; phone_number: string | null }) => Promise<void>;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    full_name: '',
    role: 'student' as UserRole,
    category_id: null as string | null,
    email: '',
    phone_number: '',
  });
  const [saving, setSaving] = useState(false);

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }));

  const handleSave = async () => {
    if (!form.full_name.trim()) return;
    setSaving(true);
    await onSave({
      full_name: form.full_name.trim(),
      role: form.role,
      category_id: form.category_id,
      email: form.email.trim() || null,
      phone_number: form.phone_number.trim() || null,
    });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center">
              <UserPlus size={16} className="text-rose-600" />
            </div>
            <h2 className="font-bold text-slate-900 text-lg">Create User</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
            <X size={18} className="text-slate-500" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          {/* Full Name */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              value={form.full_name}
              onChange={set('full_name')}
              placeholder="Enter full name"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
            />
          </div>
          {/* Role */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Role</label>
            <select
              value={form.role}
              onChange={set('role')}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition bg-white"
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          {/* Category */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Category <span className="text-slate-400 font-normal">(optional)</span></label>
            <select
              value={form.category_id || ''}
              onChange={e => setForm(f => ({ ...f, category_id: e.target.value || null }))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition bg-white"
            >
              <option value="">No Category</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>
          {/* Email */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Email <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="email"
              value={form.email}
              onChange={set('email')}
              placeholder="user@example.com"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
            />
          </div>
          {/* Phone Number */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Phone Number <span className="text-slate-400 font-normal">(optional)</span></label>
            <input
              type="tel"
              value={form.phone_number}
              onChange={set('phone_number')}
              placeholder="+1 555 000 0000"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition"
            />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.full_name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <UserPlus size={14} />{saving ? 'Creating…' : 'Create User'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Category Form Modal ──────────────────────────────────────────────────────
const CATEGORY_COLORS = [
  { label: 'Blue', value: 'from-blue-500 to-cyan-500' },
  { label: 'Purple', value: 'from-purple-500 to-violet-600' },
  { label: 'Green', value: 'from-emerald-500 to-teal-600' },
  { label: 'Orange', value: 'from-amber-500 to-orange-600' },
  { label: 'Red', value: 'from-rose-500 to-red-600' },
  { label: 'Indigo', value: 'from-indigo-500 to-blue-600' },
];

function CategoryFormModal({ category, onSave, onClose }: {
  category?: CategoryRow | null;
  onSave: (data: { name: string; slug: string; description: string; icon: string; color: string; sort_order: number }) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    name: category?.name || '',
    slug: category?.slug || '',
    description: category?.description || '',
    icon: category?.icon || 'Tag',
    color: category?.color || 'from-blue-500 to-cyan-500',
    sort_order: category?.sort_order || 0,
  });
  const [saving, setSaving] = useState(false);

  const slugify = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const slug = form.slug.trim() || slugify(form.name);
    onSave({ ...form, name: form.name.trim(), slug });
    setSaving(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-lg">{category ? 'Edit Category' : 'Add Category'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors"><X size={18} className="text-slate-500" /></button>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Introduction to Business"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition" />
            </div>
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-1.5">Slug</label>
              <input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))}
                placeholder="auto-generated"
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition" />
            </div>
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Optional description"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 transition resize-none" />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-2">Color</label>
            <div className="grid grid-cols-6 gap-2">
              {CATEGORY_COLORS.map(c => (
                <button key={c.value} type="button"
                  onClick={() => setForm(f => ({ ...f, color: c.value }))}
                  className={`w-full h-8 rounded-lg bg-gradient-to-r ${c.value} transition-all ${form.color === c.value ? 'ring-2 ring-rose-500 ring-offset-2' : ''}`}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving || !form.name.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors">
            <Save size={14} />{saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Lesson Card ──────────────────────────────────────────────────────────────
function AdminLessonCard({ lesson, onToggle, onEdit, onDelete }: {
  lesson: LessonRow;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const m = LEVEL_META[lesson.level_key] ?? LEVEL_META['elementary'];
  const menuItems: ActionItem[] = [
    { icon: Edit3,                                    label: 'Edit Lesson',                  onClick: onEdit },
    { icon: lesson.is_published ? EyeOff : Eye,       label: lesson.is_published ? 'Move to Draft' : 'Publish', onClick: onToggle, divider: true },
    { icon: Trash2,                                   label: 'Delete Lesson',                onClick: onDelete, danger: true, divider: true },
  ];
  return (
    <div className="group bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300">
      <div className="relative h-36 overflow-hidden">
        <img src={m.cover} alt={lesson.level_label} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-20`} />
        <div className="absolute top-3 left-3">
          {lesson.is_published ? (
            <span className="flex items-center gap-1 text-xs font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Live
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-white bg-amber-500 px-2.5 py-1 rounded-full">
              <FileText size={10} /> Draft
            </span>
          )}
        </div>
        <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity lg:block">
          <ActionMenu items={menuItems} />
        </div>
        <div className="lg:hidden absolute top-3 right-3">
          <ActionMenu items={menuItems} />
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-2.5 flex items-center gap-1.5">
          <span className="text-base">{m.emoji}</span>
          <span className="text-white/60 text-xs">{lesson.level_label}</span>
        </div>
      </div>
      <div className="p-4">
        <h3 className="font-bold text-slate-900 text-sm leading-snug mb-1 line-clamp-2">{lesson.title}</h3>
        <p className="text-xs text-slate-400 mb-3 line-clamp-1">By {lesson.teacher_name}</p>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="flex items-center gap-1"><Clock size={11} /> {lesson.duration_minutes}m</span>
          <span className={`px-2 py-0.5 rounded-full font-medium ${m.badgeClass}`}>{lesson.level_label}</span>
        </div>
      </div>
    </div>
  );
}

// ── User Action Menu ─────────────────────────────────────────────────────────
function UserActionMenu({ user, onChangeRole, onEdit, onDelete }: {
  user: Profile;
  onChangeRole: (role: string) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const items: ActionItem[] = [
    { icon: Edit3,       label: 'Edit User',      onClick: onEdit },
    { icon: StudentIcon, label: 'Set as Student', onClick: () => onChangeRole('student'), divider: true },
    { icon: BookOpen,    label: 'Set as Teacher', onClick: () => onChangeRole('teacher') },
    { icon: Crown,       label: 'Set as Admin',   onClick: () => onChangeRole('admin') },
    { icon: Trash2,      label: 'Delete User',    onClick: onDelete, danger: true, divider: true },
  ].filter(item => {
    if (item.label === 'Set as Student' && user.role === 'student') return false;
    if (item.label === 'Set as Teacher' && user.role === 'teacher') return false;
    if (item.label === 'Set as Admin'   && user.role === 'admin')   return false;
    return true;
  });
  return <ActionMenu items={items} />;
}

// ── Course Card ──────────────────────────────────────────────────────────────
function CourseCard({ course, onEdit, onDelete, onTogglePublish, onPreview }: {
  course: CourseRow;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePublish: () => void;
  onPreview: () => void;
}) {
  const cover = course.thumbnail_url || 'https://images.pexels.com/photos/301926/pexels-photo-301926.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop';
  const menuItems: ActionItem[] = [
    { icon: Edit3,    label: 'Edit Course',   onClick: onEdit },
    { icon: Monitor,  label: 'Student View',  onClick: onPreview, divider: true },
    { icon: course.is_published ? EyeOff : Eye, label: course.is_published ? 'Unpublish' : 'Publish', onClick: onTogglePublish },
    { icon: Trash2,   label: 'Delete Course', onClick: onDelete, danger: true, divider: true },
  ];
  return (
    /* overflow-visible so the ActionMenu dropdown is never clipped */
    <div
      className="group relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all duration-300 cursor-pointer"
      onClick={onEdit}
    >
      {/* Image — keeps its own overflow-hidden for zoom effect */}
      <div className="relative h-40 overflow-hidden rounded-t-3xl">
        <img src={cover} alt={course.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/15 to-transparent" />
        <div className="absolute top-3 left-3">
          {course.is_published ? (
            <span className="flex items-center gap-1 text-xs font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-full">
              <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" /> Published
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs font-bold text-white bg-amber-500 px-2.5 py-1 rounded-full">
              <FileText size={10} /> Draft
            </span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
          <h3 className="font-black text-white text-base leading-tight line-clamp-2">{course.title}</h3>
        </div>
      </div>

      {/* 3-dot menu — positioned on the outer card (overflow-visible) so dropdown escapes */}
      <div className="absolute top-3 right-3 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
        <ActionMenu items={menuItems} />
      </div>

      {/* Card body */}
      <div className="p-4">
        {course.description && (
          <p className="text-xs text-slate-500 line-clamp-2 mb-3">{course.description}</p>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-slate-400">
            <Layers size={11} /> {course.topic_count} {course.topic_count === 1 ? 'topic' : 'topics'}
          </span>
          {course.pricing_model === 'free' ? (
            <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">Free</span>
          ) : (
            <span className="text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">Paid · ${Number(course.price || 0).toFixed(2)}</span>
          )}
          {course.visibility === 'public' ? (
            <span className="flex items-center gap-0.5 text-xs text-slate-400"><Globe size={10} /> Public</span>
          ) : (
            <span className="flex items-center gap-0.5 text-xs text-slate-400"><Lock size={10} /> Private</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Lesson Content Modal ─────────────────────────────────────────────────────
function LessonContentModal({ item, topicTitle, onSave, onClose }: {
  item: TopicItem;
  topicTitle: string;
  onSave: (patch: Partial<TopicItem>) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState({
    title: item.title,
    content: item.content,
    featured_image_url: item.featured_image_url,
    video_url: item.video_url,
    video_hours: item.video_hours,
    video_minutes: item.video_minutes,
    video_seconds: item.video_seconds,
    attachments: item.attachments,
    display_mode: item.display_mode ?? 'classic' as 'classic' | 'interactive',
  });
  const editorRef = useRef<HTMLDivElement>(null);
  const imageInputRef  = useRef<HTMLInputElement>(null);
  const videoInputRef  = useRef<HTMLInputElement>(null);
  const attachInputRef = useRef<HTMLInputElement>(null);
  const [editorMode, setEditorMode] = useState<'visual' | 'code'>('visual');
  const [uploading, setUploading] = useState({ image: false, video: false, attachment: false });
  const [menuOpen, setMenuOpen] = useState(false);
  const [showDisplayModeOverlay, setShowDisplayModeOverlay] = useState(false);
  const [showMediaOverlay, setShowMediaOverlay] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const latestContentRef = useRef(form.content);
  latestContentRef.current = form.content;

  // AI config modal state
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiSource, setAiSource] = useState<'title' | 'text' | 'references'>('title');
  const [aiRawText, setAiRawText] = useState('');
  const [aiVideoUrl, setAiVideoUrl] = useState('');
  const [aiCustomPrompt, setAiCustomPrompt] = useState('');

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = form.content;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  const openAiConfig = () => {
    setMenuOpen(false);
    if (!form.title.trim()) {
      setAiError('Enter a lesson Name first, then run AI Lesson Generator.');
      return;
    }
    setAiSource('title');
    setAiRawText('');
    setAiVideoUrl('');
    setAiCustomPrompt('');
    setShowAiConfig(true);
  };

  const executeGeneration = async () => {
    setShowAiConfig(false);
    setGenerating(true);
    setAiError(null);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-lesson`;
      const payload: Record<string, string | undefined> = {
        topic: form.title.trim(),
        level: form.level_label,
        description: form.description,
      };
      if (aiSource === 'text' && aiRawText.trim()) payload.rawText = aiRawText.trim();
      if (aiSource === 'references' && aiVideoUrl.trim()) payload.videoUrl = aiVideoUrl.trim();
      if (aiCustomPrompt.trim()) payload.customInstructions = aiCustomPrompt.trim();

      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Request failed (${res.status})`);
      }
      const data = await res.json();
      if (!data.content || typeof data.content !== 'string') {
        throw new Error(data.error || 'AI response did not contain lesson content.');
      }
      const html = data.content;
      latestContentRef.current = html;
      setForm(f => ({
        ...f,
        content: html,
        description: data.description && !f.description ? data.description : f.description,
      }));
      if (editorRef.current) editorRef.current.innerHTML = html;
    } catch (e: unknown) {
      setAiError(e instanceof Error ? e.message : 'Failed to generate lesson content.');
    } finally {
      setGenerating(false);
    }
  };

  const clearContent = () => {
    setForm(f => ({ ...f, content: '', description: '', featured_image_url: '', video_url: '', video_duration_minutes: 0 }));
    if (editorRef.current) editorRef.current.innerHTML = '';
    setShowClearConfirm(false);
  };

  const syncContent = () => {
    if (editorRef.current) {
      setForm(f => ({ ...f, content: editorRef.current!.innerHTML }));
    }
  };

  const switchMode = (mode: 'visual' | 'code') => {
    if (mode === 'code' && editorRef.current) {
      setForm(f => ({ ...f, content: editorRef.current!.innerHTML }));
    }
    if (mode === 'visual') {
      setTimeout(() => {
        if (editorRef.current) editorRef.current.innerHTML = form.content;
      }, 0);
    }
    setEditorMode(mode);
  };

  const execFormat = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value ?? '');
    editorRef.current?.focus();
    syncContent();
  };

  const uploadToStorage = async (file: File, folder: string): Promise<string | null> => {
    const ext = file.name.split('.').pop() ?? 'bin';
    const path = `${folder}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
    const { data, error } = await supabase.storage.from('lesson-media').upload(path, file);
    if (error || !data) return null;
    const { data: { publicUrl } } = supabase.storage.from('lesson-media').getPublicUrl(data.path);
    return publicUrl;
  };

  const handleImageFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(u => ({ ...u, image: true }));
    const url = await uploadToStorage(file, 'images');
    if (url) setForm(f => ({ ...f, featured_image_url: url }));
    setUploading(u => ({ ...u, image: false }));
    e.target.value = '';
  };

  const handleVideoFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(u => ({ ...u, video: true }));
    const url = await uploadToStorage(file, 'videos');
    if (url) setForm(f => ({ ...f, video_url: url }));
    setUploading(u => ({ ...u, video: false }));
    e.target.value = '';
  };

  const handleAttachFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(u => ({ ...u, attachment: true }));
    const results = await Promise.all(files.map(async file => {
      const url = await uploadToStorage(file, 'attachments');
      const kb = Math.round(file.size / 1024);
      const size = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
      return url ? { name: file.name, url, size } : null;
    }));
    const valid = results.filter(Boolean) as { name: string; url: string; size: string }[];
    if (valid.length) setForm(f => ({ ...f, attachments: [...f.attachments, ...valid] }));
    setUploading(u => ({ ...u, attachment: false }));
    e.target.value = '';
  };

  const removeAttachment = (idx: number) =>
    setForm(f => ({ ...f, attachments: f.attachments.filter((_, i) => i !== idx) }));

  const hasChanges =
    form.title !== item.title ||
    form.content !== item.content ||
    form.featured_image_url !== item.featured_image_url ||
    form.video_url !== item.video_url ||
    form.video_hours !== item.video_hours ||
    form.video_minutes !== item.video_minutes ||
    form.video_seconds !== item.video_seconds ||
    form.attachments.length !== item.attachments.length ||
    form.display_mode !== (item.display_mode ?? 'classic');

  const handleSave = () => {
    const content = editorRef.current ? editorRef.current.innerHTML : form.content;
    onSave({ ...form, content, editing: false });
    onClose();
  };

  const TB_DIVIDER = 'divider';
  const toolbarItems: (typeof TB_DIVIDER | { cmd: string; icon: React.ElementType; title: string; action?: () => void })[] = [
    { cmd: 'bold',                icon: Bold,        title: 'Bold' },
    { cmd: 'italic',              icon: Italic,      title: 'Italic' },
    { cmd: 'underline',           icon: Underline,   title: 'Underline' },
    TB_DIVIDER,
    { cmd: 'insertUnorderedList', icon: List,        title: 'Bullet List' },
    { cmd: 'insertOrderedList',   icon: ListOrdered, title: 'Numbered List' },
    { cmd: 'blockquote',          icon: Quote,       title: 'Blockquote', action: () => execFormat('formatBlock', 'blockquote') },
    TB_DIVIDER,
    { cmd: 'justifyLeft',         icon: AlignLeft,   title: 'Align Left' },
    { cmd: 'justifyCenter',       icon: AlignCenter, title: 'Align Center' },
    { cmd: 'justifyRight',        icon: AlignRight,  title: 'Align Right' },
    TB_DIVIDER,
    { cmd: 'createLink',          icon: Link,        title: 'Link', action: () => { const u = window.prompt('Enter URL:'); if (u) execFormat('createLink', u); } },
    { cmd: 'unlink',              icon: Link2Off,    title: 'Unlink' },
    TB_DIVIDER,
    { cmd: 'insertHorizontalRule',icon: Minus,       title: 'Horizontal Rule' },
    { cmd: 'codeblock',           icon: Code,        title: 'Code', action: () => execFormat('formatBlock', 'pre') },
    { cmd: 'table',               icon: Table2,      title: 'Table' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-[#f0f0f1] animate-fadeIn">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-2.5 bg-[#1d2327] flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {hasChanges && (
            <span className="flex items-center gap-1.5 text-amber-300 text-xs font-semibold flex-shrink-0">
              <AlertTriangle size={11} /> Unsaved Changes
            </span>
          )}
          {hasChanges && <span className="text-white/20 text-sm">|</span>}
          <span className="text-sm text-white/60 truncate">
            Topic: <span className="text-white/90 font-medium">{topicTitle}</span>
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-white/70 border border-white/20 rounded hover:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!form.title.trim()}
            className="px-5 py-1.5 bg-[#2271b1] hover:bg-[#135e96] disabled:opacity-40 text-white text-sm font-semibold rounded transition-colors"
          >
            Save
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">

          {/* ── Left — Name + Content ── */}
          <div className="flex-1 min-w-0 space-y-6 relative">

            {/* Three-dot context menu — top-right, above the Name field */}
            <div className="absolute -top-1 right-0 z-30" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                aria-label="Lesson actions"
                className="w-9 h-9 rounded-lg flex items-center justify-center bg-white hover:bg-gray-50 border border-gray-200 text-gray-600 hover:text-gray-900 shadow-sm transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-xl shadow-xl shadow-gray-300/50 overflow-hidden animate-dropdown">
                  <button
                    onClick={openAiConfig}
                    disabled={generating}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shrink-0">
                      <Sparkles size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">AI Lesson Generator</p>
                      <p className="text-xs text-gray-500">Auto-generate content from the topic</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowDisplayModeOverlay(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shrink-0">
                      <Settings2 size={16} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Display Mode</p>
                      <p className="text-xs text-gray-500">Currently: {form.display_mode === 'classic' ? 'Classic' : 'Interactive'}</p>
                    </div>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 mt-0.5">
                      {form.display_mode === 'classic' ? 'Classic' : 'Interactive'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      setShowMediaOverlay(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left border-t border-gray-100"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shrink-0">
                      <Paperclip size={16} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">Media & Attachments</p>
                      <p className="text-xs text-gray-500">Featured image, video & files</p>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setShowClearConfirm(true);
                      setMenuOpen(false);
                    }}
                    className="w-full flex items-start gap-3 px-4 py-3 hover:bg-rose-50 transition-colors text-left border-t border-gray-100"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500 to-red-500 flex items-center justify-center shrink-0">
                      <Eraser size={16} className="text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-800">Clear Content</p>
                      <p className="text-xs text-gray-500">Reset the editor</p>
                    </div>
                  </button>
                </div>
              )}
            </div>

            {/* Name */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm font-semibold text-gray-800">Name</span>
                <Sparkles size={13} className="text-[#c084fc]" />
              </div>
              <div className="relative">
                <input
                  autoFocus
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Lesson title…"
                  className="w-full px-3 py-2 pr-9 bg-white border border-gray-300 rounded text-sm text-gray-800 shadow-sm focus:outline-none focus:border-[#2271b1] focus:ring-1 focus:ring-[#2271b1]/30 transition"
                />
                {form.title && (
                  <button
                    onClick={() => setForm(f => ({ ...f, title: '' }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="text-sm font-semibold text-gray-800">Content</span>
                <Sparkles size={13} className="text-[#c084fc]" />
              </div>

              <div className="border border-gray-300 rounded bg-white shadow-sm">
                {/* Top row: Add media + Visual/Code tabs */}
                <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-[#f6f7f7]">
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-[#2271b1] border border-[#2271b1] rounded hover:bg-[#2271b1]/8 transition-colors"
                  >
                    <Upload size={11} />
                    Add media
                  </button>
                  <div className="flex">
                    <button
                      onClick={() => switchMode('visual')}
                      className={`px-3 py-1 text-xs font-medium border rounded-l transition-colors ${
                        editorMode === 'visual'
                          ? 'bg-white text-gray-700 border-gray-300 shadow-sm'
                          : 'bg-[#f0f0f1] text-gray-500 border-gray-300 hover:bg-gray-50'
                      }`}
                    >Visual</button>
                    <button
                      onClick={() => switchMode('code')}
                      className={`px-3 py-1 text-xs font-medium border-t border-b border-r rounded-r transition-colors ${
                        editorMode === 'code'
                          ? 'bg-white text-gray-700 border-gray-300 shadow-sm'
                          : 'bg-[#f0f0f1] text-gray-500 border-gray-300 hover:bg-gray-50'
                      }`}
                    >Code</button>
                  </div>
                </div>

                {/* Toolbar (Visual mode only) */}
                {editorMode === 'visual' && (
                  <div className="flex items-center flex-wrap gap-0 px-2 py-1.5 border-b border-gray-200 bg-white">
                    {/* Paragraph format dropdown */}
                    <div className="relative mr-1">
                      <select
                        onChange={e => { execFormat('formatBlock', e.target.value); (e.target as HTMLSelectElement).value = 'p'; }}
                        defaultValue="p"
                        className="appearance-none pl-2 pr-6 py-1 text-xs border border-gray-300 rounded bg-white text-gray-700 focus:outline-none cursor-pointer hover:border-gray-400 transition-colors"
                      >
                        <option value="p">Paragraph</option>
                        <option value="h1">Heading 1</option>
                        <option value="h2">Heading 2</option>
                        <option value="h3">Heading 3</option>
                        <option value="h4">Heading 4</option>
                      </select>
                      <ChevronDown size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
                    </div>

                    {toolbarItems.map((btn, idx) => {
                      if (btn === TB_DIVIDER) {
                        return <div key={`div-${idx}`} className="w-px h-5 bg-gray-200 mx-1 flex-shrink-0" />;
                      }
                      return (
                        <button
                          key={btn.cmd}
                          title={btn.title}
                          type="button"
                          onMouseDown={e => {
                            e.preventDefault();
                            btn.action ? btn.action() : execFormat(btn.cmd);
                          }}
                          className="p-1.5 rounded text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
                        >
                          <btn.icon size={14} />
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Editor area */}
                {editorMode === 'visual' ? (
                  <div
                    ref={editorRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={syncContent}
                    onBlur={syncContent}
                    data-placeholder="Write lesson content here…"
                    className="min-h-[260px] h-auto px-4 py-3 text-sm text-gray-800 focus:outline-none leading-relaxed overflow-visible"
                    style={{ wordBreak: 'break-word' }}
                  />
                ) : (
                  <textarea
                    value={form.content}
                    onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    placeholder="<p>Write HTML content here…</p>"
                    className="w-full min-h-[260px] h-auto px-4 py-3 text-xs text-gray-700 font-mono bg-white focus:outline-none resize-y placeholder-gray-300 overflow-visible"
                  />
                )}

                {/* Resize handle row */}
                <div className="flex justify-end px-2 py-0.5 border-t border-gray-100 bg-white">
                  <svg width="12" height="12" viewBox="0 0 12 12" className="text-gray-300 opacity-60">
                    <path d="M10 2L2 10M10 6L6 10M10 10L10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* AI generating overlay */}
        {generating && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
            <div className="bg-[#1d2327] border border-white/10 rounded-2xl p-8 flex flex-col items-center gap-4 max-w-sm">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center animate-pulse">
                <Sparkles size={26} className="text-white" />
              </div>
              <p className="text-white font-semibold">Generating lesson content...</p>
              <p className="text-sm text-white/50 text-center">The AI is building your lesson from the topic. This takes a few seconds.</p>
              <Loader2 size={20} className="text-violet-400 animate-spin" />
            </div>
          </div>
        )}

        {/* AI error toast */}
        {aiError && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-rose-500/15 border border-rose-500/30 rounded-xl text-rose-300 text-sm max-w-md">
            <AlertCircle size={18} className="shrink-0" />
            <span>{aiError}</span>
            <button onClick={() => setAiError(null)} className="ml-auto p-1 hover:bg-rose-500/20 rounded-lg">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Clear content confirmation */}
        {showClearConfirm && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 rounded-2xl">
            <div className="bg-[#1d2327] border border-white/10 rounded-2xl p-6 max-w-sm w-full mx-4">
              <div className="w-12 h-12 rounded-xl bg-rose-500/15 flex items-center justify-center mb-4">
                <Eraser size={22} className="text-rose-400" />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">Clear all content?</h3>
              <p className="text-sm text-white/50 mb-6">This removes the content, description, featured image, and video URL. The lesson name and settings are kept. This cannot be undone.</p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/80 text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={clearContent}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition-colors"
                >
                  Clear Content
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── AI Lesson Generator Config Modal ── */}
      {showAiConfig && (
        <div className="absolute inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-[2px] p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl flex flex-col animate-fadeIn max-h-[90vh]">
            {/* Modal header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
                  <Sparkles size={18} className="text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-900">Configure AI Lesson Generation</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Topic: <span className="text-gray-600 font-medium">{form.title}</span></p>
                </div>
              </div>
              <button
                onClick={() => setShowAiConfig(false)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">

              {/* 1. Data Source Selection */}
              <div>
                <p className="text-xs font-semibold text-gray-700 mb-3 uppercase tracking-wide">Data Source</p>
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {([
                    { key: 'title', label: 'Lesson Title', icon: BookOpen, desc: 'Use the current lesson title as the topic' },
                    { key: 'text',  label: 'Paste Text',   icon: FileText, desc: 'Paste raw content to reformat into a lesson' },
                    { key: 'references', label: 'References', icon: Globe, desc: 'Add a video URL or file references' },
                  ] as const).map(({ key, label, icon: Icon, desc }) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setAiSource(key)}
                      className={`flex flex-col items-start gap-1.5 p-3 rounded-xl border-2 text-left transition-all ${
                        aiSource === key
                          ? 'border-violet-500 bg-violet-50'
                          : 'border-gray-200 bg-gray-50 hover:border-gray-300'
                      }`}
                    >
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${aiSource === key ? 'bg-violet-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                        <Icon size={14} />
                      </div>
                      <p className={`text-xs font-semibold leading-tight ${aiSource === key ? 'text-violet-700' : 'text-gray-700'}`}>{label}</p>
                      <p className="text-[10px] text-gray-400 leading-snug">{desc}</p>
                    </button>
                  ))}
                </div>

                {/* Source-specific input */}
                {aiSource === 'title' && (
                  <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5">
                    <BookOpen size={14} className="text-gray-400 flex-shrink-0" />
                    <span className="text-sm text-gray-700 font-medium truncate">{form.title}</span>
                    <span className="ml-auto text-[10px] font-semibold text-violet-600 bg-violet-100 px-2 py-0.5 rounded-full flex-shrink-0">Active</span>
                  </div>
                )}

                {aiSource === 'text' && (
                  <textarea
                    value={aiRawText}
                    onChange={e => setAiRawText(e.target.value)}
                    placeholder="Paste the raw content you want the AI to transform into a structured lesson…"
                    rows={6}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 transition resize-none"
                  />
                )}

                {aiSource === 'references' && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">Video URL</label>
                      <div className="flex items-center gap-2 border border-gray-300 rounded-xl px-3 py-2 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-400/20 transition">
                        <Video size={14} className="text-gray-400 flex-shrink-0" />
                        <input
                          type="url"
                          value={aiVideoUrl}
                          onChange={e => setAiVideoUrl(e.target.value)}
                          placeholder="https://youtube.com/watch?v=..."
                          className="flex-1 text-sm text-gray-800 placeholder-gray-400 focus:outline-none bg-transparent"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">File Attachments (PDF, Word, Excel)</label>
                      <div className="flex items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 text-gray-400 cursor-not-allowed bg-gray-50">
                        <Paperclip size={14} className="flex-shrink-0" />
                        <span className="text-xs">File upload via references — coming soon</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Custom AI Instructions */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Custom Prompt / Instructions</p>
                  <span className="text-[10px] text-gray-400 font-normal normal-case tracking-normal">(optional)</span>
                </div>
                <textarea
                  value={aiCustomPrompt}
                  onChange={e => setAiCustomPrompt(e.target.value)}
                  placeholder="e.g., Explain the concept using simple analogies, format using bullet points, create a summary at the end, or follow this specific structure..."
                  rows={4}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm text-gray-800 placeholder-gray-400 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 transition resize-none"
                />
                <p className="text-[10px] text-gray-400 mt-1.5">These instructions will guide how the AI structures and writes the lesson content.</p>
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 flex-shrink-0 gap-3">
              <button
                onClick={() => setShowAiConfig(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={executeGeneration}
                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white text-sm font-semibold rounded-xl shadow-sm shadow-violet-500/30 transition-all"
              >
                <Sparkles size={15} />
                Generate Lesson
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Display Mode sub-page overlay ── */}
      {showDisplayModeOverlay && (
        <div className="absolute inset-0 z-50 bg-[#f0f0f1] flex flex-col animate-fadeIn">
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDisplayModeOverlay(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft size={16} /> Back to editor
              </button>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <Settings2 size={15} className="text-white" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Display Mode</h2>
              </div>
            </div>
            <button
              onClick={() => setShowDisplayModeOverlay(false)}
              className="px-4 py-1.5 bg-[#2271b1] hover:bg-[#135e96] text-white text-sm font-semibold rounded transition-colors"
            >
              Done
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-6">
              <p className="text-sm text-gray-500 mb-6">Choose how students will experience this lesson. Classic shows the full lesson on one page; Interactive reveals it step-by-step with checkpoints.</p>
              <div className="grid sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, display_mode: 'classic' }))}
                  className={`flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-left transition-all ${
                    form.display_mode !== 'interactive'
                      ? 'border-[#2271b1] bg-blue-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${form.display_mode !== 'interactive' ? 'bg-[#2271b1] text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <BookOpen size={18} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${form.display_mode !== 'interactive' ? 'text-[#2271b1]' : 'text-gray-800'}`}>Classic</p>
                    <p className="text-xs text-gray-500 mt-0.5">Full lesson, scroll to read</p>
                  </div>
                  {form.display_mode !== 'interactive' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#2271b1] text-white">Selected</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, display_mode: 'interactive' }))}
                  className={`flex flex-col items-start gap-3 p-5 rounded-xl border-2 text-left transition-all ${
                    form.display_mode === 'interactive'
                      ? 'border-violet-500 bg-violet-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${form.display_mode === 'interactive' ? 'bg-violet-500 text-white' : 'bg-gray-100 text-gray-400'}`}>
                    <Layers size={18} />
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${form.display_mode === 'interactive' ? 'text-violet-700' : 'text-gray-800'}`}>Interactive</p>
                    <p className="text-xs text-gray-500 mt-0.5">Step-by-step with checkpoints</p>
                  </div>
                  {form.display_mode === 'interactive' && (
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-violet-500 text-white">Selected</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Media & Attachments sub-page overlay ── */}
      {showMediaOverlay && (
        <div className="absolute inset-0 z-50 bg-[#f0f0f1] flex flex-col animate-fadeIn">
          <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-gray-200 flex-shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMediaOverlay(false)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded transition-colors"
              >
                <ChevronLeft size={16} /> Back to editor
              </button>
              <span className="text-gray-300">|</span>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
                  <Paperclip size={15} className="text-white" />
                </div>
                <h2 className="text-sm font-semibold text-gray-800">Media & Attachments</h2>
              </div>
            </div>
            <button
              onClick={() => setShowMediaOverlay(false)}
              className="px-4 py-1.5 bg-[#2271b1] hover:bg-[#135e96] text-white text-sm font-semibold rounded transition-colors"
            >
              Done
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-2xl mx-auto p-6 space-y-5">

              {/* Featured Image */}
              <div className="bg-white border border-gray-200 rounded shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Featured Image</p>
                {form.featured_image_url ? (
                  <div className="relative group mb-3">
                    <img src={form.featured_image_url} alt="preview" className="w-full h-40 object-cover rounded" />
                    <button
                      onClick={() => setForm(f => ({ ...f, featured_image_url: '' }))}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={11} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full h-40 border-2 border-dashed border-gray-200 rounded flex flex-col items-center justify-center text-gray-300 mb-3 hover:border-[#2271b1] hover:text-[#2271b1]/50 transition-colors cursor-pointer"
                  >
                    <Image size={28} />
                    <span className="text-xs mt-1.5">Click to upload</span>
                  </div>
                )}
                <input ref={imageInputRef} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="hidden" onChange={handleImageFile} />
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={uploading.image}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-[#2271b1] text-[#2271b1] text-xs font-medium rounded hover:bg-[#2271b1]/5 disabled:opacity-60 transition-colors mb-2"
                >
                  {uploading.image
                    ? <><div className="w-3 h-3 border-2 border-[#2271b1] border-t-transparent rounded-full animate-spin" /> Uploading…</>
                    : <><Upload size={11} /> Upload Image</>
                  }
                </button>
                <input
                  value={form.featured_image_url}
                  onChange={e => setForm(f => ({ ...f, featured_image_url: e.target.value }))}
                  placeholder="Or paste image URL…"
                  className="w-full px-2.5 py-1.5 bg-[#f6f7f7] border border-gray-200 rounded text-xs text-gray-600 focus:outline-none focus:border-[#2271b1] transition"
                />
                <p className="text-[10px] text-gray-400 mt-1">JPEG, PNG, GIF, and WebP formats, up to 512 MB</p>
              </div>

              {/* Video */}
              <div className="bg-white border border-gray-200 rounded shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Video</p>
                {form.video_url ? (
                  <div className="relative group mb-3">
                    <video
                      src={form.video_url}
                      className="w-full h-36 object-cover rounded bg-black"
                      controls={false}
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded">
                      <Video size={28} className="text-white" />
                    </div>
                    <button
                      onClick={() => setForm(f => ({ ...f, video_url: '' }))}
                      className="absolute top-1.5 right-1.5 p-1 bg-black/60 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={11} className="text-white" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => videoInputRef.current?.click()}
                    className="w-full h-36 border-2 border-dashed border-gray-200 rounded flex flex-col items-center justify-center text-gray-300 mb-3 hover:border-[#2271b1] hover:text-[#2271b1]/50 transition-colors cursor-pointer"
                  >
                    <Video size={24} />
                    <span className="text-xs mt-1.5">Click to upload</span>
                  </div>
                )}
                <input ref={videoInputRef} type="file" accept="video/mp4,video/webm" className="hidden" onChange={handleVideoFile} />
                <button
                  type="button"
                  onClick={() => videoInputRef.current?.click()}
                  disabled={uploading.video}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-[#2271b1] text-[#2271b1] text-xs font-medium rounded hover:bg-[#2271b1]/5 disabled:opacity-60 transition-colors mb-2"
                >
                  {uploading.video
                    ? <><div className="w-3 h-3 border-2 border-[#2271b1] border-t-transparent rounded-full animate-spin" /> Uploading…</>
                    : <><Upload size={11} /> Upload Video</>
                  }
                </button>
                <input
                  value={form.video_url}
                  onChange={e => setForm(f => ({ ...f, video_url: e.target.value }))}
                  placeholder="Add from URL…"
                  className="w-full px-2.5 py-1.5 bg-[#f6f7f7] border border-gray-200 rounded text-xs text-gray-600 focus:outline-none focus:border-[#2271b1] transition"
                />
                <p className="text-[10px] text-gray-400 mt-1">MP4, and WebM formats, up to 512 MB</p>
              </div>

              {/* Video Playback Time */}
              <div className="bg-white border border-gray-200 rounded shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Video Playback Time</p>
                <div className="flex items-center gap-2">
                  {([
                    { key: 'video_hours',   max: undefined, label: 'hour' },
                    { key: 'video_minutes', max: 59,        label: 'min' },
                    { key: 'video_seconds', max: 59,        label: 'sec' },
                  ] as const).map(f => (
                    <div key={f.key} className="flex items-center gap-1 flex-1">
                      <input
                        type="number" min={0} max={f.max}
                        value={form[f.key]}
                        onChange={e => setForm(prev => ({ ...prev, [f.key]: Math.max(0, f.max ? Math.min(f.max, +e.target.value) : +e.target.value) }))}
                        className="w-full px-1.5 py-1.5 border border-gray-300 rounded text-xs text-center focus:outline-none focus:border-[#2271b1] transition"
                      />
                      <span className="text-[10px] text-gray-500 flex-shrink-0">{f.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Exercise Files */}
              <div className="bg-white border border-gray-200 rounded shadow-sm p-4">
                <p className="text-xs font-semibold text-gray-700 mb-3">Exercise Files</p>
                {form.attachments.length > 0 && (
                  <div className="mb-3 space-y-1.5">
                    {form.attachments.map((att, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-[#f6f7f7] border border-gray-200 rounded px-2.5 py-1.5">
                        <Paperclip size={11} className="text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700 truncate">{att.name}</p>
                          <p className="text-[10px] text-gray-400">{att.size}</p>
                        </div>
                        <a href={att.url} target="_blank" rel="noreferrer" className="text-[#2271b1] hover:underline text-[10px] font-medium flex-shrink-0">View</a>
                        <button onClick={() => removeAttachment(idx)} className="p-0.5 hover:bg-red-50 rounded flex-shrink-0">
                          <X size={11} className="text-red-400" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <input ref={attachInputRef} type="file" multiple accept=".pdf,.doc,.docx,.zip,.pptx,.xlsx,.txt" className="hidden" onChange={handleAttachFile} />
                <button
                  type="button"
                  onClick={() => attachInputRef.current?.click()}
                  disabled={uploading.attachment}
                  className="w-full flex items-center justify-center gap-1.5 py-2 border border-[#2271b1] text-[#2271b1] text-xs font-medium rounded hover:bg-[#2271b1]/5 disabled:opacity-60 transition-colors"
                >
                  {uploading.attachment
                    ? <><div className="w-3 h-3 border-2 border-[#2271b1] border-t-transparent rounded-full animate-spin" /> Uploading…</>
                    : <><Paperclip size={11} /> Upload Attachment</>
                  }
                </button>
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Audio Editor (for Listening / Listen & Write questions) ───────────────────
function AudioEditor({ audioUrl, audioMode, ttsText, onChange }: {
  audioUrl: string;
  audioMode: 'url' | 'record' | 'tts';
  ttsText: string;
  onChange: (patch: { audioUrl?: string; audioMode?: 'url' | 'record' | 'tts'; ttsText?: string }) => void;
}) {
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setPreview(url);
        onChange({ audioUrl: url });
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRef.current = mr;
      setRecording(true);
      setRecSeconds(0);
      timerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch {
      alert('Microphone access denied. Please allow microphone access.');
    }
  };

  const stopRecording = () => {
    mediaRef.current?.stop();
    setRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const previewTTS = () => {
    if (!ttsText.trim()) return;
    const utt = new SpeechSynthesisUtterance(ttsText);
    utt.rate = 0.9;
    speechSynthesis.cancel();
    speechSynthesis.speak(utt);
  };

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
        {([
          { key: 'url', label: 'URL', icon: Globe },
          { key: 'record', label: 'Record', icon: Mic },
          { key: 'tts', label: 'Text to Speech', icon: Volume2 },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => onChange({ audioMode: key })}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
              audioMode === key ? 'bg-white shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {audioMode === 'url' && (
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Audio URL</label>
          <input
            value={audioUrl}
            onChange={e => onChange({ audioUrl: e.target.value })}
            placeholder="https://example.com/audio.mp3"
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
          />
          {audioUrl && (
            <audio controls src={audioUrl} className="mt-2 w-full h-8" />
          )}
        </div>
      )}

      {audioMode === 'record' && (
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block">Record Audio</label>
          <div className="flex items-center gap-3">
            {!recording ? (
              <button
                onClick={startRecording}
                className="flex items-center gap-2 px-4 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                <Mic size={16} /> Start Recording
              </button>
            ) : (
              <button
                onClick={stopRecording}
                className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-sm font-semibold rounded-xl transition-colors animate-pulse"
              >
                <StopCircle size={16} /> Stop ({recSeconds}s)
              </button>
            )}
            {recording && (
              <div className="flex items-center gap-1.5 text-red-500 text-xs font-semibold">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                Recording...
              </div>
            )}
          </div>
          {(preview || audioUrl) && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Preview</p>
              <audio controls src={preview || audioUrl} className="w-full h-8" />
            </div>
          )}
        </div>
      )}

      {audioMode === 'tts' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Text to Speak</label>
            <textarea
              value={ttsText}
              onChange={e => onChange({ ttsText: e.target.value })}
              rows={3}
              placeholder="Type the text the browser will read aloud to students..."
              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
            />
          </div>
          <button
            onClick={previewTTS}
            disabled={!ttsText.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 text-sm font-semibold rounded-xl transition-colors disabled:opacity-50"
          >
            <Volume2 size={14} /> Preview Audio
          </button>
          <p className="text-xs text-slate-400">Students will hear this text read by the browser's built-in voice.</p>
        </div>
      )}
    </div>
  );
}

// ── Quiz Builder Modal ────────────────────────────────────────────────────────
function QuizBuilderModal({ item, topicTitle, onSave, onClose }: {
  item: TopicItem;
  topicTitle: string;
  onSave: (patch: Partial<TopicItem>) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const genId = () => crypto.randomUUID();

  const blankOption = (): QBOption => ({ tempId: genId(), text: '', isCorrect: false, matchKey: '' });
  const blankQuestion = (): QBQuestion => ({
    tempId: genId(),
    type: 'multiple_choice',
    questionText: '',
    explanation: '',
    hint: '',
    points: 10,
    options: [blankOption(), blankOption(), blankOption(), blankOption()],
    correctText: '',
    audioUrl: '',
    audioMode: 'url',
    ttsText: '',
  });

  const [title, setTitle] = useState(item.title);
  const [passingScore, setPassingScore] = useState(70);
  const [xpReward, setXpReward] = useState(30);
  const [questions, setQuestions] = useState<QBQuestion[]>([blankQuestion()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeQ, setActiveQ] = useState(0);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiTopic, setAiTopic] = useState(topicTitle || '');
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiQuestionTypes, setAiQuestionTypes] = useState<string[]>(['multiple_choice', 'fill_blank']);

  // Load existing quiz data if quiz_id present
  useEffect(() => {
    if (!item.quiz_id) return;
    setLoading(true);
    (async () => {
      const { data: qz } = await supabase.from('quizzes').select('*').eq('id', item.quiz_id).maybeSingle();
      if (qz) {
        setTitle(qz.title);
        setPassingScore(qz.passing_score);
        setXpReward(qz.xp_reward);
      }

      const { data: qs } = await supabase
        .from('quiz_questions')
        .select('*, quiz_options(*)')
        .eq('quiz_id', item.quiz_id)
        .order('sort_order');

      if (qs && qs.length > 0) {
        setQuestions(qs.map((q: any) => ({
          tempId: genId(),
          dbId: q.id,
          type: q.question_type as QBQuestion['type'],
          questionText: q.question_text,
          explanation: q.explanation ?? '',
          hint: q.hint ?? '',
          points: q.points,
          options: (q.quiz_options as any[]).sort((a, b) => a.sort_order - b.sort_order).map((o: any) => ({
            tempId: genId(),
            text: o.option_text,
            isCorrect: o.is_correct,
            matchKey: o.match_key ?? '',
          })),
          correctText: (q.question_type === 'fill_blank' || q.question_type === 'listen_write' || q.question_type === 'flash_card')
            ? (q.quiz_options as any[]).find((o: any) => o.is_correct)?.option_text ?? ''
            : '',
          audioUrl: q.question_audio_url ?? '',
          audioMode: (q.question_audio_url?.startsWith('tts:') ? 'tts' : 'url') as QBQuestion['audioMode'],
          ttsText: q.question_audio_url?.startsWith('tts:') ? q.question_audio_url.slice(4) : '',
        })));
      }
      setLoading(false);
    })();
  }, [item.quiz_id]);

  const updateQ = (idx: number, patch: Partial<QBQuestion>) =>
    setQuestions(prev => prev.map((q, i) => i === idx ? { ...q, ...patch } : q));

  const updateOption = (qIdx: number, oIdx: number, patch: Partial<QBOption>) =>
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? { ...q, options: q.options.map((o, j) => j === oIdx ? { ...o, ...patch } : o) }
      : q
    ));

  const setCorrect = (qIdx: number, oIdx: number) =>
    setQuestions(prev => prev.map((q, i) => i === qIdx
      ? { ...q, options: q.options.map((o, j) => ({ ...o, isCorrect: j === oIdx })) }
      : q
    ));

  const addQuestion = () => {
    setQuestions(prev => [...prev, blankQuestion()]);
    setActiveQ(questions.length);
  };

  const removeQuestion = (idx: number) => {
    if (questions.length === 1) return;
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    setActiveQ(Math.max(0, idx - 1));
  };

  const addOption = (qIdx: number) =>
    setQuestions(prev => prev.map((q, i) =>
      i === qIdx ? { ...q, options: [...q.options, blankOption()] } : q
    ));

  const removeOption = (qIdx: number, oIdx: number) =>
    setQuestions(prev => prev.map((q, i) =>
      i === qIdx && q.options.length > 2
        ? { ...q, options: q.options.filter((_, j) => j !== oIdx) }
        : q
    ));

  // AI Quiz Generation
  const handleAiGenerate = async () => {
    if (!aiTopic.trim()) return;
    setAiGenerating(true);
    setSaveError(null);

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: aiTopic,
          questionCount: aiQuestionCount,
          questionTypes: aiQuestionTypes,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to generate quiz');
      }

      const data = await response.json();
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error('Invalid response from AI');
      }

      // Convert AI questions to our format
      const newQuestions: QBQuestion[] = data.questions.map((q: any) => ({
        tempId: genId(),
        type: q.type as QBQuestion['type'],
        questionText: q.questionText || q.question_text || '',
        explanation: q.explanation || '',
        hint: q.hint || '',
        points: q.points || 10,
        options: q.options?.map((o: any) => ({
          tempId: genId(),
          text: o.text,
          isCorrect: o.isCorrect || o.is_correct || false,
          matchKey: o.matchKey || o.match_key || '',
        })) || [blankOption(), blankOption(), blankOption(), blankOption()],
        correctText: q.correctText || q.correct_text || '',
        audioUrl: '',
        audioMode: 'url' as const,
        ttsText: '',
      }));

      if (newQuestions.length > 0) {
        setQuestions(newQuestions);
        setActiveQ(0);
        setAiModalOpen(false);
      }
    } catch (err: any) {
      setSaveError(err.message || 'Failed to generate quiz with AI');
    } finally {
      setAiGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    setSaveError(null);

    let quizId = item.quiz_id;

    try {
      if (!quizId) {
        const { data: newQuiz, error } = await supabase.from('quizzes').insert({
          title: title.trim(),
          quiz_type: 'mixed',
          passing_score: passingScore,
          xp_reward: xpReward,
          is_published: true,
          sort_order: 0,
          created_by: user?.id,
        }).select().single();
        if (error || !newQuiz) {
          setSaveError(`Failed to create quiz: ${error?.message ?? 'Unknown error'}`);
          setSaving(false);
          return;
        }
        quizId = newQuiz.id;
      } else {
        const { error: updErr } = await supabase.from('quizzes').update({
          title: title.trim(),
          passing_score: passingScore,
          xp_reward: xpReward,
        }).eq('id', quizId);
        if (updErr) {
          setSaveError(`Failed to update quiz: ${updErr.message}`);
          setSaving(false);
          return;
        }
        const { error: delErr } = await supabase.from('quiz_questions').delete().eq('quiz_id', quizId);
        if (delErr) {
          setSaveError(`Failed to clear old questions: ${delErr.message}`);
          setSaving(false);
          return;
        }
      }

      let inserted = 0;
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.questionText.trim()) continue;

        const resolvedAudioUrl = (q.type === 'listening' || q.type === 'listen_write')
          ? q.audioMode === 'tts' && q.ttsText.trim()
            ? `tts:${q.ttsText.trim()}`
            : q.audioUrl.trim() || null
          : null;

        const { data: dbQ, error: qErr } = await supabase.from('quiz_questions').insert({
          quiz_id: quizId,
          question_type: q.type,
          question_text: q.questionText.trim(),
          explanation: q.explanation || null,
          hint: q.hint || null,
          points: q.points,
          sort_order: i,
          question_audio_url: resolvedAudioUrl,
        }).select().single();

        if (qErr || !dbQ) {
          setSaveError(`Failed to save question ${i + 1}: ${qErr?.message ?? 'Unknown error'}`);
          setSaving(false);
          return;
        }
        inserted++;

        if (q.type === 'fill_blank' || q.type === 'listen_write' || q.type === 'flash_card') {
          const { error: oErr } = await supabase.from('quiz_options').insert({
            question_id: dbQ.id,
            option_text: q.correctText.trim(),
            is_correct: true,
            sort_order: 0,
          });
          if (oErr) {
            setSaveError(`Failed to save answer for question ${i + 1}: ${oErr.message}`);
            setSaving(false);
            return;
          }
        } else if (q.type === 'matching_pair') {
          const leftItems = q.options.filter((_, idx) => idx % 2 === 0);
          const rightItems = q.options.filter((_, idx) => idx % 2 === 1);
          const alphabet = 'ABCDEFGHIJ';
          for (let k = 0; k < leftItems.length; k++) {
            if (!leftItems[k].text.trim()) continue;
            const mk = alphabet[k];
            const { error: oErr } = await supabase.from('quiz_options').insert([
              { question_id: dbQ.id, option_text: leftItems[k].text.trim(), match_key: mk, sort_order: k + 1 },
              { question_id: dbQ.id, option_text: rightItems[k]?.text?.trim() || '?', match_key: mk, sort_order: k + 5 },
            ]);
            if (oErr) {
              setSaveError(`Failed to save matching pair ${k + 1}: ${oErr.message}`);
              setSaving(false);
              return;
            }
          }
        } else {
          for (let k = 0; k < q.options.length; k++) {
            if (!q.options[k].text.trim()) continue;
            const { error: oErr } = await supabase.from('quiz_options').insert({
              question_id: dbQ.id,
              option_text: q.options[k].text.trim(),
              is_correct: q.options[k].isCorrect,
              sort_order: k + 1,
            });
            if (oErr) {
              setSaveError(`Failed to save option ${k + 1} for question ${i + 1}: ${oErr.message}`);
              setSaving(false);
              return;
            }
          }
        }
      }

      if (inserted === 0) {
        setSaveError('No questions with text were found. Please add question text before saving.');
        setSaving(false);
        return;
      }

      onSave({ title: title.trim(), quiz_id: quizId });
      setSaving(false);
      onClose();
    } catch (err: any) {
      setSaveError(`Unexpected error: ${err?.message ?? 'Unknown'}`);
      setSaving(false);
    }
  };

  const q = questions[activeQ] ?? questions[0];
  const [mobileTab, setMobileTab] = useState<'list' | 'editor'>('list');
  const [actionsOpen, setActionsOpen] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex bg-slate-900/60 backdrop-blur-sm p-0 sm:p-4 md:p-6">
      <div className="relative m-auto w-full max-w-5xl bg-white rounded-none sm:rounded-3xl shadow-2xl my-0 sm:my-6 flex flex-col h-full sm:h-[92vh] sm:max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-slate-100 bg-gradient-to-r from-amber-50/50 to-orange-50/50 sm:rounded-t-3xl shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-200/50 shrink-0">
              <HelpCircle size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-slate-900 text-base sm:text-lg truncate">Quiz Builder</h2>
              <p className="text-xs text-slate-500 truncate">{topicTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Actions dropdown */}
            <div className="relative">
              <button
                onClick={() => setActionsOpen(!actionsOpen)}
                className="w-9 h-9 rounded-xl hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors"
              >
                <MoreVertical size={18} />
              </button>
              {actionsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setActionsOpen(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-xl shadow-xl border border-slate-200 py-1 z-50">
                    <button
                      onClick={() => { addQuestion(); setActionsOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Plus size={16} /> Add Question
                    </button>
                    <button
                      onClick={() => { setAiModalOpen(true); setActionsOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                    >
                      <Sparkles size={16} className="text-violet-500" /> Generate with AI
                    </button>
                  </div>
                </>
              )}
            </div>
            <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-slate-200/60 flex items-center justify-center text-slate-400 hover:text-slate-600 transition-colors shrink-0">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Mobile tab switcher */}
        <div className="flex sm:hidden border-b border-slate-100 shrink-0">
          <button
            onClick={() => setMobileTab('list')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              mobileTab === 'list' ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50' : 'text-slate-500'
            }`}
          >
            Questions
          </button>
          <button
            onClick={() => setMobileTab('editor')}
            className={`flex-1 py-3 text-sm font-semibold transition-colors ${
              mobileTab === 'editor' ? 'text-amber-600 border-b-2 border-amber-500 bg-amber-50/50' : 'text-slate-500'
            }`}
          >
            Editor
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-24">
            <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex flex-1 min-h-0 flex-col sm:flex-row overflow-hidden">
            {/* Left sidebar: question list only */}
            <div className={`sm:border-r border-slate-100 bg-slate-50 sm:shrink-0 sm:w-56 sm:overflow-y-auto ${mobileTab === 'list' ? 'flex flex-col flex-1 overflow-y-auto' : 'hidden'} sm:flex sm:flex-col`}>
              <div className="p-3 space-y-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Questions ({questions.length})</p>
                {questions.map((qq, idx) => (
                  <button
                    key={qq.tempId}
                    onClick={() => { setActiveQ(idx); setMobileTab('editor'); }}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activeQ === idx
                        ? 'bg-amber-500 text-white shadow-md shadow-amber-200'
                        : 'bg-white text-slate-700 hover:bg-amber-50 border border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${activeQ === idx ? 'bg-white/30 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {idx + 1}
                      </span>
                      <span className="truncate">{qq.questionText || 'Untitled'}</span>
                    </div>
                    <div className={`text-[10px] mt-0.5 pl-7 ${activeQ === idx ? 'text-white/70' : 'text-slate-400'}`}>
                      {qq.type === 'multiple_choice' ? 'Multiple Choice' : qq.type === 'fill_blank' ? 'Fill Blank' : qq.type === 'matching_pair' ? 'Matching' : qq.type === 'listening' ? 'Listening' : qq.type === 'listen_write' ? 'Listen & Write' : 'Flash Card'}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Right: question editor */}
            <div className={`flex-1 overflow-y-auto p-4 sm:p-6 ${mobileTab === 'editor' ? 'flex flex-col' : 'hidden'} sm:block`}>
              {q && (
                <div className="space-y-5">
                  {/* Question Header */}
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h3 className="font-bold text-slate-800">Question {activeQ + 1}</h3>
                    <div className="flex items-center gap-2">
                      {/* Type selector dropdown */}
                      <select
                        value={q.type}
                        onChange={e => updateQ(activeQ, { type: e.target.value as QBQuestion['type'] })}
                        className="border border-slate-200 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 bg-white focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 cursor-pointer"
                      >
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="fill_blank">Fill in the Blank</option>
                        <option value="matching_pair">Matching Pairs</option>
                        <option value="listening">Listening</option>
                        <option value="listen_write">Listen &amp; Write</option>
                        <option value="flash_card">Flash Card</option>
                      </select>
                      <button
                        onClick={() => removeQuestion(activeQ)}
                        disabled={questions.length <= 1}
                        className="p-2 text-red-400 hover:bg-red-50 rounded-lg disabled:opacity-30 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Question Text */}
                  <div>
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Question Text</label>
                    <textarea
                      value={q.questionText}
                      onChange={e => updateQ(activeQ, { questionText: e.target.value })}
                      rows={3}
                      placeholder="Type your question here..."
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100 resize-none"
                    />
                  </div>

                  {/* Multiple Choice Options */}
                  {q.type === 'multiple_choice' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Answer Options</label>
                        <span className="text-[10px] text-slate-400">Click the circle to mark correct</span>
                      </div>
                      <div className="space-y-2">
                        {q.options.map((opt, oIdx) => (
                          <div key={opt.tempId} className="flex items-center gap-3">
                            <button
                              onClick={() => setCorrect(activeQ, oIdx)}
                              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                opt.isCorrect
                                  ? 'border-emerald-500 bg-emerald-500'
                                  : 'border-slate-300 hover:border-emerald-400'
                              }`}
                            >
                              {opt.isCorrect && <CheckCircle size={14} className="text-white" />}
                            </button>
                            <input
                              value={opt.text}
                              onChange={e => updateOption(activeQ, oIdx, { text: e.target.value })}
                              placeholder={`Option ${String.fromCharCode(65 + oIdx)}...`}
                              className={`flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all ${
                                opt.isCorrect
                                  ? 'border-emerald-400 bg-emerald-50 focus:ring-2 focus:ring-emerald-100'
                                  : 'border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
                              }`}
                            />
                            <button
                              onClick={() => removeOption(activeQ, oIdx)}
                              disabled={q.options.length <= 2}
                              className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg disabled:opacity-30"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                        {q.options.length < 6 && (
                          <button
                            onClick={() => addOption(activeQ)}
                            className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 py-1 pl-9"
                          >
                            <Plus size={12} /> Add option
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Fill in the Blank */}
                  {q.type === 'fill_blank' && (
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Correct Answer</label>
                      <input
                        value={q.correctText}
                        onChange={e => updateQ(activeQ, { correctText: e.target.value })}
                        placeholder="Type the correct answer..."
                        className="w-full border border-emerald-400 bg-emerald-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
                      />
                      <p className="text-xs text-slate-400 mt-1.5">Students will type this exact answer (case-insensitive)</p>
                    </div>
                  )}

                  {/* Matching Pairs */}
                  {q.type === 'matching_pair' && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Matching Pairs</label>
                        <span className="text-[10px] text-slate-400">Left → Right</span>
                      </div>
                      <div className="space-y-2">
                        {[0, 1, 2, 3].map(pairIdx => {
                          const leftIdx = pairIdx * 2;
                          const rightIdx = pairIdx * 2 + 1;
                          const left = q.options[leftIdx] ?? { tempId: genId(), text: '', isCorrect: false, matchKey: '' };
                          const right = q.options[rightIdx] ?? { tempId: genId(), text: '', isCorrect: false, matchKey: '' };
                          return (
                            <div key={pairIdx} className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                {String.fromCharCode(65 + pairIdx)}
                              </span>
                              <input
                                value={left.text}
                                onChange={e => {
                                  const updated = [...q.options];
                                  while (updated.length <= leftIdx) updated.push(blankOption());
                                  updated[leftIdx] = { ...updated[leftIdx], text: e.target.value };
                                  updateQ(activeQ, { options: updated });
                                }}
                                placeholder={`Term ${pairIdx + 1}...`}
                                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                              />
                              <ChevronRight size={16} className="text-slate-300 shrink-0" />
                              <input
                                value={right.text}
                                onChange={e => {
                                  const updated = [...q.options];
                                  while (updated.length <= rightIdx) updated.push(blankOption());
                                  updated[rightIdx] = { ...updated[rightIdx], text: e.target.value };
                                  updateQ(activeQ, { options: updated });
                                }}
                                placeholder={`Definition ${pairIdx + 1}...`}
                                className="flex-1 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-400"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Listening - Audio + Multiple Choice */}
                  {q.type === 'listening' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Audio Source</label>
                        <AudioEditor
                          audioUrl={q.audioUrl}
                          audioMode={q.audioMode}
                          ttsText={q.ttsText}
                          onChange={patch => updateQ(activeQ, patch)}
                        />
                      </div>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Answer Options</label>
                          <span className="text-[10px] text-slate-400">Click circle to mark correct</span>
                        </div>
                        <div className="space-y-2">
                          {q.options.map((opt, oIdx) => (
                            <div key={opt.tempId} className="flex items-center gap-3">
                              <button
                                onClick={() => setCorrect(activeQ, oIdx)}
                                className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                                  opt.isCorrect ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 hover:border-emerald-400'
                                }`}
                              >
                                {opt.isCorrect && <CheckCircle size={14} className="text-white" />}
                              </button>
                              <input
                                value={opt.text}
                                onChange={e => updateOption(activeQ, oIdx, { text: e.target.value })}
                                placeholder={`Option ${String.fromCharCode(65 + oIdx)}...`}
                                className={`flex-1 border rounded-xl px-4 py-2.5 text-sm focus:outline-none transition-all ${
                                  opt.isCorrect ? 'border-emerald-400 bg-emerald-50 focus:ring-2 focus:ring-emerald-100' : 'border-slate-200 focus:border-amber-400 focus:ring-2 focus:ring-amber-100'
                                }`}
                              />
                              <button
                                onClick={() => removeOption(activeQ, oIdx)}
                                disabled={q.options.length <= 2}
                                className="p-1.5 text-slate-300 hover:text-red-400 hover:bg-red-50 rounded-lg disabled:opacity-30"
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          {q.options.length < 6 && (
                            <button onClick={() => addOption(activeQ)} className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 py-1 pl-9">
                              <Plus size={12} /> Add option
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Listen & Write - Audio + typed answer */}
                  {q.type === 'listen_write' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Audio Source</label>
                        <AudioEditor
                          audioUrl={q.audioUrl}
                          audioMode={q.audioMode}
                          ttsText={q.ttsText}
                          onChange={patch => updateQ(activeQ, patch)}
                        />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Correct Answer (what students should write)</label>
                        <input
                          value={q.correctText}
                          onChange={e => updateQ(activeQ, { correctText: e.target.value })}
                          placeholder="e.g. The quick brown fox..."
                          className="w-full border border-emerald-400 bg-emerald-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100"
                        />
                        <p className="text-xs text-slate-400 mt-1.5">Students listen and type — compared case-insensitively</p>
                      </div>
                    </div>
                  )}

                  {/* Flash Card */}
                  {q.type === 'flash_card' && (
                    <div className="space-y-4">
                      <div className="bg-sky-50 border border-sky-200 rounded-xl p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Layers size={16} className="text-sky-600" />
                          <span className="text-sm font-semibold text-sky-700">Flash Card Question</span>
                        </div>
                        <p className="text-xs text-sky-600 mb-3">
                          Students will see the question text and try to recall the answer before flipping the card.
                        </p>
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Front (Question / Prompt)</label>
                            <textarea
                              value={q.questionText}
                              onChange={e => updateQ(activeQ, { questionText: e.target.value })}
                              rows={3}
                              placeholder="e.g. What is the capital of France?"
                              className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200 resize-none"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Back (Answer)</label>
                            <textarea
                              value={q.correctText}
                              onChange={e => updateQ(activeQ, { correctText: e.target.value })}
                              rows={3}
                              placeholder="e.g. Paris"
                              className="w-full border border-emerald-400 bg-emerald-50 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-100 resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Hint & Explanation */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Hint (optional)</label>
                      <input
                        value={q.hint}
                        onChange={e => updateQ(activeQ, { hint: e.target.value })}
                        placeholder="Help students if they're stuck..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Explanation (optional)</label>
                      <input
                        value={q.explanation}
                        onChange={e => updateQ(activeQ, { explanation: e.target.value })}
                        placeholder="Explain the correct answer..."
                        className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Points</label>
                    <input
                      type="number" min={1} max={100}
                      value={q.points}
                      onChange={e => updateQ(activeQ, { points: Number(e.target.value) })}
                      className="w-20 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error display */}
        {saveError && (
          <div className="mx-4 sm:mx-6 mb-4 mt-2 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle size={16} className="shrink-0 mt-0.5" />
            <span>{saveError}</span>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-t border-slate-100 bg-slate-50 sm:rounded-b-3xl shrink-0">
          <p className="text-sm text-slate-500 hidden sm:block">{questions.length} question{questions.length !== 1 ? 's' : ''}</p>
          <div className="flex gap-3 w-full sm:w-auto">
            <button onClick={onClose} className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex-1 sm:flex-none px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-200"
            >
              {saving ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Saving...</>
              ) : (
                <><Save size={15} /> Save Quiz</>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* AI Generation Modal */}
      {aiModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 p-6 animate-fadeIn">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
                <Sparkles size={20} className="text-white" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900">Generate Quiz with AI</h3>
                <p className="text-xs text-slate-500">Let AI create questions for you</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Topic / Subject</label>
                <input
                  value={aiTopic}
                  onChange={e => setAiTopic(e.target.value)}
                  placeholder="e.g., Mathematics, Grammar, Science..."
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1.5">Number of Questions</label>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={aiQuestionCount}
                  onChange={e => setAiQuestionCount(Math.min(20, Math.max(1, Number(e.target.value))))}
                  className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">Question Types</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { key: 'multiple_choice', label: 'Multiple Choice' },
                    { key: 'fill_blank', label: 'Fill Blank' },
                    { key: 'matching_pair', label: 'Matching' },
                    { key: 'flash_card', label: 'Flash Card' },
                  ].map(t => (
                    <button
                      key={t.key}
                      onClick={() => {
                        setAiQuestionTypes(prev =>
                          prev.includes(t.key)
                            ? prev.filter(x => x !== t.key)
                            : [...prev, t.key]
                        );
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        aiQuestionTypes.includes(t.key)
                          ? 'bg-violet-500 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setAiModalOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAiGenerate}
                disabled={aiGenerating || !aiTopic.trim() || aiQuestionTypes.length === 0}
                className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white text-sm font-bold hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
              >
                {aiGenerating ? (
                  <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating...</>
                ) : (
                  <><Sparkles size={14} /> Generate</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Course Builder Modal (multi-stage) ───────────────────────────────────────
const defaultCourseForm: CourseFormData = {
  title: '',
  description: '',
  thumbnail_url: '',
  intro_video_url: '',
  pricing_model: 'free',
  price: 0,
  visibility: 'public',
  difficulty_level: 'intermediate',
  is_public: false,
  tags: '',
  category_id: null,
  what_will_learn: '',
  target_audience: '',
  duration_hours: 0,
  duration_minutes_extra: 0,
  materials_included: '',
  requirements: '',
};

function CourseBuilderModal({ onClose, onSaved, editCourseId }: {
  onClose: () => void;
  onSaved: (course: CourseRow) => void;
  editCourseId?: string;
}) {
  const { user } = useAuth();
  const isEdit = !!editCourseId;
  const [step, setStep] = useState<CourseBuilderStep>(1);
  const [form, setForm] = useState<CourseFormData>(defaultCourseForm);
  const [activeOptionsTab, setActiveOptionsTab] = useState<'general' | 'drip' | 'enrollment'>('general');
  const [topics, setTopics] = useState<CurriculumTopic[]>([]);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [lessonContentEdit, setLessonContentEdit] = useState<{ topicTempId: string; item: TopicItem } | null>(null);
  const [quizContentEdit, setQuizContentEdit] = useState<{ topicTempId: string; item: TopicItem } | null>(null);
  const [allCategories, setAllCategories] = useState<{ id: string; name: string }[]>([]);
  const [catSearch, setCatSearch] = useState('');
  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    supabase.from('categories').select('id, name').order('name').then(({ data }) => {
      if (data) setAllCategories(data);
    });
  }, []);

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const { data } = await supabase.from('categories').insert({ name, slug }).select('id, name').single();
    if (data) {
      setAllCategories(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)));
      setForm(f => ({ ...f, category_id: data.id }));
      setNewCatName('');
      setAddingCat(false);
    }
  };

  const filteredCategories = allCategories.filter(c =>
    c.name.toLowerCase().includes(catSearch.toLowerCase())
  );

  useEffect(() => {
    if (!editCourseId) return;
    const load = async () => {
      setLoadingEdit(true);
      const { data: cd } = await supabase.from('courses').select('*').eq('id', editCourseId).single();
      if (cd) {
        setForm({
          title: cd.title ?? '',
          description: cd.description ?? '',
          thumbnail_url: cd.thumbnail_url ?? '',
          intro_video_url: cd.intro_video_url ?? '',
          pricing_model: cd.pricing_model ?? 'free',
          price: cd.price ?? 0,
          visibility: cd.visibility ?? 'public',
          difficulty_level: cd.difficulty_level ?? 'intermediate',
          is_public: cd.is_public ?? false,
          tags: (cd.tags ?? []).join(', '),
          category_id: cd.category_id ?? null,
          what_will_learn: cd.what_will_learn ?? '',
          target_audience: cd.target_audience ?? '',
          duration_hours: cd.duration_hours ?? 0,
          duration_minutes_extra: cd.duration_minutes ?? 0,
          materials_included: cd.materials_included ?? cd.materials ?? '',
          requirements: cd.requirements ?? '',
        });
      }
      const { data: tds } = await supabase
        .from('course_topics')
        .select('*, course_topic_items(*)')
        .eq('course_id', editCourseId)
        .order('sort_order');
      if (tds) {
        setTopics(tds.map(t => ({
          tempId: t.id,
          title: t.title,
          summary: t.summary ?? '',
          editing: false,
          items: ((t.course_topic_items ?? []) as Record<string, unknown>[])
            .sort((a, b) => (a.sort_order as number) - (b.sort_order as number))
            .map(it => ({
              tempId: it.id as string,
              type: (it.type as TopicItem['type']) ?? 'lesson',
              title: it.title as string,
              editing: false,
              content: (it.content as string) ?? '',
              featured_image_url: (it.featured_image_url as string) ?? '',
              video_url: (it.video_url as string) ?? '',
              video_hours: (it.video_hours as number) ?? 0,
              video_minutes: (it.video_minutes as number) ?? 0,
              video_seconds: (it.video_seconds as number) ?? 0,
              quiz_id: (it.quiz_id as string) ?? null,
              display_mode: ((it.display_mode as string) === 'interactive' ? 'interactive' : 'classic') as 'classic' | 'interactive',
              attachments: ((it.attachments as string[]) ?? []).map(url => ({
                name: url.split('/').pop() ?? 'file', url, size: '',
              })),
            })),
        })));
      }
      setLoadingEdit(false);
    };
    load();
  }, [editCourseId]);

  const slugify = (t: string) =>
    t.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

  const addTopic = () => {
    const t: CurriculumTopic = {
      tempId: crypto.randomUUID(),
      title: '',
      summary: '',
      editing: true,
      items: [],
    };
    setTopics(prev => [...prev, t]);
  };

  const updateTopic = (tempId: string, patch: Partial<CurriculumTopic>) =>
    setTopics(prev => prev.map(t => t.tempId === tempId ? { ...t, ...patch } : t));

  const removeTopic = (tempId: string) =>
    setTopics(prev => prev.filter(t => t.tempId !== tempId));

  const duplicateTopic = (tempId: string) =>
    setTopics(prev => {
      const idx = prev.findIndex(t => t.tempId === tempId);
      if (idx === -1) return prev;
      const src = prev[idx];
      const copy: CurriculumTopic = {
        ...src,
        tempId: crypto.randomUUID(),
        title: `${src.title} (Copy)`,
        editing: false,
        items: src.items.map(it => ({ ...it, tempId: crypto.randomUUID(), editing: false })),
      };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });

  const addItem = (topicTempId: string, type: 'lesson' | 'quiz' | 'assignment') => {
    const item: TopicItem = {
      tempId: crypto.randomUUID(), type, title: '', editing: true,
      content: '', featured_image_url: '', video_url: '',
      video_hours: 0, video_minutes: 0, video_seconds: 0,
      attachments: [], display_mode: 'classic',
    };
    setTopics(prev => prev.map(t =>
      t.tempId === topicTempId ? { ...t, items: [...t.items, item] } : t
    ));
  };

  const updateItem = (topicTempId: string, itemTempId: string, patch: Partial<TopicItem>) => {
    setTopics(prev => prev.map(t =>
      t.tempId === topicTempId
        ? { ...t, items: t.items.map(i => i.tempId === itemTempId ? { ...i, ...patch } : i) }
        : t
    ));
    // Persist quiz_id to the database so it survives reloads
    if (patch.quiz_id !== undefined && isEdit) {
      supabase.from('course_topic_items').update({ quiz_id: patch.quiz_id }).eq('id', itemTempId).then();
    }
  };

  const removeItem = (topicTempId: string, itemTempId: string) =>
    setTopics(prev => prev.map(t =>
      t.tempId === topicTempId ? { ...t, items: t.items.filter(i => i.tempId !== itemTempId) } : t
    ));

  const coursePayload = (publish: boolean) => ({
    title: form.title.trim(),
    description: form.description,
    thumbnail_url: form.thumbnail_url || null,
    intro_video_url: form.intro_video_url || null,
    pricing_model: form.pricing_model,
    price: form.pricing_model === 'paid' ? form.price : 0,
    visibility: form.visibility,
    difficulty_level: form.difficulty_level,
    is_public: form.is_public,
    is_published: publish,
    status: publish ? 'published' : 'draft',
    category_id: form.category_id,
    what_will_learn: form.what_will_learn,
    target_audience: form.target_audience,
    duration_hours: form.duration_hours,
    duration_minutes: form.duration_minutes_extra,
    materials: form.materials_included,
    materials_included: form.materials_included,
    requirements: form.requirements,
    tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    created_by: user?.id ?? null,
  });

  const saveCurriculumForCourse = async (courseId: string) => {
    if (isEdit) {
      await supabase.from('course_topics').delete().eq('course_id', courseId);
    }
    const validTopics = topics.filter(t => t.title.trim());
    for (let i = 0; i < validTopics.length; i++) {
      const tp = validTopics[i];
      const { data: tpData, error: tpErr } = await supabase
        .from('course_topics')
        .insert({ course_id: courseId, title: tp.title.trim(), summary: tp.summary, sort_order: i })
        .select().single();
      if (tpErr) { console.error('Topic error:', tpErr); continue; }
      if (tpData) {
        const validItems = tp.items.filter(it => it.title.trim());
        for (let j = 0; j < validItems.length; j++) {
          const it = validItems[j];
          const { error: itErr } = await supabase.from('course_topic_items').insert({
            topic_id: tpData.id, type: it.type, title: it.title.trim(), sort_order: j,
            content: it.content, video_url: it.video_url,
            quiz_id: it.quiz_id ?? null,
            display_mode: it.display_mode ?? 'classic',
          });
          if (itErr) console.error('Item error:', itErr);
        }
      }
    }
    return validTopics.length;
  };

  const handleSave = async (publish: boolean) => {
    if (!form.title.trim()) {
      setSaveError('Please enter a course title before saving.');
      setStep(1);
      return;
    }
    setSaveError(null);
    setSaveSuccess(false);
    publish ? setPublishing(true) : setSaving(true);

    try {
      let courseData: Record<string, unknown> | null = null;

      if (isEdit && editCourseId) {
        const { data, error } = await supabase
          .from('courses')
          .update(coursePayload(publish))
          .eq('id', editCourseId)
          .select().single();
        if (error || !data) { setSaveError(error?.message ?? 'Update failed.'); setSaving(false); setPublishing(false); return; }
        courseData = data as Record<string, unknown>;
      } else {
        const { data, error } = await supabase
          .from('courses')
          .insert(coursePayload(publish))
          .select().single();
        if (error || !data) { setSaveError(error?.message ?? 'Save failed.'); setSaving(false); setPublishing(false); return; }
        courseData = data as Record<string, unknown>;
      }

      const topicCount = await saveCurriculumForCourse(courseData.id as string);

      onSaved({
        id: courseData.id as string,
        title: courseData.title as string,
        description: (courseData.description as string) ?? '',
        thumbnail_url: courseData.thumbnail_url as string | null,
        pricing_model: courseData.pricing_model as string,
        visibility: courseData.visibility as string,
        difficulty_level: courseData.difficulty_level as string,
        is_published: (courseData.is_published as boolean) ?? publish,
        created_at: courseData.created_at as string,
        topic_count: topicCount,
      });

      setSaveSuccess(true);
      setSaving(false);
      setPublishing(false);
      setTimeout(onClose, 600);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An unexpected error occurred.';
      setSaveError(msg);
      setSaving(false);
      setPublishing(false);
    }
  };

  const stepLabels: { num: CourseBuilderStep; label: string }[] = [
    { num: 1, label: 'Basics' },
    { num: 2, label: 'Curriculum' },
    { num: 3, label: 'Additional' },
  ];

  if (loadingEdit) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white gap-4">
        <div className="w-10 h-10 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading course…</p>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Top bar */}
      <div className="border-b border-slate-200 bg-white shadow-sm flex-shrink-0">
        {/* Row 1: brand + actions */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3">
          <div className="flex items-center gap-2 sm:gap-6 min-w-0">
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center">
                <BookMarked size={14} className="text-white" />
              </div>
              <span className="font-bold text-slate-800 text-sm">{isEdit ? 'Edit Course' : 'Course Builder'}</span>
            </div>
            {/* Step indicators — desktop only (shown in row 2 on mobile) */}
            <div className="hidden sm:flex items-center gap-1">
              {stepLabels.map((s, idx) => (
                <div key={s.num} className="flex items-center gap-1">
                  {idx > 0 && <div className="w-8 h-px bg-slate-200" />}
                  <button
                    onClick={() => setStep(s.num)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                      step === s.num
                        ? 'bg-rose-600 text-white shadow'
                        : step > s.num
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'text-slate-400 hover:text-slate-600'
                    }`}
                  >
                    <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black ${
                      step === s.num ? 'bg-white/20 text-white' : step > s.num ? 'bg-emerald-200 text-emerald-700' : 'bg-slate-200 text-slate-500'
                    }`}>{s.num}</span>
                    {s.label}
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Save as Draft — icon-only on mobile, full label on desktop */}
            <button
              onClick={() => handleSave(false)}
              disabled={saving || publishing || !form.title.trim()}
              title="Save as Draft"
              className="flex items-center gap-1.5 px-2.5 sm:px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-40 transition-colors"
            >
              <Save size={13} />
              <span className="hidden sm:inline">{saving ? 'Saving…' : 'Save as Draft'}</span>
            </button>
            <button
              onClick={() => handleSave(true)}
              disabled={saving || publishing || !form.title.trim()}
              className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl disabled:opacity-40 transition-colors shadow"
            >
              {publishing ? 'Publishing…' : 'Publish'}
            </button>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-xl transition-colors">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Row 2: step tabs — mobile only */}
        <div className="flex sm:hidden border-t border-slate-100">
          {stepLabels.map((s) => (
            <button
              key={s.num}
              onClick={() => setStep(s.num)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all border-b-2 ${
                step === s.num
                  ? 'border-rose-600 text-rose-600 bg-rose-50/40'
                  : step > s.num
                    ? 'border-emerald-400 text-emerald-600 bg-emerald-50/30'
                    : 'border-transparent text-slate-400'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-black flex-shrink-0 ${
                step === s.num ? 'bg-rose-600 text-white' : step > s.num ? 'bg-emerald-400 text-white' : 'bg-slate-200 text-slate-500'
              }`}>{s.num}</span>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Error / Success banner */}
      {saveError && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-red-50 border-b border-red-200 flex-shrink-0">
          <AlertTriangle size={15} className="text-red-500 flex-shrink-0" />
          <p className="flex-1 text-sm text-red-700 font-medium">{saveError}</p>
          <button onClick={() => setSaveError(null)} className="p-1 hover:bg-red-100 rounded transition-colors">
            <X size={14} className="text-red-400" />
          </button>
        </div>
      )}
      {saveSuccess && (
        <div className="flex items-center gap-3 px-6 py-2.5 bg-emerald-50 border-b border-emerald-200 flex-shrink-0">
          <CheckCircle size={15} className="text-emerald-500 flex-shrink-0" />
          <p className="flex-1 text-sm text-emerald-700 font-medium">Course saved successfully!</p>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto bg-slate-50">
        {/* ── Step 1: Basics ── */}
        {step === 1 && (
          <div className="max-w-6xl mx-auto p-6 flex flex-col lg:flex-row gap-6">
            {/* Left / Main */}
            <div className="flex-1 space-y-5">
              {/* Title */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Title</label>
                <input
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="New Course"
                  className="w-full text-lg font-semibold text-slate-900 bg-transparent border-b border-slate-200 pb-2 focus:outline-none focus:border-rose-400 transition"
                />
                {form.title && (
                  <p className="text-xs text-slate-400 mt-2">
                    Course URL: <span className="text-slate-600">…/courses/{slugify(form.title) || 'new-course'}</span>
                  </p>
                )}
              </div>

              {/* Description */}
              <div className="bg-white rounded-2xl border border-slate-200 p-5">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={6}
                  placeholder="Describe what this course is about…"
                  className="w-full text-sm text-slate-700 bg-transparent focus:outline-none resize-none placeholder-slate-300"
                />
              </div>

              {/* Options */}
              <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                <div className="flex border-b border-slate-100">
                  {(['general', 'drip', 'enrollment'] as const).map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveOptionsTab(tab)}
                      className={`flex-1 py-3 text-xs font-semibold capitalize transition-colors ${
                        activeOptionsTab === tab
                          ? 'text-rose-600 border-b-2 border-rose-500 bg-rose-50/50'
                          : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab === 'drip' ? 'Content Drip' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                    </button>
                  ))}
                </div>
                <div className="p-5">
                  {activeOptionsTab === 'general' && (
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-semibold text-slate-700 block mb-1.5">Difficulty Level</label>
                        <select
                          value={form.difficulty_level}
                          onChange={e => setForm(f => ({ ...f, difficulty_level: e.target.value }))}
                          className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                        >
                          {['Beginner', 'Elementary', 'Pre-Intermediate', 'Intermediate', 'Upper-Intermediate', 'Advanced'].map(l => (
                            <option key={l} value={l.toLowerCase()}>{l}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-700">Public Course</p>
                          <p className="text-xs text-slate-400 mt-0.5">Visible to all users without enrollment</p>
                        </div>
                        <div
                          onClick={() => setForm(f => ({ ...f, is_public: !f.is_public }))}
                          className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer flex-shrink-0 ${form.is_public ? 'bg-rose-500' : 'bg-slate-200'}`}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all ${form.is_public ? 'left-5' : 'left-0.5'}`} />
                        </div>
                      </div>
                    </div>
                  )}
                  {activeOptionsTab === 'drip' && (
                    <p className="text-sm text-slate-400 text-center py-4">Content drip settings can be configured after publishing the course.</p>
                  )}
                  {activeOptionsTab === 'enrollment' && (
                    <p className="text-sm text-slate-400 text-center py-4">Enrollment settings can be configured after publishing the course.</p>
                  )}
                </div>
              </div>
            </div>

            {/* Right sidebar */}
            <div className="w-full lg:w-72 space-y-4 flex-shrink-0">
              {/* Visibility */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Visibility</label>
                <select
                  value={form.visibility}
                  onChange={e => setForm(f => ({ ...f, visibility: e.target.value as 'public' | 'private' }))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                >
                  <option value="public">Public</option>
                  <option value="private">Private</option>
                </select>
              </div>

              {/* Featured Image */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Featured Image</label>
                <input
                  value={form.thumbnail_url}
                  onChange={e => setForm(f => ({ ...f, thumbnail_url: e.target.value }))}
                  placeholder="Paste image URL…"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                />
                {form.thumbnail_url && (
                  <img src={form.thumbnail_url} alt="preview" className="mt-2 w-full h-28 object-cover rounded-xl" />
                )}
                {!form.thumbnail_url && (
                  <div className="mt-2 w-full h-28 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-300">
                    <Upload size={20} />
                    <span className="text-xs mt-1">No image</span>
                  </div>
                )}
              </div>

              {/* Intro Video */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Intro Video URL</label>
                <input
                  value={form.intro_video_url}
                  onChange={e => setForm(f => ({ ...f, intro_video_url: e.target.value }))}
                  placeholder="Paste video URL…"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                />
              </div>

              {/* Pricing */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Pricing Model</label>
                <div className="flex gap-3">
                  {(['free', 'paid'] as const).map(p => (
                    <label key={p} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        checked={form.pricing_model === p}
                        onChange={() => setForm(f => ({ ...f, pricing_model: p, price: p === 'free' ? 0 : f.price }))}
                        className="accent-rose-500"
                      />
                      <span className="text-sm font-medium text-slate-700 capitalize">{p}</span>
                    </label>
                  ))}
                </div>
                {form.pricing_model === 'paid' && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">Course Price (USD)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-semibold">$</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.price || ''}
                        onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))}
                        placeholder="0.00"
                        className="w-full pl-7 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-rose-400 focus:border-transparent transition-all"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1.5">Set the price students will pay to enroll in this course.</p>
                  </div>
                )}
              </div>

              {/* Categories */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-3">Categories</label>
                {/* Search */}
                <div className="relative mb-2">
                  <Search size={12} className="absolute left-2.5 top-2.5 text-slate-400 pointer-events-none" />
                  <input
                    value={catSearch}
                    onChange={e => setCatSearch(e.target.value)}
                    placeholder="Search"
                    className="w-full pl-7 pr-3 py-2 text-xs rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                  />
                </div>
                {/* Checklist */}
                <div className="max-h-44 overflow-y-auto space-y-2 mb-3 pr-1">
                  {filteredCategories.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-3">
                      {catSearch ? 'No matches found' : 'No categories yet'}
                    </p>
                  ) : (
                    filteredCategories.map(cat => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setForm(f => ({ ...f, category_id: f.category_id === cat.id ? null : cat.id }))}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                          form.category_id === cat.id
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-white text-slate-700 border border-slate-100 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-3 h-3 rounded-full ${form.category_id === cat.id ? 'bg-rose-500' : 'bg-slate-200'}`} />
                        <span className="truncate">{cat.name}</span>
                        {form.category_id === cat.id && <CheckCircle size={14} className="ml-auto text-rose-500" />}
                      </button>
                    ))
                  )}
                </div>
                {/* Add category */}
                {addingCat ? (
                  <div className="flex gap-1.5 items-center">
                    <input
                      autoFocus
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddCategory(); if (e.key === 'Escape') { setAddingCat(false); setNewCatName(''); } }}
                      placeholder="Category name…"
                      className="flex-1 px-2.5 py-1.5 text-xs border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                    />
                    <button
                      onClick={handleAddCategory}
                      disabled={!newCatName.trim()}
                      className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-xs font-bold rounded-lg transition"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => { setAddingCat(false); setNewCatName(''); }}
                      className="px-2 py-1.5 text-slate-500 hover:bg-slate-100 text-xs rounded-lg transition"
                    >
                      <X size={12} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setAddingCat(true)}
                    className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
                  >
                    <Plus size={13} /> Add New Category
                  </button>
                )}
              </div>

              {/* Tags */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Tags</label>
                <input
                  value={form.tags}
                  onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="english, grammar, beginner…"
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                />
                <p className="text-xs text-slate-400 mt-1">Separate with commas</p>
              </div>
            </div>
          </div>
        )}

        {/* ── Step 2: Curriculum ── */}
        {step === 2 && (
          <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setStep(1)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <ChevronLeft size={18} className="text-slate-500" />
              </button>
              <h2 className="text-xl font-bold text-slate-900">Curriculum</h2>
            </div>

            <div className="space-y-3">
              {topics.map((topic, tIdx) => (
                <div key={topic.tempId} className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                  {topic.editing ? (
                    <div className="p-4">
                      <div className="flex items-start gap-3 mb-3">
                        <GripVertical size={16} className="text-slate-300 mt-2.5 flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                          <input
                            autoFocus
                            value={topic.title}
                            onChange={e => updateTopic(topic.tempId, { title: e.target.value })}
                            placeholder="Add a title"
                            className="w-full px-4 py-2.5 rounded-xl border border-rose-300 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                          />
                          <textarea
                            value={topic.summary}
                            onChange={e => updateTopic(topic.tempId, { summary: e.target.value })}
                            placeholder="Add a summary"
                            rows={2}
                            className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 transition resize-none"
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => removeTopic(topic.tempId)}
                          className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 rounded-lg transition-colors"
                        >Cancel</button>
                        <button
                          onClick={() => { if (topic.title.trim()) updateTopic(topic.tempId, { editing: false }); }}
                          className="px-4 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-lg transition-colors"
                        >Ok</button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between px-3 sm:px-4 py-3 border-b border-slate-100 bg-slate-50/60">
                        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                          <GripVertical size={14} className="text-slate-300 flex-shrink-0 hidden sm:block" />
                          <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wide flex-shrink-0 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded-md">
                            {tIdx + 1}
                          </span>
                          <span className="font-bold text-slate-800 text-sm truncate">{topic.title}</span>
                          {topic.items.length > 0 && (
                            <span className="hidden sm:inline text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full flex-shrink-0">
                              {topic.items.length} item{topic.items.length !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-0.5 flex-shrink-0 ml-2">
                          <button
                            title="Edit topic"
                            onClick={() => updateTopic(topic.tempId, { editing: true })}
                            className="p-2 sm:p-1.5 hover:bg-slate-100 rounded-lg transition-colors"
                          >
                            <Edit3 size={13} className="text-slate-400 hover:text-slate-600 transition-colors" />
                          </button>
                          <button
                            title="Duplicate topic"
                            onClick={() => duplicateTopic(topic.tempId)}
                            className="p-2 sm:p-1.5 hover:bg-blue-50 rounded-lg transition-colors group/dup"
                          >
                            <Copy size={13} className="text-slate-400 group-hover/dup:text-blue-500 transition-colors" />
                          </button>
                          <button
                            title="Delete topic"
                            onClick={() => removeTopic(topic.tempId)}
                            className="p-2 sm:p-1.5 hover:bg-red-50 rounded-lg transition-colors group/del"
                          >
                            <Trash2 size={13} className="text-slate-400 group-hover/del:text-red-500 transition-colors" />
                          </button>
                        </div>
                      </div>

                      {/* Topic items */}
                      {topic.items.length > 0 && (
                        <div className="px-4 py-2 space-y-1.5 border-b border-slate-100">
                          {topic.items.map(item => (
                            <div key={item.tempId} className="flex items-center gap-2">
                              {item.editing ? (
                                <>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                                    item.type === 'lesson' ? 'bg-blue-100 text-blue-600' :
                                    item.type === 'quiz'   ? 'bg-amber-100 text-amber-600' :
                                                             'bg-green-100 text-green-600'
                                  }`}>{item.type}</span>
                                  <input
                                    autoFocus
                                    value={item.title}
                                    onChange={e => updateItem(topic.tempId, item.tempId, { title: e.target.value })}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter' && item.title.trim()) {
                                        updateItem(topic.tempId, item.tempId, { editing: false });
                                        if (item.type === 'quiz') setTimeout(() => setQuizContentEdit({ topicTempId: topic.tempId, item: { ...item, editing: false } }), 50);
                                      }
                                    }}
                                    placeholder={`${item.type.charAt(0).toUpperCase() + item.type.slice(1)} title…`}
                                    className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                                  />
                                  <button onClick={() => {
                                    if (item.title.trim()) {
                                      updateItem(topic.tempId, item.tempId, { editing: false });
                                      if (item.type === 'quiz') setTimeout(() => setQuizContentEdit({ topicTempId: topic.tempId, item: { ...item, editing: false } }), 50);
                                    }
                                  }} className="text-xs font-semibold text-rose-600 px-2 py-1 hover:bg-rose-50 rounded-lg">Ok</button>
                                  <button onClick={() => removeItem(topic.tempId, item.tempId)}
                                    className="p-1 hover:bg-red-50 rounded-lg"><X size={12} className="text-red-400" /></button>
                                </>
                              ) : (
                                <>
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 ${
                                    item.type === 'lesson' ? 'bg-blue-100 text-blue-600' :
                                    item.type === 'quiz'   ? 'bg-amber-100 text-amber-600' :
                                                             'bg-green-100 text-green-600'
                                  }`}>{item.type}</span>
                                  <span
                                    className={`flex-1 text-sm text-slate-700 truncate ${item.type !== 'assignment' ? 'cursor-pointer hover:text-rose-600' : ''}`}
                                    onClick={() => {
                                      if (item.type === 'lesson') setLessonContentEdit({ topicTempId: topic.tempId, item });
                                      else if (item.type === 'quiz') setQuizContentEdit({ topicTempId: topic.tempId, item });
                                    }}
                                  >{item.title}</span>
                                  {item.type === 'quiz' && (
                                    <button
                                      onClick={() => setQuizContentEdit({ topicTempId: topic.tempId, item })}
                                      className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 transition-colors ${
                                        item.quiz_id
                                          ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                          : 'bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-600'
                                      }`}
                                    >
                                      <HelpCircle size={10} />
                                      {item.quiz_id ? 'Edit Questions' : 'Build Quiz'}
                                    </button>
                                  )}
                                  <button
                                    onClick={() => {
                                      if (item.type === 'lesson') setLessonContentEdit({ topicTempId: topic.tempId, item });
                                      else if (item.type === 'quiz') setQuizContentEdit({ topicTempId: topic.tempId, item });
                                      else updateItem(topic.tempId, item.tempId, { editing: true });
                                    }}
                                    className="p-1 hover:bg-slate-100 rounded-lg"
                                  ><Edit3 size={12} className="text-slate-400" /></button>
                                  <button onClick={() => removeItem(topic.tempId, item.tempId)}
                                    className="p-1 hover:bg-red-50 rounded-lg"><X size={12} className="text-red-400" /></button>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="px-4 py-3 flex flex-wrap gap-2">
                        {(['lesson', 'quiz', 'assignment'] as const).map(type => (
                          <button
                            key={type}
                            onClick={() => addItem(topic.tempId, type)}
                            className="flex items-center gap-1 text-xs font-semibold text-slate-500 border border-slate-200 hover:border-rose-300 hover:text-rose-600 px-3 py-1.5 rounded-xl transition-colors"
                          >
                            <Plus size={11} /> {type.charAt(0).toUpperCase() + type.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <button
              onClick={addTopic}
              className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors shadow"
            >
              <Plus size={15} /> Add Topic
            </button>
          </div>
        )}

        {/* ── Step 3: Additional ── */}
        {step === 3 && (
          <div className="max-w-3xl mx-auto p-6">
            <div className="flex items-center gap-3 mb-6">
              <button onClick={() => setStep(2)} className="p-2 hover:bg-white rounded-xl transition-colors">
                <ChevronLeft size={18} className="text-slate-500" />
              </button>
              <h2 className="text-xl font-bold text-slate-900">Additional</h2>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-6">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Overview</p>
                <p className="text-sm text-slate-500">Provide essential course information to attract and inform potential students.</p>
              </div>

              {[
                { key: 'what_will_learn',      label: 'What Will I Learn?',          placeholder: 'Define the key takeaways (one per line)' },
                { key: 'target_audience',      label: 'Target Audience',              placeholder: 'Specify the target audience (one per line)' },
                { key: 'materials_included',   label: 'Materials Included',           placeholder: 'List assets provided to students (one per line)' },
                { key: 'requirements',         label: 'Requirements / Instructions',  placeholder: 'Additional requirements or instructions (one per line)' },
              ].map(field => (
                <div key={field.key}>
                  <label className="text-sm font-semibold text-slate-700 block mb-1.5">{field.label}</label>
                  <textarea
                    value={form[field.key as keyof CourseFormData] as string}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    rows={3}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 transition resize-none placeholder-slate-300"
                  />
                </div>
              ))}

              <div>
                <label className="text-sm font-semibold text-slate-700 block mb-1.5">Total Course Duration</label>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number" min={0} value={form.duration_hours}
                      onChange={e => setForm(f => ({ ...f, duration_hours: +e.target.value }))}
                      className="w-24 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                    />
                    <span className="text-sm text-slate-500">hour(s)</span>
                  </div>
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="number" min={0} max={59} value={form.duration_minutes_extra}
                      onChange={e => setForm(f => ({ ...f, duration_minutes_extra: +e.target.value }))}
                      className="w-24 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 transition"
                    />
                    <span className="text-sm text-slate-500">min(s)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-white flex-shrink-0">
        <button
          onClick={() => setStep(s => Math.max(1, s - 1) as CourseBuilderStep)}
          disabled={step === 1}
          className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={15} /> Previous
        </button>
        <div className="flex items-center gap-1">
          {stepLabels.map(s => (
            <div key={s.num} className={`w-2 h-2 rounded-full transition-all ${step === s.num ? 'bg-rose-500 w-5' : step > s.num ? 'bg-emerald-400' : 'bg-slate-200'}`} />
          ))}
        </div>
        {step < 3 ? (
          <button
            onClick={() => setStep(s => Math.min(3, s + 1) as CourseBuilderStep)}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors shadow"
          >
            Next <ChevronRight size={15} />
          </button>
        ) : (
          <button
            onClick={() => handleSave(false)}
            disabled={saving || !form.title.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors shadow"
          >
            <Save size={13} /> {saving ? 'Saving…' : 'Save Draft'}
          </button>
        )}
      </div>

      {/* Lesson Content Modal */}
      {lessonContentEdit && (
        <LessonContentModal
          item={lessonContentEdit.item}
          topicTitle={topics.find(t => t.tempId === lessonContentEdit.topicTempId)?.title ?? ''}
          onSave={patch => updateItem(lessonContentEdit.topicTempId, lessonContentEdit.item.tempId, patch)}
          onClose={() => setLessonContentEdit(null)}
        />
      )}

      {/* Quiz Builder Modal */}
      {quizContentEdit && (
        <QuizBuilderModal
          item={quizContentEdit.item}
          topicTitle={topics.find(t => t.tempId === quizContentEdit.topicTempId)?.title ?? ''}
          onSave={patch => updateItem(quizContentEdit.topicTempId, quizContentEdit.item.tempId, patch)}
          onClose={() => setQuizContentEdit(null)}
        />
      )}
    </div>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────
export default function AdminDashboard({ onPreviewCourse }: { onPreviewCourse: (id: string) => void }) {
  const { profile } = useAuth();
  const [page, setPage]         = useState<AdminPage>('overview');
  const [users, setUsers]       = useState<Profile[]>([]);
  const [lessons, setLessons]   = useState<LessonRow[]>([]);
  const [levelRows, setLevelRows] = useState<LevelRow[]>([]);
  const [courses, setCourses]   = useState<CourseRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [contentFilter, setContentFilter] = useState<string>('all');
  const [stats, setStats] = useState({ students: 0, teachers: 0, admins: 0, lessons: 0, published: 0, enrollments: 0, completions: 0, courses: 0, publishedCourses: 0 });

  // Modals
  const [deleteLesson, setDeleteLesson]   = useState<LessonRow | null>(null);
  const [deleteUser, setDeleteUser]       = useState<Profile | null>(null);
  const [deleteCourse, setDeleteCourse]   = useState<CourseRow | null>(null);
  const [editLesson, setEditLesson]       = useState<LessonRow | null>(null);
  const [showCourseBuilder, setShowCourseBuilder] = useState(false);
  const [editCourseId, setEditCourseId] = useState<string | null>(null);
  const [editUser, setEditUser] = useState<Profile | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [editCategory, setEditCategory] = useState<CategoryRow | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<CategoryRow | null>(null);

  const loadData = async () => {
    const [usersRes, lessonsRes, levelsRes, enrRes, progRes, profilesRes, coursesRes, topicsRes, categoriesRes, courseCompletionsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('lessons').select('*').order('created_at', { ascending: false }),
      supabase.from('levels').select('*').order('sort_order'),
      supabase.from('enrollments').select('*', { count: 'exact' }),
      supabase.from('lesson_progress').select('*').eq('completed', true),
      supabase.from('profiles').select('id, full_name, role'),
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
      supabase.from('course_topics').select('id, course_id'),
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('course_completions').select('*', { count: 'exact' }),
    ]);

    const allUsers    = usersRes.data ?? [];
    const allLessons  = lessonsRes.data ?? [];
    const allProfiles = profilesRes.data ?? [];
    const allLevels   = levelsRes.data ?? [];
    const allCourses  = coursesRes.data ?? [];
    const allTopics   = topicsRes.data ?? [];
    const allCategories = categoriesRes.data ?? [];

    setUsers(allUsers);
    setLessons(allLessons.map(l => ({
      id: l.id, title: l.title, is_published: l.is_published,
      level_key:   allLevels.find(lv => lv.id === l.level_id)?.key   ?? 'elementary',
      level_label: allLevels.find(lv => lv.id === l.level_id)?.label ?? '—',
      level_id:    l.level_id,
      teacher_name: allProfiles.find(p => p.id === l.teacher_id)?.full_name ?? 'Unknown',
      duration_minutes: l.duration_minutes,
      created_at: l.created_at,
      description: l.description ?? '',
    })));
    setLevelRows(allLevels.map(lv => ({
      id: lv.id, key: lv.key, label: lv.label,
      description: lv.description ?? '', sort_order: lv.sort_order,
      lesson_count:    allLessons.filter(l => l.level_id === lv.id).length,
      published_count: allLessons.filter(l => l.level_id === lv.id && l.is_published).length,
    })));
    setCourses(allCourses.map(c => ({
      id: c.id, title: c.title,
      description: c.description ?? '',
      thumbnail_url: c.thumbnail_url,
      pricing_model: c.pricing_model,
      price: c.price,
      visibility: c.visibility,
      difficulty_level: c.difficulty_level,
      is_published: c.is_published,
      created_at: c.created_at,
      topic_count: allTopics.filter(t => t.course_id === c.id).length,
    })));
    setStats({
      students:        allUsers.filter(u => u.role === 'student').length,
      teachers:        allUsers.filter(u => u.role === 'teacher').length,
      admins:          allUsers.filter(u => u.role === 'admin').length,
      lessons:         allLessons.length,
      published:       allLessons.filter(l => l.is_published).length,
      enrollments:     enrRes.count ?? 0,
      completions:     (progRes.data?.length ?? 0) + (courseCompletionsRes.count ?? 0),
      courses:         allCourses.length,
      publishedCourses: allCourses.filter(c => c.is_published).length,
    });
    setCategories(allCategories.map(cat => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      description: cat.description,
      icon: cat.icon,
      color: cat.color,
      sort_order: cat.sort_order,
      course_count: allCourses.filter(c => c.category_id === cat.id).length,
      user_count: allUsers.filter(u => (u as any).category_id === cat.id).length,
    })));
    setLoading(false);
  };

  useEffect(() => { loadData(); }, []);

  // Auto-refresh when users or content change in real time
  useEffect(() => {
    const channel = supabase
      .channel('admin-overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lessons' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'enrollments' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lesson_progress' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'courses' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'course_completions' }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleToggleLesson = async (id: string) => {
    const current = lessons.find(l => l.id === id);
    if (!current) return;
    const next = !current.is_published;
    await supabase.from('lessons').update({ is_published: next }).eq('id', id);
    setLessons(p => p.map(l => l.id === id ? { ...l, is_published: next } : l));
    setStats(s => ({ ...s, published: s.published + (next ? 1 : -1) }));

    // Notify all students enrolled in this level when publishing
    if (next && current.level_id) {
      const { data: enrollments } = await supabase
        .from('enrollments')
        .select('student_id')
        .eq('level_id', current.level_id);
      const studentIds = (enrollments ?? []).map(e => e.student_id);
      await Promise.allSettled(
        studentIds.map(id =>
          notifyLessonPublished(id, current.title, current.level_label)
        )
      );
      // SMS opted-in students
      smsNewLessonByLevelId(current.level_id, current.title).catch(console.warn);
    }
  };

  const handleDeleteLesson = async (id: string) => {
    await supabase.from('lessons').delete().eq('id', id);
    setLessons(p => p.filter(l => l.id !== id));
    setDeleteLesson(null);
  };

  const handleEditLesson = async (id: string, data: { title: string; description: string; duration_minutes: number; level_id: string; is_published: boolean }) => {
    await supabase.from('lessons').update(data).eq('id', id);
    const newLevelKey   = levelRows.find(l => l.id === data.level_id)?.key   ?? 'elementary';
    const newLevelLabel = levelRows.find(l => l.id === data.level_id)?.label ?? '—';
    setLessons(p => p.map(l => l.id === id ? { ...l, ...data, level_key: newLevelKey, level_label: newLevelLabel } : l));
    setEditLesson(null);
  };

  const handleChangeRole = async (userId: string, role: string) => {
    await supabase.from('profiles').update({ role }).eq('id', userId);
    setUsers(p => p.map(u => u.id === userId ? { ...u, role: role as Profile['role'] } : u));
  };

  const handleEditUser = async (userId: string, data: { full_name: string; role: UserRole; category_id: string | null; email: string | null; phone_number: string | null }) => {
    await supabase.from('profiles').update(data).eq('id', userId);
    setUsers(p => p.map(u => u.id === userId ? { ...u, ...data } : u));
    setEditUser(null);
  };

  const handleDeleteUser = async (userId: string) => {
    await supabase.from('profiles').delete().eq('id', userId);
    setUsers(p => p.filter(u => u.id !== userId));
    setDeleteUser(null);
  };

  const handleExportUsers = () => {
    setExporting(true);
    try {
      const headers = ['ID', 'Full Name', 'Role', 'Category ID', 'Bio', 'Avatar URL', 'Created At'];
      const rows = users.map(u => [
        u.id,
        u.full_name,
        u.role,
        u.category_id ?? '',
        u.bio ?? '',
        u.avatar_url ?? '',
        u.created_at,
      ]);
      const escape = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
      const csv = [headers, ...rows].map(r => r.map(escape).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
      setUserMenuOpen(false);
    }
  };

  const handleImportUsers = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const text = String(reader.result || '');
        const lines = text.split(/\r?\n/).filter(Boolean);
        if (lines.length < 2) { alert('CSV is empty or has no data rows.'); return; }
        const parseRow = (line: string) => {
          const vals: string[] = [];
          let cur = '';
          let inQ = false;
          for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (ch === '"') {
              if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
              else inQ = !inQ;
            } else if (ch === ',' && !inQ) { vals.push(cur); cur = ''; }
            else cur += ch;
          }
          vals.push(cur);
          return vals;
        };
        const dataRows = lines.slice(1).map(parseRow);
        const payload = dataRows
          .map(r => ({
            full_name: r[1] || '',
            role: (r[2] as UserRole) || 'student',
            category_id: r[3] || null,
            bio: r[4] || null,
            avatar_url: r[5] || null,
          }))
          .filter(u => u.full_name);
        if (payload.length === 0) { alert('No valid user rows found.'); return; }
        const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
        if (error) {
          const { data: inserted, error: insErr } = await supabase.from('profiles').insert(payload);
          if (insErr) { alert('Import failed: ' + insErr.message); return; }
          if (inserted) setUsers(p => [...p, ...(inserted as Profile[])]);
        } else {
          const { data: fresh } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
          if (fresh) setUsers(fresh as Profile[]);
        }
        alert(`Imported ${payload.length} user(s).`);
      } finally {
        setImporting(false);
        setUserMenuOpen(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleCreateUser = async (data: { full_name: string; role: UserRole; category_id: string | null; email: string | null; phone_number: string | null }) => {
    const { data: result, error } = await supabase.functions.invoke('create-user', { body: data });
    if (error) { alert('Create failed: ' + error.message); return; }
    if (result?.error) { alert('Create failed: ' + result.error); return; }
    if (result?.profile) setUsers(p => [result.profile as Profile, ...p]);
    setShowCreateUser(false);
  };


  const handleToggleCoursePublish = async (id: string) => {
    const current = courses.find(c => c.id === id);
    if (!current) return;
    const next = !current.is_published;
    await supabase.from('courses').update({ is_published: next }).eq('id', id);
    setCourses(p => p.map(c => c.id === id ? { ...c, is_published: next } : c));
  };

  const handleDeleteCourse = async (id: string) => {
    await supabase.from('courses').delete().eq('id', id);
    setCourses(p => p.filter(c => c.id !== id));
    setDeleteCourse(null);
  };

  // Category CRUD
  const handleSaveCategory = async (data: { name: string; slug: string; description: string; icon: string; color: string; sort_order: number }) => {
    if (editCategory) {
      const { data: updated } = await supabase.from('categories').update(data).eq('id', editCategory.id).select().single();
      if (updated) {
        setCategories(prev => prev.map(c => c.id === editCategory.id ? { ...c, ...updated, course_count: c.course_count, user_count: c.user_count } : c));
      }
    } else {
      const { data: created } = await supabase.from('categories').insert(data).select().single();
      if (created) {
        setCategories(prev => [...prev, { ...created, course_count: 0, user_count: 0 }]);
      }
    }
    setShowCategoryForm(false);
    setEditCategory(null);
  };

  const handleDeleteCategory = async (id: string) => {
    await supabase.from('categories').delete().eq('id', id);
    setCategories(prev => prev.filter(c => c.id !== id));
    setDeleteCategory(null);
  };

  const roleColors: Record<string, string> = {
    student: 'text-blue-700 bg-blue-50 border-blue-200',
    teacher: 'text-violet-700 bg-violet-50 border-violet-200',
    admin:   'text-rose-700 bg-rose-50 border-rose-200',
  };

  const filteredUsers   = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.role.toLowerCase().includes(search.toLowerCase())
  );
  const filteredLessons = contentFilter === 'all'
    ? lessons
    : contentFilter === 'published'
      ? lessons.filter(l => l.is_published)
      : contentFilter === 'draft'
        ? lessons.filter(l => !l.is_published)
        : lessons.filter(l => l.level_id === contentFilter);

  const coursesMenuItems: ActionItem[] = [
    { icon: Plus,      label: 'Create New Course', onClick: () => setShowCourseBuilder(true) },
    { icon: FileText,  label: 'Import Courses',    onClick: () => {}, disabled: true, divider: true },
    { icon: RefreshCw, label: 'Refresh',           onClick: loadData, divider: true },
  ];

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <>
      <SidebarLayout
        items={navItems} active={page}
        onNavigate={k => setPage(k as AdminPage)}
        accentGradient="from-rose-500 to-red-600"
        accentText="text-rose-500"
      >
        <div className="p-5 sm:p-7 max-w-6xl mx-auto">

          {/* ── OVERVIEW ── */}
          {page === 'overview' && (
            <div className="space-y-7 animate-fadeInUp">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center shadow-lg">
                  <Shield size={22} className="text-white" />
                </div>
                <div>
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900">Admin Overview</h1>
                  <p className="text-slate-500 text-sm">Welcome back, {profile?.full_name}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { icon: GraduationCap, label: 'Students',        value: stats.students,    g: 'from-blue-500 to-blue-600' },
                  { icon: Users,         label: 'Teachers',        value: stats.teachers,    g: 'from-violet-500 to-purple-600' },
                  { icon: BookOpen,      label: 'Lessons',         value: stats.lessons,     g: 'from-amber-400 to-orange-500' },
                  { icon: Layers,        label: 'Courses',         value: stats.courses,     g: 'from-indigo-500 to-blue-600' },
                  { icon: CheckCircle,   label: 'Completions',     value: stats.completions, g: 'from-emerald-400 to-teal-500' },
                  { icon: TrendingUp,    label: 'Published',       value: stats.published + stats.publishedCourses, g: 'from-cyan-500 to-blue-500' },
                  { icon: Activity,      label: 'Enrollments',     value: stats.enrollments, g: 'from-rose-500 to-red-500' },
                  { icon: Shield,        label: 'Admins',          value: stats.admins,      g: 'from-slate-500 to-slate-700' },
                  { icon: BarChart2,     label: 'Total Users',    value: stats.students + stats.teachers + stats.admins, g: 'from-fuchsia-500 to-pink-600' },
                ].map((s, i) => (
                  <div key={s.label} className={`rounded-2xl p-4 bg-gradient-to-br ${s.g} text-white shadow-md`} style={{ animationDelay: `${i * 0.05}s` }}>
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center mb-3">
                      <s.icon size={17} className="text-white" />
                    </div>
                    <div className="text-2xl font-black">{s.value}</div>
                    <div className="text-white/75 text-xs mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">User Distribution</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Students', count: stats.students, g: 'from-blue-400 to-blue-600' },
                      { label: 'Teachers', count: stats.teachers, g: 'from-violet-400 to-purple-600' },
                      { label: 'Admins',   count: stats.admins,   g: 'from-rose-400 to-red-600' },
                    ].map(r => {
                      const total = stats.students + stats.teachers + stats.admins;
                      return (
                      <div key={r.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700">{r.label}</span>
                          <span className="text-slate-400">{r.count} / {total}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${r.g} rounded-full`} style={{ width: total ? `${(r.count / total) * 100}%` : '0%', transition: 'width 0.8s' }} />
                        </div>
                      </div>
                      );
                    })}
                  </div>
                </div>
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h3 className="font-semibold text-slate-900 mb-4">Content Health</h3>
                  <div className="space-y-3">
                    {[
                      { label: 'Published Courses', count: stats.publishedCourses,                 total: Math.max(stats.courses, 1), g: 'from-emerald-400 to-teal-500' },
                      { label: 'Draft Courses',    count: stats.courses - stats.publishedCourses, total: Math.max(stats.courses, 1), g: 'from-amber-400 to-orange-500' },
                      { label: 'Published Lessons', count: stats.published,                        total: Math.max(stats.lessons, 1), g: 'from-cyan-400 to-blue-500' },
                      { label: 'Draft Lessons',    count: stats.lessons - stats.published,         total: Math.max(stats.lessons, 1), g: 'from-sky-400 to-indigo-500' },
                    ].map(r => (
                      <div key={r.label}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700">{r.label}</span>
                          <span className="text-slate-400">{r.count} / {r.total}</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full bg-gradient-to-r ${r.g} rounded-full`} style={{ width: `${Math.min((r.count / r.total) * 100, 100)}%`, transition: 'width 0.8s' }} />
                        </div>
                      </div>
                    ))}
                    {(() => {
                      const rate = stats.enrollments > 0 ? Math.round((stats.completions / stats.enrollments) * 100) : 0;
                      return (
                      <div>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="font-medium text-slate-700">Completion Rate</span>
                          <span className="text-slate-400">{rate}% <span className="text-slate-300">({stats.completions}/{stats.enrollments})</span></span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-400 to-blue-600 rounded-full" style={{ width: `${rate}%`, transition: 'width 0.8s' }} />
                        </div>
                      </div>
                      );
                    })()}
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                  <h2 className="font-semibold text-slate-900">Recent Users</h2>
                  <button onClick={() => setPage('users')} className="text-sm text-rose-600 font-medium flex items-center gap-1">View all <ChevronRight size={14} /></button>
                </div>
                <div className="divide-y divide-slate-50">
                  {users.slice(0, 5).map(u => (
                    <div key={u.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {u.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-slate-900 text-sm truncate">{u.full_name || 'Unnamed'}</p>
                        <p className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full capitalize border ${roleColors[u.role]}`}>{u.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── USERS ── */}
          {page === 'users' && (
            <div className="space-y-5 animate-fadeInUp">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900">User Management</h1>
                  <p className="text-slate-500 text-sm mt-1">{users.length} total users</p>
                </div>
                <div className="relative">
                  <button
                    onClick={() => setUserMenuOpen(o => !o)}
                    className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
                    aria-label="User actions"
                  >
                    <MoreVertical size={20} />
                  </button>
                  {userMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setUserMenuOpen(false)} />
                      <div className="absolute right-0 top-full mt-1 z-40 w-52 bg-white rounded-xl border border-slate-200 shadow-xl py-1.5 animate-fadeInUp">
                        <button
                          onClick={() => { setShowCreateUser(true); setUserMenuOpen(false); }}
                          className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-3 transition"
                        >
                          <UserPlus size={16} /> Create User
                        </button>
                        <label className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-3 transition cursor-pointer">
                          <Upload size={16} />
                          {importing ? 'Importing…' : 'Import CSV'}
                          <input type="file" accept=".csv" className="hidden" onChange={handleImportUsers} disabled={importing} />
                        </label>
                        <button
                          onClick={handleExportUsers}
                          disabled={exporting || users.length === 0}
                          className="w-full px-4 py-2.5 text-left text-sm text-slate-700 hover:bg-rose-50 hover:text-rose-600 flex items-center gap-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <Download size={16} /> {exporting ? 'Exporting…' : 'Export CSV'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="relative">
                <Search size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)}
                  placeholder="Search by name or role…"
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 transition shadow-sm" />
              </div>

              <div className="flex gap-2 flex-wrap">
                {[
                  { label: `All (${users.length})`,         key: 'all' },
                  { label: `Students (${stats.students})`,  key: 'student' },
                  { label: `Teachers (${stats.teachers})`,  key: 'teacher' },
                  { label: `Admins (${stats.admins})`,      key: 'admin' },
                ].map(f => (
                  <button key={f.key}
                    onClick={() => setSearch(f.key === 'all' ? '' : f.key)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      (f.key === 'all' && !search) || search === f.key
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredUsers.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-100 p-14 text-center">
                  <UserX size={40} className="text-slate-200 mx-auto mb-3" />
                  <p className="text-slate-500">No users found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredUsers.map(u => (
                    <div key={u.id} className="group bg-white rounded-2xl border border-slate-100 p-4 hover:shadow-md hover:-translate-y-0.5 transition-all shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 flex items-center justify-center text-white font-black text-base flex-shrink-0">
                            {u.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{u.full_name || 'Unnamed'}</p>
                            <p className="text-xs text-slate-400">{new Date(u.created_at).toLocaleDateString()}</p>
                          </div>
                        </div>
                        <UserActionMenu
                          user={u}
                          onChangeRole={role => handleChangeRole(u.id, role)}
                          onEdit={() => setEditUser(u)}
                          onDelete={() => setDeleteUser(u)}
                        />
                      </div>
                      <span className={`inline-flex items-center text-xs font-bold px-3 py-1 rounded-full capitalize border ${roleColors[u.role]}`}>
                        {u.role === 'admin'   && <Crown size={11} className="mr-1" />}
                        {u.role === 'teacher' && <BookOpen size={11} className="mr-1" />}
                        {u.role === 'student' && <GraduationCap size={11} className="mr-1" />}
                        {u.role}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CONTENT ── */}
          {page === 'content' && (
            <div className="space-y-6 animate-fadeInUp">
              <div>
                <h1 className="font-display text-2xl font-bold text-slate-900">Content Management</h1>
                <p className="text-slate-500 text-sm mt-1">{lessons.length} lessons · {stats.published} published</p>
              </div>

              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'all',       label: `All (${lessons.length})` },
                  { key: 'published', label: `Published (${stats.published})` },
                  { key: 'draft',     label: `Drafts (${lessons.length - stats.published})` },
                  ...levelRows.map(lv => ({ key: lv.id, label: `${LEVEL_META[lv.key]?.emoji ?? ''} ${lv.label} (${lv.lesson_count})` })),
                ].map(f => (
                  <button key={f.key}
                    onClick={() => setContentFilter(f.key)}
                    className={`px-4 py-1.5 rounded-xl text-sm font-medium transition-all ${
                      contentFilter === f.key
                        ? 'bg-rose-600 text-white shadow-md'
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-rose-300'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredLessons.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-16 text-center">
                  <BookOpen size={44} className="text-slate-200 mx-auto mb-4" />
                  <p className="font-semibold text-slate-500">No lessons found</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {filteredLessons.map(lesson => (
                    <AdminLessonCard
                      key={lesson.id}
                      lesson={lesson}
                      onToggle={() => handleToggleLesson(lesson.id)}
                      onEdit={() => setEditLesson(lesson)}
                      onDelete={() => setDeleteLesson(lesson)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── COURSES (Course Builder) ── */}
          {page === 'courses' && (
            <div className="space-y-6 animate-fadeInUp">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900">Courses Management</h1>
                  <p className="text-slate-500 text-sm mt-1">
                    {courses.length} {courses.length === 1 ? 'course' : 'courses'} · {courses.filter(c => c.is_published).length} published
                  </p>
                </div>
                <ActionMenu items={coursesMenuItems} align="right" />
              </div>

              {courses.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
                    <Layers size={32} className="text-rose-300" />
                  </div>
                  <p className="font-semibold text-slate-600 mb-1">No courses yet</p>
                  <p className="text-sm text-slate-400 mb-5">Create your first course using the Course Builder</p>
                  <button
                    onClick={() => setShowCourseBuilder(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors shadow"
                  >
                    <Plus size={15} /> Create New Course
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                  {courses.map(course => (
                    <CourseCard
                      key={course.id}
                      course={course}
                      onEdit={() => setEditCourseId(course.id)}
                      onDelete={() => setDeleteCourse(course)}
                      onTogglePublish={() => handleToggleCoursePublish(course.id)}
                      onPreview={() => onPreviewCourse(course.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── CATEGORIES ── */}
          {page === 'categories' && (
            <div className="space-y-6 animate-fadeInUp">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h1 className="font-display text-2xl font-bold text-slate-900">Categories</h1>
                  <p className="text-slate-500 text-sm mt-1">{categories.length} categories for organizing users and courses</p>
                </div>
                <button
                  onClick={() => setShowCategoryForm(true)}
                  className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
                >
                  <Plus size={16} /> Add Category
                </button>
              </div>

              {categories.length === 0 ? (
                <div className="bg-white rounded-3xl border border-dashed border-slate-200 p-16 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <FolderOpen size={32} className="text-slate-300" />
                  </div>
                  <p className="font-semibold text-slate-600 mb-1">No categories yet</p>
                  <p className="text-sm text-slate-400 mb-5">Create your first category to organize users and courses</p>
                  <button
                    onClick={() => setShowCategoryForm(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    <Plus size={16} /> Add Category
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {categories.map(cat => (
                    <div key={cat.id} className="group bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:-translate-y-0.5 transition-all shadow-sm">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${cat.color} flex items-center justify-center flex-shrink-0`}>
                            <Tag size={18} className="text-white" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-sm truncate">{cat.name}</p>
                            <p className="text-xs text-slate-400">{cat.slug}</p>
                          </div>
                        </div>
                        <ActionMenu
                          items={[
                            { icon: Edit3, label: 'Edit', onClick: () => setEditCategory(cat) },
                            { icon: Trash2, label: 'Delete', onClick: () => setDeleteCategory(cat), danger: true, divider: true },
                          ]}
                        />
                      </div>
                      {cat.description && (
                        <p className="text-xs text-slate-500 mb-3 line-clamp-2">{cat.description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><Users size={12} /> {cat.user_count} users</span>
                        <span className="flex items-center gap-1"><Layers size={12} /> {cat.course_count} courses</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── STUDENT PROGRESS ── */}
          {page === 'progress' && (
            <div className="animate-fadeInUp">
              <AdminStudentProgress />
            </div>
          )}

          {/* ── ACTIVITY REPORT ── */}
          {page === 'activity' && (
            <div className="animate-fadeInUp">
              <AdminActivityReport />
            </div>
          )}

          {/* ── ANALYTICS ── */}
          {page === 'analytics' && (
            <AdminAnalyticsPage stats={stats} users={users} lessons={lessons} courses={courses} />
          )}

          {/* ── LIVE ARENA ── */}
          {page === 'arena' && (
            <div className="animate-fadeInUp">
              <AdminArenaPage />
            </div>
          )}

          {/* ── SETTINGS ── */}
          {page === 'settings' && (
            <div className="space-y-6 animate-fadeInUp">
              <h1 className="font-display text-2xl font-bold text-slate-900">Platform Settings</h1>
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm divide-y divide-slate-100">
                {[
                  { label: 'Platform Name',         value: 'Ilesy Academy', desc: 'The public name of the platform' },
                  { label: 'Default Language',       value: 'Multiple',   desc: 'Available teaching languages' },
                  { label: 'Max Levels',             value: '5',         desc: 'Number of learning levels' },
                  { label: 'Allow Self-Enrollment',  value: 'Enabled',   desc: 'Students can enroll in levels themselves' },
                  { label: 'Email Confirmation',     value: 'Disabled',  desc: 'Require email verification on signup' },
                ].map(s => (
                  <div key={s.label} className="px-5 py-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900 text-sm">{s.label}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{s.desc}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-600 bg-slate-100 px-3 py-1 rounded-xl">{s.value}</span>
                  </div>
                ))}
              </div>
              <div className="bg-rose-50 border border-rose-100 rounded-2xl p-5">
                <h3 className="font-semibold text-rose-700 mb-1">Danger Zone</h3>
                <p className="text-sm text-rose-600 mb-4">These actions are irreversible. Proceed with caution.</p>
                <button disabled className="px-4 py-2 bg-red-600 text-white text-sm font-semibold rounded-xl opacity-50 cursor-not-allowed">
                  Reset All Data
                </button>
              </div>
              <AdminSMSPanel />
            </div>
          )}

          {/* ── COMMUNITY CHAT ─────────────────────────────────────────────── */}
          {page === 'forum' && (
            <ForumPage onBack={() => setPage('overview')} />
          )}

          {page === 'whatsapp' && (
            <AdminWhatsAppPanel />
          )}

        </div>
      </SidebarLayout>

      {/* ── Modals ── */}
      {deleteLesson && (
        <DeleteModal
          title="Delete Lesson?"
          body={`"${deleteLesson.title}" will be permanently removed.`}
          onConfirm={() => handleDeleteLesson(deleteLesson.id)}
          onCancel={() => setDeleteLesson(null)}
        />
      )}
      {deleteUser && (
        <DeleteModal
          title="Delete User?"
          body={`"${deleteUser.full_name}" will be permanently removed from the platform.`}
          onConfirm={() => handleDeleteUser(deleteUser.id)}
          onCancel={() => setDeleteUser(null)}
        />
      )}
      {deleteCourse && (
        <DeleteModal
          title="Delete Course?"
          body={`"${deleteCourse.title}" and all its topics will be permanently removed.`}
          onConfirm={() => handleDeleteCourse(deleteCourse.id)}
          onCancel={() => setDeleteCourse(null)}
        />
      )}

      {editLesson && (
        <EditLessonModal
          lesson={editLesson}
          levels={levelRows}
          onSave={handleEditLesson}
          onClose={() => setEditLesson(null)}
        />
      )}

      {/* Course Builder full-screen */}
      {showCourseBuilder && (
        <CourseBuilderModal
          onClose={() => setShowCourseBuilder(false)}
          onSaved={course => setCourses(prev => [course, ...prev])}
        />
      )}
      {editCourseId && (
        <CourseBuilderModal
          editCourseId={editCourseId}
          onClose={() => setEditCourseId(null)}
          onSaved={updated => setCourses(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c))}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          categories={categories}
          onSave={handleEditUser}
          onClose={() => setEditUser(null)}
        />
      )}
      {showCreateUser && (
        <CreateUserModal
          categories={categories}
          onSave={handleCreateUser}
          onClose={() => setShowCreateUser(false)}
        />
      )}
      {(showCategoryForm || editCategory) && (
        <CategoryFormModal
          category={editCategory}
          onSave={handleSaveCategory}
          onClose={() => { setShowCategoryForm(false); setEditCategory(null); }}
        />
      )}
      {deleteCategory && (
        <DeleteModal
          title="Delete Category?"
          body={`"${deleteCategory.name}" will be permanently removed.`}
          onConfirm={() => handleDeleteCategory(deleteCategory.id)}
          onCancel={() => setDeleteCategory(null)}
        />
      )}
    </>
  );
}
