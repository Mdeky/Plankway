export interface Cell {
  x: number;
  y: number;
}

export interface Island extends Cell {
  /** Number of bridges that must touch this island (1–8). */
  n: number;
}

export interface Puzzle {
  id: string;
  width: number;
  height: number;
  islands: Island[];
  /** Twist: water cells a bridge cannot cross. Ignored when the reefs rule is disabled. */
  reefs: Cell[];
  /** Difficulty score, see rateDifficulty(). */
  difficulty: number;
  seed: string;
}

/** A connection between islands `a` and `b` (indices into Puzzle.islands). */
export interface Bridge {
  a: number;
  b: number;
  count: 1 | 2;
}

export type Solution = Bridge[];

export const MAX_BRIDGES = 2;
export const MAX_ISLAND_VALUE = 8;
export const MIN_GRID = 2;
export const MAX_GRID = 32;

/** Compact wire format: islands and reefs are flattened number arrays. */
export interface SerializedPuzzle {
  v: 1;
  id: string;
  s: string;
  w: number;
  h: number;
  d: number;
  /** x, y, n triplets */
  i: number[];
  /** x, y pairs */
  r: number[];
}

export function toSerialized(puzzle: Puzzle): SerializedPuzzle {
  return {
    v: 1,
    id: puzzle.id,
    s: puzzle.seed,
    w: puzzle.width,
    h: puzzle.height,
    d: puzzle.difficulty,
    i: puzzle.islands.flatMap((isl) => [isl.x, isl.y, isl.n]),
    r: puzzle.reefs.flatMap((c) => [c.x, c.y]),
  };
}

export function serializePuzzle(puzzle: Puzzle): string {
  return JSON.stringify(toSerialized(puzzle));
}

export class PuzzleFormatError extends Error {
  override name = 'PuzzleFormatError';
}

function isInt(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value);
}

/** Parses and validates the wire format. Throws PuzzleFormatError on malformed input. */
export function parsePuzzle(input: string | SerializedPuzzle): Puzzle {
  let raw: unknown;
  try {
    raw = typeof input === 'string' ? JSON.parse(input) : input;
  } catch {
    throw new PuzzleFormatError('Puzzle is not valid JSON');
  }
  const p = raw as Partial<SerializedPuzzle>;
  const fail = (msg: string): never => {
    throw new PuzzleFormatError(msg);
  };

  if (!p || typeof p !== 'object') fail('Puzzle must be an object');
  if (p.v !== 1) fail('Unsupported puzzle version');
  if (typeof p.id !== 'string' || typeof p.s !== 'string') fail('Missing id or seed');
  const { w, h } = p;
  if (!isInt(w) || !isInt(h) || w < MIN_GRID || h < MIN_GRID || w > MAX_GRID || h > MAX_GRID) {
    fail('Invalid grid size');
  }
  if (!isInt(p.d)) fail('Invalid difficulty');
  if (!Array.isArray(p.i) || p.i.length % 3 !== 0 || !p.i.every(isInt)) fail('Invalid islands');
  if (!Array.isArray(p.r) || p.r.length % 2 !== 0 || !p.r.every(isInt)) fail('Invalid reefs');

  const width = w as number;
  const height = h as number;
  const occupied = new Set<number>();
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < width && y < height;

  const islands: Island[] = [];
  const flatIslands = p.i as number[];
  for (let k = 0; k < flatIslands.length; k += 3) {
    const x = flatIslands[k] as number;
    const y = flatIslands[k + 1] as number;
    const n = flatIslands[k + 2] as number;
    if (!inside(x, y)) fail(`Island ${k / 3} is outside the grid`);
    if (n < 1 || n > MAX_ISLAND_VALUE) fail(`Island ${k / 3} has invalid number ${n}`);
    const key = y * width + x;
    if (occupied.has(key)) fail(`Two islands share cell ${x},${y}`);
    occupied.add(key);
    islands.push({ x, y, n });
  }
  if (islands.length === 0) fail('Puzzle has no islands');

  const reefs: Cell[] = [];
  const flatReefs = p.r as number[];
  for (let k = 0; k < flatReefs.length; k += 2) {
    const x = flatReefs[k] as number;
    const y = flatReefs[k + 1] as number;
    if (!inside(x, y)) fail(`Reef ${k / 2} is outside the grid`);
    const key = y * width + x;
    if (occupied.has(key)) fail(`Reef ${k / 2} overlaps an island or another reef`);
    occupied.add(key);
    reefs.push({ x, y });
  }

  return {
    id: p.id as string,
    seed: p.s as string,
    width,
    height,
    difficulty: p.d as number,
    islands,
    reefs,
  };
}

/** Solutions travel as flattened a, b, count triplets. */
export function serializeSolution(solution: Solution): number[] {
  return solution.flatMap((b) => [b.a, b.b, b.count]);
}

export function parseSolution(flat: unknown): Solution {
  if (!Array.isArray(flat) || flat.length % 3 !== 0 || !flat.every(isInt)) {
    throw new PuzzleFormatError('Invalid solution format');
  }
  const out: Solution = [];
  for (let k = 0; k < flat.length; k += 3) {
    const count = flat[k + 2] as number;
    if (count !== 1 && count !== 2) throw new PuzzleFormatError('Bridge count must be 1 or 2');
    out.push({ a: flat[k] as number, b: flat[k + 1] as number, count });
  }
  return out;
}
