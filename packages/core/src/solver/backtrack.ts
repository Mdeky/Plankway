import type { Board } from '../board.ts';
import { cloneState, createState, isDetermined, type SolverState } from '../state.ts';
import { propagate } from './techniques.ts';

/**
 * Exhaustive search (propagation + branching). Finds up to `limit` distinct solutions,
 * which is all we need to prove uniqueness.
 */
export function findSolutions(board: Board, limit = 2, from?: SolverState): SolverState[] {
  const found: SolverState[] = [];
  const start = from ? cloneState(from) : createState(board);

  const search = (s: SolverState): void => {
    if (found.length >= limit) return;
    if (!propagate(board, s)) return;
    if (isDetermined(s)) {
      found.push(s);
      return;
    }
    // Branch on the undecided edge with the smallest range, highest count first.
    let pick = -1;
    let best = Infinity;
    for (let e = 0; e < s.min.length; e++) {
      const range = (s.max[e] as number) - (s.min[e] as number);
      if (range > 0 && range < best) {
        best = range;
        pick = e;
        if (range === 1) break;
      }
    }
    for (let v = s.max[pick] as number; v >= (s.min[pick] as number); v--) {
      const next = cloneState(s);
      next.min[pick] = v;
      next.max[pick] = v;
      search(next);
      if (found.length >= limit) return;
    }
  };

  search(start);
  return found;
}

export function countSolutions(board: Board, limit = 2): number {
  return findSolutions(board, limit).length;
}
