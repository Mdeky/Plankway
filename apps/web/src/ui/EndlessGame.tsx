import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Solution } from '@bridgle/core';
import { t } from '../i18n.ts';
import { GeneratorClient, randomSeed, type EndlessPuzzle } from '../game/generator-client.ts';
import { createSession, type Session } from '../game/session.ts';
import {
  clearEndlessGame,
  loadEndlessGame,
  loadEndlessProgress,
  saveEndlessGame,
  saveEndlessProgress,
  type EndlessProgress,
} from '../game/storage.ts';
import { interstitialDue } from '../ads/config.ts';
import { Dialog } from './Dialog.tsx';
import { Interstitial } from './Interstitial.tsx';
import { GameScreen } from './GameScreen.tsx';
import { formatTime } from './format.ts';

interface Loaded {
  level: number;
  session: Session;
  solution: Solution;
  initialMs: number;
}

interface Win {
  level: number;
  timeMs: number;
  undos: number;
  hints: number;
  record: boolean;
}

export function EndlessGame({ onExit }: { onExit(): void }) {
  const client = useMemo(() => new GeneratorClient(), []);
  const nextPuzzle = useRef<Promise<EndlessPuzzle> | null>(null);
  const [progress, setProgress] = useState<EndlessProgress>(loadEndlessProgress);
  const [game, setGame] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [win, setWin] = useState<Win | null>(null);
  /** Level to start after the between-levels ad (endless only, every N levels). */
  const [breakBefore, setBreakBefore] = useState<number | null>(null);
  /** Puzzle whose win was already handled (moves can arrive faster than renders). */
  const finished = useRef<object | null>(null);

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
      setGame({ level, session: createSession(next.puzzle, next.solution), solution: next.solution, initialMs: 0 });
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
      setGame({
        level: saved.level,
        session: { ...s, undos: saved.undos, hints: saved.hints },
        solution: saved.solution,
        initialMs: saved.elapsedMs,
      });
      prefetch(saved.level + 1);
    } else {
      void start(progress.level);
    }
    return () => client.dispose();
  }, []);

  const onChange = (next: Session, timeMs: number) => {
    if (!game) return;
    setGame((g) => g && { ...g, session: next });
    if (!next.solved || finished.current === game.session.puzzle) return;
    finished.current = game.session.puzzle;

    const record = game.level > progress.best;
    const updated: EndlessProgress = {
      level: game.level + 1,
      best: Math.max(progress.best, game.level),
      solved: progress.solved + 1,
    };
    saveEndlessProgress(updated);
    clearEndlessGame();
    setProgress(updated);
    setWin({ level: game.level, timeMs, undos: next.undos, hints: next.hints, record });
  };

  const onPersist = (s: Session, elapsedMs: number) => {
    if (!game) return;
    saveEndlessGame({
      level: game.level,
      puzzle: s.puzzle,
      solution: game.solution,
      counts: Array.from(s.counts),
      elapsedMs,
      undos: s.undos,
      hints: s.hints,
    });
  };

  return (
    <GameScreen
      title={t('game.level', { level: game?.level ?? progress.level })}
      session={game?.session ?? null}
      placeholder={error ?? t('game.generating')}
      initialMs={game?.initialMs ?? 0}
      onChange={onChange}
      onPersist={onPersist}
      onExit={onExit}
    >
      {win && (
        <Dialog title={t('win.title')}>
          {win.record && <p class="badge">{t('win.record')}</p>}
          <dl class="stats">
            <div>
              <dt>{t('win.time')}</dt>
              <dd>{formatTime(win.timeMs)}</dd>
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
                if (interstitialDue(progress.solved)) setBreakBefore(win.level + 1);
                else void start(win.level + 1);
              }}
            >
              {t('win.next')}
            </button>
          </div>
        </Dialog>
      )}
      {breakBefore !== null && (
        <Interstitial
          onContinue={() => {
            const next = breakBefore;
            setBreakBefore(null);
            void start(next);
          }}
        />
      )}
    </GameScreen>
  );
}
