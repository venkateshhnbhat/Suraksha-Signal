import { initializeApp, getApps } from 'firebase/app';
import { getAuth, GoogleAuthProvider, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDemoFallbackKeyOnlyForDevelopment',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'safesignal-app.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'safesignal-app',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'safesignal-app.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1029384756',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1029384756:web:9876543210'
};

// Safe initialization
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);

export const isFirebaseConfigured = (): boolean => {
  const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
  return Boolean(apiKey && !apiKey.includes('Demo') && !apiKey.includes('your_'));
};

// Google provider (used in UI)
export const googleProvider = new GoogleAuthProvider();

// Helper to setup reCAPTCHA for phone auth (invisible)
export const setupRecaptcha = (containerId: string) => {
  return new RecaptchaVerifier(
    containerId,
    {
      size: 'invisible',
      callback: () => {
        // reCAPTCHA solved - will proceed with signInWithPhoneNumber
      }
    },
    auth
  );
};

export const sendPhoneOtp = async (phoneNumber: string, appVerifier: RecaptchaVerifier) => {
  return signInWithPhoneNumber(auth, phoneNumber, appVerifier);
};
