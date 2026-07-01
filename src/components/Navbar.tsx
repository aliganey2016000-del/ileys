import { useState } from 'react';
import { BookOpen, Menu, X, LogOut, User } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';

interface NavbarProps {
  transparent?: boolean;
  onLogin?: () => void;
  onGetStarted?: () => void;
}

export default function Navbar({ transparent = false, onLogin, onGetStarted }: NavbarProps) {
  const { user, profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const base = transparent
    ? 'fixed top-0 left-0 right-0 z-50 transition-all duration-300'
    : 'sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm';

  const navLinks = [
    { label: 'Subjects', href: '#levels' },
    { label: 'Courses', href: '#courses' },
    { label: 'About', href: '#about' },
  ];

  return (
    <nav className={base}>
      <div className={`${transparent ? 'glass-dark' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 md:h-18">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg">
                <BookOpen size={18} className="text-white" strokeWidth={2.5} />
              </div>
              <span className={`font-bold text-xl tracking-tight ${transparent ? 'text-white' : 'text-slate-900'}`}>
                Ilesy Academy
              </span>
            </div>

            {/* Desktop nav links — only on landing */}
            {!user && (
              <div className="hidden md:flex items-center gap-8">
                {navLinks.map(link => (
                  <a
                    key={link.label}
                    href={link.href}
                    className={`text-sm font-medium transition-colors ${
                      transparent ? 'text-white/80 hover:text-white' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {link.label}
                  </a>
                ))}
              </div>
            )}

            {/* Right side */}
            <div className="flex items-center gap-3">
              {user && profile ? (
                <div className="flex items-center gap-3">
                  <div className="hidden sm:flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                      <User size={14} className="text-white" />
                    </div>
                    <div className="hidden md:block">
                      <p className={`text-sm font-semibold leading-none ${transparent ? 'text-white' : 'text-slate-800'}`}>
                        {profile.full_name || 'User'}
                      </p>
                      <p className={`text-xs capitalize mt-0.5 ${transparent ? 'text-white/60' : 'text-slate-400'}`}>
                        {profile.role}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={signOut}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <LogOut size={15} />
                    <span className="hidden sm:inline">Sign out</span>
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={onLogin}
                    className={`hidden md:block px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                      transparent
                        ? 'text-white/90 hover:text-white hover:bg-white/10'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    onClick={onGetStarted}
                    className="hidden md:inline-flex px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-lg shadow-blue-500/25 transition-all hover:shadow-blue-500/40 hover:-translate-y-0.5"
                  >
                    Get Started
                  </button>
                </>
              )}

              {/* Mobile menu toggle */}
              {!user && (
                <button
                  className={`md:hidden p-2 rounded-lg ${transparent ? 'text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-100'}`}
                  onClick={() => setMenuOpen(v => !v)}
                >
                  {menuOpen ? <X size={20} /> : <Menu size={20} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && !user && (
          <div className={`md:hidden border-t ${transparent ? 'border-white/10 glass-dark' : 'border-slate-200 bg-white'}`}>
            <div className="px-4 py-3 space-y-1">
              {navLinks.map(link => (
                <a
                  key={link.label}
                  href={link.href}
                  onClick={() => setMenuOpen(false)}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-medium ${
                    transparent ? 'text-white/80 hover:text-white hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {link.label}
                </a>
              ))}
              <div className="pt-2 border-t border-white/10 flex flex-col gap-2">
                <button
                  onClick={() => { setMenuOpen(false); onLogin?.(); }}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-medium ${
                    transparent ? 'text-white/80 hover:bg-white/10' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => { setMenuOpen(false); onGetStarted?.(); }}
                  className="w-full px-3 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl text-center"
                >
                  Get Started Free
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
