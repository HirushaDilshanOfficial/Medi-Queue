import { useEffect, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

/**
 * Runs a task on an interval, but only while the screen is active and the app is
 * in the foreground.
 *
 * A live queue poll has no value in the background: it drains the battery and
 * competes with the request the app makes the moment the patient reopens it. The
 * screen passes `enabled: isFocused` so switching tabs stops the poll, and
 * AppState additionally suspends it when the app is backgrounded.
 *
 * Consecutive failures back off so a dead server is not hammered every few
 * seconds; a successful poll resets that backoff.
 */
export function usePolling(
  task: () => Promise<void>,
  intervalMs: number,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const taskRef = useRef(task);

  // Kept out of render so the compiler's ref rules hold; declared before the
  // polling effect so it has already run when that effect starts.
  useEffect(() => {
    taskRef.current = task;
  });

  useEffect(() => {
    if (!enabled) return undefined;

    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const schedule = () => {
      if (cancelled) return;
      // 1x, then 2x, 4x ... capped at 8 intervals.
      const backoff = Math.min(failures === 0 ? 1 : 2 ** failures, 8);
      timer = setTimeout(tick, intervalMs * backoff);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        await taskRef.current();
        failures = 0;
      } catch {
        failures += 1;
      }
      schedule();
    };

    const appStateSub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active') {
        if (timer) clearTimeout(timer);
        timer = null;
        return;
      }
      // Returning to the app should feel instant: refresh now and drop whatever
      // backoff accumulated while the app was away.
      if (timer) clearTimeout(timer);
      failures = 0;
      void tick();
    });

    void tick();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      appStateSub.remove();
    };
  }, [intervalMs, enabled]);
}
