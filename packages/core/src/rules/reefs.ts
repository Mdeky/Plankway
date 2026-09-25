import type { Edge } from '../board.ts';
import { OCC_TWIST, OCC_WATER, type GeneratorContext, type RuleModule } from './types.ts';

export const REEFS_RULE_ID = 'reefs';

/**
 * Twist: reefs are rocky water cells. A bridge can never pass over a reef, so two
 * islands that line up can still be unconnectable. The generator places reefs on
 * alternative (non-solution) connections to create new deductions.
 */
export const reefsRule: RuleModule = {
  id: REEFS_RULE_ID,

  compile(puzzle) {
    if (puzzle.reefs.length === 0) return null;
    const cells = new Set(puzzle.reefs.map((c) => c.y * puzzle.width + c.x));
    return {
      blocksCell: (x, y) => cells.has(y * puzzle.width + x),
    };
  },

  generator: {
    place(ctx, board) {
      const budget = ctx.budget[REEFS_RULE_ID] ?? 0;
      if (budget <= 0) return;
      // Spend roughly half up front; keep the rest for resolving ambiguity.
      const upFront = Math.max(1, Math.floor(budget / 2));
      for (let k = 0; k < upFront; k++) {
        if (!placeReefOnEdges(ctx, board.edges)) break;
      }
    },
    breakAmbiguity(ctx, _board, open) {
      return placeReefOnEdges(ctx, open);
    },
  },
};

/** Puts one reef on a free water cell of a random non-solution edge. */
function placeReefOnEdges(ctx: GeneratorContext, edges: readonly Edge[]): boolean {
  if ((ctx.budget[REEFS_RULE_ID] ?? 0) <= 0) return false;
  const options = ctx.rng.shuffle(edges.filter((e) => !ctx.isSolutionEdge(e.a, e.b)));
  for (const edge of options) {
    const free = edge.cells.filter((c) => ctx.occupancy[c.y * ctx.width + c.x] === OCC_WATER);
    if (free.length === 0) continue;
    const cell = ctx.rng.pick(free);
    ctx.occupancy[cell.y * ctx.width + cell.x] = OCC_TWIST;
    ctx.reefs.push({ x: cell.x, y: cell.y });
    ctx.budget[REEFS_RULE_ID] = (ctx.budget[REEFS_RULE_ID] ?? 0) - 1;
    return true;
  }
  return false;
}
