import { describe, expect, it } from 'vitest';
import { endlessSeed, generateEndless, serializePuzzle, serializeSolution, validateSolution } from '../src/index.ts';

describe('endless levels', () => {
  it('are the same puzzle for everyone', () => {
    for (const level of [1, 7, 30, 31]) {
      const a = generateEndless(level);
      const b = generateEndless(level);
      expect(serializePuzzle(a.puzzle)).toBe(serializePuzzle(b.puzzle));
      expect(serializeSolution(a.solution)).toEqual(serializeSolution(b.solution));
      expect(a.puzzle.id).toBe(endlessSeed(level));
    }
  });

  it('differ from level to level and are valid', () => {
    const one = generateEndless(1);
    const two = generateEndless(2);
    expect(serializePuzzle(one.puzzle)).not.toBe(serializePuzzle(two.puzzle));
    expect(validateSolution(two.puzzle, two.solution).valid).toBe(true);
  });
});
