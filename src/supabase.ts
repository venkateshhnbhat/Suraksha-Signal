import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://swptetysmvlvorkqzcuo.supabase.co';
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3cHRldHlzbXZsdm9ya3F6Y3VvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMyNjIyNTIsImV4cCI6MjEwODgzODI1Mn0.UeMn1WyRjR-3ICFMiSOjeiiR1TWieu1S6hUd7nHPyCA';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  !supabaseUrl.includes('placeholder')
);

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Triggers Google OAuth Sign-In via Supabase.
 * Redirects the user to Google login, and returns back to the application.
 */
export const signInWithGoogleSupabase = async () => {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  });

  if (error) {
    throw error;
  }

  return data;
};

/**
 * Sends a real 6-digit OTP to the user's email via Supabase Auth.
 */
export const sendSupabaseOtp = async (email: string) => {
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined,
      shouldCreateUser: true
    }
  });
  if (error) throw error;
  return data;
};

/**
 * Verifies the 6-digit OTP sent to the user's email via Supabase Auth.
 */
export const verifySupabaseOtp = async (email: string, token: string) => {
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email'
  });
  if (error) {
    const retry = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup'
    });
    if (retry.error) {
      throw error;
    }
    return retry.data;
  }
  return data;
};

