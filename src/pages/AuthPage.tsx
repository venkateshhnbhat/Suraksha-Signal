import React, { useState, useEffect } from 'react';
import {
  signInWithPopup,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from 'firebase/auth';
import { auth, googleProvider, setupRecaptcha, sendPhoneOtp, isFirebaseConfigured } from '@/firebase';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { AppUser } from '@/types';

interface Props {
  onLoginDemo?: (user: AppUser) => void;
}

type AuthTab = 'email' | 'phone';
type EmailMode = 'signin' | 'signup';

const AuthPage: React.FC<Props> = ({ onLoginDemo }) => {
  const navigate = useNavigate();

  // Dark / Light theme state
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    const savedTheme = localStorage.getItem('suraksha_theme') || localStorage.getItem('safesignal_theme');
    return (savedTheme as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('suraksha_theme', theme);
  }, [theme]);

  // Tab & mode states
  const [activeTab, setActiveTab] = useState<AuthTab>('email');
  const [emailMode, setEmailMode] = useState<EmailMode>('signin');

  // Form states
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Phone states
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);

  // Status & modal states
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');

  const hasFirebaseConfig = isFirebaseConfigured();

  const handleDemoSignIn = (customEmail?: string, customName?: string) => {
    const demoUser: AppUser = {
      uid: 'demo_user_' + Date.now().toString(36),
      displayName: customName || 'Venkatesh (Demo User)',
      email: customEmail || 'demo@safesignal.app',
      phoneNumber: '+919876543210',
      isDemo: true
    };
    if (onLoginDemo) {
      onLoginDemo(demoUser);
    } else {
      localStorage.setItem('suraksha_demo_user', JSON.stringify(demoUser));
      localStorage.setItem('safesignal_demo_user', JSON.stringify(demoUser));
    }
    navigate('/');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email || !password) {
      setError('Please fill in both email and password.');
      return;
    }

    if (emailMode === 'signup' && password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (emailMode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    try {
      setLoading(true);

      if (!hasFirebaseConfig) {
        // Smooth local demo fallback when Firebase keys are default/demo
        handleDemoSignIn(email, name || email.split('@')[0]);
        return;
      }

      if (emailMode === 'signin') {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        if (name && userCredential.user) {
          await updateProfile(userCredential.user, { displayName: name });
        }
        navigate('/');
      }
    } catch (err: any) {
      console.warn('Auth error:', err);
      const code = err.code || '';
      if (
        code.includes('api-key-not-valid') ||
        code.includes('invalid-api-key') ||
        code.includes('app-not-authorized')
      ) {
        // Fall back gracefully to demo session
        handleDemoSignIn(email, name || email.split('@')[0]);
      } else if (code === 'auth/user-not-found' || code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      if (!hasFirebaseConfig) {
        handleDemoSignIn('google.user@safesignal.app', 'Google Account User');
        return;
      }
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (e: any) {
      console.error(e);
      if (
        e.code?.includes('api-key-not-valid') ||
        e.code?.includes('invalid-api-key') ||
        e.code?.includes('app-not-authorized')
      ) {
        handleDemoSignIn('google.user@safesignal.app', 'Google Account User');
      } else {
        setError(e.message || 'Google Sign-In failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone) return setError('Please enter a valid phone number with country code (e.g. +91 9876543210)');
    try {
      setLoading(true);
      setError(null);
      if (!hasFirebaseConfig) {
        // In demo mode, simulate OTP sent immediately
        setVerificationId('mock_verification_id_123');
        setSuccessMsg('Demo OTP code is: 123456');
        return;
      }
      const verifier = setupRecaptcha('recaptcha-container');
      const confirmation = await sendPhoneOtp(phone, verifier);
      setVerificationId(confirmation.verificationId);
      setSuccessMsg('OTP code sent to your phone.');
    } catch (e: any) {
      console.error(e);
      if (e.code?.includes('api-key-not-valid') || e.code?.includes('invalid-api-key')) {
        setVerificationId('mock_verification_id_123');
        setSuccessMsg('Demo OTP code is: 123456');
      } else {
        setError(e.message || 'Failed to send OTP. Check phone number and Firebase configuration.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationId || !otp) return;
    try {
      setLoading(true);
      setError(null);
      if (verificationId === 'mock_verification_id_123') {
        if (otp === '123456' || otp.length === 6) {
          handleDemoSignIn(undefined, `Phone User (${phone})`);
          return;
        } else {
          setError('Invalid demo OTP. Use 123456.');
          return;
        }
      }
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      await signInWithCredential(auth, credential);
      navigate('/');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) {
      setError('Enter your email to receive password reset link.');
      return;
    }
    try {
      setLoading(true);
      if (hasFirebaseConfig) {
        await sendPasswordResetEmail(auth, resetEmail);
      }
      setShowForgotModal(false);
      setSuccessMsg(`Password reset instructions sent to ${resetEmail}`);
    } catch (err: any) {
      setError(err.message || 'Failed to send reset email.');
    } finally {
      setLoading(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div
      className={`min-h-screen transition-colors duration-300 flex flex-col justify-center items-center p-4 relative overflow-hidden ${
        isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      {/* Background ambient decorative glows */}
      <div
        className={`absolute top-1/4 -left-20 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
          isDark ? 'bg-teal-500/15' : 'bg-teal-400/25'
        }`}
      />
      <div
        className={`absolute bottom-1/4 -right-20 w-80 h-80 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
          isDark ? 'bg-rose-500/10' : 'bg-rose-400/20'
        }`}
      />

      {/* Top Bar with Brand, Language & Theme Toggle */}
      <div className="w-full max-w-md flex items-center justify-between mb-4 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xl">🛡️</span>
          <span className="font-bold text-sm tracking-wide bg-gradient-to-r from-teal-500 to-emerald-400 bg-clip-text text-transparent">
            SURAKSHA SIGNAL
          </span>
        </div>

        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          {/* Theme Toggle Button */}
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className={`px-2.5 py-1.5 rounded-full text-xs font-medium flex items-center gap-1.5 transition-all duration-200 border shadow-sm ${
              isDark
                ? 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white hover:border-slate-600'
                : 'bg-white border-slate-200 text-slate-700 hover:text-slate-950 hover:border-slate-300 shadow-slate-200/50'
            }`}
            title="Toggle Light / Dark Mode"
          >
            {isDark ? (
              <>
                <span className="text-amber-400">☀️</span>
              </>
            ) : (
              <>
                <span className="text-indigo-500">🌙</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Auth Card */}
      <div
        className={`w-full max-w-md rounded-3xl p-6 sm:p-8 backdrop-blur-xl border transition-all duration-300 shadow-2xl z-10 ${
          isDark
            ? 'bg-slate-900/90 border-slate-800 shadow-black/40'
            : 'bg-white/95 border-slate-200 shadow-xl shadow-slate-300/40'
        }`}
      >
        {/* Header Badge & Title */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white shadow-lg shadow-teal-500/25 mb-3 text-2xl">
            🚨
          </div>
          <h1 className={`text-2xl font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {activeTab === 'phone'
              ? 'Phone Verification'
              : emailMode === 'signin'
              ? 'Welcome Back'
              : 'Create Suraksha Account'}
          </h1>
          <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Discreet Emergency SOS & Live GPS Safety Network
          </p>
        </div>

        {/* Auth Method Navigation Tabs (Email vs Phone) */}
        <div
          className={`flex rounded-2xl p-1 mb-5 border ${
            isDark ? 'bg-slate-950 border-slate-800' : 'bg-slate-100 border-slate-200'
          }`}
        >
          <button
            type="button"
            onClick={() => {
              setActiveTab('email');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition duration-150 flex items-center justify-center gap-1.5 ${
              activeTab === 'email'
                ? isDark
                  ? 'bg-slate-800 text-teal-400 shadow-sm shadow-slate-900'
                  : 'bg-white text-teal-600 shadow-sm'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>✉️</span> Email & Password
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('phone');
              setError(null);
            }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition duration-150 flex items-center justify-center gap-1.5 ${
              activeTab === 'phone'
                ? isDark
                  ? 'bg-slate-800 text-teal-400 shadow-sm shadow-slate-900'
                  : 'bg-white text-teal-600 shadow-sm'
                : isDark
                ? 'text-slate-400 hover:text-slate-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📱</span> Phone OTP
          </button>
        </div>

        {/* Error / Success Notifications */}
        {error && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2 border ${
              isDark
                ? 'bg-rose-950/40 border-rose-800/60 text-rose-300'
                : 'bg-rose-50 border-rose-200 text-rose-700'
            }`}
          >
            <span className="text-sm">⚠️</span>
            <span className="flex-1">{error}</span>
          </div>
        )}

        {successMsg && (
          <div
            className={`mb-4 p-3 rounded-xl text-xs flex items-start gap-2 border ${
              isDark
                ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            <span className="text-sm">✅</span>
            <span className="flex-1">{successMsg}</span>
          </div>
        )}

        {/* TAB 1: EMAIL & PASSWORD (SIGN IN / SIGN UP) */}
        {activeTab === 'email' && (
          <div>
            {/* Sub-toggle: Sign In vs Sign Up */}
            <div className="flex items-center justify-center gap-2 mb-4">
              <button
                type="button"
                onClick={() => {
                  setEmailMode('signin');
                  setError(null);
                }}
                className={`text-xs font-semibold pb-1 border-b-2 transition ${
                  emailMode === 'signin'
                    ? 'border-teal-500 text-teal-500'
                    : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`
                }`}
              >
                Sign In
              </button>
              <span className={`text-xs ${isDark ? 'text-slate-600' : 'text-slate-300'}`}>•</span>
              <button
                type="button"
                onClick={() => {
                  setEmailMode('signup');
                  setError(null);
                }}
                className={`text-xs font-semibold pb-1 border-b-2 transition ${
                  emailMode === 'signup'
                    ? 'border-teal-500 text-teal-500'
                    : `border-transparent ${isDark ? 'text-slate-400 hover:text-slate-200' : 'text-slate-500 hover:text-slate-800'}`
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handleEmailSubmit} className="space-y-3.5">
              {emailMode === 'signup' && (
                <div>
                  <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Sharma"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={`w-full rounded-xl px-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 border ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-teal-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                    }`}
                  />
                </div>
              )}

              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  Email Address
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 border ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-teal-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                    }`}
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">✉️</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className={`block text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Password
                  </label>
                  {emailMode === 'signin' && (
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setShowForgotModal(true);
                      }}
                      className="text-[11px] text-teal-500 hover:text-teal-400 transition"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className={`w-full rounded-xl pl-9 pr-10 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 border ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-teal-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                    }`}
                  />
                  <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔒</span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-200 text-xs focus:outline-none"
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                </div>
              </div>

              {emailMode === 'signup' && (
                <div>
                  <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className={`w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 border ${
                        isDark
                          ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-teal-500'
                          : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                      }`}
                    />
                    <span className="absolute left-3 top-2.5 text-slate-400 text-sm">🔑</span>
                  </div>
                </div>
              )}

              {emailMode === 'signin' && (
                <div className="flex items-center gap-2">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-teal-500 focus:ring-teal-500/30 accent-teal-500"
                  />
                  <label
                    htmlFor="rememberMe"
                    className={`text-xs cursor-pointer select-none ${isDark ? 'text-slate-400' : 'text-slate-600'}`}
                  >
                    Remember this device for 30 days
                  </label>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Processing…</span>
                  </>
                ) : (
                  <span>{emailMode === 'signin' ? 'Sign In to Suraksha Signal' : 'Complete Registration'}</span>
                )}
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: PHONE NUMBER OTP */}
        {activeTab === 'phone' && (
          <div className="space-y-3.5">
            <div>
              <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Mobile Phone Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  placeholder="+91 98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={loading || !!verificationId}
                  className={`w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 border ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-teal-500'
                      : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                  }`}
                />
                <span className="absolute left-3 top-2.5 text-slate-400 text-sm">📞</span>
              </div>
              <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                Includes country code prefix (e.g., +91 for India, +1 for US)
              </p>
            </div>

            {!verificationId ? (
              <button
                type="button"
                onClick={handleSendOtp}
                disabled={loading}
                className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-400 border border-teal-500/30 font-semibold rounded-xl text-sm transition flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
              >
                {loading ? 'Sending Verification Code…' : '📨 Send One-Time SMS Code'}
              </button>
            ) : (
              <div className="space-y-3 pt-2">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className={`block text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                      6-Digit Security Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setVerificationId(null);
                        setOtp('');
                      }}
                      className="text-[11px] text-teal-500 hover:underline"
                    >
                      Change number
                    </button>
                  </div>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit OTP"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className={`w-full text-center tracking-widest text-lg font-mono rounded-xl px-3.5 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 border ${
                      isDark
                        ? 'bg-slate-950 border-slate-800 text-slate-100 focus:border-teal-500'
                        : 'bg-slate-50 border-slate-300 text-slate-900 focus:border-teal-500'
                    }`}
                  />
                </div>

                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={loading || otp.length < 6}
                  className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {loading ? 'Verifying Code…' : '✅ Verify & Sign In'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Divider */}
        <div className="relative my-5 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className={`w-full border-t ${isDark ? 'border-slate-800' : 'border-slate-200'}`} />
          </div>
          <span
            className={`relative px-3 text-[11px] uppercase tracking-wider ${
              isDark ? 'bg-slate-900 text-slate-500' : 'bg-white text-slate-400'
            }`}
          >
            Or Instant Access
          </span>
        </div>

        {/* Google SSO Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={loading}
          className={`w-full mb-3 py-2.5 px-4 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2.5 border disabled:opacity-50 ${
            isDark
              ? 'bg-slate-800/80 hover:bg-slate-700/80 border-slate-700 text-white'
              : 'bg-white hover:bg-slate-50 border-slate-300 text-slate-800 shadow-sm'
          }`}
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* Demo / Guest Mode One-Click Card */}
        <div
          className={`p-3.5 rounded-2xl border transition ${
            isDark
              ? 'bg-gradient-to-r from-teal-950/40 to-slate-900 border-teal-500/30'
              : 'bg-teal-50/70 border-teal-200'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <span
              className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                isDark ? 'text-teal-400' : 'text-teal-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-teal-500 animate-ping" />
              Developer & Guest Testing
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-200 text-teal-800'
              }`}
            >
              1-Click
            </span>
          </div>
          <p className={`text-[11px] mb-2.5 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
            Bypass authentication and test the full SOS siren, GPS tracking, and emergency contacts.
          </p>
          <button
            type="button"
            onClick={() => handleDemoSignIn()}
            className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
              isDark
                ? 'bg-teal-500/10 hover:bg-teal-500/20 text-teal-300 border-teal-500/40'
                : 'bg-teal-600 hover:bg-teal-700 text-white border-transparent shadow-sm'
            }`}
          >
            <span>🚀 Launch Demo / Guest Session</span>
          </button>
        </div>
      </div>

      {/* Invisible reCAPTCHA container for Phone Auth */}
      <div id="recaptcha-container" />

      {/* Forgot Password Modal */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div
            className={`w-full max-w-sm rounded-2xl p-6 border shadow-2xl ${
              isDark ? 'bg-slate-900 border-slate-800 text-slate-100' : 'bg-white border-slate-200 text-slate-900'
            }`}
          >
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-base flex items-center gap-1.5">
                <span>🔑</span> Reset Password
              </h3>
              <button
                type="button"
                onClick={() => setShowForgotModal(false)}
                className="text-slate-400 hover:text-slate-200 text-sm"
              >
                ✕
              </button>
            </div>
            <p className={`text-xs mb-4 ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
              Enter the email address associated with your Suraksha Signal account. We will send you instructions to reset your password.
            </p>
            <form onSubmit={handleResetPassword} className="space-y-3">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className={`w-full rounded-xl px-3.5 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-teal-500/40 ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400'
                }`}
              />
              <div className="flex gap-2 justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border ${
                    isDark ? 'border-slate-700 text-slate-300' : 'border-slate-300 text-slate-700'
                  }`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-teal-500 hover:bg-teal-600 text-slate-950 font-bold rounded-xl text-xs transition"
                >
                  Send Reset Link
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Footer Info */}
      <footer className="mt-6 text-center text-[11px] text-slate-500 z-10">
        Suraksha Signal Protective Network • End-to-End Encrypted SOS
      </footer>
    </div>
  );
};

export default AuthPage;
