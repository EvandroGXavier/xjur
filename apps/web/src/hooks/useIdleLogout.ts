import { useEffect, useRef } from 'react';

export function useIdleLogout(options: {
  timeoutMs: number;
  onIdle: () => void;
  enabled?: boolean;
}) {
  const { timeoutMs, onIdle, enabled = true } = options;
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const reset = () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      timerRef.current = window.setTimeout(() => {
        onIdle();
      }, timeoutMs);
    };

    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
    ];

    for (const eventName of events) {
      window.addEventListener(eventName, reset, { passive: true });
    }

    reset();

    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
      for (const eventName of events) {
        window.removeEventListener(eventName, reset);
      }
    };
  }, [enabled, onIdle, timeoutMs]);
}

