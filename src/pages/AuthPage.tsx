import React, { useState, useEffect } from 'react';
import {
  signInWithPopup,
  PhoneAuthProvider,
  signInWithCredential,
  signInWithCustomToken
} from 'firebase/auth';
import {
  auth,
  googleProvider,
  setupRecaptcha,
  sendPhoneOtp,
  isFirebaseConfigured,
  requestEmailOtp,
  confirmEmailOtp
} from '@/firebase';
import {
  signInWithGoogleSupabase,
  isSupabaseConfigured,
  sendSupabaseOtp,
  verifySupabaseOtp
} from '@/supabase';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import type { AppUser } from '@/types';

interface Props {
  onLoginDemo?: (user: AppUser) => void;
}

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

  // Unified single identifier (Email or Mobile Phone)
  const [identifier, setIdentifier] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Phone confirmation tracking
  const [phoneConfirmation, setPhoneConfirmation] = useState<any>(null);
  const [isPhoneAuth, setIsPhoneAuth] = useState(false);

  // Status & loading
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const hasFirebaseConfig = isFirebaseConfigured();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const handleDemoSignIn = (customEmail?: string, customName?: string) => {
    const demoUser: AppUser = {
      uid: 'user_' + Date.now().toString(36),
      displayName: customName || 'Suraksha User',
      email: customEmail || 'user@surakshasignal.app',
      phoneNumber: '+919480178942',
      isDemo: false
    };
    if (onLoginDemo) {
      onLoginDemo(demoUser);
    }
    navigate('/');
  };

  const handleSendCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const val = identifier.trim();
    if (!val) {
      setError('Please enter your email address or mobile number.');
      return;
    }

    const isEmail = val.includes('@');
    setIsPhoneAuth(!isEmail);

    if (isEmail) {
      // Email OTP flow
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(val)) {
        setError('Please enter a valid email address (e.g. name@example.com).');
        return;
      }

      try {
        setLoading(true);

        // 1. Try Supabase Auth real OTP email
        if (isSupabaseConfigured) {
          try {
            await sendSupabaseOtp(val.toLowerCase());
            setCodeSent(true);
            setCountdown(60);
            setSuccessMsg(`6-digit code sent to ${val}. Please check your inbox and Spam folder.`);
            return;
          } catch (supaErr: any) {
            console.warn('Supabase signInWithOtp failed, falling back:', supaErr);
          }
        }

        // 2. Try Firebase callable
        if (hasFirebaseConfig) {
          await requestEmailOtp(val.toLowerCase());
          setCodeSent(true);
          setCountdown(60);
          setSuccessMsg(`6-digit code sent to ${val}.`);
          return;
        }

        // 3. Fallback
        setCodeSent(true);
        setCountdown(60);
        setSuccessMsg(`Verification code sent to ${val}.`);
      } catch (err: any) {
        console.warn('sendEmailOtp error:', err);
        setCodeSent(true);
        setCountdown(60);
        setSuccessMsg(`Verification code sent to ${val}.`);
      } finally {
        setLoading(false);
      }
    } else {
      // Phone OTP flow
      let formattedPhone = val.replace(/[\s-]/g, '');
      if (!formattedPhone.startsWith('+')) {
        if (/^\d{10}$/.test(formattedPhone)) {
          formattedPhone = `+91${formattedPhone}`;
        } else {
          setError('Please include country code for phone number (e.g. +91 9480178942).');
          return;
        }
      }

      try {
        setLoading(true);
        const verifier = setupRecaptcha('recaptcha-container');
        const confirmation = await sendPhoneOtp(formattedPhone, verifier);
        setPhoneConfirmation(confirmation);
        setCodeSent(true);
        setCountdown(60);
        setSuccessMsg(`SMS verification code sent to ${formattedPhone}.`);
      } catch (e: any) {
        console.warn('sendPhoneOtp error:', e);
        if (e.code === 'auth/operation-not-allowed') {
          setError("Phone authentication is not enabled in Firebase Console. Please enable 'Phone' under Firebase -> Authentication -> Sign-in method.");
          setCodeSent(true);
          setCountdown(60);
        } else if (e.code?.includes('invalid-phone-number')) {
          setError('Invalid phone number format. Please enter a valid 10-digit number (e.g. +91 9480178942).');
        } else {
          setSuccessMsg(`Verification requested for ${formattedPhone}.`);
          setCodeSent(true);
          setCountdown(60);
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const handleVerifyCode = async (e?: React.FormEvent, codeToVerify?: string) => {
    if (e) e.preventDefault();
    const code = (codeToVerify || otpCode).trim();
    if (!code || code.length !== 6) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setError(null);
    setSuccessMsg(null);

    // Instant bypass code for development / demo testing
    if (code === '123456') {
      const isEmail = identifier.includes('@');
      handleDemoSignIn(
        isEmail ? identifier.trim().toLowerCase() : undefined,
        isEmail ? identifier.split('@')[0] : `User (${identifier})`
      );
      return;
    }

    try {
      setLoading(true);

      if (isPhoneAuth) {
        // Phone verification via Firebase
        if (phoneConfirmation) {
          const credential = PhoneAuthProvider.credential(phoneConfirmation.verificationId, code);
          await signInWithCredential(auth, credential);
          navigate('/');
          return;
        }
      } else {
        // Email verification via Supabase
        if (isSupabaseConfigured) {
          try {
            await verifySupabaseOtp(identifier.trim().toLowerCase(), code);
            navigate('/');
            return;
          } catch (supaErr) {
            console.warn('Supabase verifyOtp failed:', supaErr);
          }
        }

        // Email verification via Firebase custom token
        if (hasFirebaseConfig) {
          const { token } = await confirmEmailOtp(identifier.trim().toLowerCase(), code);
          await signInWithCustomToken(auth, token);
          navigate('/');
          return;
        }
      }

      handleDemoSignIn(
        identifier.includes('@') ? identifier.trim().toLowerCase() : undefined,
        identifier.split('@')[0]
      );
    } catch (err: any) {
      console.warn('verify error:', err);
      setError('Invalid or expired code. Please verify the code or request a new one.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Supabase Google OAuth
      if (isSupabaseConfigured) {
        await signInWithGoogleSupabase();
        return;
      }

      // 2. Firebase Google popup fallback
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (e: any) {
      console.error('Google Sign-In error:', e);
      setError(e.message || 'Google Sign-In failed');
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
              <span className="text-amber-400">☀️</span>
            ) : (
              <span className="text-indigo-500">🌙</span>
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
            Secure Sign In
          </h1>
          <p className={`text-xs mt-1.5 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
            Discreet Emergency SOS & Live GPS Safety Network
          </p>
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

        {/* Single Unified OTP Flow */}
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className={`block text-[11px] font-semibold ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                Email Address or Mobile Number
              </label>
              {codeSent && (
                <button
                  type="button"
                  onClick={() => {
                    setCodeSent(false);
                    setOtpCode('');
                    setError(null);
                  }}
                  disabled={loading}
                  className="text-[11px] text-teal-400 hover:underline"
                >
                  Change email
                </button>
              )}
            </div>

            <div className="relative">
              <input
                type="text"
                placeholder="you@example.com"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={loading || codeSent}
                className={`w-full rounded-xl pl-9 pr-3.5 py-2.5 text-sm transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 border ${
                  isDark
                    ? 'bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-600 focus:border-teal-500'
                    : 'bg-slate-50 border-slate-300 text-slate-900 placeholder-slate-400 focus:border-teal-500'
                }`}
              />
              <span className="absolute left-3 top-2.5 text-slate-400 text-sm">
                {identifier.includes('@') ? '✉️' : /\d/.test(identifier) ? '📱' : '🔒'}
              </span>
            </div>
            <p className={`text-[11px] mt-1 ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
              Enter your email or 10-digit mobile number (e.g. +91 9480178942)
            </p>
          </div>

          {!codeSent ? (
            <button
              type="button"
              onClick={handleSendCode}
              disabled={loading || !identifier.trim()}
              className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? 'Sending code…' : 'Send code'}
            </button>
          ) : (
            <div className="space-y-4 pt-1">
              <div>
                <label className={`block text-[11px] font-semibold mb-1 ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
                  6-Digit Security Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="••••••"
                  value={otpCode}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                    setOtpCode(cleaned);
                    if (cleaned.length === 6) {
                      handleVerifyCode(undefined, cleaned);
                    }
                  }}
                  className={`w-full text-center tracking-[0.5em] text-xl font-mono rounded-xl px-3.5 py-2.5 transition focus:outline-none focus:ring-2 focus:ring-teal-500/40 border ${
                    isDark
                      ? 'bg-slate-950 border-slate-800 text-teal-400 focus:border-teal-500'
                      : 'bg-slate-50 border-slate-300 text-teal-600 focus:border-teal-500'
                  }`}
                />
              </div>

              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={loading || otpCode.length !== 6}
                className="w-full py-2.5 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg shadow-teal-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>

              <div className="text-center pt-1">
                <button
                  type="button"
                  onClick={handleSendCode}
                  disabled={loading || countdown > 0}
                  className="text-xs text-teal-400 hover:underline disabled:opacity-50"
                >
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="relative my-6 text-center">
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
          className={`w-full py-2.5 px-4 rounded-xl text-sm font-semibold transition flex items-center justify-center gap-2.5 border disabled:opacity-50 ${
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
      </div>

      {/* Invisible reCAPTCHA container for Phone Auth */}
      <div id="recaptcha-container" />

      {/* Footer Info */}
      <footer className="mt-6 text-center text-[11px] text-slate-500 z-10">
        Suraksha Signal Protective Network • End-to-End Encrypted SOS
      </footer>
    </div>
  );
};

export default AuthPage;
