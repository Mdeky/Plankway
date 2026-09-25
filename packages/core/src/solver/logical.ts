import type { Board } from '../board.ts';
import { createState, hasContradiction, isDetermined, type SolverState } from '../state.ts';
import { applyStep, TECHNIQUES, type Step, type Technique } from './techniques.ts';

export interface LogicalOptions {
  /** Only use techniques up to this weight. */
  maxWeight?: number;
  /** Start from this state instead of an empty grid (it is not mutated). */
  from?: SolverState;
}

export interface LogicalResult {
  solved: boolean;
  contradiction: boolean;
  state: SolverState;
  steps: Step[];
  /** Weight of the hardest technique that was needed (0 if none). */
  maxWeight: number;
}

/** Iterator over deduction steps, cheapest technique first. Mutates `s` as it goes. */
export function* deductionSteps(board: Board, s: SolverState, techniques: readonly Technique[]): Generator<Step> {
  for (;;) {
    let step: Step | null = null;
    for (const t of techniques) {
      step = t.find(board, s);
      if (step) break;
    }
    if (!step) return;
    applyStep(s, step);
    yield step;
    if (hasContradiction(board, s)) return;
  }
}

/** Solves like a human would: no guessing, only the listed deduction techniques. */
export function solveLogically(board: Board, options: LogicalOptions = {}): LogicalResult {
  const maxWeight = options.maxWeight ?? Infinity;
  const techniques = TECHNIQUES.filter((t) => t.weight <= maxWeight);
  const state = options.from ? { min: options.from.min.slice(), max: options.from.max.slice() } : createState(board);
  const steps: Step[] = [];
  let hardest = 0;

  if (!hasContradiction(board, state)) {
    for (const step of deductionSteps(board, state, techniques)) {
      steps.push(step);
      hardest = Math.max(hardest, step.weight);
    }
  }

  const contradiction = hasContradiction(board, state);
  return {
    solved: !contradiction && isDetermined(state),
    contradiction,
    state,
    steps,
    maxWeight: hardest,
  };
}
