import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions, httpsCallable } from 'firebase/functions';

export const isFirebaseConfigured = (): boolean => {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
  return Boolean(
    apiKey &&
    projectId &&
    !apiKey.includes('your_') &&
    !apiKey.includes('Demo') &&
    !projectId.includes('your_')
  );
};

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || ''
};

// Safe initialization without hardcoded fake keys
const app: FirebaseApp =
  getApps().length === 0
    ? initializeApp(
        isFirebaseConfigured()
          ? firebaseConfig
          : { apiKey: 'none', projectId: 'demo-safesignal' }
      )
    : getApps()[0];

export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const functions: Functions = getFunctions(app);

// Google provider (used in UI)
export const googleProvider = new GoogleAuthProvider();

// Helper to setup reCAPTCHA for phone auth (invisible)
export const setupRecaptcha = (containerId: string) => {
  return new RecaptchaVerifier(
    auth,
    containerId,
    {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved - will proceed with signInWithPhoneNumber
      }
    }
  );
};

export const sendPhoneOtp = async (phoneNumber: string, appVerifier: RecaptchaVerifier) => {
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
};

export const requestEmailOtp = async (email: string) => {
  const sendEmailOtpCallable = httpsCallable<{ email: string }, { success: boolean; message: string }>(
    functions,
    'sendEmailOtp'
  );
  const result = await sendEmailOtpCallable({ email });
  return result.data;
};

export const confirmEmailOtp = async (email: string, code: string) => {
  const verifyEmailOtpCallable = httpsCallable<{ email: string; code: string }, { token: string }>(
    functions,
    'verifyEmailOtp'
  );
  const result = await verifyEmailOtpCallable({ email, code });
  return result.data;
};
