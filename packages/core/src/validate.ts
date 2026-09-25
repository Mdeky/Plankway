import { buildBoard, findEdge, type Board } from './board.ts';
import type { Bridge, Puzzle } from './model.ts';
import { DEFAULT_RULES } from './rules/index.ts';
import type { RuleModule } from './rules/types.ts';
import { isConnected } from './state.ts';

export type ValidationIssue =
  /** Not a straight, unobstructed line between two neighbouring islands. */
  | { type: 'illegal-bridge'; a: number; b: number }
  | { type: 'bad-count'; a: number; b: number; count: number }
  | { type: 'duplicate'; a: number; b: number }
  | { type: 'crossing'; edges: [number, number] }
  | { type: 'island-count'; island: number; expected: number; actual: number }
  | { type: 'disconnected' };

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
}

export type IslandStatus = 'open' | 'full' | 'over';

/** Full rule check of a finished grid, e.g. a solution submitted to the server. */
export function validateSolution(
  puzzle: Puzzle,
  bridges: readonly Bridge[],
  rules: readonly RuleModule[] = DEFAULT_RULES,
): ValidationResult {
  const board = buildBoard(puzzle, rules);
  const issues: ValidationIssue[] = [];
  const counts = new Int8Array(board.edges.length);
  const seen = new Set<number>();

  for (const br of bridges) {
    const n = puzzle.islands.length;
    const inRange = Number.isInteger(br.a) && Number.isInteger(br.b) && br.a >= 0 && br.b >= 0 && br.a < n && br.b < n;
    const id = inRange && br.a !== br.b ? findEdge(board, br.a, br.b) : -1;
    if (id < 0) {
      issues.push({ type: 'illegal-bridge', a: br.a, b: br.b });
      continue;
    }
    if (br.count !== 1 && br.count !== 2) {
      issues.push({ type: 'bad-count', a: br.a, b: br.b, count: br.count });
      continue;
    }
    if (seen.has(id)) {
      issues.push({ type: 'duplicate', a: br.a, b: br.b });
      continue;
    }
    seen.add(id);
    counts[id] = br.count;
  }

  issues.push(...checkCounts(board, counts));
  return { valid: issues.length === 0, issues };
}

/** Checks per-edge counts (crossings, island numbers, connectivity). */
export function checkCounts(board: Board, counts: ArrayLike<number>): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const e of board.edges) {
    if ((counts[e.id] as number) < 1) continue;
    for (const c of e.crosses) {
      if (c > e.id && (counts[c] as number) >= 1) issues.push({ type: 'crossing', edges: [e.id, c] });
    }
  }
  const degrees = islandDegrees(board, counts);
  board.puzzle.islands.forEach((isl, i) => {
    if (degrees[i] !== isl.n) {
      issues.push({ type: 'island-count', island: i, expected: isl.n, actual: degrees[i]! });
    }
  });
  if (!isConnected(board, counts)) issues.push({ type: 'disconnected' });
  return issues;
}

export function islandDegrees(board: Board, counts: ArrayLike<number>): Int16Array {
  const out = new Int16Array(board.puzzle.islands.length);
  for (const e of board.edges) {
    const c = counts[e.id] as number;
    out[e.a]! += c;
    out[e.b]! += c;
  }
  return out;
}

/** Per-island feedback for the UI while playing. */
export function islandStatuses(board: Board, counts: ArrayLike<number>): IslandStatus[] {
  const degrees = islandDegrees(board, counts);
  return board.puzzle.islands.map((isl, i) => {
    const d = degrees[i]!;
    return d === isl.n ? 'full' : d > isl.n ? 'over' : 'open';
  });
}

/** True when the grid is a complete, valid solution. */
export function isSolved(board: Board, counts: ArrayLike<number>): boolean {
  return checkCounts(board, counts).length === 0;
}
