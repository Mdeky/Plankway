import type { Cell, Puzzle } from './model.ts';
import { DEFAULT_RULES } from './rules/index.ts';
import type { CompiledRule, RuleModule } from './rules/types.ts';

/** A possible connection between two islands that see each other in a straight line. */
export interface Edge {
  id: number;
  /** Left or top island. */
  a: number;
  /** Right or bottom island. */
  b: number;
  horizontal: boolean;
  /** Water cells strictly between a and b. */
  cells: Cell[];
  /** Ids of edges that cross this one. */
  crosses: number[];
}

/** Two islands that line up, but a twist (e.g. a reef) blocks the connection. */
export interface BlockedPair {
  a: number;
  b: number;
  rule: string;
  cell: Cell;
}

/** Precomputed geometry of a puzzle under a given rule set. */
export interface Board {
  puzzle: Puzzle;
  rules: readonly RuleModule[];
  width: number;
  height: number;
  /** Island index per cell, -1 for water. */
  islandAt: Int16Array;
  edges: Edge[];
  /** Edge ids per island. */
  edgesOf: number[][];
  blockedPairs: BlockedPair[];
  edgeLookup: Map<number, number>;
  /** Id of the rule that blocks this cell, or null. */
  blocker(x: number, y: number): string | null;
}

export function pairKey(a: number, b: number): number {
  return a < b ? a * 4096 + b : b * 4096 + a;
}

export function buildBoard(puzzle: Puzzle, rules: readonly RuleModule[] = DEFAULT_RULES): Board {
  const { width, height, islands } = puzzle;
  const islandAt = new Int16Array(width * height).fill(-1);
  islands.forEach((isl, i) => {
    islandAt[isl.y * width + isl.x] = i;
  });

  const compiled: [string, CompiledRule][] = [];
  for (const rule of rules) {
    const c = rule.compile(puzzle);
    if (c) compiled.push([rule.id, c]);
  }
  const blocker = (x: number, y: number): string | null => {
    for (const [id, rule] of compiled) if (rule.blocksCell(x, y)) return id;
    return null;
  };

  const edges: Edge[] = [];
  const edgesOf: number[][] = islands.map(() => []);
  const blockedPairs: BlockedPair[] = [];
  const edgeLookup = new Map<number, number>();

  islands.forEach((isl, i) => {
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ] as const) {
      const cells: Cell[] = [];
      let blockedRule: string | null = null;
      let blockedCell: Cell | null = null;
      let x = isl.x + dx;
      let y = isl.y + dy;
      while (x < width && y < height) {
        const j = islandAt[y * width + x] as number;
        if (j >= 0) {
          if (blockedRule && blockedCell) {
            blockedPairs.push({ a: i, b: j, rule: blockedRule, cell: blockedCell });
          } else {
            const id = edges.length;
            edges.push({ id, a: i, b: j, horizontal: dy === 0, cells, crosses: [] });
            edgesOf[i]!.push(id);
            edgesOf[j]!.push(id);
            edgeLookup.set(pairKey(i, j), id);
          }
          break;
        }
        if (!blockedRule) {
          const rule = blocker(x, y);
          if (rule) {
            blockedRule = rule;
            blockedCell = { x, y };
          } else {
            cells.push({ x, y });
          }
        }
        x += dx;
        y += dy;
      }
    }
  });

  const horizontal = edges.filter((e) => e.horizontal);
  const vertical = edges.filter((e) => !e.horizontal);
  for (const h of horizontal) {
    const hy = islands[h.a]!.y;
    const x1 = islands[h.a]!.x;
    const x2 = islands[h.b]!.x;
    for (const v of vertical) {
      const vx = islands[v.a]!.x;
      const y1 = islands[v.a]!.y;
      const y2 = islands[v.b]!.y;
      if (x1 < vx && vx < x2 && y1 < hy && hy < y2) {
        h.crosses.push(v.id);
        v.crosses.push(h.id);
      }
    }
  }

  return { puzzle, rules, width, height, islandAt, edges, edgesOf, blockedPairs, edgeLookup, blocker };
}

/** Edge id between two islands, or -1 if they cannot be connected. */
export function findEdge(board: Board, a: number, b: number): number {
  return board.edgeLookup.get(pairKey(a, b)) ?? -1;
}

/** The other island of an edge. */
export function otherEnd(edge: Edge, island: number): number {
  return edge.a === island ? edge.b : edge.a;
}
