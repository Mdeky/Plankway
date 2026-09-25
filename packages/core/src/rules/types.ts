import type { Board, Edge } from '../board.ts';
import type { Cell, Island, Puzzle } from '../model.ts';
import type { Rng } from '../rng.ts';

/**
 * A twist on the base Hashi rules. The base rules (straight lines, max two bridges,
 * no crossings, island counts, one connected network) are always active; rule modules
 * can only take connections away. That keeps the solver and validator twist-agnostic.
 */
export interface RuleModule {
  readonly id: string;
  /** Returns null when the rule has nothing to say about this puzzle. */
  compile(puzzle: Puzzle): CompiledRule | null;
  /** Optional hooks that let the generator build puzzles around this twist. */
  readonly generator?: GeneratorHooks;
}

export interface CompiledRule {
  /** True if no bridge may pass over this water cell. */
  blocksCell(x: number, y: number): boolean;
}

export const OCC_WATER = 0;
export const OCC_ISLAND = 1;
export const OCC_BRIDGE = 2;
export const OCC_TWIST = 3;

export interface GeneratorContext {
  readonly width: number;
  readonly height: number;
  readonly rng: Rng;
  readonly islands: readonly Island[];
  /** Per cell: OCC_WATER, OCC_ISLAND, OCC_BRIDGE (used by the solution) or OCC_TWIST. */
  readonly occupancy: Uint8Array;
  isSolutionEdge(a: number, b: number): boolean;
  /** Remaining placement budget per rule id. */
  readonly budget: Record<string, number>;
  /** Reefs placed so far (written into Puzzle.reefs). */
  readonly reefs: Cell[];
}

export interface GeneratorHooks {
  /** Called once, after the islands and the solution are fixed. */
  place?(ctx: GeneratorContext, board: Board): void;
  /**
   * Called when the logical solver gets stuck. `open` lists undecided edges that are
   * not part of the intended solution. Return true if the puzzle was changed.
   */
  breakAmbiguity?(ctx: GeneratorContext, board: Board, open: readonly Edge[]): boolean;
}
