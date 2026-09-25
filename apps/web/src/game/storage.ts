import {
  parsePuzzle,
  parseSolution,
  serializePuzzle,
  serializeSolution,
  type Puzzle,
  type Solution,
} from '@bridgle/core';

/**
 * Small wrapper around localStorage. Every access can throw (private mode, blocked
 * storage), so failures fall back to defaults and the game keeps working.
 */
function read<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable: progress simply isn't kept.
  }
}

function remove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
}

const ENDLESS_KEY = 'bridgle.endless.v1';
const ENDLESS_GAME_KEY = 'bridgle.endless.game.v1';

export interface EndlessProgress {
  /** Level currently being played. */
  level: number;
  /** Highest level ever solved. */
  best: number;
  solved: number;
}

export function loadEndlessProgress(): EndlessProgress {
  const p = read<Partial<EndlessProgress>>(ENDLESS_KEY);
  const level = Number.isInteger(p?.level) && p!.level! >= 1 ? p!.level! : 1;
  const best = Number.isInteger(p?.best) && p!.best! >= 0 ? p!.best! : 0;
  const solved = Number.isInteger(p?.solved) && p!.solved! >= 0 ? p!.solved! : 0;
  return { level, best, solved };
}

export function saveEndlessProgress(p: EndlessProgress): void {
  write(ENDLESS_KEY, p);
}

export interface SavedGame {
  level: number;
  puzzle: Puzzle;
  solution: Solution;
  counts: number[];
  elapsedMs: number;
  undos: number;
  hints: number;
}

interface RawSavedGame {
  level: number;
  puzzle: string;
  solution: number[];
  counts: number[];
  elapsedMs: number;
  undos: number;
  hints: number;
}

export function loadEndlessGame(): SavedGame | null {
  const raw = read<RawSavedGame>(ENDLESS_GAME_KEY);
  if (!raw) return null;
  try {
    return {
      level: raw.level,
      puzzle: parsePuzzle(raw.puzzle),
      solution: parseSolution(raw.solution),
      counts: Array.isArray(raw.counts) ? raw.counts : [],
      elapsedMs: Number(raw.elapsedMs) || 0,
      undos: Number(raw.undos) || 0,
      hints: Number(raw.hints) || 0,
    };
  } catch {
    remove(ENDLESS_GAME_KEY);
    return null;
  }
}

export function saveEndlessGame(game: SavedGame): void {
  const raw: RawSavedGame = {
    level: game.level,
    puzzle: serializePuzzle(game.puzzle),
    solution: serializeSolution(game.solution),
    counts: game.counts,
    elapsedMs: Math.round(game.elapsedMs),
    undos: game.undos,
    hints: game.hints,
  };
  write(ENDLESS_GAME_KEY, raw);
}

export function clearEndlessGame(): void {
  remove(ENDLESS_GAME_KEY);
}
