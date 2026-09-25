import { describe, expect, it } from 'vitest';
import {
  buildBoard,
  bridgesToCounts,
  countSolutions,
  createRules,
  DAILY_PRESETS,
  dailyConfig,
  endlessConfig,
  ENDLESS_PLATEAU_LEVEL,
  generatePuzzle,
  getHint,
  MAX_ISLAND_VALUE,
  serializePuzzle,
  solveLogically,
  validateSolution,
  type GeneratorConfig,
} from '../src/index.ts';

function checkPuzzle(config: GeneratorConfig, seed: string) {
  const { puzzle, solution, report } = generatePuzzle(config, seed);
  const rules = createRules(config.twists);
  const board = buildBoard(puzzle, rules);

  expect(puzzle.islands).toHaveLength(config.islands);
  for (const isl of puzzle.islands) {
    expect(isl.n).toBeGreaterThanOrEqual(1);
    expect(isl.n).toBeLessThanOrEqual(MAX_ISLAND_VALUE);
  }
  expect(validateSolution(puzzle, solution, rules)).toEqual({ valid: true, issues: [] });
  expect(countSolutions(board, 2)).toBe(1);

  const logical = solveLogically(board, { maxWeight: config.maxWeight });
  expect(logical.solved).toBe(true);
  expect([...logical.state.min]).toEqual([...bridgesToCounts(board, solution)]);
  expect(report.maxWeight).toBeLessThanOrEqual(config.maxWeight);
  expect(puzzle.difficulty).toBe(report.score);
  expect(serializePuzzle(puzzle).length).toBeLessThan(2048);
  return { puzzle, report };
}

describe('generator', () => {
  it('is deterministic per seed', () => {
    const a = generatePuzzle(dailyConfig(3), 'same-seed');
    const b = generatePuzzle(dailyConfig(3), 'same-seed');
    expect(serializePuzzle(a.puzzle)).toBe(serializePuzzle(b.puzzle));
    expect(a.solution).toEqual(b.solution);
    expect(serializePuzzle(generatePuzzle(dailyConfig(3), 'other-seed').puzzle)).not.toBe(serializePuzzle(a.puzzle));
  });

  it('produces valid, unique puzzles for every weekday', () => {
    DAILY_PRESETS.forEach((preset, day) => {
      for (let i = 0; i < 5; i++) checkPuzzle(preset, `daily-${day}-${i}`);
    });
  });

  it('makes Sunday harder than Monday', () => {
    const avg = (config: GeneratorConfig) => {
      let total = 0;
      for (let i = 0; i < 10; i++) total += generatePuzzle(config, `curve-${i}`).report.score;
      return total / 10;
    };
    expect(avg(dailyConfig(0))).toBeGreaterThan(avg(dailyConfig(1)) + 200);
  });

  it('uses lookahead only on the hardest settings', () => {
    const sunday = generatePuzzle(dailyConfig(0), 'expert');
    expect(sunday.report.tier).toBe('expert');
    expect(sunday.report.techniques.lookahead ?? 0).toBeGreaterThan(0);
    const monday = generatePuzzle(dailyConfig(1), 'easy');
    expect(monday.report.tier).toBe('easy');
  });

  it('places no reefs when the twist is disabled', () => {
    const config = { ...dailyConfig(2), twists: { reefs: false } };
    for (let i = 0; i < 5; i++) {
      const { puzzle } = checkPuzzle(config, `plain-${i}`);
      expect(puzzle.reefs).toEqual([]);
    }
  });

  it('places reefs only where they do not block the solution', () => {
    for (let i = 0; i < 20; i++) {
      const { puzzle, solution } = generatePuzzle(dailyConfig(0), `reefs-${i}`);
      expect(puzzle.reefs.length).toBeLessThanOrEqual(dailyConfig(0).reefs);
      expect(validateSolution(puzzle, solution).valid).toBe(true);
    }
  });

  it('generated puzzles support hints all the way to the end', () => {
    const { puzzle } = generatePuzzle(endlessConfig(25), 'hint-walk');
    const board = buildBoard(puzzle);
    const solution = solveLogically(board).state;
    const counts = new Int8Array(board.edges.length);
    for (let guard = 0; guard < 200; guard++) {
      const hint = getHint(board, counts, solution);
      if (hint.kind === 'solved') return;
      expect(hint.kind).toBe('step');
      if (hint.kind !== 'step') return;
      for (const b of hint.place) counts[board.edgeLookup.get(Math.min(b.a, b.b) * 4096 + Math.max(b.a, b.b))!] = b.count;
    }
    throw new Error('hints did not finish the puzzle');
  });

  it('property: 1000 generated puzzles are all valid and uniquely, logically solvable', () => {
    const configs: [string, GeneratorConfig][] = [];
    for (let level = 1; level <= 60; level++) configs.push([`endless-${level}`, endlessConfig(level)]);
    DAILY_PRESETS.forEach((p, i) => configs.push([`daily-${i}`, p]));
    for (let i = 0; i < 1000; i++) {
      const [label, config] = configs[i % configs.length]!;
      checkPuzzle(config, `prop-${label}-${i}`);
    }
  }, 300_000);
});

describe('difficulty curves', () => {
  it('maps weekdays Monday → Sunday', () => {
    expect(dailyConfig(1)).toEqual(DAILY_PRESETS[0]);
    expect(dailyConfig(0)).toEqual(DAILY_PRESETS[6]);
    expect(DAILY_PRESETS[0]!.width).toBe(7);
    expect(DAILY_PRESETS[6]!.width).toBe(10);
  });

  it('endless grows until the plateau, then stays hard', () => {
    let prev = endlessConfig(1);
    for (let level = 2; level < ENDLESS_PLATEAU_LEVEL; level++) {
      const next = endlessConfig(level);
      expect(next.islands).toBeGreaterThanOrEqual(prev.islands);
      expect(next.maxWeight).toBeGreaterThanOrEqual(prev.maxWeight);
      prev = next;
    }
    for (let level = ENDLESS_PLATEAU_LEVEL; level < ENDLESS_PLATEAU_LEVEL + 50; level++) {
      expect(endlessConfig(level).maxWeight).toBeGreaterThanOrEqual(4);
    }
  });
});
