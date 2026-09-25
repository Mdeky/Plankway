import { describe, expect, it } from 'vitest';
import {
  buildBoard,
  createRules,
  findEdge,
  islandStatuses,
  validateSolution,
  type Bridge,
} from '../src/index.ts';
import { fromAscii, islandIndex } from './helpers.ts';

describe('board geometry', () => {
  it('connects only nearest islands in straight lines', () => {
    const p = fromAscii(['1.2.1']);
    const board = buildBoard(p);
    expect(board.edges).toHaveLength(2);
    expect(findEdge(board, 0, 1)).toBeGreaterThanOrEqual(0);
    expect(findEdge(board, 0, 2)).toBe(-1); // island 1 is in the way
  });

  it('detects crossings', () => {
    const p = fromAscii(['.1.', '1.1', '.1.']);
    const board = buildBoard(p);
    const h = findEdge(board, islandIndex(p, 0, 1), islandIndex(p, 2, 1));
    const v = findEdge(board, islandIndex(p, 1, 0), islandIndex(p, 1, 2));
    expect(board.edges[h]!.crosses).toEqual([v]);
    expect(board.edges[v]!.crosses).toEqual([h]);
  });

  it('reefs block connections and are reported as blocked pairs', () => {
    const p = fromAscii(['1.2#.1']);
    const board = buildBoard(p);
    expect(findEdge(board, 1, 2)).toBe(-1);
    expect(board.blockedPairs).toEqual([{ a: 1, b: 2, rule: 'reefs', cell: { x: 3, y: 0 } }]);
  });

  it('the reef twist can be switched off', () => {
    const p = fromAscii(['1.2#.1']);
    const board = buildBoard(p, createRules({ reefs: false }));
    expect(findEdge(board, 1, 2)).toBeGreaterThanOrEqual(0);
    expect(board.blockedPairs).toEqual([]);
  });
});

describe('validateSolution', () => {
  // 2 . 2
  // . . .
  // 2 . 2   → unique solution: a ring of single bridges
  const ring = fromAscii(['2.2', '...', '2.2']);
  const tl = 0;
  const tr = 1;
  const bl = 2;
  const br = 3;
  const ringSolution: Bridge[] = [
    { a: tl, b: tr, count: 1 },
    { a: bl, b: br, count: 1 },
    { a: tl, b: bl, count: 1 },
    { a: tr, b: br, count: 1 },
  ];

  it('accepts a correct solution', () => {
    expect(validateSolution(ring, ringSolution)).toEqual({ valid: true, issues: [] });
  });

  it('rejects wrong island counts', () => {
    const res = validateSolution(ring, ringSolution.slice(0, 3));
    expect(res.valid).toBe(false);
    expect(res.issues.filter((i) => i.type === 'island-count')).toHaveLength(2);
  });

  it('rejects disconnected networks', () => {
    const res = validateSolution(ring, [
      { a: tl, b: tr, count: 2 },
      { a: bl, b: br, count: 2 },
    ]);
    expect(res.issues).toEqual([{ type: 'disconnected' }]);
  });

  it('rejects illegal, duplicate and malformed bridges', () => {
    expect(validateSolution(ring, [{ a: tl, b: br, count: 1 }]).issues[0]).toEqual({
      type: 'illegal-bridge',
      a: tl,
      b: br,
    });
    expect(validateSolution(ring, [...ringSolution, ringSolution[0]!]).issues).toContainEqual({
      type: 'duplicate',
      a: tl,
      b: tr,
    });
    expect(
      validateSolution(ring, [{ a: tl, b: tr, count: 3 as unknown as 1 }]).issues[0]?.type,
    ).toBe('bad-count');
    expect(validateSolution(ring, [{ a: 0, b: 99, count: 1 }]).issues[0]?.type).toBe('illegal-bridge');
  });

  it('rejects crossing bridges', () => {
    const plus = fromAscii(['.2.', '2.2', '.2.']);
    const [top, left, right, bottom] = [0, 1, 2, 3];
    const res = validateSolution(plus, [
      { a: left, b: right, count: 2 },
      { a: top, b: bottom, count: 2 },
    ]);
    expect(res.issues.some((i) => i.type === 'crossing')).toBe(true);
  });

  it('rejects bridges over a reef', () => {
    const p = fromAscii(['1#1']);
    expect(validateSolution(p, [{ a: 0, b: 1, count: 1 }]).issues[0]?.type).toBe('illegal-bridge');
    expect(validateSolution(p, [{ a: 0, b: 1, count: 1 }], createRules({ reefs: false })).valid).toBe(true);
  });

  it('reports island status for UI feedback', () => {
    const board = buildBoard(ring);
    const counts = new Int8Array(board.edges.length);
    counts[findEdge(board, tl, tr)] = 2;
    counts[findEdge(board, tl, bl)] = 1;
    expect(islandStatuses(board, counts)).toEqual(['over', 'full', 'open', 'open']);
  });
});
