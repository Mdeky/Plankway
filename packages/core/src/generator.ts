import { buildBoard, pairKey, type Board } from './board.ts';
import { rateDifficulty, type DifficultyReport } from './difficulty.ts';
import type { Cell, Island, Puzzle, Solution } from './model.ts';
import { createRng, type Rng } from './rng.ts';
import { createRules, REEFS_RULE_ID, type RuleOptions } from './rules/index.ts';
import {
  OCC_BRIDGE,
  OCC_ISLAND,
  OCC_WATER,
  type GeneratorContext,
  type RuleModule,
} from './rules/types.ts';
import { countSolutions } from './solver/backtrack.ts';
import { solveLogically } from './solver/logical.ts';

export interface GeneratorConfig {
  width: number;
  height: number;
  /** Target number of islands. */
  islands: number;
  /** Maximum number of reefs (twist budget). */
  reefs: number;
  /** Chance that a new bridge is a double bridge. */
  doubleChance: number;
  /** Chance per extra straight connection to add it to the solution (creates loops). */
  loopChance: number;
  /** Hardest technique the puzzle may require. */
  maxWeight: number;
  /** Preferred minimum for the hardest technique; best effort. */
  minWeight: number;
  twists?: RuleOptions;
  maxAttempts?: number;
}

export interface GeneratedPuzzle {
  puzzle: Puzzle;
  solution: Solution;
  report: DifficultyReport;
  attempts: number;
}

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
] as const;

/**
 * Constructive generator: grow a connected island network bridge by bridge, derive the
 * numbers, let twist modules add obstacles, then prove the puzzle has exactly one
 * solution that can be found without guessing.
 */
export function generatePuzzle(config: GeneratorConfig, seed: string, id = seed): GeneratedPuzzle {
  const rules = createRules(config.twists);
  const rng = createRng(seed);
  const maxAttempts = config.maxAttempts ?? 200;
  let best: GeneratedPuzzle | null = null;

  for (let k = 0; k < maxAttempts; k++) {
    const candidate = attempt(config, rng.fork(`attempt-${k}`), rules, seed, id);
    if (!candidate) continue;
    candidate.attempts = k + 1;
    if (candidate.report.maxWeight >= config.minWeight) return candidate;
    if (!best || candidate.report.score > best.report.score) best = candidate;
  }
  if (best) return best;
  throw new Error(`Plankway generator: no valid puzzle for seed "${seed}" after ${maxAttempts} attempts`);
}

function attempt(
  config: GeneratorConfig,
  rng: Rng,
  rules: readonly RuleModule[],
  seed: string,
  id: string,
): GeneratedPuzzle | null {
  const { width, height } = config;
  const occupancy = new Uint8Array(width * height);
  const islands: Island[] = [];
  const bridges = new Map<number, { a: number; b: number; count: number }>();
  const at = (x: number, y: number) => y * width + x;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  const addIsland = (x: number, y: number) => {
    occupancy[at(x, y)] = OCC_ISLAND;
    islands.push({ x, y, n: 0 });
    return islands.length - 1;
  };
  const addBridge = (a: number, b: number, path: Cell[]) => {
    for (const c of path) occupancy[at(c.x, c.y)] = OCC_BRIDGE;
    bridges.set(pairKey(a, b), { a, b, count: rng.chance(config.doubleChance) ? 2 : 1 });
  };

  // 1. Grow a tree of islands, one bridge at a time.
  addIsland(rng.int(0, width - 1), rng.int(0, height - 1));
  const maxDistance = Math.max(2, Math.ceil(Math.max(width, height) / 2));
  for (let tries = 0; islands.length < config.islands && tries < config.islands * 80; tries++) {
    const from = rng.int(0, islands.length - 1);
    const src = islands[from]!;
    const [dx, dy] = rng.pick(DIRECTIONS);
    const dist = rng.int(2, maxDistance);
    const tx = src.x + dx * dist;
    const ty = src.y + dy * dist;
    if (!inside(tx, ty) || occupancy[at(tx, ty)] !== OCC_WATER) continue;
    // Keep islands apart so every bridge has at least one visible plank.
    let crowded = false;
    for (const [nx, ny] of DIRECTIONS) {
      const x = tx + nx;
      const y = ty + ny;
      if (inside(x, y) && occupancy[at(x, y)] === OCC_ISLAND) crowded = true;
    }
    if (crowded) continue;
    const path: Cell[] = [];
    let clear = true;
    for (let d = 1; d < dist; d++) {
      const x = src.x + dx * d;
      const y = src.y + dy * d;
      if (occupancy[at(x, y)] !== OCC_WATER) {
        clear = false;
        break;
      }
      path.push({ x, y });
    }
    if (!clear) continue;
    const to = addIsland(tx, ty);
    addBridge(from, to, path);
  }
  if (islands.length < config.islands) return null;

  // 2. Close some loops along free straight lines.
  const draft = buildBoard(makePuzzle(config, islands, [], seed, id), []);
  for (const edge of rng.shuffle(draft.edges.slice())) {
    if (bridges.has(pairKey(edge.a, edge.b)) || !rng.chance(config.loopChance)) continue;
    if (edge.cells.every((c) => occupancy[at(c.x, c.y)] === OCC_WATER)) addBridge(edge.a, edge.b, edge.cells);
  }

  // 3. Island numbers follow from the bridges.
  for (const br of bridges.values()) {
    islands[br.a]!.n += br.count;
    islands[br.b]!.n += br.count;
  }

  // 4. Twists add obstacles, then we tighten until the logic alone solves it.
  const reefs: Cell[] = [];
  const ctx: GeneratorContext = {
    width,
    height,
    rng,
    islands,
    occupancy,
    reefs,
    budget: { [REEFS_RULE_ID]: config.reefs },
    isSolutionEdge: (a, b) => bridges.has(pairKey(a, b)),
  };
  let board: Board = buildBoard(makePuzzle(config, islands, reefs, seed, id), rules);
  for (const rule of rules) rule.generator?.place?.(ctx, board);

  for (let round = 0; ; round++) {
    board = buildBoard(makePuzzle(config, islands, reefs, seed, id), rules);
    const result = solveLogically(board, { maxWeight: config.maxWeight });
    if (result.contradiction) return null;
    if (result.solved) {
      if (countSolutions(board, 2) !== 1) return null;
      const report = rateDifficulty(result);
      const puzzle = board.puzzle;
      puzzle.difficulty = report.score;
      const solution: Solution = [...bridges.values()].map((b) => ({ a: b.a, b: b.b, count: b.count as 1 | 2 }));
      return { puzzle, solution, report, attempts: 0 };
    }
    if (round >= 40) return null;
    const open = board.edges.filter(
      (e) => (result.state.max[e.id] as number) > (result.state.min[e.id] as number) && !bridges.has(pairKey(e.a, e.b)),
    );
    if (open.length === 0) return null;
    let changed = false;
    for (const rule of rules) {
      if (rule.generator?.breakAmbiguity?.(ctx, board, open)) {
        changed = true;
        break;
      }
    }
    if (!changed) return null;
  }
}

function makePuzzle(config: GeneratorConfig, islands: Island[], reefs: Cell[], seed: string, id: string): Puzzle {
  return {
    id,
    seed,
    width: config.width,
    height: config.height,
    difficulty: 0,
    islands: islands.map((i) => ({ ...i })),
    reefs: reefs.map((c) => ({ ...c })),
  };
}
