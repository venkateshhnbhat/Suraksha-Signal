import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AuthPage from '../pages/AuthPage';
import * as firebaseModule from '../firebase';
import * as firebaseAuth from 'firebase/auth';

vi.mock('../firebase', async (importOriginal) => {
  const actual = await importOriginal<typeof firebaseModule>();
  return {
    ...actual,
    isFirebaseConfigured: vi.fn(() => true),
    requestEmailOtp: vi.fn(),
    confirmEmailOtp: vi.fn()
  };
});

vi.mock('firebase/auth', async (importOriginal) => {
  const actual = await importOriginal<typeof firebaseAuth>();
  return {
    ...actual,
    signInWithCustomToken: vi.fn().mockResolvedValue({ user: { uid: 'user_123' } } as any)
  };
});

describe('AuthPage Email OTP Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders email input and sends code when Send code button is clicked', async () => {
    const mockRequest = vi.mocked(firebaseModule.requestEmailOtp).mockResolvedValueOnce({
      success: true,
      message: 'Verification code sent.'
    });

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthPage />
      </MemoryRouter>
    );

    // Initial state: Email OTP tab is active
    const emailInput = screen.getByPlaceholderText('you@example.com');
    expect(emailInput).toBeInTheDocument();

    const sendCodeBtn = screen.getByRole('button', { name: /Send code/i });
    expect(sendCodeBtn).toBeInTheDocument();

    // Enter email and submit
    fireEvent.change(emailInput, { target: { value: 'user@surakshasignal.app' } });
    fireEvent.click(sendCodeBtn);

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith('user@surakshasignal.app');
    });

    // Code input and Verify button appear
    await waitFor(() => {
      expect(screen.getByPlaceholderText('••••••')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Verify & Sign In/i })).toBeInTheDocument();
      expect(screen.getByText(/Change email/i)).toBeInTheDocument();
    });
  });

  it('calls confirmEmailOtp and signInWithCustomToken upon verifying code', async () => {
    vi.mocked(firebaseModule.requestEmailOtp).mockResolvedValueOnce({
      success: true,
      message: 'Verification code sent.'
    });

    const mockConfirm = vi.mocked(firebaseModule.confirmEmailOtp).mockResolvedValueOnce({
      token: 'custom-auth-token-987'
    });

    const mockSignInWithCustomToken = vi.mocked(firebaseAuth.signInWithCustomToken);

    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthPage />
      </MemoryRouter>
    );

    // Enter email and send code
    const emailInput = screen.getByPlaceholderText('you@example.com');
    fireEvent.change(emailInput, { target: { value: 'verified@surakshasignal.app' } });
    fireEvent.click(screen.getByRole('button', { name: /Send code/i }));

    // Wait for code input
    const codeInput = await screen.findByPlaceholderText('••••••');

    // Enter 6 digits
    fireEvent.change(codeInput, { target: { value: '654321' } });

    await waitFor(() => {
      expect(mockConfirm).toHaveBeenCalledWith('verified@surakshasignal.app', '654321');
    });

    await waitFor(() => {
      expect(mockSignInWithCustomToken).toHaveBeenCalled();
    });
  });
});

