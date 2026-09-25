import { describe, expect, it } from 'vitest';
import {
  createRng,
  parsePuzzle,
  parseSolution,
  PuzzleFormatError,
  serializePuzzle,
  serializeSolution,
  generatePuzzle,
  dailyConfig,
} from '../src/index.ts';
import { fromAscii } from './helpers.ts';

describe('rng', () => {
  it('is deterministic per seed', () => {
    const a = createRng('bridgle');
    const b = createRng('bridgle');
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('differs between seeds and forks', () => {
    const a = createRng('one');
    const b = createRng('two');
    expect(a.next()).not.toBe(b.next());
    expect(createRng('x').fork('a').next()).not.toBe(createRng('x').fork('b').next());
  });

  it('stays within bounds', () => {
    const r = createRng('bounds');
    for (let i = 0; i < 2000; i++) {
      const f = r.next();
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
      const n = r.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('shuffles into a permutation', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(createRng('s').shuffle(items.slice()).sort()).toEqual(items);
  });
});

describe('serialization', () => {
  it('round-trips a puzzle', () => {
    const p = fromAscii(['2.2', '.#.', '1.1']);
    expect(parsePuzzle(serializePuzzle(p))).toEqual(p);
  });

  it('keeps the largest puzzles under 2 KB', () => {
    const { puzzle, solution } = generatePuzzle(dailyConfig(0), 'size-check');
    expect(serializePuzzle(puzzle).length).toBeLessThan(2048);
    expect(JSON.stringify(serializeSolution(solution)).length).toBeLessThan(2048);
  });

  it('round-trips a solution', () => {
    const sol = [
      { a: 0, b: 1, count: 2 as const },
      { a: 1, b: 2, count: 1 as const },
    ];
    expect(parseSolution(serializeSolution(sol))).toEqual(sol);
    expect(() => parseSolution([0, 1, 3])).toThrow(PuzzleFormatError);
  });

  it('rejects malformed puzzles', () => {
    const good = JSON.parse(serializePuzzle(fromAscii(['2.2', '...', '1.1'])));
    expect(() => parsePuzzle('{nope')).toThrow(PuzzleFormatError);
    expect(() => parsePuzzle({ ...good, v: 2 })).toThrow(PuzzleFormatError);
    expect(() => parsePuzzle({ ...good, w: 1 })).toThrow(PuzzleFormatError);
    expect(() => parsePuzzle({ ...good, i: [0, 0, 9] })).toThrow(PuzzleFormatError);
    expect(() => parsePuzzle({ ...good, i: [0, 0, 1, 0, 0, 1] })).toThrow(PuzzleFormatError);
    expect(() => parsePuzzle({ ...good, i: [5, 0, 1] })).toThrow(PuzzleFormatError);
    expect(() => parsePuzzle({ ...good, r: [0, 0] })).toThrow(PuzzleFormatError);
  });
});
