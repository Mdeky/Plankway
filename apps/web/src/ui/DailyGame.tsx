import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import {
  bridgesToCounts,
  buildBoard,
  countsToSolution,
  dateForNumber,
  findSolutions,
  formatDate,
  serializeSolution,
  stateToSolution,
} from '@bridgle/core';
import { fetchDaily, requestStartToken } from '../game/api.ts';
import { t } from '../i18n.ts';
import { navigate } from '../route.ts';
import { loadDailyRecord, loadDailyStats, saveDailyRecord, todayNumber } from '../game/daily-store.ts';
import { GeneratorClient, type GeneratedGame } from '../game/generator-client.ts';
import { createSession, type Session } from '../game/session.ts';
import { shareResult, shareText, type ShareOutcome } from '../game/share.ts';
import { syncResults } from '../game/sync.ts';
import type { DailyRecord, DailyStats } from '../game/stats.ts';
import { AdSlot } from './AdSlot.tsx';
import { Dialog } from './Dialog.tsx';
import { GameScreen } from './GameScreen.tsx';
import { Countdown, StatsPanel } from './StatsPanel.tsx';
import { formatTime } from './format.ts';

/**
 * The server's puzzle is canonical; without a connection (or before it's published) the
 * same puzzle is generated locally from its seed. The client never receives a solution,
 * so it solves the puzzle itself for hints.
 */
async function loadPuzzle(client: GeneratorClient, number: number): Promise<GeneratedGame> {
  const remote = await fetchDaily(formatDate(dateForNumber(number)));
  if (remote && remote.number === number) {
    const board = buildBoard(remote.puzzle);
    const [solved] = findSolutions(board, 1);
    if (solved) return { puzzle: remote.puzzle, solution: stateToSolution(board, solved) };
  }
  return client.daily(number);
}

interface Loaded {
  session: Session;
  record: DailyRecord | null;
  initialMs: number;
}

export function DailyGame({ onExit }: { onExit(): void }) {
  const [number, setNumber] = useState(todayNumber);
  const client = useMemo(() => new GeneratorClient(), []);
  const [game, setGame] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ record: DailyRecord; stats: DailyStats } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const finished = useRef<object | null>(null);
  const record = useRef<DailyRecord | null>(null);
  /** Server-signed start of this daily (undefined offline or before it arrives). */
  const startToken = useRef<string | undefined>(undefined);

  useEffect(() => () => client.dispose(), []);

  useEffect(() => {
    let cancelled = false;
    setGame(null);
    record.current = null;
    startToken.current = undefined;
    setResult(null);
    setShowResult(false);
    (async () => {
      try {
        const [generated, saved] = await Promise.all([loadPuzzle(client, number), loadDailyRecord(number)]);
        if (cancelled) return;
        record.current = saved ?? null;
        let session = createSession(generated.puzzle, generated.solution);
        if (saved?.solved) {
          // Show the finished grid.
          session = createSession(generated.puzzle, generated.solution, bridgesToCounts(session.board, generated.solution));
          finished.current = session.puzzle;
          setGame({ session, record: saved, initialMs: saved.timeMs ?? 0 });
          setResult({ record: saved, stats: await loadDailyStats(number) });
          setShowResult(true);
          return;
        }
        // The first start counts: a token from an earlier session is kept.
        startToken.current = saved?.startToken;
        if (!startToken.current) {
          void requestStartToken('daily', number).then((token) => {
            if (cancelled || !token || startToken.current) return;
            startToken.current = token;
            if (record.current && !record.current.solved) record.current = { ...record.current, startToken: token };
          });
        }
        if (saved?.progress) {
          const resumed = createSession(generated.puzzle, generated.solution, saved.progress.counts);
          session = { ...resumed, undos: saved.undos, hints: saved.hints };
        }
        setGame({ session, record: saved ?? null, initialMs: saved?.progress?.elapsedMs ?? 0 });
      } catch (err) {
        if (!cancelled) setError(String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [number]);

  const onChange = (next: Session, timeMs: number) => {
    if (!game) return;
    // The puzzle counts as "played" from the first move.
    record.current ??= game.record ?? {
      number,
      date: formatDate(dateForNumber(number)),
      startedAt: Date.now(),
      solved: false,
      undos: 0,
      hints: 0,
      startToken: startToken.current,
    };
    const current = record.current;
    setGame((g) => g && { ...g, session: next, record: current });
    if (!next.solved || finished.current === game.session.puzzle) return;
    finished.current = game.session.puzzle;

    const solved: DailyRecord = {
      ...current,
      solved: true,
      solvedAt: Date.now(),
      timeMs: Math.round(timeMs),
      undos: next.undos,
      hints: next.hints,
      progress: undefined,
      bridges: serializeSolution(countsToSolution(next.board, next.counts)),
      startToken: current.startToken ?? startToken.current,
      synced: false,
    };
    record.current = solved;
    void saveDailyRecord(solved).then(async () => {
      void syncResults();
      setResult({ record: solved, stats: await loadDailyStats(number) });
      setShowResult(true);
    });
  };

  const onPersist = (s: Session, elapsedMs: number) => {
    const current = record.current;
    if (!current || current.solved || s.solved) return;
    void saveDailyRecord({
      ...current,
      startToken: current.startToken ?? startToken.current,
      undos: s.undos,
      hints: s.hints,
      progress: { counts: Array.from(s.counts), elapsedMs: Math.round(elapsedMs) },
    });
  };

  const statsButton = result && !showResult && (
    <button class="btn" onClick={() => setShowResult(true)}>
      {t('stats.title')}
    </button>
  );

  return (
    <GameScreen
      title={`Plankway #${number}`}
      session={game?.session ?? null}
      placeholder={error ?? t('game.generating')}
      initialMs={game?.initialMs ?? 0}
      onChange={onChange}
      onPersist={onPersist}
      onExit={onExit}
      extraActions={statsButton}
    >
      {result && showResult && (
        <ResultDialog
          record={result.record}
          stats={result.stats}
          onClose={() => setShowResult(false)}
          onNewDay={() => setNumber(todayNumber())}
        />
      )}
    </GameScreen>
  );
}

function ResultDialog({
  record,
  stats,
  onClose,
  onNewDay,
}: {
  record: DailyRecord;
  stats: DailyStats;
  onClose(): void;
  onNewDay(): void;
}) {
  const [shared, setShared] = useState<ShareOutcome | null>(null);
  const [newDay, setNewDay] = useState(false);
  const text = shareText({ number: record.number, timeMs: record.timeMs ?? 0, hints: record.hints });

  return (
    <Dialog title={t('win.title')} onClose={onClose}>
      <dl class="stats">
        <div>
          <dt>{t('win.time')}</dt>
          <dd>{formatTime(record.timeMs ?? 0)}</dd>
        </div>
        <div>
          <dt>{t('win.hints')}</dt>
          <dd>{record.hints}</dd>
        </div>
      </dl>
      <pre class="share-preview" aria-label={t('share.preview')}>
        {text}
      </pre>
      <div class="dialog-actions">
        <button
          class="btn primary"
          autofocus
          onClick={async () => {
            setShared(await shareResult(text));
          }}
        >
          {t('share.button')}
        </button>
        <button class="btn" onClick={() => navigate('leaderboard')}>
          {t('board.title')}
        </button>
        <button class="btn" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
      <p class="status" role="status" aria-live="polite">
        {shared === 'copied' ? t('share.copied') : shared === 'failed' ? t('share.failed') : ''}
      </p>
      <AdSlot placement="result" />
      <hr />
      <StatsPanel stats={stats} />
      {newDay ? (
        <div class="dialog-actions">
          <button class="btn primary" onClick={onNewDay}>
            {t('stats.newPuzzle')}
          </button>
        </div>
      ) : (
        <Countdown onNewDay={() => setNewDay(true)} />
      )}
    </Dialog>
  );
}
