import { describe, expect, it } from 'vitest';
import { endlessConfig, findEdge, generatePuzzle, type Puzzle } from '@bridgle/core';
import { createSession, cycleEdge, hint, removeEdge, reset, undo, type Session } from '../src/game/session.ts';

// 2 . 2
// . . .
// 2 . 2   → unique solution: a ring of single bridges
const ring: Puzzle = {
  id: 'ring',
  seed: 'ring',
  width: 3,
  height: 3,
  difficulty: 0,
  islands: [
    { x: 0, y: 0, n: 2 },
    { x: 2, y: 0, n: 2 },
    { x: 0, y: 2, n: 2 },
    { x: 2, y: 2, n: 2 },
  ],
  reefs: [],
};
const ringSolution = [
  { a: 0, b: 1, count: 1 as const },
  { a: 2, b: 3, count: 1 as const },
  { a: 0, b: 2, count: 1 as const },
  { a: 1, b: 3, count: 1 as const },
];

const edge = (s: Session, a: number, b: number) => findEdge(s.board, a, b);
const play = (s: Session, e: number) => cycleEdge(s, e).session;

describe('session', () => {
  it('cycles a bridge 0 → 1 → 2 → 0', () => {
    let s = createSession(ring, ringSolution);
    const e = edge(s, 0, 1);
    s = play(s, e);
    expect(s.counts[e]).toBe(1);
    s = play(s, e);
    expect(s.counts[e]).toBe(2);
    s = play(s, e);
    expect(s.counts[e]).toBe(0);
  });

  it('removes a single or double bridge in one tap', () => {
    let s = createSession(ring, ringSolution);
    const e = edge(s, 0, 1);
    s = play(play(s, e), e);
    expect(s.counts[e]).toBe(2);
    s = removeEdge(s, e);
    expect(s.counts[e]).toBe(0);
    expect(removeEdge(s, e)).toBe(s);
    s = undo(s);
    expect(s.counts[e]).toBe(2);
  });

  it('detects the win and locks the board', () => {
    let s = createSession(ring, ringSolution);
    for (const b of ringSolution) s = play(s, edge(s, b.a, b.b));
    expect(s.solved).toBe(true);
    expect(play(s, edge(s, 0, 1))).toBe(s);
    expect(undo(s)).toBe(s);
  });

  it('does not count a disconnected grid as solved', () => {
    let s = createSession(ring, ringSolution);
    for (const [a, b] of [
      [0, 1],
      [0, 1],
      [2, 3],
      [2, 3],
    ] as const) {
      s = play(s, edge(s, a, b));
    }
    expect(s.solved).toBe(false);
  });

  it('undo restores the previous grid and counts undos', () => {
    let s = createSession(ring, ringSolution);
    const e = edge(s, 0, 1);
    s = play(s, e);
    s = play(s, e);
    s = undo(s);
    expect(s.counts[e]).toBe(1);
    expect(s.undos).toBe(1);
    s = undo(undo(s));
    expect(s.counts[e]).toBe(0);
    expect(s.undos).toBe(2); // the last undo had nothing to undo
  });

  it('reset clears the grid and can be undone', () => {
    let s = createSession(ring, ringSolution);
    s = play(s, edge(s, 0, 1));
    s = reset(s);
    expect([...s.counts]).toEqual([0, 0, 0, 0]);
    s = undo(s);
    expect(s.counts[edge(s, 0, 1)]).toBe(1);
  });

  it('blocks a bridge that would cross an existing one', () => {
    const plus: Puzzle = {
      ...ring,
      id: 'plus',
      islands: [
        { x: 1, y: 0, n: 1 },
        { x: 0, y: 1, n: 1 },
        { x: 2, y: 1, n: 1 },
        { x: 1, y: 2, n: 1 },
      ],
    };
    let s = createSession(plus, []);
    const h = edge(s, 1, 2);
    const v = edge(s, 0, 3);
    s = play(s, h);
    const result = cycleEdge(s, v);
    expect(result.blocked).toBe(true);
    if (result.blocked) expect(result.by).toBe(h);
    expect(result.session.counts[v]).toBe(0);
  });

  it('hints are counted and point at a real next step', () => {
    const g = generatePuzzle(endlessConfig(12), 'web-hint');
    const s = createSession(g.puzzle, g.solution);
    const { session, hint: h } = hint(s);
    expect(session.hints).toBe(1);
    expect(h.kind).toBe('step');
  });

  it('resumes from saved counts', () => {
    const s = createSession(ring, ringSolution, [1, 1, 1, 1]);
    expect(s.solved).toBe(true);
    const bad = createSession(ring, ringSolution, [1]);
    expect([...bad.counts]).toEqual([0, 0, 0, 0]);
  });
});
