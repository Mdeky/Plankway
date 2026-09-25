import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * Play timer that pauses while the tab is hidden. `resetKey` restarts it from
 * `initialMs` (e.g. for a new puzzle).
 */
export function useTimer(running: boolean, initialMs: number, resetKey: unknown): { elapsed: number; read(): number } {
  const base = useRef(initialMs);
  const startedAt = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(initialMs);

  const read = () => base.current + (startedAt.current === null ? 0 : performance.now() - startedAt.current);

  useEffect(() => {
    base.current = initialMs;
    startedAt.current = null;
    setElapsed(initialMs);
  }, [resetKey]);

  useEffect(() => {
    const pause = () => {
      if (startedAt.current !== null) {
        base.current = read();
        startedAt.current = null;
      }
    };
    const resume = () => {
      if (running && startedAt.current === null && document.visibilityState === 'visible') {
        startedAt.current = performance.now();
      }
    };
    const onVisibility = () => (document.visibilityState === 'visible' ? resume() : pause());

    resume();
    const tick = setInterval(() => setElapsed(read()), 250);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      pause();
      setElapsed(base.current);
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [running, resetKey]);

  return { elapsed, read };
}

export function formatTime(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
