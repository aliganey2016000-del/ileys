import { ReactNode, useState } from 'react';
import { BookOpen, Menu, LogOut, ChevronRight } from 'lucide-react';
import { useAuth } from '../lib/AuthContext';
import { NotificationCenter } from './NotificationCenter';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ElementType;
  badge?: number;
}

interface SidebarLayoutProps {
  items: NavItem[];
  active: string;
  onNavigate: (key: string) => void;
  accentGradient: string;
  accentText: string;
  children: ReactNode;
  bottomNavItems?: NavItem[];
  showBottomNav?: boolean;
}

export default function SidebarLayout({
  items, active, onNavigate, accentGradient, accentText, children, bottomNavItems, showBottomNav = false,
}: SidebarLayoutProps) {
  const { profile, user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={`flex flex-col h-full ${mobile ? 'w-72' : collapsed ? 'w-16' : 'w-60'} transition-all duration-300`}>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-4 py-4 ${collapsed && !mobile ? 'justify-center' : ''}`}>
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${accentGradient} flex items-center justify-center shadow-lg flex-shrink-0`}>
          <BookOpen size={17} className="text-white" strokeWidth={2.5} />
        </div>
        {(!collapsed || mobile) && (
          <>
            <span className="font-bold text-lg tracking-tight text-slate-900 flex-1">
              Ilesy Academy
            </span>
            <NotificationCenter
              userId={user?.id}
              onNavigate={key => { onNavigate(key); if (mobile) setMobileOpen(false); }}
              accentGradient={accentGradient}
            />
          </>
        )}
      </div>

      {/* Profile card */}
      {(!collapsed || mobile) && (
        <div className={`mx-3 mb-4 p-3 rounded-2xl bg-gradient-to-br ${accentGradient} text-white`}>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center font-bold text-sm flex-shrink-0">
              {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate leading-tight">{profile?.full_name || 'User'}</p>
              <p className="text-xs text-white/70 capitalize">{profile?.role}</p>
            </div>
          </div>
        </div>
      )}
      {collapsed && !mobile && (
        <div className="flex justify-center mb-4">
          <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${accentGradient} flex items-center justify-center font-bold text-sm text-white`}>
            {profile?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
        </div>
      )}

      {/* Nav items */}
      <nav className="flex-1 min-h-0 px-2 space-y-0.5 overflow-y-auto">
        {items.map(item => {
          const isActive = active === item.key;
          return (
            <button
              key={item.key}
              onClick={() => { onNavigate(item.key); if (mobile) setMobileOpen(false); }}
              title={collapsed && !mobile ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group ${
                isActive
                  ? `bg-gradient-to-r ${accentGradient} text-white shadow-lg`
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              } ${collapsed && !mobile ? 'justify-center' : ''}`}
            >
              <item.icon size={18} strokeWidth={isActive ? 2.5 : 2} className="flex-shrink-0" />
              {(!collapsed || mobile) && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge !== undefined && item.badge > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isActive ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-700'}`}>
                      {item.badge}
                    </span>
                  )}
                  {isActive && <ChevronRight size={14} className="opacity-70" />}
                </>
              )}
              {collapsed && !mobile && item.badge !== undefined && item.badge > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-blue-500 rounded-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Sign out */}
      <div className={`flex-shrink-0 p-3 border-t border-slate-100 ${collapsed && !mobile ? 'flex justify-center' : ''}`}>
        <button
          onClick={signOut}
          title={collapsed && !mobile ? 'Sign out' : undefined}
          className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 transition-colors w-full ${collapsed && !mobile ? 'justify-center w-auto' : ''}`}
        >
          <LogOut size={17} />
          {(!collapsed || mobile) && <span>Sign Out</span>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Desktop sidebar */}
      <aside className={`hidden lg:flex flex-col bg-white border-r border-slate-100 shadow-sm sticky top-0 h-screen flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        <SidebarContent />
        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="absolute -right-3 top-20 w-6 h-6 bg-white border border-slate-200 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-all z-10"
        >
          <ChevronRight size={12} className={`text-slate-500 transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </button>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 bg-white shadow-2xl z-50 flex flex-col animate-slide-right">
            <SidebarContent mobile />
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (mobile) */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-100 px-4 py-3 flex items-center justify-between gap-2">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-700 flex-shrink-0"
          >
            <Menu size={20} />
          </button>
          <div className="flex items-center gap-2 flex-1">
            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${accentGradient} flex items-center justify-center`}>
              <BookOpen size={14} className="text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-slate-900">Ilesy Academy</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <NotificationCenter
              userId={user?.id}
              onNavigate={onNavigate}
              accentGradient={accentGradient}
            />
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold text-red-500 hover:bg-red-50 border border-red-100 transition-colors"
            >
              <LogOut size={14} />
              <span className="hidden xs:inline">Out</span>
            </button>
          </div>
        </header>

        <main className={`flex-1 overflow-auto ${showBottomNav ? 'pb-20 lg:pb-0' : ''}`}>
          {children}
        </main>

        {/* Mobile Bottom Navigation */}
        {showBottomNav && bottomNavItems && (
          <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200">
            <div className="flex items-center justify-around h-16 px-2 safe-area-inset-bottom">
              {bottomNavItems.filter(item => ['overview', 'my-courses', 'market', 'arena', 'profile'].includes(item.key)).map(item => {
                const isActive = active === item.key;
                return (
                  <button
                    key={item.key}
                    onClick={() => onNavigate(item.key)}
                    className={`flex flex-col items-center justify-center gap-0.5 px-3 py-1.5 rounded-xl transition-all min-w-[60px] relative ${
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
                      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-blue-600 rounded-full" />
                    )}
                  </button>
                );
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  );
}
