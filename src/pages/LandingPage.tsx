import { BookOpen, Star, Zap, Award, TrendingUp, ArrowRight, Globe, Users, CheckCircle, Play, ChevronDown, Flame, GraduationCap, Target, Languages, Calculator, Cpu, Heart, Briefcase, Lightbulb } from 'lucide-react';
import Navbar from '../components/Navbar';

interface LandingPageProps {
  onGetStarted: () => void;
  onLogin: () => void;
}

const subjects = [
  { icon: Languages,    key: 'languages',     label: 'Languages',        color: 'from-teal-400 to-emerald-500',     desc: 'Master English, Arabic, and more with interactive lessons.' },
  { icon: Calculator,   key: 'mathematics',  label: 'Mathematics',       color: 'from-blue-400 to-blue-600',        desc: 'Build strong foundations in math from basic to advanced.' },
  { icon: Cpu,          key: 'technology',   label: 'Technology',        color: 'from-violet-400 to-purple-600',    desc: 'Learn coding, digital skills, and 21st century tech.' },
  { icon: Heart,        key: 'religious',    label: 'Religious Studies',  color: 'from-amber-400 to-orange-500',     desc: 'Deepen your understanding of Islamic knowledge.' },
  { icon: Briefcase,    key: 'business',     label: 'Business Skills',    color: 'from-rose-400 to-red-600',         desc: 'Entrepreneurship, finance, and professional development.' },
  { icon: Lightbulb,    key: 'skills',       label: 'Life Skills',        color: 'from-cyan-400 to-teal-500',        desc: 'Critical thinking, communication, and problem-solving.' },
];

const stats = [
  { value: '50K+',  label: 'Active Learners' },
  { value: '500+',  label: 'Lessons' },
  { value: '95%',   label: 'Success Rate' },
  { value: '4.9★',  label: 'Average Rating' },
];

const features = [
  { icon: BookOpen,    title: 'Diverse Curriculum',  desc: 'Multiple subjects from languages to technology — all designed for 21st century skills.',  color: 'text-blue-600 bg-blue-50 border-blue-100' },
  { icon: Zap,         title: 'Interactive Quizzes',    desc: 'Reinforce what you learn with smart quizzes that adapt to your skill level.',           color: 'text-violet-600 bg-violet-50 border-violet-100' },
  { icon: Users,       title: 'Expert Teachers',        desc: 'Lessons crafted by certified educators with years of experience.',               color: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  { icon: Award,       title: 'Progress Tracking',      desc: "Visual dashboards show exactly how far you've come and what to tackle next.",          color: 'text-amber-600 bg-amber-50 border-amber-100' },
  { icon: Globe,       title: 'Real-World Skills',     desc: 'Learn skills that matter in today\'s world — from coding to communication.',     color: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
  { icon: CheckCircle, title: 'Certificates',           desc: 'Earn verifiable certificates for each subject to share on your CV or LinkedIn.',          color: 'text-rose-600 bg-rose-50 border-rose-100' },
];

const steps = [
  { n: '01', title: 'Create Your Account',    desc: 'Sign up free and choose your learning journey from our diverse subjects.' },
  { n: '02', title: 'Follow Your Path',       desc: 'Learn at your own pace with structured lessons in multiple subjects.' },
  { n: '03', title: 'Practice & Compete',     desc: 'Reinforce skills with quizzes and compete with other learners.' },
  { n: '04', title: 'Earn & Advance',         desc: 'Collect XP, unlock achievements, and earn certificates as you progress.' },
];

const testimonials = [
  { name: 'Amina Hassan',    role: 'Medical Student',   avatar: 'https://images.pexels.com/photos/415829/pexels-photo-415829.jpeg?w=80&h=80&fit=crop',   text: 'Ilesy Academy helped me master multiple skills at once. The diverse curriculum is exactly what I needed.', rating: 5 },
  { name: 'Omar Farah',      role: 'Software Engineer', avatar: 'https://images.pexels.com/photos/220453/pexels-photo-220453.jpeg?w=80&h=80&fit=crop',    text: 'From coding to communication skills, this platform covers everything needed for the modern world.', rating: 5 },
  { name: 'Faadumo Warsame', role: 'Business Owner',    avatar: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?w=80&h=80&fit=crop',  text: 'The teacher dashboard is incredible. I can manage students and track their progress across all subjects.', rating: 5 },
];

function AppMockup() {
  const courses = [
    { name: 'Languages',       pct: 100, color: 'from-emerald-400 to-teal-500' },
    { name: 'Mathematics', pct: 68,  color: 'from-blue-400 to-blue-600' },
    { name: 'Technology',     pct: 30,  color: 'from-violet-400 to-purple-600' },
  ];
  return (
    <div className="relative w-full max-w-[320px] xl:max-w-[360px] mx-auto lg:mx-0 lg:ml-auto">
      {/* Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/30 to-cyan-400/20 blur-3xl rounded-3xl scale-110" />

      {/* Card frame */}
      <div className="relative bg-white/10 backdrop-blur-xl border border-white/20 rounded-[2rem] p-3 shadow-2xl shadow-black/30">
        <div className="bg-slate-900 rounded-[1.5rem] overflow-hidden">

          {/* Mock top bar */}
          <div className="px-4 pt-4 pb-3 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                <BookOpen size={11} className="text-white" />
              </div>
              <span className="text-white font-bold text-xs">Ilesy Academy</span>
            </div>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
          </div>

          {/* Greeting banner */}
          <div className="m-3 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 p-4">
            <p className="text-blue-100 text-[10px] font-medium mb-0.5">Good morning!</p>
            <p className="text-white font-bold text-sm">Welcome back, Ali 👋</p>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[{ l: 'Level', v: '5' }, { l: 'Streak', v: '7 🔥' }, { l: 'XP', v: '2,450' }].map(s => (
                <div key={s.l} className="bg-white/20 rounded-xl p-2 text-center">
                  <p className="text-white/60 text-[9px]">{s.l}</p>
                  <p className="text-white font-bold text-[11px]">{s.v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Progress */}
          <div className="mx-3 mb-3 bg-white/5 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-white text-[10px] font-medium">Overall Progress</span>
              <span className="text-cyan-400 text-[10px] font-bold">68%</span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full w-2/3 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-full" />
            </div>
          </div>

          {/* Course list */}
          <div className="px-3 pb-4 space-y-2">
            {courses.map(c => (
              <div key={c.name} className="bg-white/5 rounded-xl px-3 py-2.5 flex items-center gap-2.5">
                <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${c.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-white text-[10px] font-medium truncate">{c.name}</p>
                  <div className="h-1 bg-white/10 rounded-full mt-1 overflow-hidden">
                    <div className={`h-full bg-gradient-to-r ${c.color} rounded-full`} style={{ width: `${c.pct}%` }} />
                  </div>
                </div>
                <span className="text-white/40 text-[9px] flex-shrink-0">{c.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Floating badge: streak */}
      <div className="absolute -left-10 top-20 bg-white rounded-2xl px-3 py-2 shadow-2xl animate-float border border-slate-100">
        <div className="flex items-center gap-2">
          <span className="text-xl">🔥</span>
          <div>
            <p className="text-[9px] text-slate-400 font-medium">Current Streak</p>
            <p className="text-sm font-black text-slate-800">7 Days!</p>
          </div>
        </div>
      </div>

      {/* Floating badge: XP */}
      <div className="absolute -right-8 bottom-24 bg-white rounded-2xl px-3 py-2 shadow-2xl border border-slate-100" style={{ animation: 'float 4s ease-in-out infinite', animationDelay: '1.5s' }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <div>
            <p className="text-[9px] text-slate-400 font-medium">XP Earned</p>
            <p className="text-sm font-black text-amber-600">+250 XP</p>
          </div>
        </div>
      </div>

      {/* Floating badge: achievement */}
      <div className="absolute -left-6 bottom-12 bg-white rounded-2xl px-3 py-2 shadow-2xl border border-slate-100" style={{ animation: 'float 5s ease-in-out infinite', animationDelay: '0.7s' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">🏆</span>
          <div>
            <p className="text-[9px] text-slate-400 font-medium">New Achievement</p>
            <p className="text-xs font-bold text-slate-800">Quiz Master!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage({ onGetStarted, onLogin }: LandingPageProps) {
  return (
    <div className="min-h-screen bg-white overflow-x-hidden">
      <Navbar transparent onLogin={onLogin} onGetStarted={onGetStarted} />

      {/* ── Hero ──────────────────────────────────────────────────────────────── */}
      <section className="hero-bg relative min-h-screen flex flex-col justify-center px-4 pt-20 pb-16 overflow-hidden">
        {/* Dot grid overlay */}
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />

        {/* Ambient blobs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-blue-600/20 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] rounded-full bg-indigo-600/8 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 xl:gap-20 items-center">

            {/* Left: Copy */}
            <div className="text-center lg:text-left">
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-dark text-white/90 text-sm font-medium mb-8 animate-fadeInUp">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                #1 Learning Platform Worldwide
              </div>

              <h1 className="font-display text-5xl sm:text-6xl xl:text-7xl font-black text-white leading-[1.05] mb-6 animate-fadeInUp delay-100">
                Master New Skills.<br />
                <span className="shimmer-text">Transform Your Future.</span>
              </h1>

              <p className="text-white/70 text-lg sm:text-xl max-w-xl mx-auto lg:mx-0 mb-10 leading-relaxed animate-fadeInUp delay-200">
                Learn languages, mathematics, technology, and essential 21st century skills —
                all in one beautiful platform.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fadeInUp delay-300">
                <button
                  onClick={onGetStarted}
                  className="group px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold text-lg rounded-2xl shadow-2xl shadow-blue-500/40 transition-all hover:-translate-y-1 hover:shadow-blue-500/60 flex items-center justify-center gap-2"
                >
                  Start Learning Free
                  <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                </button>
                <button
                  onClick={onLogin}
                  className="px-8 py-4 glass-dark text-white font-semibold text-lg rounded-2xl border border-white/20 hover:bg-white/10 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                >
                  <Play size={18} className="fill-white" />
                  Sign In
                </button>
              </div>

              {/* Stats row */}
              <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fadeInUp delay-400">
                {stats.map(s => (
                  <div key={s.value} className="glass-dark rounded-2xl px-4 py-4 text-center">
                    <div className="text-2xl font-black text-white">{s.value}</div>
                    <div className="text-white/60 text-xs mt-0.5 font-medium">{s.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: App mockup */}
            <div className="flex items-center justify-center lg:justify-end animate-fadeInUp delay-300">
              <AppMockup />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce opacity-60">
          <ChevronDown size={28} className="text-white" />
        </div>
      </section>

      {/* ── Subjects ────────────────────────────────────────────────────────────── */}
      <section id="levels" className="py-24 px-4 bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-14">
            <span className="inline-block text-blue-600 font-bold text-xs uppercase tracking-[0.2em] mb-4 px-4 py-1.5 bg-blue-50 rounded-full border border-blue-100">
              Subjects
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Learn What Matters Most
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              21st century skills for success — choose your path and start learning today.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {subjects.map((subject, i) => (
              <button
                key={subject.key}
                className="group text-left bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 animate-fadeInUp cursor-pointer"
                style={{ animationDelay: `${i * 0.08}s` }}
                onClick={onGetStarted}
              >
                {/* Gradient top accent */}
                <div className={`h-1.5 bg-gradient-to-r ${subject.color}`} />

                {/* Icon & content */}
                <div className="p-6">
                  <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${subject.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <subject.icon size={22} className="text-white" strokeWidth={2} />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-2">{subject.label}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{subject.desc}</p>
                </div>

                {/* Bottom CTA */}
                <div className={`mx-4 mb-4 py-2 rounded-xl bg-gradient-to-r ${subject.color} text-white text-xs font-bold text-center opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0`}>
                  Start Learning →
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-emerald-600 font-bold text-xs uppercase tracking-[0.2em] mb-4 px-4 py-1.5 bg-emerald-50 rounded-full border border-emerald-100">
              How It Works
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Your Learning Journey in 4 Steps
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div
                key={step.n}
                className="relative group p-7 rounded-3xl border border-slate-100 bg-white hover:border-blue-200 hover:shadow-lg transition-all animate-fadeInUp"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {/* Connecting line */}
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-slate-200 to-transparent z-0 -translate-x-7" />
                )}
                <div className="relative z-10">
                  <div className="text-5xl font-black text-slate-100 group-hover:text-blue-100 transition-colors leading-none mb-4">{step.n}</div>
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg shadow-blue-200 group-hover:scale-110 transition-transform">
                    {i === 0 && <GraduationCap size={18} className="text-white" />}
                    {i === 1 && <BookOpen size={18} className="text-white" />}
                    {i === 2 && <Target size={18} className="text-white" />}
                    {i === 3 && <Award size={18} className="text-white" />}
                  </div>
                  <h3 className="font-bold text-slate-900 text-base mb-2">{step.title}</h3>
                  <p className="text-slate-500 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────────── */}
      <section id="courses" className="py-24 px-4 bg-slate-50 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-40 pointer-events-none" />
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center mb-14">
            <span className="inline-block text-violet-600 font-bold text-xs uppercase tracking-[0.2em] mb-4 px-4 py-1.5 bg-violet-50 rounded-full border border-violet-100">
              Features
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Ilesy Academy brings together all the tools modern learners and teachers need.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="group p-7 rounded-3xl bg-white border hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fadeInUp"
                style={{ animationDelay: `${i * 0.07}s` }}
              >
                <div className={`w-14 h-14 rounded-2xl ${f.color} border flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon size={24} strokeWidth={2} />
                </div>
                <h3 className="font-bold text-slate-900 text-lg mb-2">{f.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Testimonials ──────────────────────────────────────────────────────── */}
      <section className="py-24 px-4 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-14">
            <span className="inline-block text-amber-600 font-bold text-xs uppercase tracking-[0.2em] mb-4 px-4 py-1.5 bg-amber-50 rounded-full border border-amber-100">
              Testimonials
            </span>
            <h2 className="font-display text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
              Loved by Thousands
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <div
                key={t.name}
                className="relative bg-white rounded-3xl p-8 shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 animate-fadeInUp overflow-hidden"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {/* Quote mark */}
                <div className="absolute top-4 right-6 text-7xl font-serif text-slate-100 leading-none select-none">"</div>
                <div className="flex gap-0.5 mb-5">
                  {Array(t.rating).fill(0).map((_, j) => (
                    <Star key={j} size={16} className="fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-6 relative z-10">"{t.text}"</p>
                <div className="flex items-center gap-3">
                  <img src={t.avatar} alt={t.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-blue-100 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-slate-900 text-sm">{t.name}</p>
                    <p className="text-slate-400 text-xs font-medium">{t.role}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social proof numbers ──────────────────────────────────────────────── */}
      <section className="py-16 px-4 bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
        <div className="max-w-5xl mx-auto relative">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {[
              { value: '50,000+', label: 'Active Learners',  icon: Users },
              { value: '500+',    label: 'Lessons',          icon: BookOpen },
              { value: '95%',     label: 'Success Rate',     icon: TrendingUp },
              { value: '4.9 ★',   label: 'Average Rating',   icon: Star },
            ].map((s, i) => (
              <div key={s.label} className="animate-fadeInUp" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center mx-auto mb-3">
                  <s.icon size={20} className="text-blue-300" />
                </div>
                <div className="text-3xl sm:text-4xl font-black text-white mb-1">{s.value}</div>
                <div className="text-slate-400 text-sm font-medium">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner ────────────────────────────────────────────────────────── */}
      <section id="about" className="py-24 px-4 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="relative overflow-hidden rounded-[2.5rem] shadow-2xl">
            {/* Background */}
            <div className="hero-bg p-10 sm:p-16 text-center relative">
              <div className="absolute inset-0 dot-grid opacity-20 pointer-events-none" />
              <div className="absolute top-0 right-0 w-72 h-72 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-blue-700/30 blur-3xl pointer-events-none" />

              <div className="relative z-10">
                {/* Small badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-white/80 text-xs font-medium mb-6">
                  <Flame size={12} className="text-orange-400" />
                  Free to start — no credit card needed
                </div>

                <h2 className="font-display text-4xl sm:text-5xl font-black text-white mb-4">
                  Ready to Unlock<br />Your Full Potential?
                </h2>
                <p className="text-white/70 text-lg mb-10 max-w-xl mx-auto">
                  Join over 50,000 learners already gaining 21st century skills with Ilesy Academy.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <button
                    onClick={onGetStarted}
                    className="group px-10 py-4 bg-white text-blue-700 font-bold text-lg rounded-2xl hover:bg-blue-50 transition-all shadow-2xl hover:-translate-y-1 flex items-center justify-center gap-2"
                  >
                    Start Your Journey
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  <button
                    onClick={onLogin}
                    className="px-10 py-4 glass-dark border border-white/20 text-white font-semibold text-lg rounded-2xl hover:bg-white/10 transition-all hover:-translate-y-1 flex items-center justify-center gap-2"
                  >
                    Sign In
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────────────────────── */}
      <footer className="bg-slate-900 text-white py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">
            {/* Brand */}
            <div className="text-center md:text-left">
              <div className="flex items-center gap-2.5 justify-center md:justify-start mb-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-900/50">
                  <BookOpen size={18} className="text-white" strokeWidth={2.5} />
                </div>
                <span className="font-bold text-xl">Ilesy Academy</span>
              </div>
              <p className="text-slate-400 text-sm max-w-xs">
                The premier learning platform for students and professionals worldwide seeking 21st century skills.
              </p>
            </div>

            {/* Links */}
            <div className="flex gap-12 text-sm text-slate-400">
              <div className="space-y-3">
                <p className="text-slate-200 font-semibold text-xs uppercase tracking-wider">Platform</p>
                {['Subjects', 'Courses', 'Quizzes', 'Leaderboard'].map(l => (
                  <p key={l} className="hover:text-white transition-colors cursor-pointer">{l}</p>
                ))}
              </div>
              <div className="space-y-3">
                <p className="text-slate-200 font-semibold text-xs uppercase tracking-wider">Company</p>
                {['About', 'Privacy', 'Terms', 'Contact'].map(l => (
                  <p key={l} className="hover:text-white transition-colors cursor-pointer">{l}</p>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-slate-800 text-center">
            <p className="text-slate-500 text-sm">
              © {new Date().getFullYear()} Ilesy Academy. All rights reserved. Built with ❤️ for the World.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
