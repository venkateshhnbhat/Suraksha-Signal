import React, { useState, useRef } from 'react';

interface SOSButtonProps {
  /** Called when the hold completes */
  onActivate: () => void;
  /** Optional label */
  label?: string;
}

const HOLD_DURATION_MS = 3000; // 3 seconds

const SOSButton: React.FC<SOSButtonProps> = ({ onActivate, label = 'Hold for SOS' }) => {
  const [holding, setHolding] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setHolding(false);
    setProgress(0);
  };

  const startHold = () => {
    setHolding(true);
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current;
      setProgress(Math.min(100, (elapsed / HOLD_DURATION_MS) * 100));
      if (elapsed >= HOLD_DURATION_MS) {
        clearTimer();
        onActivate();
      }
    }, 100);
  };

  return (
    <button
      onMouseDown={startHold}
      onMouseUp={clearTimer}
      onMouseLeave={clearTimer}
      onTouchStart={startHold}
      onTouchEnd={clearTimer}
      className="relative rounded-full bg-red-600 text-white font-semibold px-6 py-3 focus:outline-none hover:bg-red-700 disabled:opacity-50"
      disabled={holding}
    >
      {holding ? (
        <div className="flex items-center">
          <span className="mr-2">Activating…</span>
          <div className="w-24 h-2 bg-white bg-opacity-30 rounded">
            <div
              className="h-full bg-white rounded"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : (
        label
      )}
    </button>
  );
};

export default SOSButton;
