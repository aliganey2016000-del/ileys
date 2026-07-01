import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { AuthProvider } from './lib/AuthContext';
import LandingPage from './pages/LandingPage';
import AuthPage from './pages/AuthPage';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import AdminDashboard from './pages/AdminDashboard';
import LessonBuilderPage from './pages/LessonBuilderPage';
import CoursePreviewPage from './pages/CoursePreviewPage';
import { CertificateVerifyPage } from './pages/CertificateVerifyPage';
import { useAuth } from './lib/AuthContext';
import { supabase } from './lib/supabase';

function AppRouter() {
  const { user, profile, loading, profileLoading } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [previewCourseId, setPreviewCourseId] = useState<string | null>(null);

  // Initial auth loading
  if (loading) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70 text-lg font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Show loading while fetching profile after sign in
  if (user && profileLoading && !profile) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-white/70 text-lg font-medium">Signing you in...</p>
        </div>
      </div>
    );
  }

  // If user is signed in but profile couldn't be fetched, sign them out and show landing
  if (user && !profile && !profileLoading) {
    return (
      <div className="min-h-screen hero-bg flex items-center justify-center">
        <div className="text-center bg-white/10 backdrop-blur-md rounded-2xl p-8 max-w-md mx-4">
          <p className="text-white/90 text-lg font-medium mb-4">Could not load your profile. Please try again.</p>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.reload();
            }}
            className="px-6 py-3 bg-white text-slate-800 font-semibold rounded-xl hover:bg-slate-100 transition-colors"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  if (previewCourseId) {
    return (
      <CoursePreviewPage
        courseId={previewCourseId}
        onBack={() => setPreviewCourseId(null)}
      />
    );
  }

  // Authenticated: route to the appropriate dashboard immediately
  if (user && profile) {
    if (profile.role === 'admin') {
      return <AdminDashboard onPreviewCourse={setPreviewCourseId} />;
    }

    if (profile.role === 'teacher') {
      return <TeacherDashboard />;
    }

    return <StudentDashboard />;
  }

  if (showAuth) {
    return (
      <AuthPage
        mode={authMode}
        setMode={setAuthMode}
        onBack={() => setShowAuth(false)}
      />
    );
  }

  return (
    <LandingPage
      onGetStarted={() => { setAuthMode('signup'); setShowAuth(true); }}
      onLogin={() => { setAuthMode('login'); setShowAuth(true); }}
    />
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/verify/:certificateId" element={<CertificateVerifyPage />} />
        <Route path="/*" element={
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        } />
      </Routes>
    </BrowserRouter>
  );
}
