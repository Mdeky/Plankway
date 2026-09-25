import type { Board } from './board.ts';
import type { Bridge } from './model.ts';
import { deductionSteps } from './solver/logical.ts';
import { TECHNIQUES, type Step } from './solver/techniques.ts';
import type { SolverState } from './state.ts';

export type Hint =
  | { kind: 'solved' }
  /** The player placed more bridges on this connection than the solution has. */
  | { kind: 'mistake'; edge: number; a: number; b: number }
  /** A logical deduction; `place` lists the bridge counts it proves. */
  | { kind: 'step'; step: Step; place: Bridge[] }
  /** No deduction found from this position: reveal one bridge. */
  | { kind: 'reveal'; place: Bridge[] };

/**
 * Next logical step from the player's current grid. `counts` are the player's bridges
 * per edge, `solution` the (unique) solved state of the puzzle.
 */
export function getHint(board: Board, counts: ArrayLike<number>, solution: SolverState): Hint {
  let complete = true;
  for (const edge of board.edges) {
    const have = counts[edge.id] as number;
    const want = solution.min[edge.id] as number;
    if (have > want) return { kind: 'mistake', edge: edge.id, a: edge.a, b: edge.b };
    if (have < want) complete = false;
  }
  if (complete) return { kind: 'solved' };

  // Everything the player placed is correct, so it is a valid lower bound.
  const s: SolverState = {
    min: Int8Array.from(counts),
    max: new Int8Array(board.edges.length).fill(2),
  };
  for (const step of deductionSteps(board, s, TECHNIQUES)) {
    const place: Bridge[] = [];
    for (const c of step.changes) {
      if (c.min > (counts[c.edge] as number)) {
        const edge = board.edges[c.edge]!;
        place.push({ a: edge.a, b: edge.b, count: c.min as 1 | 2 });
      }
    }
    if (place.length) return { kind: 'step', step, place };
  }

  const edge = board.edges.find((e) => (counts[e.id] as number) < (solution.min[e.id] as number))!;
  return { kind: 'reveal', place: [{ a: edge.a, b: edge.b, count: solution.min[edge.id] as 1 | 2 }] };
}
