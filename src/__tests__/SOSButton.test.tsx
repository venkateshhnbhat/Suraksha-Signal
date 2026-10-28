import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import SOSButton from '../components/SOSButton';

describe('SOSButton Component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with label and emergency aria attributes', () => {
    const handleActivate = vi.fn();
    render(<SOSButton onActivate={handleActivate} label="Hold 3s for SOS" />);

    const button = screen.getByRole('button', { name: /Emergency SOS panic button/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('Hold 3s for SOS')).toBeInTheDocument();
  });

  it('does not trigger onActivate if released before 3 seconds', () => {
    const handleActivate = vi.fn();
    render(<SOSButton onActivate={handleActivate} />);

    const button = screen.getByRole('button', { name: /Emergency SOS panic button/i });

    // Press down
    fireEvent.pointerDown(button, { button: 0 });
    act(() => {
      vi.advanceTimersByTime(1500); // Only 1.5 seconds
    });

    // Release before 3000ms
    fireEvent.pointerUp(button);
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(handleActivate).not.toHaveBeenCalled();
    expect(screen.queryByText(/Keep Holding/i)).not.toBeInTheDocument();
  });

  it('triggers onActivate when held for the full 3 seconds via pointer', () => {
    const handleActivate = vi.fn();
    render(<SOSButton onActivate={handleActivate} />);

    const button = screen.getByRole('button', { name: /Emergency SOS panic button/i });

    fireEvent.pointerDown(button, { button: 0 });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Keep Holding/i)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2100);
    });

    expect(handleActivate).toHaveBeenCalledTimes(1);
  });

  it('supports keyboard accessibility by holding Space key', () => {
    const handleActivate = vi.fn();
    render(<SOSButton onActivate={handleActivate} />);

    const button = screen.getByRole('button', { name: /Emergency SOS panic button/i });

    // Keydown Space
    fireEvent.keyDown(button, { key: ' ' });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByText(/Keep Holding/i)).toBeInTheDocument();

    // Release Space early cancels hold
    fireEvent.keyUp(button, { key: ' ' });
    expect(screen.queryByText(/Keep Holding/i)).not.toBeInTheDocument();
    expect(handleActivate).not.toHaveBeenCalled();

    // Keydown Enter and hold 3s
    fireEvent.keyDown(button, { key: 'Enter' });
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(handleActivate).toHaveBeenCalledTimes(1);
  });
});
