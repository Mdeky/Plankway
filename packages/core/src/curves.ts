import type { GeneratorConfig } from './generator.ts';
import { createRng } from './rng.ts';

type Preset = Omit<GeneratorConfig, 'twists' | 'maxAttempts'>;

/** Daily difficulty per weekday, Monday (index 0) easiest to Sunday (index 6) hardest. */
export const DAILY_PRESETS: readonly Preset[] = [
  { width: 7, height: 7, islands: 10, reefs: 2, doubleChance: 0.35, loopChance: 0.25, maxWeight: 2, minWeight: 1 },
  { width: 7, height: 7, islands: 12, reefs: 2, doubleChance: 0.35, loopChance: 0.3, maxWeight: 2, minWeight: 2 },
  { width: 8, height: 8, islands: 14, reefs: 3, doubleChance: 0.35, loopChance: 0.3, maxWeight: 3, minWeight: 3 },
  { width: 8, height: 8, islands: 16, reefs: 3, doubleChance: 0.35, loopChance: 0.35, maxWeight: 3, minWeight: 3 },
  { width: 9, height: 9, islands: 18, reefs: 4, doubleChance: 0.35, loopChance: 0.35, maxWeight: 4, minWeight: 3 },
  { width: 9, height: 9, islands: 20, reefs: 4, doubleChance: 0.35, loopChance: 0.4, maxWeight: 6, minWeight: 4 },
  { width: 10, height: 10, islands: 22, reefs: 5, doubleChance: 0.35, loopChance: 0.4, maxWeight: 6, minWeight: 6 },
];

/** `jsDay` as returned by Date#getDay(): 0 = Sunday … 6 = Saturday. */
export function dailyConfig(jsDay: number): GeneratorConfig {
  const mondayFirst = (((jsDay + 6) % 7) + 7) % 7;
  return { ...DAILY_PRESETS[mondayFirst]! };
}

export const ENDLESS_PLATEAU_LEVEL = 30;

/** Endless mode: starts small and grows; from level 30 on it varies around "hard". */
export function endlessConfig(level: number): GeneratorConfig {
  const lvl = Math.max(1, Math.floor(level));
  if (lvl >= ENDLESS_PLATEAU_LEVEL) {
    const rng = createRng(`endless-plateau-${lvl}`);
    const size = rng.int(8, 10);
    const islands = Math.round(size * size * rng.int(19, 23) / 100);
    const maxWeight = rng.pick([4, 6, 6]);
    return {
      width: size,
      height: size,
      islands,
      reefs: rng.int(3, 5),
      doubleChance: 0.35,
      loopChance: 0.35,
      maxWeight,
      minWeight: maxWeight === 6 ? 4 : 3,
    };
  }
  const t = (lvl - 1) / (ENDLESS_PLATEAU_LEVEL - 1);
  const size = Math.round(5 + 4 * t);
  const maxWeight = t < 0.15 ? 1 : t < 0.35 ? 2 : t < 0.6 ? 3 : 4;
  return {
    width: size,
    height: size,
    islands: Math.round(5 + 15 * t),
    reefs: Math.round(1 + 3 * t),
    doubleChance: 0.35,
    loopChance: 0.2 + 0.15 * t,
    maxWeight,
    minWeight: Math.max(1, maxWeight - 1),
  };
}
