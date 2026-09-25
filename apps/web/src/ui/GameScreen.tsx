import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { findEdge, type Hint } from '@bridgle/core';
import { t, techniqueKey } from '../i18n.ts';
import { cycleEdge, hint, reset, statuses, undo, type Session } from '../game/session.ts';
import type { BoardView, ViewModel } from '../game/view.ts';
import { BoardCanvas } from './BoardCanvas.tsx';
import { formatTime, useTimer } from './hooks.ts';

interface Props {
  title: string;
  session: Session | null;
  /** Shown instead of the board while loading. */
  placeholder: string;
  /** Time already spent on this puzzle (resumed games). */
  initialMs: number;
  /** Every change to the session; `timeMs` is the play time at that moment. */
  onChange(next: Session, timeMs: number): void;
  /** Called on changes and when the page is hidden, to store progress. */
  onPersist?(session: Session, elapsedMs: number): void;
  onExit(): void;
  /** Extra toolbar buttons, e.g. stats. */
  extraActions?: ComponentChildren;
  children?: ComponentChildren;
}

const NO_HINT = { edges: [] as number[], island: -1, mistakes: [] as number[] };

/** Board, timer, status line and toolbar. Shared by daily and endless mode. */
export function GameScreen({ title, session, placeholder, initialMs, onChange, onPersist, onExit, extraActions, children }: Props) {
  const viewRef = useRef<BoardView | null>(null);
  const [hintView, setHintView] = useState(NO_HINT);
  const [message, setMessage] = useState('');
  const timer = useTimer(!!session && !session.solved, initialMs, session?.puzzle);
  // Input can arrive faster than Preact re-renders; always build on the newest session.
  const latest = useRef(session);
  latest.current = session;

  useEffect(() => {
    setHintView(NO_HINT);
    setMessage('');
  }, [session?.puzzle]);

  // Store progress on every change and when the tab goes away.
  useEffect(() => {
    if (!session || session.solved || !onPersist) return;
    const save = () => onPersist(session, timer.read());
    save();
    const onHide = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    };
  }, [session]);

  const change = (next: Session) => {
    if (next === latest.current) return;
    latest.current = next;
    setHintView(NO_HINT);
    onChange(next, timer.read());
  };

  const onCycle = (edge: number) => {
    const current = latest.current;
    if (!current) return;
    const result = cycleEdge(current, edge);
    if (result.blocked) {
      viewRef.current?.flash(result.by);
      setMessage(t('game.blocked'));
      return;
    }
    setMessage('');
    change(result.session);
  };

  const onHint = () => {
    const current = latest.current;
    if (!current || current.solved) return;
    const { session: next, hint: h } = hint(current);
    latest.current = next;
    onChange(next, timer.read());
    setHintView(hintHighlights(current, h));
    setMessage(hintText(h));
  };

  const model: ViewModel | null = useMemo(
    () =>
      session && {
        board: session.board,
        counts: session.counts,
        statuses: statuses(session),
        hintEdges: hintView.edges,
        hintIsland: hintView.island,
        mistakeEdges: hintView.mistakes,
        locked: session.solved,
      },
    [session, hintView],
  );

  const playing = !!session && !session.solved;

  return (
    <main class="screen game">
      <header class="topbar">
        <button class="btn icon" onClick={onExit} aria-label={t('common.back')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 class="topbar-title">{title}</h1>
        <span class="timer" role="timer" aria-label={t('win.time')}>
          {formatTime(timer.elapsed)}
        </span>
      </header>

      {model ? (
        <BoardCanvas model={model} onCycle={onCycle} viewRef={viewRef} />
      ) : (
        <div class="board-frame placeholder">
          <p>{placeholder}</p>
        </div>
      )}

      <p class="status" role="status" aria-live="polite">
        {message}
      </p>

      <nav class="toolbar">
        <button class="btn" onClick={() => latest.current && change(undo(latest.current))} disabled={!playing || session!.history.length === 0}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h11a5 5 0 010 10h-3" />
          </svg>
          {t('game.undo')}
        </button>
        <button class="btn" onClick={() => latest.current && change(reset(latest.current))} disabled={!playing}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 3-6.2" />
            <path d="M4 4v5h5" />
          </svg>
          {t('game.reset')}
        </button>
        <button class="btn" onClick={onHint} disabled={!playing}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 18h6M10 21h4" />
            <path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" />
          </svg>
          {t('game.hint')}
        </button>
        {extraActions}
      </nav>

      {children}
    </main>
  );
}

function hintHighlights(s: Session, h: Hint) {
  const edgeOf = (a: number, b: number) => findEdge(s.board, a, b);
  switch (h.kind) {
    case 'step':
      return { edges: h.place.map((b) => edgeOf(b.a, b.b)), island: h.step.island ?? -1, mistakes: [] };
    case 'reveal':
      return { edges: h.place.map((b) => edgeOf(b.a, b.b)), island: -1, mistakes: [] };
    case 'mistake':
      return { edges: [], island: -1, mistakes: [h.edge] };
    default:
      return NO_HINT;
  }
}

function hintText(h: Hint): string {
  switch (h.kind) {
    case 'step':
      return t(techniqueKey(h.step.technique)) + (h.step.twistAssisted ? t('hint.twist') : '');
    case 'reveal':
      return t('hint.reveal');
    case 'mistake':
      return t('hint.mistake');
    default:
      return '';
  }
}
