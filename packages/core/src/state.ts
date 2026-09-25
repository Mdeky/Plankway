import { pairKey, type Board } from './board.ts';
import { MAX_BRIDGES, type Bridge, type Solution } from './model.ts';

/** Bounds on the number of bridges per edge, as known so far. */
export interface SolverState {
  min: Int8Array;
  max: Int8Array;
}

export function createState(board: Board): SolverState {
  return {
    min: new Int8Array(board.edges.length),
    max: new Int8Array(board.edges.length).fill(MAX_BRIDGES),
  };
}

export function cloneState(s: SolverState): SolverState {
  return { min: s.min.slice(), max: s.max.slice() };
}

export function isDetermined(s: SolverState): boolean {
  for (let e = 0; e < s.min.length; e++) if (s.min[e] !== s.max[e]) return false;
  return true;
}

/** Sum of the lower bounds of every island's edges. */
export function minSums(board: Board, s: SolverState): Int16Array {
  const out = new Int16Array(board.puzzle.islands.length);
  for (const e of board.edges) {
    const m = s.min[e.id] as number;
    out[e.a]! += m;
    out[e.b]! += m;
  }
  return out;
}

export function maxSums(board: Board, s: SolverState): Int16Array {
  const out = new Int16Array(board.puzzle.islands.length);
  for (const e of board.edges) {
    const m = s.max[e.id] as number;
    out[e.a]! += m;
    out[e.b]! += m;
  }
  return out;
}

/** Union-find over islands, joined by every edge with count >= 1. */
export function islandComponents(board: Board, counts: ArrayLike<number>): Int32Array {
  const parent = new Int32Array(board.puzzle.islands.length);
  for (let i = 0; i < parent.length; i++) parent[i] = i;
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]!]!;
      i = parent[i]!;
    }
    return i;
  };
  for (const e of board.edges) {
    if ((counts[e.id] as number) >= 1) {
      const ra = find(e.a);
      const rb = find(e.b);
      if (ra !== rb) parent[ra] = rb;
    }
  }
  for (let i = 0; i < parent.length; i++) parent[i] = find(i);
  return parent;
}

export function isConnected(board: Board, counts: ArrayLike<number>): boolean {
  const roots = islandComponents(board, counts);
  for (let i = 1; i < roots.length; i++) if (roots[i] !== roots[0]) return false;
  return true;
}

/**
 * True if the bounds can no longer lead to a valid solution: empty ranges, crossing
 * bridges, islands that can't reach or already exceed their number, or a group of
 * islands that is complete but cut off from the rest.
 */
export function hasContradiction(board: Board, s: SolverState): boolean {
  const { min, max } = s;
  for (const e of board.edges) {
    const lo = min[e.id] as number;
    if (lo > (max[e.id] as number)) return true;
    if (lo >= 1) for (const c of e.crosses) if ((min[c] as number) >= 1) return true;
  }
  const lo = minSums(board, s);
  const hi = maxSums(board, s);
  const islands = board.puzzle.islands;
  for (let i = 0; i < islands.length; i++) {
    const n = islands[i]!.n;
    if (lo[i]! > n || hi[i]! < n) return true;
  }
  if (islands.length > 1) {
    const roots = islandComponents(board, min);
    const complete = new Map<number, boolean>();
    for (let i = 0; i < islands.length; i++) {
      const r = roots[i]!;
      complete.set(r, (complete.get(r) ?? true) && lo[i] === islands[i]!.n);
    }
    if (complete.size > 1) for (const done of complete.values()) if (done) return true;
  }
  return false;
}

export function stateToSolution(board: Board, s: SolverState): Solution {
  const out: Solution = [];
  for (const e of board.edges) {
    const c = s.min[e.id] as number;
    if (c > 0) out.push({ a: e.a, b: e.b, count: c as 1 | 2 });
  }
  return out;
}

/** Converts bridges to per-edge counts, ignoring bridges that don't match an edge. */
export function bridgesToCounts(board: Board, bridges: readonly Bridge[]): Int8Array {
  const counts = new Int8Array(board.edges.length);
  for (const br of bridges) {
    const id = board.edgeLookup.get(pairKey(br.a, br.b));
    if (id !== undefined) counts[id] = Math.min(MAX_BRIDGES, (counts[id] as number) + br.count);
  }
  return counts;
}

export function countsToSolution(board: Board, counts: ArrayLike<number>): Solution {
  return stateToSolution(board, { min: Int8Array.from(counts), max: Int8Array.from(counts) });
}
