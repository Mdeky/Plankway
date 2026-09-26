import { endlessConfig } from './curves.ts';
import { generatePuzzle, type GeneratedPuzzle } from './generator.ts';

/** Every level has one fixed seed, so all players get the same puzzle for the same level. */
export function endlessSeed(level: number): string {
  return `endless-${level}`;
}

export function generateEndless(level: number): GeneratedPuzzle {
  const seed = endlessSeed(level);
  return generatePuzzle(endlessConfig(level), seed, seed);
}
