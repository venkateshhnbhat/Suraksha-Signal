import React, { useState, useRef, useEffect, useCallback } from 'react';

interface SOSButtonProps {
  onActivate: () => void;
  label?: string;
}

const HOLD_DURATION_MS = 3000; // 3 seconds hold

const SOSButton: React.FC<SOSButtonProps> = ({ onActivate, label = 'Hold 3s for SOS' }) => {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const isHoldingRef = useRef<boolean>(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    isHoldingRef.current = false;
    setHolding(false);
    setProgress(0);
    if ('vibrate' in navigator) {
      navigator.vibrate(0);
    }
  }, []);

  const startHold = useCallback(() => {
    // Prevent double invocation
    if (isHoldingRef.current) return;
    isHoldingRef.current = true;
    setHolding(true);
    startTimeRef.current = Date.now();

    if ('vibrate' in navigator) {
      navigator.vibrate([100, 50, 100]);
    }

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setProgress(pct);

      if (elapsed >= HOLD_DURATION_MS) {
        clearTimer();
        if ('vibrate' in navigator) {
          navigator.vibrate([500, 200, 500]);
        }
        onActivate();
      }
    }, 50);
  }, [clearTimer, onActivate]);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // Pointer event handlers
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return; // Only primary button
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    startHold();
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    clearTimer();
  };

  const handlePointerCancel = () => {
    clearTimer();
  };

  const handlePointerLeave = () => {
    clearTimer();
  };

  // Keyboard accessibility (Hold Space or Enter)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      if (!e.repeat) {
        e.preventDefault();
        startHold();
      }
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      clearTimer();
    }
  };

  const secondsLeft = Math.max(0, (HOLD_DURATION_MS - (progress / 100) * HOLD_DURATION_MS) / 1000).toFixed(1);

  return (
    <div className="relative flex flex-col items-center justify-center">
      {/* Outer pulsing ring */}
      <div
        className={`absolute rounded-full pointer-events-none transition-all duration-300 ${
          holding ? 'w-64 h-64 bg-red-500/20 animate-ping' : 'w-56 h-56 bg-red-500/10 animate-pulse'
        }`}
      />

      {/* Main SOS button */}
      <button
        type="button"
        role="button"
        tabIndex={0}
        aria-label="Emergency SOS panic button. Hold for 3 seconds to broadcast emergency signal."
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onPointerLeave={handlePointerLeave}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        className={`relative z-10 w-44 h-44 rounded-full flex flex-col items-center justify-center text-white font-bold transition-transform shadow-2xl select-none outline-none focus:ring-4 focus:ring-red-400/50 ${
          holding
            ? 'scale-95 bg-gradient-to-tr from-red-700 to-red-600 shadow-red-600/50'
            : 'bg-gradient-to-tr from-red-600 to-rose-500 hover:scale-105 shadow-red-500/40 active:scale-95'
        }`}
      >
        {holding ? (
          <div className="flex flex-col items-center justify-center text-center px-4">
            <span className="text-3xl font-black">{secondsLeft}s</span>
            <span className="text-xs uppercase tracking-wider font-semibold text-red-200 mt-1">
              Keep Holding…
            </span>
            <div className="w-24 h-2 bg-black/40 rounded-full mt-2.5 overflow-hidden">
              <div
                className="h-full bg-white rounded-full transition-all duration-75"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center px-2">
            <span className="text-4xl mb-1">🚨</span>
            <span className="text-xl font-extrabold tracking-wider">SOS</span>
            <span className="text-[11px] text-red-100 font-medium tracking-tight mt-0.5">{label}</span>
          </div>
        )}
      </button>

      {/* Screen reader live region */}
      <div className="sr-only" aria-live="polite">
        {holding ? `SOS button active: ${secondsLeft} seconds remaining before alert trigger.` : 'SOS button idle.'}
      </div>

      <p className="mt-4 text-xs text-slate-400 font-medium">
        Press & hold (or hold Space/Enter) for 3 seconds to broadcast emergency signal
      </p>
    </div>
  );
};

export default SOSButton;
