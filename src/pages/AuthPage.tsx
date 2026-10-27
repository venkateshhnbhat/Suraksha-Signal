import React, { useState } from 'react';
import { signInWithPopup, PhoneAuthProvider, signInWithCredential } from 'firebase/auth';
import { auth, googleProvider, setupRecaptcha, sendPhoneOtp } from '@/firebase';
import { useNavigate } from 'react-router-dom';

const AuthPage: React.FC = () => {
  const navigate = useNavigate();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [verificationId, setVerificationId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      await signInWithPopup(auth, googleProvider);
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone) return setError('Enter a phone number');
    try {
      setLoading(true);
      // Container must exist in the DOM
      const verifier = setupRecaptcha('recaptcha-container');
      const confirmation = await sendPhoneOtp(phone, verifier);
      setVerificationId(confirmation.verificationId);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!verificationId) return;
    try {
      setLoading(true);
      const credential = PhoneAuthProvider.credential(verificationId, otp);
      await signInWithCredential(auth, credential);
      navigate('/');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <h1 className="mb-6 text-2xl font-semibold text-gray-800">SafeSignal – Sign In</h1>
      {error && <div className="mb-4 text-red-600">{error}</div>}
      {/* Google Sign‑In */}
      <button
        onClick={handleGoogleSignIn}
        disabled={loading}
        className="mb-6 w-full max-w-xs rounded bg-primary py-2 text-white hover:bg-primary/80 disabled:opacity-50"
      >
        {loading ? 'Signing in…' : 'Continue with Google'}
      </button>

      {/* Phone OTP */}
      <div className="w-full max-w-xs space-y-2">
        <input
          type="tel"
          placeholder="Phone (+1234567890)"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
        />
        <button
          onClick={handleSendOtp}
          disabled={loading || !!verificationId}
          className="w-full rounded bg-primary py-2 text-white hover:bg-primary/80 disabled:opacity-50"
        >
          {loading ? 'Sending…' : verificationId ? 'OTP Sent' : 'Send OTP'}
        </button>
        {verificationId && (
          <>
            <input
              type="text"
              placeholder="Enter OTP"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
              className="w-full rounded border border-gray-300 px-3 py-2 focus:border-primary focus:outline-none"
            />
            <button
              onClick={handleVerifyOtp}
              disabled={loading}
              className="w-full rounded bg-primary py-2 text-white hover:bg-primary/80 disabled:opacity-50"
            >
              {loading ? 'Verifying…' : 'Verify OTP'}
            </button>
          </>
        )}
      </div>
      {/* Invisible reCAPTCHA container */}
      <div id="recaptcha-container" />
    </div>
  );
};

export default AuthPage;
