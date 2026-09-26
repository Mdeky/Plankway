import {
  buildBoard,
  bridgesToCounts,
  getHint,
  isSolved,
  islandStatuses,
  MAX_BRIDGES,
  type Board,
  type Hint,
  type IslandStatus,
  type Puzzle,
  type Solution,
  type SolverState,
} from '@bridgle/core';

/**
 * One play-through of a puzzle. Immutable: every action returns a new session, which
 * keeps undo trivial and plays nicely with Preact state.
 */
export interface Session {
  puzzle: Puzzle;
  board: Board;
  solution: SolverState;
  counts: Int8Array;
  /** Previous `counts`, most recent last. */
  history: Int8Array[];
  undos: number;
  hints: number;
  solved: boolean;
}

export type MoveResult = { session: Session; blocked: false } | { session: Session; blocked: true; by: number };

export function createSession(puzzle: Puzzle, solution: Solution, counts?: ArrayLike<number>): Session {
  const board = buildBoard(puzzle);
  const target = bridgesToCounts(board, solution);
  const start = counts && counts.length === board.edges.length ? Int8Array.from(counts) : new Int8Array(board.edges.length);
  return {
    puzzle,
    board,
    solution: { min: target, max: target },
    counts: start,
    history: [],
    undos: 0,
    hints: 0,
    solved: isSolved(board, start),
  };
}

/** Placed bridge that crosses `edge`, or -1. */
export function crossingBridge(s: Session, edge: number): number {
  for (const c of s.board.edges[edge]!.crosses) if ((s.counts[c] as number) > 0) return c;
  return -1;
}

/** 0 → 1 → 2 → 0. A new bridge may not cross an existing one. */
export function cycleEdge(s: Session, edge: number): MoveResult {
  if (s.solved) return { session: s, blocked: false };
  const current = s.counts[edge] as number;
  const next = current >= MAX_BRIDGES ? 0 : current + 1;
  if (current === 0) {
    const by = crossingBridge(s, edge);
    if (by >= 0) return { session: s, blocked: true, by };
  }
  return { session: withCounts(s, edge, next), blocked: false };
}

/** Tapping a bridge takes it away completely, single or double. */
export function removeEdge(s: Session, edge: number): Session {
  if (s.solved || (s.counts[edge] as number) === 0) return s;
  return withCounts(s, edge, 0);
}

function withCounts(s: Session, edge: number, value: number): Session {
  const counts = s.counts.slice();
  counts[edge] = value;
  return { ...s, counts, history: [...s.history, s.counts], solved: isSolved(s.board, counts) };
}

export function undo(s: Session): Session {
  if (s.solved || s.history.length === 0) return s;
  const counts = s.history[s.history.length - 1]!;
  return { ...s, counts, history: s.history.slice(0, -1), undos: s.undos + 1 };
}

/** Clears the grid. Can itself be undone. */
export function reset(s: Session): Session {
  if (s.solved || s.counts.every((c) => c === 0)) return s;
  return { ...s, counts: new Int8Array(s.counts.length), history: [...s.history, s.counts] };
}

export function hint(s: Session): { session: Session; hint: Hint } {
  const h = getHint(s.board, s.counts, s.solution);
  if (h.kind === 'solved') return { session: s, hint: h };
  return { session: { ...s, hints: s.hints + 1 }, hint: h };
}

export function statuses(s: Session): IslandStatus[] {
  return islandStatuses(s.board, s.counts);
}
