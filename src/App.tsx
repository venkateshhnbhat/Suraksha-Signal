import React, { useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '@/firebase';
import AuthPage from '@/pages/AuthPage';
import HomePage from '@/pages/HomePage';
import ContactsPage from '@/pages/ContactsPage';
import TrackPage from '@/pages/TrackPage';
import ErrorBoundary from '@/components/ErrorBoundary';
import type { AppUser } from '@/types';

export type { AppUser };

const App: React.FC = () => {
  const [user, setUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem('safesignal_demo_user');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return null;
      }
    }
    return null;
  });
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    // Safety timeout: never get stuck on loading screen
    timer = setTimeout(() => {
      setChecking(false);
    }, 1500);

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
            const saved = localStorage.getItem('safesignal_demo_user');
            if (saved) {
              try {
                setUser(JSON.parse(saved));
              } catch {
                setUser(null);
              }
            } else {
              setUser(null);
            }
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
      };
    } catch (err) {
      console.warn('Firebase onAuthStateChanged error caught:', err);
      clearTimeout(timer);
      setChecking(false);
    }
  }, []);

  const handleLoginDemo = (demoUser: AppUser) => {
    localStorage.setItem('safesignal_demo_user', JSON.stringify(demoUser));
    setUser(demoUser);
  };

  const handleLogout = () => {
    localStorage.removeItem('safesignal_demo_user');
    setUser(null);
    try {
      auth.signOut();
    } catch {
      // ignore
    }
  };

  if (checking) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-900 text-white">
        <div className="w-12 h-12 border-4 border-teal-500 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-lg font-semibold tracking-wide text-teal-400">SafeSignal</h2>
        <p className="text-xs text-slate-400 mt-1">Initializing secure safety environment…</p>
      </div>
    );
  }

  return (
    <ErrorBoundary>
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
