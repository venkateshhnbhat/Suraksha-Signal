import React, { useState } from 'react';
import { signInWithPopup, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, googleProvider, setupRecaptcha, sendPhoneOtp, isFirebaseConfigured } from '@/firebase';
import { useNavigate } from 'react-router-dom';
import type { AppUser } from '@/App';

interface Props {
  onLoginDemo?: (user: AppUser) => void;
}

const AuthPage: React.FC<Props> = ({ onLoginDemo }) => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasFirebaseConfig = isFirebaseConfigured();

  const handleDemoSignIn = () => {
    const demoUser: AppUser = {
      uid: 'demo_user_123',
      displayName: 'Venkatesh (Demo User)',
      email: 'demo@safesignal.app',
      phoneNumber: '+919876543210',
      isDemo: true
    };
    if (onLoginDemo) {
      onLoginDemo(demoUser);
    } else {
      localStorage.setItem('safesignal_demo_user', JSON.stringify(demoUser));
    }
    navigate('/');
  };

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Google Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone) return setError('Enter a valid phone number');
    try {
      setLoading(true);
      setError(null);
      const verifier = setupRecaptcha('recaptcha-container');
      const confirmation = await sendPhoneOtp(phone, verifier);
      setVerificationId(confirmation.verificationId);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to send OTP. Check phone number and Firebase configuration.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationId) return;
    try {
      setLoading(true);
      setError(null);
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background ambient glow */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-800 rounded-3xl p-8 shadow-2xl z-10">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-500 to-emerald-400 text-white shadow-lg shadow-teal-500/20 mb-4 text-3xl">
            🚨
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Suraksha Signal</h1>
          <p className="text-sm text-slate-400 mt-1">
            Emergency SOS & Real-time Location Broadcast
          </p>
        </div>

        {/* Demo Mode Instant Launch Banner */}
        <div className="mb-6 p-4 rounded-2xl bg-gradient-to-r from-teal-950/60 to-emerald-950/60 border border-teal-500/30">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-teal-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
              Quick Test / Demo Mode
            </span>
            <span className="text-[11px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full font-medium">
              Ready
            </span>
          </div>
          <p className="text-xs text-slate-300 mb-3">
            Explore the complete app (SOS trigger, GPS location, contacts & alert simulation) without configuring Firebase keys.
          </p>
          <button
            onClick={handleDemoSignIn}
            className="w-full py-2.5 px-4 bg-gradient-to-r from-teal-500 to-emerald-500 hover:from-teal-600 hover:to-emerald-600 text-slate-950 font-semibold rounded-xl text-sm transition duration-150 shadow-md shadow-teal-500/20 flex items-center justify-center gap-2"
          >
            <span>🚀 Enter as Demo User</span>
          </button>
        </div>

        {/* Divider */}
        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-800" />
          </div>
          <span className="relative bg-slate-900 px-3 text-xs uppercase tracking-wider text-slate-500">
            Or Sign In with Firebase
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-950/50 border border-red-800/60 rounded-xl text-xs text-red-300">
            ⚠️ {error}
          </div>
        )}

        {/* Google Sign-in */}
        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full mb-4 py-2.5 px-4 bg-slate-800 hover:bg-slate-700/80 border border-slate-700 text-white rounded-xl text-sm font-medium transition duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
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

        {/* Phone OTP */}
        <div className="space-y-3">
          <input
            type="tel"
            placeholder="Phone number (+91...)"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
          />
          <button
            onClick={handleSendOtp}
            disabled={loading || !!verificationId}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-teal-400 font-medium rounded-xl text-sm transition disabled:opacity-50"
          >
            {loading ? 'Sending OTP…' : verificationId ? '✓ OTP Sent' : 'Send Phone OTP'}
          </button>

          {verificationId && (
            <div className="space-y-3 pt-2">
              <input
                type="text"
                placeholder="6-digit verification code"
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-teal-500 transition"
              />
              <button
                onClick={handleVerifyOtp}
                disabled={loading}
                className="w-full py-2.5 bg-teal-500 hover:bg-teal-600 text-white font-semibold rounded-xl text-sm transition disabled:opacity-50"
              >
                {loading ? 'Verifying…' : 'Verify & Sign In'}
              </button>
            </div>
          )}
        </div>

        {/* Invisible reCAPTCHA container */}
        <div id="recaptcha-container" />

        {!hasFirebaseConfig && (
          <p className="mt-6 text-[11px] text-center text-slate-500">
            Tip: You can add real Firebase keys to <code className="text-teal-400">SafeSignal/.env</code> anytime.
          </p>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
