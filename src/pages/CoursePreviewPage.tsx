import { useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, BookOpen, Video, Layers, Globe, Lock,
  Clock, Award, Star, Users2, Monitor, CheckCircle, FileText,
  PlayCircle, BookMarked, ChevronDown, X, ChevronUp, ArrowLeft, ArrowRight,
  Zap, PenSquare, MessageSquare,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import CourseForum from '../components/CourseForum';

function toEmbedUrl(url: string): string {
  if (url.includes('youtube.com/embed/') || url.includes('player.vimeo.com/video/')) return url;
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (shortMatch) return `https://www.youtube.com/embed/${shortMatch[1]}`;
  const watchMatch = url.match(/(?:youtube\.com|youtu\.be).*[?&]v=([a-zA-Z0-9_-]{11})/);
  if (watchMatch) return `https://www.youtube.com/embed/${watchMatch[1]}`;
  const vimeoMatch = url.match(/vimeo\.com\/(\d+)/);
  if (vimeoMatch) return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  return url;
}

interface PreviewItem {
  id: string;
  type: string;
  title: string;
  video_url: string;
  content: string;
  sort_order: number;
  display_mode: 'classic' | 'interactive';
  featured_image_url: string;
}

interface PreviewTopic {
  id: string;
  title: string;
  summary: string;
  sort_order: number;
  items: PreviewItem[];
}

interface CourseData {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  pricing_model: string;
  price: number | null;
  visibility: string;
  difficulty_level: string;
  is_published: boolean;
}

interface Props {
  courseId: string;
  onBack: () => void;
}

// split HTML content on <hr> tags into step sections
function splitIntoSteps(html: string): string[] {
  const parts = html.split(/<hr\s*\/?>/gi).map(s => s.trim()).filter(Boolean);
  return parts.length > 0 ? parts : [html];
}

// ── Lesson Viewer Modal ────────────────────────────────────────────────────────
function LessonViewer({
  item,
  allItems,
  courseTitle,
  onClose,
}: {
  item: PreviewItem;
  allItems: PreviewItem[];
  courseTitle: string;
  onClose: () => void;
}) {
  const idx = allItems.findIndex(i => i.id === item.id);
  const [current, setCurrent] = useState(idx);
  const [step, setStep] = useState(0);

  const active = allItems[current];
  const isInteractive = active.display_mode === 'interactive';
  const steps = isInteractive ? splitIntoSteps(active.content ?? '') : [];
  const totalSteps = steps.length;
  const onLastStep = !isInteractive || step === totalSteps - 1;

  // reset step when lesson changes
  const goToLesson = (i: number) => { setCurrent(i); setStep(0); };
  const prevLesson = () => goToLesson(Math.max(0, current - 1));
  const nextLesson = () => goToLesson(Math.min(allItems.length - 1, current + 1));

  const typeIcon =
    active.type === 'quiz'       ? Zap :
    active.type === 'assignment' ? PenSquare :
    BookOpen;
  const TypeIcon = typeIcon;

  const typeBg =
    active.type === 'quiz'       ? 'bg-amber-100 text-amber-700' :
    active.type === 'assignment' ? 'bg-violet-100 text-violet-700' :
    'bg-blue-100 text-blue-700';

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl w-full max-w-2xl flex flex-col shadow-2xl animate-scaleIn" style={{ maxHeight: 'calc(100vh - 2rem)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${typeBg}`}>
              <TypeIcon size={15} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-slate-400 font-medium">{courseTitle}</p>
              <p className="font-bold text-slate-900 text-sm truncate">{active.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {isInteractive && totalSteps > 1 && (
              <span className="text-xs font-semibold text-violet-600 bg-violet-50 border border-violet-200 px-2.5 py-1 rounded-full">
                Step {step + 1}/{totalSteps}
              </span>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
            >
              <X size={16} className="text-slate-600" />
            </button>
          </div>
        </div>

        {/* Interactive step progress bar */}
        {isInteractive && totalSteps > 1 && (
          <div className="px-6 pt-3 flex-shrink-0">
            <div className="flex items-center gap-1">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                    i < step ? 'bg-violet-500' : i === step ? 'bg-violet-400' : 'bg-slate-200'
                  }`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">

          {/* Featured image (classic only, shown above video) */}
          {!isInteractive && active.featured_image_url && !active.video_url && (
            <div className="w-full h-48 overflow-hidden">
              <img src={active.featured_image_url} alt={active.title} className="w-full h-full object-cover" />
            </div>
          )}

          {/* Video */}
          {active.video_url && (
            <div className="relative w-full bg-black" style={{ paddingTop: '56.25%' }}>
              <iframe
                src={toEmbedUrl(active.video_url)}
                title={active.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="absolute inset-0 w-full h-full"
              />
            </div>
          )}

          {/* Content area */}
          <div className="px-3 sm:px-6 py-4 sm:py-6">
            <div className="flex items-center gap-2 mb-4">
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${typeBg}`}>
                {active.type}
              </span>
              <span className="text-xs text-slate-400">
                Lesson {current + 1} of {allItems.length}
              </span>
              {isInteractive && (
                <span className="text-xs text-violet-500 font-semibold flex items-center gap-1">
                  <Layers size={11} /> Interactive
                </span>
              )}
            </div>

            <h2 className="text-xl font-black text-slate-900 mb-4">{active.title}</h2>

            {/* CLASSIC: show all content at once */}
            {!isInteractive && (
              active.content ? (
                <div
                  className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: active.content }}
                />
              ) : (
                <EmptyContent type={active.type} />
              )
            )}

            {/* INTERACTIVE: show one step at a time */}
            {isInteractive && (
              <div key={step} className="animate-fadeIn">
                {steps[step] ? (
                  <div
                    className="prose prose-sm max-w-none text-slate-700 leading-relaxed"
                    dangerouslySetInnerHTML={{ __html: steps[step] }}
                  />
                ) : (
                  <EmptyContent type={active.type} />
                )}

                {/* Step navigation */}
                {totalSteps > 1 && (
                  <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
                    <button
                      onClick={() => setStep(s => Math.max(0, s - 1))}
                      disabled={step === 0}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                    >
                      <ArrowLeft size={14} /> Back
                    </button>
                    <div className="flex items-center gap-1.5">
                      {steps.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => i <= step && setStep(i)}
                          className={`rounded-full transition-all ${
                            i === step ? 'w-5 h-2 bg-violet-500' :
                            i < step  ? 'w-2 h-2 bg-violet-300 cursor-pointer hover:bg-violet-400' :
                            'w-2 h-2 bg-slate-200 cursor-not-allowed'
                          }`}
                        />
                      ))}
                    </div>
                    {step < totalSteps - 1 ? (
                      <button
                        onClick={() => setStep(s => s + 1)}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 transition-all"
                      >
                        Next Step <ArrowRight size={14} />
                      </button>
                    ) : (
                      <div className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                        <CheckCircle size={14} /> Done!
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer nav — prev/next LESSON */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 flex-shrink-0 bg-slate-50/50">
          <button
            onClick={prevLesson}
            disabled={current === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <ArrowLeft size={15} /> Prev Lesson
          </button>

          {/* Lesson dots */}
          <div className="flex items-center gap-1.5">
            {allItems.map((_, i) => (
              <button
                key={i}
                onClick={() => goToLesson(i)}
                className={`rounded-full transition-all ${
                  i === current
                    ? 'w-5 h-2 bg-rose-500'
                    : 'w-2 h-2 bg-slate-300 hover:bg-slate-400'
                }`}
              />
            ))}
          </div>

          <button
            onClick={nextLesson}
            disabled={current === allItems.length - 1 || (isInteractive && !onLastStep)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            Next Lesson <ArrowRight size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function EmptyContent({ type }: { type: string }) {
  const config =
    type === 'quiz'       ? { bg: 'bg-amber-100', Icon: Zap,       color: 'text-amber-500',  title: 'Quiz coming soon',            sub: 'This quiz will be available when the course is fully published.' } :
    type === 'assignment' ? { bg: 'bg-violet-100', Icon: PenSquare, color: 'text-violet-500', title: 'Assignment details coming soon', sub: 'Assignment instructions will appear here once published.' } :
                            { bg: 'bg-blue-100',   Icon: BookOpen,  color: 'text-blue-500',   title: 'Lesson content coming soon',   sub: 'The teacher is still preparing this lesson. Check back soon!' };
  return (
    <div className="flex flex-col items-center justify-center py-12 text-slate-400">
      <div className={`w-16 h-16 rounded-2xl ${config.bg} flex items-center justify-center mb-4`}>
        <config.Icon size={28} className={config.color} />
      </div>
      <p className="font-semibold text-slate-600 mb-1">{config.title}</p>
      <p className="text-sm text-slate-400 text-center max-w-xs">{config.sub}</p>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function CoursePreviewPage({ courseId, onBack }: Props) {
  const [course, setCourse] = useState<CourseData | null>(null);
  const [topics, setTopics] = useState<PreviewTopic[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [activeSection, setActiveSection] = useState<'overview' | 'curriculum'>('overview');
  const [activeItem, setActiveItem] = useState<PreviewItem | null>(null);
  const [showForum, setShowForum] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        // Fetch course
        const { data: c, error: cErr } = await supabase
          .from('courses')
          .select('id,title,description,thumbnail_url,pricing_model,price,visibility,difficulty_level,is_published')
          .eq('id', courseId)
          .maybeSingle();

        if (cErr) {
          console.error('Course query error:', cErr);
          if (mounted) setLoading(false);
          return;
        }

        if (c && mounted) setCourse(c as CourseData);

        // Fetch topics separately
        const { data: t, error: tErr } = await supabase
          .from('course_topics')
          .select('id,title,summary,sort_order')
          .eq('course_id', courseId)
          .order('sort_order');

        if (tErr) {
          console.error('Topics query error:', tErr);
        }

        if (t && t.length > 0 && mounted) {
          // Fetch items for each topic
          const topicsWithItems = await Promise.all(
            t.map(async (tp: any) => {
              const { data: items } = await supabase
                .from('course_topic_items')
                .select('id,type,title,video_url,content,sort_order,display_mode,featured_image_url')
                .eq('topic_id', tp.id)
                .order('sort_order');
              return {
                id: tp.id,
                title: tp.title,
                summary: tp.summary,
                sort_order: tp.sort_order,
                items: (items ?? []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
              };
            })
          );
          setTopics(topicsWithItems);
          setExpanded(new Set([topicsWithItems[0]?.id].filter(Boolean)));
        }
      } catch (err) {
        console.error('Preview load error:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [courseId]);

  const toggle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const toggleAll = () =>
    setExpanded(expanded.size > 0 ? new Set() : new Set(topics.map(t => t.id)));

  // All items flattened for prev/next navigation
  const allItems = topics.flatMap(t => t.items);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500 font-medium text-sm">Loading preview…</p>
        </div>
      </div>
    );
  }

  if (showForum && course) {
    return (
      <CourseForum
        courseId={course.id}
        courseTitle={course.title}
        onBack={() => setShowForum(false)}
      />
    );
  }

  if (!course) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-500 font-medium">Course not found.</p>
          <button onClick={onBack} className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-bold">Go Back</button>
        </div>
      </div>
    );
  }

  const totalItems = topics.reduce((s, t) => s + t.items.length, 0);
  const videoCount = topics.flatMap(t => t.items).filter(i => i.video_url).length;
  const cover = course.thumbnail_url || 'https://images.pexels.com/photos/301926/pexels-photo-301926.jpeg?auto=compress&cs=tinysrgb&w=1600&h=800&fit=crop';

  const diffBg =
    course.difficulty_level === 'Beginner' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' :
    course.difficulty_level === 'Intermediate' ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' :
    'bg-rose-500/20 text-rose-300 border-rose-500/30';

  const sidebarFeatures = [
    { icon: Layers,    text: `${topics.length} ${topics.length === 1 ? 'section' : 'sections'}` },
    { icon: BookOpen,  text: `${totalItems} ${totalItems === 1 ? 'lesson' : 'lessons'}` },
    ...(videoCount > 0 ? [{ icon: Video,  text: `${videoCount} video ${videoCount === 1 ? 'lesson' : 'lessons'}` }] : []),
    { icon: Globe,     text: course.visibility === 'public' ? 'Open to all students' : 'Invite only' },
    { icon: Clock,     text: 'Self-paced learning' },
    { icon: Award,     text: 'Certificate on completion' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-slate-50 overflow-y-auto flex flex-col">

      {/* ── Lesson Viewer Modal ── */}
      {activeItem && (
        <LessonViewer
          item={activeItem}
          allItems={allItems}
          courseTitle={course.title}
          onClose={() => setActiveItem(null)}
        />
      )}

      {/* ── Sticky Navbar ── */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm flex-shrink-0">
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-3">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 text-slate-500 hover:text-rose-600 transition-colors font-medium text-sm flex-shrink-0 group"
            >
              <ChevronLeft size={17} className="group-hover:-translate-x-0.5 transition-transform" />
              <span className="hidden sm:inline">Back</span>
            </button>
            <div className="hidden sm:block h-4 w-px bg-slate-200" />
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-rose-500 to-red-600 flex items-center justify-center flex-shrink-0">
                <BookMarked size={10} className="text-white" />
              </div>
              <span className="text-sm text-slate-500 flex-shrink-0">Courses</span>
              <ChevronRight size={13} className="text-slate-300 flex-shrink-0" />
              <span className="text-sm font-semibold text-slate-800 truncate">{course.title}</span>
            </div>
            <span className="sm:hidden text-sm font-semibold text-slate-800 truncate">{course.title}</span>
          </div>
          {/* Right */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="hidden md:flex items-center gap-1.5 text-[11px] font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-full">
              <Monitor size={11} /> Student Preview
            </span>
            <button
              onClick={() => setShowForum(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition-colors shadow-sm"
            >
              <MessageSquare size={13} /> Forum
            </button>
            <button
              disabled
              className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white text-xs font-bold rounded-xl opacity-60 cursor-not-allowed shadow-sm"
            >
              Enroll Now
            </button>
          </div>
        </div>
      </div>

      {/* ── Hero ── */}
      <div className="relative overflow-hidden bg-slate-900 flex-shrink-0">
        <img src={cover} alt={course.title} className="absolute inset-0 w-full h-full object-cover opacity-30 scale-105" />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-900/80 to-slate-900/50" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />

        <div className="relative max-w-screen-xl mx-auto px-4 sm:px-6 py-12 sm:py-16 lg:py-20 lg:pr-[340px] xl:pr-[380px]">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mb-4 font-medium">
            <span>Courses</span>
            <ChevronRight size={10} />
            <span className="capitalize">{course.difficulty_level}</span>
            <ChevronRight size={10} />
            <span className="text-slate-300">{course.title}</span>
          </div>

          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight mb-3 tracking-tight">
            {course.title}
          </h1>

          {course.description && (
            <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl mb-6">
              {course.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 mb-5">
            <div className="flex items-center gap-1.5">
              {[1,2,3,4,5].map(s => (
                <Star key={s} size={14} className={s <= 4 ? 'text-amber-400 fill-amber-400' : 'text-amber-300 fill-amber-300 opacity-40'} />
              ))}
              <span className="text-amber-400 font-bold text-sm ml-1">4.8</span>
              <span className="text-slate-400 text-xs ml-1">(124 ratings)</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400">
              <Users2 size={12} className="text-slate-500" />
              <span>Open enrollment</span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${diffBg}`}>
              {course.difficulty_level}
            </span>
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${course.pricing_model === 'free' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border-amber-500/30'}`}>
              {course.pricing_model === 'free' ? 'Free Course' : `Paid · ${Number(course.price || 0).toFixed(2)}`}
            </span>
            <span className="flex items-center gap-1 text-xs font-bold px-3 py-1 rounded-full border bg-white/10 text-white border-white/20">
              {course.visibility === 'public' ? <Globe size={10} /> : <Lock size={10} />}
              <span className="capitalize">{course.visibility}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 max-w-screen-xl mx-auto w-full px-4 sm:px-6 py-8 lg:flex lg:gap-8 lg:items-start">

        {/* ── Left: main content ── */}
        <div className="flex-1 min-w-0 space-y-6 pb-24 lg:pb-0">

          {/* Stats strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { icon: Layers,    label: 'Sections', value: String(topics.length),    color: 'text-rose-500',   bg: 'bg-rose-50 border-rose-100'    },
              { icon: BookOpen,  label: 'Lessons',  value: String(totalItems),        color: 'text-blue-500',   bg: 'bg-blue-50 border-blue-100'    },
              { icon: Video,     label: 'Videos',   value: String(videoCount),        color: 'text-violet-500', bg: 'bg-violet-50 border-violet-100' },
              { icon: Award,     label: 'Level',    value: course.difficulty_level,   color: 'text-amber-500',  bg: 'bg-amber-50 border-amber-100'  },
            ].map(({ icon: Icon, label, value, color, bg }) => (
              <div key={label} className={`flex items-center gap-3 ${bg} border rounded-2xl px-4 py-3.5`}>
                <div className={`w-8 h-8 rounded-xl ${bg.replace('50', '100')} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={16} className={color} />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 font-medium leading-none">{label}</p>
                  <p className="font-bold text-slate-800 text-sm leading-tight mt-0.5">{value}</p>
                </div>
              </div>
            ))}
          </div>

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
            </div>
          </div>

          {/* Curriculum */}
          <div className={`${activeSection === 'curriculum' ? 'block' : 'hidden'} lg:block`}>
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100">
                <div>
                  <h2 className="font-bold text-slate-800 text-base flex items-center gap-2">
                    <span className="w-1 h-5 bg-amber-500 rounded-full inline-block" />
                    Course Curriculum
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {topics.length} {topics.length === 1 ? 'section' : 'sections'} · {totalItems} {totalItems === 1 ? 'lesson' : 'lessons'}
                  </p>
                </div>
                <button
                  onClick={toggleAll}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 transition-colors"
                >
                  {expanded.size > 0 ? 'Collapse all' : 'Expand all'}
                </button>
              </div>

              {topics.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <BookOpen size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">No curriculum added yet</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {topics.map((topic, tIdx) => {
                    const isOpen = expanded.has(topic.id);
                    return (
                      <div key={topic.id}>
                        <button
                          onClick={() => toggle(topic.id)}
                          className="w-full flex items-center justify-between px-5 sm:px-6 py-4 hover:bg-slate-50/80 transition-colors text-left group"
                        >
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <span className="w-8 h-8 rounded-xl bg-gradient-to-br from-rose-500 to-red-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 shadow-sm">
                              {tIdx + 1}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-slate-800 text-sm">{topic.title}</p>
                              {topic.summary && (
                                <p className="text-xs text-slate-400 mt-0.5 truncate">{topic.summary}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                            <span className="text-xs text-slate-400 hidden sm:inline">
                              {topic.items.length} {topic.items.length === 1 ? 'lesson' : 'lessons'}
                            </span>
                            <ChevronDown size={15} className={`text-slate-400 transition-transform duration-200 group-hover:text-slate-600 ${isOpen ? 'rotate-180' : ''}`} />
                          </div>
                        </button>

                        {isOpen && (
                          <div className="bg-slate-50/60">
                            {topic.items.length === 0 ? (
                              <p className="px-6 py-3 text-xs text-slate-400 italic">No lessons in this section</p>
                            ) : (
                              topic.items.map((item, iIdx) => {
                                const typeStyle =
                                  item.type === 'lesson'     ? { bg: 'bg-blue-100',   text: 'text-blue-700',   Icon: BookOpen    } :
                                  item.type === 'quiz'       ? { bg: 'bg-amber-100',  text: 'text-amber-700',  Icon: FileText    } :
                                                               { bg: 'bg-green-100',  text: 'text-green-700',  Icon: CheckCircle };
                                return (
                                  <button
                                    key={item.id}
                                    onClick={() => setActiveItem(item)}
                                    className={`w-full flex items-center gap-3 px-5 sm:px-6 py-3.5 hover:bg-white hover:shadow-sm transition-all text-left group/item ${iIdx !== topic.items.length - 1 ? 'border-b border-slate-100' : ''}`}
                                  >
                                    <div className="w-7 h-7 rounded-lg bg-white border border-slate-200 flex items-center justify-center flex-shrink-0 shadow-sm group-hover/item:border-rose-200 transition-colors">
                                      <typeStyle.Icon size={13} className={typeStyle.text} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-slate-700 font-medium truncate group-hover/item:text-slate-900">
                                        {item.title || `Untitled ${item.type}`}
                                      </p>
                                      <div className="flex items-center gap-2 mt-0.5">
                                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${typeStyle.bg} ${typeStyle.text}`}>
                                          {item.type}
                                        </span>
                                        {item.video_url && (
                                          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
                                            <PlayCircle size={9} /> Video
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <ChevronRight size={14} className="text-slate-300 group-hover/item:text-rose-400 flex-shrink-0 transition-colors" />
                                  </button>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Right: sticky enrollment card ── */}
        <div className="hidden lg:block w-72 xl:w-80 flex-shrink-0">
          <div className="sticky top-20 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">

            <div className="relative h-44 bg-slate-200 group overflow-hidden">
              <img src={cover} alt={course.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
              <div className="absolute inset-0 bg-black/35 flex items-center justify-center">
                <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center shadow-2xl group-hover:scale-110 transition-transform">
                  <PlayCircle size={28} className="text-rose-600 fill-rose-50" />
                </div>
              </div>
              <div className="absolute bottom-3 right-3">
                <span className="text-[10px] font-bold bg-black/70 backdrop-blur-sm text-white px-2.5 py-1 rounded-full">
                  Course Preview
                </span>
              </div>
            </div>

            <div className="p-5">
              <div className="flex items-end justify-between mb-4">
                {course.pricing_model === 'free' ? (
                  <div>
                    <p className="text-3xl font-black text-emerald-600">Free</p>
                    <p className="text-xs text-slate-400 mt-0.5">Full lifetime access</p>
                  </div>
                ) : (
                  <div>
                    <p className="text-3xl font-black text-slate-800">Paid</p>
                    <p className="text-xs text-slate-400 mt-0.5">One-time purchase</p>
                  </div>
                )}
                <span className={`text-xs font-bold px-2.5 py-1.5 rounded-xl ${course.pricing_model === 'free' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {course.pricing_model === 'free' ? 'Free' : 'Paid'}
                </span>
              </div>

              <button
                disabled
                className="w-full py-3.5 bg-gradient-to-r from-rose-600 to-red-500 text-white font-bold rounded-2xl text-sm opacity-60 cursor-not-allowed shadow-lg shadow-rose-200 mb-2"
              >
                Enroll Now
              </button>
              <p className="text-[11px] text-slate-400 text-center mb-5">
                Preview only — students enroll here
              </p>

              <div className="h-px bg-slate-100 mb-4" />

              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">This course includes</p>
              <ul className="space-y-3">
                {sidebarFeatures.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-2.5 text-sm text-slate-700">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Icon size={13} className="text-slate-500" />
                    </div>
                    {text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* ── Mobile sticky CTA bar ── */}
      {activeSection === 'overview' && (
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200 px-4 py-3 flex items-center justify-between gap-3 shadow-2xl">
        <div className="min-w-0">
          <p className="font-bold text-slate-800 text-sm truncate">{course.title}</p>
          <p className="text-xs text-slate-500">
            {course.pricing_model === 'free' ? 'Free · ' : 'Paid · '}
            {totalItems} lessons
          </p>
        </div>
        <button
          disabled
          className="flex-shrink-0 px-5 py-2.5 bg-gradient-to-r from-rose-600 to-red-500 text-white text-sm font-bold rounded-xl opacity-60 cursor-not-allowed shadow"
        >
          Enroll Now
        </button>
      </div>
      )}
    </div>
  );
}
