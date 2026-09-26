import { useMemo, useRef, useState } from 'preact/hooks';
import { buildBoard, findSolutions, stateToSolution } from '@bridgle/core';
import { createSession, cycleEdge, removeEdge, reset, statuses, type Session } from '../game/session.ts';
import { sfx } from '../game/sound.ts';
import type { BoardView, ViewModel } from '../game/view.ts';
import { t } from '../i18n.ts';
import { BoardCanvas } from './BoardCanvas.tsx';
import { demoPuzzle } from './DemoBoard.tsx';

/** A small first puzzle: six islands, one double bridge, a reef in the way. One solution. */
const PUZZLE = demoPuzzle('practice', ['2.2.3', '..#..', '..1.3', '1....', '.....']);

/** The tutorial's last step: the player solves a tiny puzzle with the real controls. */
export function PracticeBoard() {
  const solution = useMemo(() => {
    const board = buildBoard(PUZZLE);
    return stateToSolution(board, findSolutions(board, 1)[0]!);
  }, []);
  const [session, setSession] = useState<Session>(() => createSession(PUZZLE, solution));
  const [blocked, setBlocked] = useState(false);
  const latest = useRef(session);
  latest.current = session;
  const viewRef = useRef<BoardView | null>(null);

  const update = (next: Session) => {
    const prev = latest.current;
    if (next === prev) return;
    latest.current = next;
    setBlocked(false);
    if (next.solved && !prev.solved) {
      sfx.win();
      void viewRef.current?.playWin();
    } else if (next.counts.some((c, i) => c > (prev.counts[i] as number))) sfx.build();
    else sfx.splash();
    setSession(next);
  };

  const model: ViewModel = useMemo(
    () => ({
      board: session.board,
      counts: session.counts,
      statuses: statuses(session),
      hintEdges: [],
      hintIsland: -1,
      mistakeEdges: [],
      locked: session.solved,
    }),
    [session],
  );

  const isolated = model.statuses.includes('isolated');

  return (
    <div class="practice">
      <div class="practice-board">
        <BoardCanvas
          model={model}
          viewRef={viewRef}
          onCycle={(edge) => {
            const result = cycleEdge(latest.current, edge);
            if (result.blocked) {
              viewRef.current?.flash(result.by);
              sfx.blocked();
              setBlocked(true);
              return;
            }
            update(result.session);
          }}
          onRemove={(edge) => update(removeEdge(latest.current, edge))}
        />
      </div>
      <p class={`practice-status${session.solved ? ' done' : ''}`} role="status" aria-live="polite">
        {session.solved
          ? t('tutorial.practice.solved')
          : blocked
            ? t('game.blocked')
            : isolated
              ? t('game.isolated')
              : t('tutorial.practice.hint')}
      </p>
      {/* Always there (disabled until needed): a button appearing would grow the dialog
          and shift the board under the player's finger. */}
      <button
        class="btn practice-reset"
        onClick={() => update(reset(latest.current))}
        disabled={session.solved || session.counts.every((c) => c === 0)}
      >
        {t('game.reset')}
      </button>
    </div>
  );
}
