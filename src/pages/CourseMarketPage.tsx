import { useState } from 'react';
import {
  BookOpen, CheckCircle, Clock, Globe, Play, ArrowRight,
  Gift, Crown, Search, ArrowLeft, Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Course {
  id: string;
  title: string;
  description: string | null;
  thumbnail_url: string | null;
  difficulty_level: string | null;
  pricing_model: string | null;
  price: number | null;
  visibility: string | null;
  duration_hours: number | null;
  duration_minutes: number | null;
  category_id: string | null;
  instructor_name?: string;
  category_name?: string;
  category_color?: string;
}

interface CourseEnrollment {
  id: string;
  student_id: string;
  course_id: string;
  enrolled_at: string;
}

interface CourseMarketPageProps {
  onOpenCourse: (courseId: string) => void;
  onEnroll: (courseId: string) => void;
  courses: Course[];
  courseEnrollments: CourseEnrollment[];
  myCategoryId: string | null;
}

function CourseCard({
  course, enrolled, onOpen, onEnroll,
}: {
  course: Course;
  enrolled: boolean;
  onOpen: () => void;
  onEnroll: (e: React.MouseEvent) => void;
}) {
  const cover = course.thumbnail_url ||
    'https://images.pexels.com/photos/301926/pexels-photo-301926.jpeg?auto=compress&cs=tinysrgb&w=600&h=300&fit=crop';

  const diffColor =
    course.difficulty_level === 'Beginner' ? 'bg-emerald-100 text-emerald-700' :
    course.difficulty_level === 'Intermediate' ? 'bg-blue-100 text-blue-700' :
    'bg-rose-100 text-rose-700';

  return (
    <div
      onClick={onOpen}
      className="group relative bg-white rounded-2xl overflow-hidden border border-slate-100 cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-transparent"
      style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="relative h-44 overflow-hidden">
        <img
          src={cover}
          alt={course.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${diffColor}`}>
            {course.difficulty_level || 'All Levels'}
          </span>
          {enrolled ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-white bg-emerald-500 px-2.5 py-1 rounded-full">
              <CheckCircle size={10} /> Enrolled
            </span>
          ) : (
            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
              course.pricing_model === 'free' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
            }`}>
              {course.pricing_model === 'free' ? 'Free' : `${Number(course.price || 0).toFixed(2)}`}
            </span>
          )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 px-4 pb-4">
          <h3 className="font-black text-white text-base leading-tight line-clamp-2 drop-shadow-sm">
            {course.title}
          </h3>
        </div>
      </div>

      <div className="p-4">
        {course.category_name && (
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: course.category_color || '#94a3b8' }} />
            <span className="text-[11px] font-semibold text-slate-500">{course.category_name}</span>
          </div>
        )}
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-3 min-h-[2.5rem]">
          {course.description || 'No description available'}
        </p>
        <div className="flex items-center gap-3 mb-4 text-[11px] text-slate-400">
          <span className="flex items-center gap-1"><Clock size={10} /> {course.duration_hours ? `${course.duration_hours}h` : ''} {course.duration_minutes ? `${course.duration_minutes}m` : ''}</span>
          <span className="flex items-center gap-1"><Globe size={10} /> {course.visibility === 'public' ? 'Public' : 'Private'}</span>
          {course.instructor_name && <span className="flex items-center gap-1">{course.instructor_name}</span>}
        </div>

        {enrolled ? (
          <button
            onClick={e => { e.stopPropagation(); onOpen(); }}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md shadow-blue-100"
          >
            <Play size={13} className="fill-white" /> Continue
            <ArrowRight size={14} className="ml-auto" />
          </button>
        ) : (
          <button
            onClick={onEnroll}
            className="w-full py-2.5 bg-gradient-to-r from-blue-600 to-cyan-500 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all shadow-md shadow-blue-100 hover:shadow-lg"
          >
            <Sparkles size={13} /> Enroll Now
            <ArrowRight size={14} className="ml-auto" />
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon: Icon, title, subtitle, action, actionLabel,
}: {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  action?: () => void;
  actionLabel?: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-dashed border-slate-200 text-center px-4">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-cyan-100 flex items-center justify-center mb-4 shadow-inner">
        <Icon size={28} className="text-blue-400" />
      </div>
      <h2 className="text-base font-bold text-slate-700 mb-1">{title}</h2>
      <p className="text-sm text-slate-400 max-w-xs mx-auto mb-5">{subtitle}</p>
      {action && actionLabel && (
        <button
          onClick={action}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-200 hover:shadow-xl transition-all hover:-translate-y-0.5"
        >
          {actionLabel} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

export default function CourseMarketPage({
  onOpenCourse, onEnroll, courses, courseEnrollments, myCategoryId,
}: CourseMarketPageProps) {
  const [activeTab, setActiveTab] = useState<'free' | 'paid'>('free');
  const [search, setSearch] = useState('');
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(
    new Set(courseEnrollments.map(e => e.course_id))
  );

  const isEnrolled = (courseId: string) => enrolledIds.has(courseId);

  const handleEnroll = async (courseId: string) => {
    await onEnroll(courseId);
    setEnrolledIds(prev => new Set(prev).add(courseId));
  };

  const filtered = (list: Course[]) => {
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(c =>
      c.title.toLowerCase().includes(q) ||
      (c.description && c.description.toLowerCase().includes(q)) ||
      (c.category_name && c.category_name.toLowerCase().includes(q))
    );
  };

  // Category filter: if myCategoryId is null (ALL), show all courses; otherwise only courses in student's category
  const categoryMatch = (c: Course) => !myCategoryId || c.category_id === myCategoryId;

  // Tab 1: Free courses in student's category, NOT enrolled
  const tab1Courses = filtered(
    courses.filter(c => c.pricing_model === 'free' && categoryMatch(c) && !isEnrolled(c.id))
  );

  // Tab 2: Paid courses in student's category, NOT enrolled
  const tab2Courses = filtered(
    courses.filter(c => c.pricing_model !== 'free' && categoryMatch(c) && !isEnrolled(c.id))
  );

  const tabs = [
    {
      key: 'free' as const,
      label: 'Free',
      icon: Gift,
      count: tab1Courses.length,
      color: 'from-emerald-500 to-teal-600',
      textColor: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
      courses: tab1Courses,
    },
    {
      key: 'paid' as const,
      label: 'Paid',
      icon: Crown,
      count: tab2Courses.length,
      color: 'from-amber-500 to-orange-600',
      textColor: 'text-amber-600',
      bgColor: 'bg-amber-50',
      courses: tab2Courses,
    },
  ];

  const currentTab = tabs.find(t => t.key === activeTab)!;

  return (
    <div className="space-y-6 animate-fadeInUp">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">Course Market</h1>
          <p className="text-slate-500 text-sm mt-1">Discover and enroll in courses across all categories</p>
        </div>
        <div className="relative flex-shrink-0 w-full sm:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search courses..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
          />
        </div>
      </div>

      <div className="flex gap-2 sm:gap-3 bg-slate-100 p-1.5 sm:p-2 rounded-2xl overflow-x-auto">
        {tabs.map(tab => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 sm:gap-2.5 px-3 sm:px-4 py-2.5 rounded-xl text-sm font-semibold transition-all whitespace-nowrap flex-1 sm:flex-none justify-center sm:justify-start ${
                isActive ? `bg-white shadow-md text-slate-900 ring-1 ring-slate-200` : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
                isActive ? `bg-gradient-to-br ${tab.color}` : tab.bgColor
              }`}>
                <tab.icon size={14} className={isActive ? 'text-white' : tab.textColor} />
              </div>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden text-xs">{tab.label}</span>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                isActive ? `bg-gradient-to-br ${tab.color} text-white` : 'bg-slate-200/60 text-slate-500'
              }`}>{tab.count}</span>
            </button>
          );
        })}
      </div>

      <div>
        <div className="flex items-center gap-2 mb-5">
          <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${currentTab.color} flex items-center justify-center`}>
            <currentTab.icon size={14} className="text-white" />
          </div>
          <div>
            <h2 className="font-semibold text-slate-900 text-sm">{currentTab.label}</h2>
            <p className="text-xs text-slate-400">{currentTab.courses.length} course{currentTab.courses.length !== 1 ? 's' : ''}</p>
          </div>
        </div>

        {currentTab.courses.length === 0 ? (
          <EmptyState
            icon={currentTab.icon}
            title={`No ${currentTab.label} courses available`}
            subtitle={
              activeTab === 'free'
                ? 'No free courses in your category to enroll in. Check the Paid tab for premium courses.'
                : 'No paid courses in your category to enroll in. Check the Free tab for free courses.'
            }
            action={activeTab === 'free' ? () => setActiveTab('paid') : () => setActiveTab('free')}
            actionLabel={activeTab === 'free' ? 'Browse Paid Courses' : 'Browse Free Courses'}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {currentTab.courses.map(course => (
              <CourseCard
                key={course.id}
                course={course}
                enrolled={isEnrolled(course.id)}
                onOpen={() => onOpenCourse(course.id)}
                onEnroll={e => { e.stopPropagation(); handleEnroll(course.id); }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
