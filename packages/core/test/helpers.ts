import type { Cell, Puzzle } from '../src/index.ts';

/**
 * Builds a puzzle from ASCII art: digits are islands, `#` is a reef, `.` is water.
 */
export function fromAscii(rows: string[], id = 'test'): Puzzle {
  const islands: Puzzle['islands'] = [];
  const reefs: Cell[] = [];
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      if (ch >= '1' && ch <= '8') islands.push({ x, y, n: Number(ch) });
      else if (ch === '#') reefs.push({ x, y });
    });
  });
  return { id, seed: id, width: rows[0]!.length, height: rows.length, difficulty: 0, islands, reefs };
}

export function islandIndex(puzzle: Puzzle, x: number, y: number): number {
  const i = puzzle.islands.findIndex((isl) => isl.x === x && isl.y === y);
  if (i < 0) throw new Error(`No island at ${x},${y}`);
  return i;
}
