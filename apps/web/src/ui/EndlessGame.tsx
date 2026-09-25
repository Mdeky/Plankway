import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { findEdge, type Hint } from '@bridgle/core';
import { t, techniqueKey } from '../i18n.ts';
import { GeneratorClient, randomSeed, type EndlessPuzzle } from '../game/generator-client.ts';
import { createSession, cycleEdge, hint, reset, statuses, undo, type Session } from '../game/session.ts';
import {
  clearEndlessGame,
  loadEndlessGame,
  loadEndlessProgress,
  saveEndlessGame,
  saveEndlessProgress,
  type EndlessProgress,
} from '../game/storage.ts';
import type { BoardView, ViewModel } from '../game/view.ts';
import { BoardCanvas } from './BoardCanvas.tsx';
import { Dialog } from './Dialog.tsx';
import { formatTime, useTimer } from './hooks.ts';

interface Loaded {
  level: number;
  session: Session;
  initialMs: number;
}

interface Win {
  level: number;
  timeMs: number;
  undos: number;
  hints: number;
  record: boolean;
}

const NO_HINT = { edges: [] as number[], island: -1, mistakes: [] as number[] };

export function EndlessGame({ onExit }: { onExit(): void }) {
  const client = useMemo(() => new GeneratorClient(), []);
  const nextPuzzle = useRef<Promise<EndlessPuzzle> | null>(null);
  const viewRef = useRef<BoardView | null>(null);
  const [progress, setProgress] = useState<EndlessProgress>(loadEndlessProgress);
  const [game, setGame] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hintView, setHintView] = useState(NO_HINT);
  const [message, setMessage] = useState('');
  const [win, setWin] = useState<Win | null>(null);

  const session = game?.session ?? null;
  const timer = useTimer(!!session && !session.solved, game?.initialMs ?? 0, game?.session.puzzle);

  const prefetch = (level: number) => {
    const promise = client.generate(level, randomSeed(`endless-${level}`));
    promise.catch(() => undefined);
    nextPuzzle.current = promise;
  };

  const start = async (level: number) => {
    setGame(null);
    setError(null);
    try {
      const pending = nextPuzzle.current;
      nextPuzzle.current = null;
      let next = pending ? await pending.catch(() => null) : null;
      if (!next || next.level !== level) next = await client.generate(level, randomSeed(`endless-${level}`));
      setGame({ level, session: createSession(next.puzzle, next.solution), initialMs: 0 });
      prefetch(level + 1);
    } catch (err) {
      setError(String(err));
    }
  };

  // Resume a saved game, or build a fresh one.
  useEffect(() => {
    const saved = loadEndlessGame();
    if (saved && saved.level === progress.level) {
      const s = createSession(saved.puzzle, saved.solution, saved.counts);
      setGame({ level: saved.level, session: { ...s, undos: saved.undos, hints: saved.hints }, initialMs: saved.elapsedMs });
      prefetch(saved.level + 1);
    } else {
      void start(progress.level);
    }
    return () => client.dispose();
  }, []);

  // Persist progress on every change and when the tab is hidden.
  useEffect(() => {
    if (!game || game.session.solved) return;
    const save = () =>
      saveEndlessGame({
        level: game.level,
        puzzle: game.session.puzzle,
        solution: solutionOf(game.session),
        counts: Array.from(game.session.counts),
        elapsedMs: timer.read(),
        undos: game.session.undos,
        hints: game.session.hints,
      });
    save();
    const onHide = () => document.visibilityState === 'hidden' && save();
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', save);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', save);
    };
  }, [game]);

  const update = (next: Session) => {
    if (!game) return;
    setHintView(NO_HINT);
    setGame({ ...game, session: next });
    if (next.solved && !game.session.solved) finish(next);
  };

  const finish = (solvedSession: Session) => {
    const level = game!.level;
    const record = level > progress.best;
    const updated: EndlessProgress = {
      level: level + 1,
      best: Math.max(progress.best, level),
      solved: progress.solved + 1,
    };
    saveEndlessProgress(updated);
    clearEndlessGame();
    setProgress(updated);
    setWin({ level, timeMs: timer.read(), undos: solvedSession.undos, hints: solvedSession.hints, record });
  };

  const onCycle = (edge: number) => {
    if (!session) return;
    const result = cycleEdge(session, edge);
    if (result.blocked) {
      viewRef.current?.flash(result.by);
      setMessage(t('game.blocked'));
      return;
    }
    setMessage('');
    update(result.session);
  };

  const onHint = () => {
    if (!session || session.solved) return;
    const { session: next, hint: h } = hint(session);
    setGame({ ...game!, session: next });
    setHintView(hintHighlights(session, h));
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

  return (
    <main class="screen game">
      <header class="topbar">
        <button class="btn icon" onClick={onExit} aria-label={t('common.back')}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <h1 class="topbar-title">{t('game.level', { level: game?.level ?? progress.level })}</h1>
        <span class="timer" aria-hidden="true">
          {formatTime(timer.elapsed)}
        </span>
      </header>

      {model ? (
        <BoardCanvas model={model} onCycle={onCycle} viewRef={viewRef} />
      ) : (
        <div class="board-frame placeholder">
          <p>{error ?? t('game.generating')}</p>
        </div>
      )}

      <p class="status" role="status" aria-live="polite">
        {message}
      </p>

      <nav class="toolbar">
        <button class="btn" onClick={() => session && update(undo(session))} disabled={!session || session.history.length === 0 || session.solved}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 14L4 9l5-5" />
            <path d="M4 9h11a5 5 0 010 10h-3" />
          </svg>
          {t('game.undo')}
        </button>
        <button class="btn" onClick={() => session && update(reset(session))} disabled={!session || session.solved}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 3-6.2" />
            <path d="M4 4v5h5" />
          </svg>
          {t('game.reset')}
        </button>
        <button class="btn" onClick={onHint} disabled={!session || session.solved}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9 18h6M10 21h4" />
            <path d="M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0012 3z" />
          </svg>
          {t('game.hint')}
        </button>
      </nav>

      {win && (
        <Dialog title={t('win.title')}>
          {win.record && <p class="badge">{t('win.record')}</p>}
          <dl class="stats">
            <div>
              <dt>{t('win.time')}</dt>
              <dd>{formatTime(win.timeMs)}</dd>
            </div>
            <div>
              <dt>{t('win.undos')}</dt>
              <dd>{win.undos}</dd>
            </div>
            <div>
              <dt>{t('win.hints')}</dt>
              <dd>{win.hints}</dd>
            </div>
          </dl>
          <div class="dialog-actions">
            <button class="btn" onClick={onExit}>
              {t('common.back')}
            </button>
            <button
              class="btn primary"
              autofocus
              onClick={() => {
                setWin(null);
                setMessage('');
                void start(win.level + 1);
              }}
            >
              {t('win.next')}
            </button>
          </div>
        </Dialog>
      )}
    </main>
  );
}

function solutionOf(s: Session) {
  return s.board.edges
    .filter((e) => (s.solution.min[e.id] as number) > 0)
    .map((e) => ({ a: e.a, b: e.b, count: s.solution.min[e.id] as 1 | 2 }));
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
