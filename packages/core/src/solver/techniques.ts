import type { Board } from '../board.ts';
import {
  cloneState,
  hasContradiction,
  islandComponents,
  maxSums,
  minSums,
  type SolverState,
} from '../state.ts';

/**
 * Human-style deduction techniques. Each one only ever tightens the bounds of one or
 * more edges, so every step is sound and the solver always terminates.
 */
export type TechniqueId =
  | 'full-island'
  | 'all-bridges'
  | 'crossing'
  | 'cap'
  | 'forced-minimum'
  | 'isolation'
  | 'connectivity'
  | 'lookahead';

export const TECHNIQUE_WEIGHTS: Record<TechniqueId, number> = {
  /** Island already has all its bridges: no more on the other edges. */
  'full-island': 1,
  /** Island needs every bridge it can still get (e.g. 4 with two neighbours). */
  'all-bridges': 1,
  /** A placed bridge rules out every bridge crossing it. */
  crossing: 1,
  /** Remaining capacity limits an edge (e.g. a 1 can't take a double bridge). */
  cap: 1,
  /** Other neighbours can't supply enough, so this edge needs at least k bridges. */
  'forced-minimum': 2,
  /** This bridge would close off a finished group from the rest. */
  isolation: 3,
  /** A group has only one way out left, so it must be used. */
  connectivity: 4,
  /** Trying an option leads to a contradiction a few simple steps later. */
  lookahead: 6,
};

export interface Change {
  edge: number;
  min: number;
  max: number;
}

export interface Step {
  technique: TechniqueId;
  weight: number;
  /** The island the reasoning is about, when there is one. */
  island: number | null;
  changes: Change[];
  /** True when a twist (reef) hides a neighbour of the island involved. */
  twistAssisted: boolean;
}

export interface Technique {
  id: TechniqueId;
  weight: number;
  find(board: Board, s: SolverState): Step | null;
}

function makeStep(board: Board, technique: TechniqueId, island: number | null, changes: Change[]): Step {
  const twistAssisted =
    island !== null && board.blockedPairs.some((p) => p.a === island || p.b === island);
  return { technique, weight: TECHNIQUE_WEIGHTS[technique], island, changes, twistAssisted };
}

export function applyStep(s: SolverState, step: Step): void {
  for (const c of step.changes) {
    s.min[c.edge] = c.min;
    s.max[c.edge] = c.max;
  }
}

const fullIsland: Technique = {
  id: 'full-island',
  weight: TECHNIQUE_WEIGHTS['full-island'],
  find(board, s) {
    const lo = minSums(board, s);
    const islands = board.puzzle.islands;
    for (let i = 0; i < islands.length; i++) {
      if (lo[i] !== islands[i]!.n) continue;
      const changes: Change[] = [];
      for (const e of board.edgesOf[i]!) {
        const m = s.min[e] as number;
        if ((s.max[e] as number) > m) changes.push({ edge: e, min: m, max: m });
      }
      if (changes.length) return makeStep(board, 'full-island', i, changes);
    }
    return null;
  },
};

const allBridges: Technique = {
  id: 'all-bridges',
  weight: TECHNIQUE_WEIGHTS['all-bridges'],
  find(board, s) {
    const hi = maxSums(board, s);
    const islands = board.puzzle.islands;
    for (let i = 0; i < islands.length; i++) {
      if (hi[i] !== islands[i]!.n) continue;
      const changes: Change[] = [];
      for (const e of board.edgesOf[i]!) {
        const m = s.max[e] as number;
        if ((s.min[e] as number) < m) changes.push({ edge: e, min: m, max: m });
      }
      if (changes.length) return makeStep(board, 'all-bridges', i, changes);
    }
    return null;
  },
};

const crossing: Technique = {
  id: 'crossing',
  weight: TECHNIQUE_WEIGHTS.crossing,
  find(board, s) {
    for (const e of board.edges) {
      if ((s.min[e.id] as number) < 1) continue;
      const changes: Change[] = [];
      for (const c of e.crosses) {
        if ((s.max[c] as number) > 0) changes.push({ edge: c, min: s.min[c] as number, max: 0 });
      }
      if (changes.length) return makeStep(board, 'crossing', null, changes);
    }
    return null;
  },
};

const cap: Technique = {
  id: 'cap',
  weight: TECHNIQUE_WEIGHTS.cap,
  find(board, s) {
    const lo = minSums(board, s);
    const islands = board.puzzle.islands;
    for (let i = 0; i < islands.length; i++) {
      const changes: Change[] = [];
      for (const e of board.edgesOf[i]!) {
        const room = islands[i]!.n - (lo[i]! - (s.min[e] as number));
        if ((s.max[e] as number) > room) changes.push({ edge: e, min: s.min[e] as number, max: room });
      }
      if (changes.length) return makeStep(board, 'cap', i, changes);
    }
    return null;
  },
};

const forcedMinimum: Technique = {
  id: 'forced-minimum',
  weight: TECHNIQUE_WEIGHTS['forced-minimum'],
  find(board, s) {
    const hi = maxSums(board, s);
    const islands = board.puzzle.islands;
    for (let i = 0; i < islands.length; i++) {
      const changes: Change[] = [];
      for (const e of board.edgesOf[i]!) {
        const need = islands[i]!.n - (hi[i]! - (s.max[e] as number));
        if ((s.min[e] as number) < need) changes.push({ edge: e, min: need, max: s.max[e] as number });
      }
      if (changes.length) return makeStep(board, 'forced-minimum', i, changes);
    }
    return null;
  },
};

/** Would setting edge `e` to exactly `k` bridges complete a group that isn't everything? */
function closesGroup(board: Board, s: SolverState, lo: Int16Array, e: number, k: number): boolean {
  const islands = board.puzzle.islands;
  const edge = board.edges[e]!;
  const counts = s.min.slice();
  counts[e] = k;
  const roots = islandComponents(board, counts);
  const root = roots[edge.a]!;
  let size = 0;
  for (let i = 0; i < islands.length; i++) {
    if (roots[i] !== root) continue;
    size++;
    const extra = i === edge.a || i === edge.b ? k - (s.min[e] as number) : 0;
    if (lo[i]! + extra !== islands[i]!.n) return false;
  }
  return size < islands.length;
}

const isolation: Technique = {
  id: 'isolation',
  weight: TECHNIQUE_WEIGHTS.isolation,
  find(board, s) {
    const lo = minSums(board, s);
    for (const edge of board.edges) {
      const e = edge.id;
      const k = s.max[e] as number;
      if (k <= (s.min[e] as number)) continue;
      if (closesGroup(board, s, lo, e, k)) {
        return makeStep(board, 'isolation', edge.a, [{ edge: e, min: s.min[e] as number, max: k - 1 }]);
      }
    }
    return null;
  },
};

const connectivity: Technique = {
  id: 'connectivity',
  weight: TECHNIQUE_WEIGHTS.connectivity,
  find(board, s) {
    const roots = islandComponents(board, s.min);
    const exits = new Map<number, number[]>();
    for (const edge of board.edges) {
      if ((s.max[edge.id] as number) < 1) continue;
      const ra = roots[edge.a]!;
      const rb = roots[edge.b]!;
      if (ra === rb) continue;
      (exits.get(ra) ?? exits.set(ra, []).get(ra)!).push(edge.id);
      (exits.get(rb) ?? exits.set(rb, []).get(rb)!).push(edge.id);
    }
    const seen = new Set<number>();
    for (let i = 0; i < roots.length; i++) {
      const r = roots[i]!;
      if (seen.has(r)) continue;
      seen.add(r);
      const out = exits.get(r);
      if (out && out.length === 1) {
        const e = out[0]!;
        if ((s.min[e] as number) === 0) {
          return makeStep(board, 'connectivity', i, [{ edge: e, min: 1, max: s.max[e] as number }]);
        }
      }
    }
    return null;
  },
};

/** The techniques cheap enough to run inside lookahead and backtracking. */
export const BASIC_TECHNIQUES: readonly Technique[] = [
  fullIsland,
  allBridges,
  crossing,
  cap,
  forcedMinimum,
  isolation,
  connectivity,
];

/**
 * Applies techniques until nothing changes. Returns false if the state turned out to be
 * contradictory. Mutates `s`.
 */
export function propagate(board: Board, s: SolverState, techniques: readonly Technique[] = BASIC_TECHNIQUES): boolean {
  if (hasContradiction(board, s)) return false;
  for (;;) {
    let step: Step | null = null;
    for (const t of techniques) {
      step = t.find(board, s);
      if (step) break;
    }
    if (!step) return true;
    applyStep(s, step);
    if (hasContradiction(board, s)) return false;
  }
}

const lookahead: Technique = {
  id: 'lookahead',
  weight: TECHNIQUE_WEIGHTS.lookahead,
  find(board, s) {
    for (const edge of board.edges) {
      const e = edge.id;
      const lo = s.min[e] as number;
      const hi = s.max[e] as number;
      if (hi <= lo) continue;

      const noMore = cloneState(s);
      noMore.max[e] = lo;
      if (!propagate(board, noMore)) {
        return makeStep(board, 'lookahead', edge.a, [{ edge: e, min: lo + 1, max: hi }]);
      }
      const allIn = cloneState(s);
      allIn.min[e] = hi;
      if (!propagate(board, allIn)) {
        return makeStep(board, 'lookahead', edge.a, [{ edge: e, min: lo, max: hi - 1 }]);
      }
    }
    return null;
  },
};

/** All techniques, cheapest first. */
export const TECHNIQUES: readonly Technique[] = [...BASIC_TECHNIQUES, lookahead];
