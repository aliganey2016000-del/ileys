import { useState } from 'react';
import { BookOpen, ArrowLeft, Eye, EyeOff, GraduationCap, Users, Shield, Phone } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';

interface AuthPageProps {
  mode: 'login' | 'signup';
  setMode: (m: 'login' | 'signup') => void;
  onBack: () => void;
}

const roles = [
  { key: 'student', label: 'Student',  icon: GraduationCap, desc: 'I want to learn new skills',       color: 'from-blue-500 to-cyan-500' },
  { key: 'teacher', label: 'Teacher',  icon: Users,          desc: 'I want to teach and manage classes', color: 'from-violet-500 to-purple-600' },
  { key: 'admin',   label: 'Admin',    icon: Shield,         desc: 'I manage the platform',        color: 'from-rose-500 to-red-600' },
];

export default function AuthPage({ mode, setMode, onBack }: AuthPageProps) {
  const { signIn, signUp } = useAuth();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone]       = useState('');
  const [role, setRole]         = useState('student');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (mode === 'login') {
      const { error } = await signIn(email, password);
      if (error) setError(error);
    } else {
      if (!fullName.trim()) { setError('Please enter your full name.'); setLoading(false); return; }
      const { error } = await signUp(email, password, fullName.trim(), role);
      if (error) { setError(error); }
      // Save phone number after successful signup
      else if (phone.trim()) {
        // Get the newly created user session
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from('profiles').update({ phone_number: phone.trim() }).eq('id', user.id);
        }
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Blobs */}
      <div className="absolute top-20 right-20 w-72 h-72 rounded-full bg-blue-500/20 blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 left-20 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Back button */}
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-white/70 hover:text-white transition-colors mb-8 text-sm font-medium"
        >
          <ArrowLeft size={16} />
          Back to home
        </button>

        <div className="glass rounded-3xl p-8 shadow-2xl">
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
              <BookOpen size={20} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl text-slate-900">Ilesy Academy</span>
          </div>

          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-slate-500 text-sm mb-8">
            {mode === 'login' ? 'Sign in to continue your learning journey.' : 'Join 50,000+ learners today — it\'s free.'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  placeholder="e.g. Amina Hassan"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/80 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white/80 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full px-4 py-3 pr-11 rounded-xl border border-slate-200 bg-white/80 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {/* Phone number on signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Phone Number <span className="text-slate-400 font-normal">(optional — for SMS alerts)</span>
                </label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    <Phone size={16} />
                  </div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="+252 61 234 5678"
                    className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 bg-white/80 text-slate-900 placeholder-slate-400 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
                  />
                </div>
                <p className="text-xs text-slate-400 mt-1">E.164 format e.g. +252611234567</p>
              </div>
            )}

            {/* Role selection on signup */}
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">I am a...</label>
                <div className="grid grid-cols-3 gap-2">
                  {roles.map(r => (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setRole(r.key)}
                      className={`flex flex-col items-center gap-2 px-3 py-3 rounded-2xl border-2 text-sm font-medium transition-all ${
                        role === r.key
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${r.color} flex items-center justify-center`}>
                        <r.icon size={16} className="text-white" />
                      </div>
                      <span>{r.label}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2">
                  {roles.find(r => r.key === role)?.desc}
                </p>
              </div>
            )}

            {error && (
              <div className="px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-bold text-sm rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:-translate-y-0.5"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {mode === 'login' ? 'Signing in...' : 'Creating account...'}
                </span>
              ) : (
                mode === 'login' ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {mode === 'login' ? "Don't have an account? " : "Already have an account? "}
            <button
              onClick={() => { setError(null); setMode(mode === 'login' ? 'signup' : 'login'); }}
              className="font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {mode === 'login' ? 'Sign up free' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
