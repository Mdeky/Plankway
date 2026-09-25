import type { Board } from '@bridgle/core';

export interface Point {
  x: number;
  y: number;
}

export interface Layout {
  width: number;
  height: number;
  cell: number;
  ox: number;
  oy: number;
  radius: number;
  /** Touch target radius: at least 22 CSS px (44 px diameter). */
  hit: number;
}

export const MIN_HIT_RADIUS = 22;

/** Extra room around the grid (in cells) so decorations on edge islands aren't clipped. */
const MARGIN = 0.2;

export function computeLayout(board: Board, width: number, height: number): Layout {
  const cell = Math.min(width / (board.width + MARGIN * 2), height / (board.height + MARGIN * 2));
  const radius = cell * 0.42;
  return {
    width,
    height,
    cell,
    ox: (width - cell * board.width) / 2,
    oy: (height - cell * board.height) / 2,
    radius,
    hit: Math.max(radius, Math.min(MIN_HIT_RADIUS, cell * 0.5)),
  };
}

export function islandCenter(board: Board, layout: Layout, i: number): Point {
  const isl = board.puzzle.islands[i]!;
  return cellCenter(layout, isl.x, isl.y);
}

export function cellCenter(layout: Layout, x: number, y: number): Point {
  return { x: layout.ox + (x + 0.5) * layout.cell, y: layout.oy + (y + 0.5) * layout.cell };
}

export function islandAt(board: Board, layout: Layout, p: Point): number {
  let best = -1;
  let bestDist = Infinity;
  board.puzzle.islands.forEach((_, i) => {
    const c = islandCenter(board, layout, i);
    const d = Math.hypot(c.x - p.x, c.y - p.y);
    if (d <= layout.hit && d < bestDist) {
      best = i;
      bestDist = d;
    }
  });
  return best;
}

/** Placed bridge under the point, or -1. */
export function bridgeAt(board: Board, layout: Layout, counts: ArrayLike<number>, p: Point): number {
  const tolerance = Math.max(12, layout.cell * 0.25);
  for (const e of board.edges) {
    if ((counts[e.id] as number) === 0) continue;
    const a = islandCenter(board, layout, e.a);
    const b = islandCenter(board, layout, e.b);
    if (e.horizontal) {
      if (p.x > a.x + layout.radius && p.x < b.x - layout.radius && Math.abs(p.y - a.y) <= tolerance) return e.id;
    } else if (p.y > a.y + layout.radius && p.y < b.y - layout.radius && Math.abs(p.x - a.x) <= tolerance) {
      return e.id;
    }
  }
  return -1;
}

export type Direction = 'left' | 'right' | 'up' | 'down';

export const DIRECTION_VECTORS: Record<Direction, [number, number]> = {
  left: [-1, 0],
  right: [1, 0],
  up: [0, -1],
  down: [0, 1],
};

/** The edge leaving `island` in `dir`, or -1. */
export function edgeInDirection(board: Board, island: number, dir: Direction): number {
  const [dx, dy] = DIRECTION_VECTORS[dir];
  const from = board.puzzle.islands[island]!;
  for (const id of board.edgesOf[island]!) {
    const e = board.edges[id]!;
    const to = board.puzzle.islands[e.a === island ? e.b : e.a]!;
    if (Math.sign(to.x - from.x) === dx && Math.sign(to.y - from.y) === dy) return id;
  }
  return -1;
}

/** Closest island roughly in `dir`, for keyboard navigation. */
export function islandInDirection(board: Board, island: number, dir: Direction): number {
  const [dx, dy] = DIRECTION_VECTORS[dir];
  const from = board.puzzle.islands[island]!;
  let best = -1;
  let bestScore = Infinity;
  board.puzzle.islands.forEach((to, i) => {
    if (i === island) return;
    const along = (to.x - from.x) * dx + (to.y - from.y) * dy;
    if (along <= 0) return;
    const across = Math.abs((to.x - from.x) * dy) + Math.abs((to.y - from.y) * dx);
    const score = along + across * 2;
    if (score < bestScore) {
      best = i;
      bestScore = score;
    }
  });
  return best;
}
