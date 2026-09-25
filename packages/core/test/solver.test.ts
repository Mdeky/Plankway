import { describe, expect, it } from 'vitest';
import {
  buildBoard,
  countSolutions,
  createState,
  findEdge,
  getHint,
  findSolutions,
  solveLogically,
  stateToSolution,
  TECHNIQUES,
  validateSolution,
  type TechniqueId,
} from '../src/index.ts';
import { fromAscii, islandIndex } from './helpers.ts';

const technique = (id: TechniqueId) => TECHNIQUES.find((t) => t.id === id)!;

describe('logical techniques', () => {
  it('all-bridges: a 2 with one neighbour takes a double bridge', () => {
    const board = buildBoard(fromAscii(['2.4.2']));
    const res = solveLogically(board);
    expect(res.solved).toBe(true);
    expect(res.maxWeight).toBe(1);
    expect(res.steps[0]!.technique).toBe('all-bridges');
    expect([...res.state.min]).toEqual([2, 2]);
  });

  it('cap: a 1 never takes a double bridge', () => {
    const board = buildBoard(fromAscii(['1.1']));
    const res = solveLogically(board);
    expect(res.steps[0]!.technique).toBe('cap');
    expect(res.solved).toBe(true);
    expect(res.state.min[0]).toBe(1);
  });

  it('full-island: a satisfied island closes its other edges', () => {
    const p = fromAscii(['1.2', '...', '1..']);
    const board = buildBoard(p);
    const s = createState(board);
    const top = findEdge(board, 0, 1);
    s.min[top] = 1;
    const step = technique('full-island').find(board, s)!;
    expect(step.island).toBe(0);
    expect(step.changes).toEqual([
      { edge: top, min: 1, max: 1 },
      { edge: findEdge(board, 0, 2), min: 0, max: 0 },
    ]);
  });

  it('forced-minimum: a 3 between two neighbours needs a bridge to each', () => {
    const board = buildBoard(fromAscii(['2.3.2', '.....', '2...2']));
    const step = technique('forced-minimum').find(board, createState(board))!;
    expect(step.island).toBe(1);
    expect(step.changes.map((c) => c.min)).toEqual([1, 1]);
  });

  it('crossing: a placed bridge excludes the bridge it crosses', () => {
    const p = fromAscii(['.1.', '1.1', '.1.']);
    const board = buildBoard(p);
    const h = findEdge(board, islandIndex(p, 0, 1), islandIndex(p, 2, 1));
    const v = findEdge(board, islandIndex(p, 1, 0), islandIndex(p, 1, 2));
    const s = createState(board);
    s.min[h] = 1;
    expect(technique('crossing').find(board, s)!.changes).toEqual([{ edge: v, min: 0, max: 0 }]);
  });

  it('isolation: two 2s may not form a closed pair', () => {
    const board = buildBoard(fromAscii(['2.2', '...', '2.2']));
    const res = solveLogically(board);
    expect(res.solved).toBe(true);
    expect(res.steps[0]!.technique).toBe('isolation');
    expect(res.maxWeight).toBe(3);
    expect([...res.state.min]).toEqual([1, 1, 1, 1]);
  });

  it('connectivity: a group with one exit must use it', () => {
    const board = buildBoard(fromAscii(['1.2.2.1']));
    const s = createState(board);
    s.min[0] = 1;
    s.max[0] = 1;
    const step = technique('connectivity').find(board, s)!;
    expect(step.changes).toEqual([{ edge: 1, min: 1, max: 2 }]);
  });

  it('marks steps next to a reef as twist-assisted', () => {
    const board = buildBoard(fromAscii(['1.2#.1', '......', '..2..2']));
    const res = solveLogically(board);
    expect(res.solved).toBe(true);
    expect(res.steps.some((s) => s.twistAssisted)).toBe(true);
  });

  it('respects maxWeight and never guesses', () => {
    const ring = buildBoard(fromAscii(['2.2', '...', '2.2']));
    expect(solveLogically(ring, { maxWeight: 2 }).solved).toBe(false);
    const ambiguous = buildBoard(fromAscii(['3.3', '...', '3.3']));
    const res = solveLogically(ambiguous);
    expect(res.solved).toBe(false);
    expect(res.contradiction).toBe(false);
  });
});

describe('backtracking', () => {
  it('counts solutions up to the limit', () => {
    expect(countSolutions(buildBoard(fromAscii(['2.2', '...', '2.2'])))).toBe(1);
    expect(countSolutions(buildBoard(fromAscii(['3.3', '...', '3.3'])))).toBe(2);
    expect(countSolutions(buildBoard(fromAscii(['1.1.1'])))).toBe(0);
  });

  it('only returns valid solutions', () => {
    const p = fromAscii(['3.3', '...', '3.3']);
    const board = buildBoard(p);
    for (const s of findSolutions(board, 5)) {
      expect(validateSolution(p, stateToSolution(board, s)).valid).toBe(true);
    }
  });
});

describe('hints', () => {
  const p = fromAscii(['1.3.2']);
  const board = buildBoard(p);
  const solution = findSolutions(board, 1)[0]!;

  it('gives the next logical step with the bridges it proves', () => {
    const hint = getHint(board, new Int8Array(board.edges.length), solution);
    expect(hint.kind).toBe('step');
    if (hint.kind !== 'step') return;
    expect(hint.place.length).toBeGreaterThan(0);
    for (const b of hint.place) expect(b.count).toBeLessThanOrEqual(solution.min[findEdge(board, b.a, b.b)]!);
  });

  it('flags mistakes without revealing the answer', () => {
    const counts = new Int8Array(board.edges.length);
    counts[0] = 2;
    expect(getHint(board, counts, solution)).toEqual({ kind: 'mistake', edge: 0, a: 0, b: 1 });
  });

  it('reports a solved grid', () => {
    expect(getHint(board, solution.min, solution)).toEqual({ kind: 'solved' });
  });
});
