import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { findEdge, type Hint, type IslandStatus } from '@bridgle/core';
import { t, techniqueKey } from '../i18n.ts';
import { cycleEdge, hint, removeEdge, reset, statuses, undo, type Session } from '../game/session.ts';
import { isSoundOn, setSoundOn, sfx, SOUND_EVENT } from '../game/sound.ts';
import type { BoardView, ViewModel } from '../game/view.ts';
import { AdSlot } from './AdSlot.tsx';
import { BoardCanvas } from './BoardCanvas.tsx';
import { Dialog } from './Dialog.tsx';
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
  /** Screen reader announcements (visually hidden). */
  const [announce, setAnnounce] = useState('');
  const [celebrating, setCelebrating] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [soundOn, setSound] = useState(isSoundOn);
  const timer = useTimer(!!session && !session.solved, initialMs, session?.puzzle);
  // Input can arrive faster than Preact re-renders; always build on the newest session.
  const latest = useRef(session);
  latest.current = session;

  useEffect(() => {
    setHintView(NO_HINT);
    setMessage('');
    setCelebrating(false);
  }, [session?.puzzle]);

  useEffect(() => {
    const sync = () => setSound(isSoundOn());
    window.addEventListener(SOUND_EVENT, sync);
    return () => window.removeEventListener(SOUND_EVENT, sync);
  }, []);

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

  const change = (next: Session, changedEdge = -1) => {
    const prev = latest.current;
    if (next === prev || !prev) return;
    latest.current = next;
    setHintView(NO_HINT);
    playChangeSound(prev.counts, next.counts);
    if (!next.solved && newlyFull(statuses(prev), statuses(next))) sfx.complete();
    if (changedEdge >= 0) setAnnounce(describeBridge(next, changedEdge));
    if (next.solved && !prev.solved) {
      // Hold back result dialogs until the short celebration is over (or skipped).
      setCelebrating(true);
      sfx.win();
      setAnnounce(t('a11y.solved'));
      const view = viewRef.current;
      void (view ? view.playWin() : Promise.resolve()).then(() => setCelebrating(false));
    }
    onChange(next, timer.read());
  };
  const changeRef = useRef(change);
  changeRef.current = change;

  const onFocusIsland = (island: number, selected: boolean) => {
    const s = latest.current;
    if (!s) return;
    if (selected) sfx.select();
    setAnnounce(describeIsland(s, island) + (selected ? t('a11y.selected') : ''));
  };

  const onCycle = (edge: number) => {
    const current = latest.current;
    if (!current) return;
    const result = cycleEdge(current, edge);
    if (result.blocked) {
      viewRef.current?.flash(result.by);
      sfx.blocked();
      setMessage(t('game.blocked'));
      return;
    }
    setMessage('');
    change(result.session, edge);
  };

  const onRemove = (edge: number) => {
    const current = latest.current;
    if (!current) return;
    setMessage('');
    change(removeEdge(current, edge), edge);
  };

  // Undo stays available from the keyboard; on the board a tap on a bridge removes it.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!(ev.ctrlKey || ev.metaKey) || ev.shiftKey || ev.altKey || ev.key.toLowerCase() !== 'z') return;
      const target = ev.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const current = latest.current;
      if (!current || current.solved || current.history.length === 0) return;
      ev.preventDefault();
      changeRef.current(undo(current));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onHint = () => {
    const current = latest.current;
    if (!current || current.solved) return;
    const { session: next, hint: h } = hint(current);
    latest.current = next;
    onChange(next, timer.read());
    setHintView(hintHighlights(current, h));
    setMessage(hintText(h));
    sfx.hint();
  };

  const islandState = useMemo(() => session && statuses(session), [session]);
  const isolated = !!islandState?.includes('isolated');

  const model: ViewModel | null = useMemo(
    () =>
      session && {
        board: session.board,
        counts: session.counts,
        statuses: islandState!,
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
        <button
          class="btn icon"
          onClick={() => setSoundOn(!soundOn)}
          aria-pressed={!soundOn}
          aria-label={soundOn ? t('game.mute') : t('game.unmute')}
          title={soundOn ? t('game.mute') : t('game.unmute')}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 9h4l5-4v14l-5-4H4z" />
            {soundOn ? <path d="M16.5 8.5a5 5 0 010 7M19 6a8.5 8.5 0 010 12" /> : <path d="M17 9l5 6M22 9l-5 6" />}
          </svg>
        </button>
      </header>

      {model ? (
        <BoardCanvas model={model} onCycle={onCycle} onRemove={onRemove} onFocus={onFocusIsland} viewRef={viewRef} />
      ) : (
        <div class="board-frame placeholder">
          <p>{placeholder}</p>
        </div>
      )}

      <p class={`status${!message && isolated ? ' warn' : ''}`} role="status" aria-live="polite">
        {message || (isolated ? t('game.isolated') : '')}
      </p>
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      {celebrating && <p class="skip-hint">{t('win.skip')}</p>}

      <nav class="toolbar">
        <button class="btn" onClick={() => setConfirmReset(true)} disabled={!playing || session!.counts.every((c) => c === 0)}>
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

      {/* Ads only below the board and toolbar, never on the board. */}
      <AdSlot placement="board" />

      {!celebrating && children}

      {confirmReset && (
        <Dialog title={t('game.resetTitle')} onClose={() => setConfirmReset(false)}>
          <p>{t('game.resetBody')}</p>
          <div class="dialog-actions">
            <button class="btn" onClick={() => setConfirmReset(false)}>
              {t('common.cancel')}
            </button>
            <button
              class="btn primary"
              onClick={() => {
                setConfirmReset(false);
                if (latest.current) change(reset(latest.current));
              }}
            >
              {t('game.reset')}
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}

function playChangeSound(before: ArrayLike<number>, after: ArrayLike<number>): void {
  let up = false;
  let down = false;
  for (let i = 0; i < after.length; i++) {
    if ((after[i] as number) > (before[i] as number)) up = true;
    else if ((after[i] as number) < (before[i] as number)) down = true;
  }
  if (up) sfx.build();
  else if (down) sfx.splash();
}

/** True when at least one island just became complete. */
function newlyFull(before: IslandStatus[], after: IslandStatus[]): boolean {
  return after.some((st, i) => st === 'full' && before[i] !== 'full' && before[i] !== 'isolated');
}

function describeIsland(s: Session, island: number): string {
  const isl = s.puzzle.islands[island]!;
  let have = 0;
  for (const e of s.board.edgesOf[island]!) have += s.counts[e] as number;
  return t('a11y.island', { n: isl.n, row: isl.y + 1, col: isl.x + 1, have });
}

function describeBridge(s: Session, edge: number): string {
  const e = s.board.edges[edge]!;
  const a = s.puzzle.islands[e.a]!;
  const b = s.puzzle.islands[e.b]!;
  return t('a11y.bridge', {
    count: s.counts[edge] as number,
    a: t('a11y.islandShort', { n: a.n, row: a.y + 1, col: a.x + 1 }),
    b: t('a11y.islandShort', { n: b.n, row: b.y + 1, col: b.x + 1 }),
  });
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
