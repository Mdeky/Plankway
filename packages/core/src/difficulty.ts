import type { LogicalResult } from './solver/logical.ts';
import type { TechniqueId } from './solver/techniques.ts';

export type Tier = 'easy' | 'medium' | 'hard' | 'expert';

export interface DifficultyReport {
  /** Weight of the hardest technique needed. */
  maxWeight: number;
  steps: number;
  /** Steps where a twist (reef) mattered. */
  twistSteps: number;
  /** maxWeight dominates, step count breaks ties: 100 × maxWeight + steps. */
  score: number;
  tier: Tier;
  techniques: Partial<Record<TechniqueId, number>>;
}

export function tierForWeight(maxWeight: number): Tier {
  if (maxWeight <= 2) return 'easy';
  if (maxWeight <= 3) return 'medium';
  if (maxWeight <= 4) return 'hard';
  return 'expert';
}

export function rateDifficulty(result: LogicalResult): DifficultyReport {
  const techniques: Partial<Record<TechniqueId, number>> = {};
  let twistSteps = 0;
  for (const step of result.steps) {
    techniques[step.technique] = (techniques[step.technique] ?? 0) + 1;
    if (step.twistAssisted) twistSteps++;
  }
  return {
    maxWeight: result.maxWeight,
    steps: result.steps.length,
    twistSteps,
    score: result.maxWeight * 100 + result.steps.length,
    tier: tierForWeight(result.maxWeight),
    techniques,
  };
}
