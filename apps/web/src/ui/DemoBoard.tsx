import { useEffect, useRef } from 'preact/hooks';
import { buildBoard, findEdge, islandStatuses, type Puzzle } from '@bridgle/core';
import { BoardView } from '../game/view.ts';

export interface DemoStep {
  /** Bridges on the board in this step: [island a, island b, count]. */
  bridges: [number, number, number][];
  /** Briefly highlight this bridge, e.g. the one that blocks a move. */
  flash?: [number, number];
  /** Ghost bridge, as if the player is dragging it. */
  preview?: [number, number];
  /** How long the step stays up. */
  ms?: number;
}

const STEP_MS = 1100;
const DEMO_HEIGHT = 170;

/** Builds a puzzle from rows of text: digits are islands, `#` is a reef. */
export function demoPuzzle(id: string, rows: string[]): Puzzle {
  const islands: Puzzle['islands'] = [];
  const reefs: Puzzle['reefs'] = [];
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch >= '1' && ch <= '8') islands.push({ x, y, n: Number(ch) });
      else if (ch === '#') reefs.push({ x, y });
    }),
  );
  return { id, seed: `demo-${id}`, width: rows[0]!.length, height: rows.length, difficulty: 0, islands, reefs };
}

/** A small board that plays a scripted loop with the real renderer. Not interactive. */
export function DemoBoard({ puzzle, steps }: { puzzle: Puzzle; steps: DemoStep[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const board = buildBoard(puzzle);
    const view = new BoardView(canvasRef.current!, { onCycle() {}, onRemove() {} });
    let index = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const show = () => {
      const step = steps[index]!;
      const counts = new Int8Array(board.edges.length);
      for (const [a, b, n] of step.bridges) counts[findEdge(board, a, b)] = n;
      view.setModel({
        board,
        counts,
        statuses: islandStatuses(board, counts),
        hintEdges: [],
        hintIsland: -1,
        mistakeEdges: [],
        locked: true,
      });
      const ms = step.ms ?? STEP_MS;
      if (step.flash) view.flash(findEdge(board, step.flash[0], step.flash[1]), ms);
      if (step.preview) view.showPreview(findEdge(board, step.preview[0], step.preview[1]));
      timer = setTimeout(() => {
        index = (index + 1) % steps.length;
        show();
      }, ms);
    };
    show();
    return () => {
      clearTimeout(timer);
      view.destroy();
    };
  }, [puzzle, steps]);

  return (
    <div class="demo-stage" style={{ height: `${DEMO_HEIGHT}px` }}>
      <div
        class="board-frame demo"
        style={{ aspectRatio: `${puzzle.width} / ${puzzle.height}`, width: `min(100%, ${(DEMO_HEIGHT * puzzle.width) / puzzle.height}px)` }}
      >
        <canvas ref={canvasRef} class="board" aria-hidden="true" />
      </div>
    </div>
  );
}
