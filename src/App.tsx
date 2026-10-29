import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/firebase';
import { supabase } from '@/supabase';
import AuthPage from '@/pages/AuthPage';
import HomePage from '@/pages/HomePage';
import ContactsPage from '@/pages/ContactsPage';
import TrackPage from '@/pages/TrackPage';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { AppUser } from '@/types';

export type { AppUser };

const getStoredDemoUser = (): AppUser | null => {
  const saved = localStorage.getItem('suraksha_demo_user') || localStorage.getItem('safesignal_demo_user');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      // Migrate key if needed
      localStorage.setItem('suraksha_demo_user', saved);
      return parsed;
    } catch {
      return null;
    }
  }
  return null;
};

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(getStoredDemoUser);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Safety timeout: never get stuck on loading screen
    const timer = setTimeout(() => {
      setChecking(false);
    }, 1500);

    // 1. Listen for Supabase authentication sessions (e.g. Google OAuth redirect)
    let supabaseUnsubscribe: (() => void) | null = null;
    try {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session?.user) {
          clearTimeout(timer);
          setUser({
            uid: session.user.id,
            displayName:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email?.split('@')[0] ||
              'Google User',
            email: session.user.email,
            phoneNumber: session.user.phone || undefined,
            isDemo: false
          });
          setChecking(false);
        }
      });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session?.user) {
          clearTimeout(timer);
          setUser({
            uid: session.user.id,
            displayName:
              session.user.user_metadata?.full_name ||
              session.user.user_metadata?.name ||
              session.user.email?.split('@')[0] ||
              'Google User',
            email: session.user.email,
            phoneNumber: session.user.phone || undefined,
            isDemo: false
          });
          setChecking(false);
        }
      });
      supabaseUnsubscribe = () => data.subscription.unsubscribe();
    } catch (e) {
      console.warn('Supabase auth state listener warning:', e);
    }

    // 2. Listen for Firebase authentication
    try {
      const unsubscribe = onAuthStateChanged(
        auth,
        (firebaseUser: User | null) => {
          clearTimeout(timer);
          if (firebaseUser) {
            setUser({
              uid: firebaseUser.uid,
              displayName: firebaseUser.displayName,
              email: firebaseUser.email,
              phoneNumber: firebaseUser.phoneNumber,
              isDemo: false
            });
          } else {
            // Check if demo user is active in localStorage
            setUser(getStoredDemoUser());
          }
          setChecking(false);
        },
        (error) => {
          console.warn('Firebase auth state listener warning:', error);
          clearTimeout(timer);
          setChecking(false);
        }
      );

      return () => {
        clearTimeout(timer);
        unsubscribe();
        if (supabaseUnsubscribe) {
          supabaseUnsubscribe();
        }
      };
    } catch (err) {
      console.warn('Firebase onAuthStateChanged error caught:', err);
      clearTimeout(timer);
      setChecking(false);
    }
  }, []);

  const handleLoginDemo = (demoUser: AppUser) => {
    localStorage.setItem('suraksha_demo_user', JSON.stringify(demoUser));
    localStorage.setItem('safesignal_demo_user', JSON.stringify(demoUser));
    setUser(demoUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('suraksha_demo_user');
    localStorage.removeItem('safesignal_demo_user');
    setUser(null);
    try {
      auth.signOut();
    } catch {
      // ignore
    }
    try {
      supabase.auth.signOut();
    } catch {
      // ignore
    }
  };

  if (checking) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-semibold tracking-wide text-teal-400">Suraksha Signal</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing secure safety environment…</p>
      </div>
    );
  }

  const hasFirebase = isFirebaseConfigured();

  return (
    <ErrorBoundary>
      {/* Explicit Demo Banner when Firebase is not configured */}
      {!hasFirebase && (
        <aside
          role="status"
          aria-label="Demo mode active notice"
          className="bg-amber-950/80 border-b border-amber-600/60 text-amber-200 px-4 py-2 text-xs text-center flex items-center justify-center gap-2 sticky top-0 z-50 backdrop-blur-md"
        >
          <span className="font-bold">⚠️ Running in Demo Mode:</span>
          <span>Firebase environment is unconfigured. SMS alerts and cloud persistence are simulated locally.</span>
        </aside>
      )}

      <Router>
        <Routes>
          <Route
            path="/auth"
            element={
              user ? (
                <Navigate to="/" replace />
              ) : (
                <AuthPage onLoginDemo={handleLoginDemo} />
              )
            }
          />
          <Route
            path="/contacts"
            element={
              user ? (
                <ContactsPage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          <Route
            path="/track/:alertId"
            element={<TrackPage />}
          />
          <Route
            path="/"
            element={
              user ? (
                <HomePage user={user} onLogout={handleLogout} />
              ) : (
                <Navigate to="/auth" replace />
              )
            }
          />
          {/* Catch‑all fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
};

export default App;
