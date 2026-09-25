/**
 * Deterministic, seedable PRNG (mulberry32 seeded by an xmur3-style string hash).
 * Core code must never use Math.random(): the same seed always yields the same puzzle,
 * on every device and on the server.
 */
export interface Rng {
  readonly seed: string;
  /** Float in [0, 1). */
  next(): number;
  /** Integer in [min, max], both inclusive. */
  int(min: number, max: number): number;
  chance(p: number): boolean;
  pick<T>(items: readonly T[]): T;
  /** Shuffles in place and returns the same array. */
  shuffle<T>(items: T[]): T[];
  /** Independent child stream, derived from this seed and a label. */
  fork(label: string): Rng;
}

export function hashSeed(seed: string): number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function createRng(seed: string): Rng {
  let state = hashSeed(seed);

  const next = (): number => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return {
    seed,
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick<T>(items: readonly T[]): T {
      if (items.length === 0) throw new Error('Rng.pick() called on an empty array');
      return items[Math.floor(next() * items.length)] as T;
    },
    shuffle<T>(items: T[]): T[] {
      for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        const tmp = items[i] as T;
        items[i] = items[j] as T;
        items[j] = tmp;
      }
      return items;
    },
    fork(label) {
      return createRng(`${seed}/${label}`);
    },
  };
}
