export { computeStats, TIME_BUCKETS, type DailyStats, type TimeBucket } from '@bridgle/core';

/** One daily puzzle as stored on this device. */
export interface DailyRecord {
  number: number;
  /** ISO calendar date of the puzzle. */
  date: string;
  startedAt: number;
  solved: boolean;
  solvedAt?: number;
  timeMs?: number;
  undos: number;
  hints: number;
  /** Game in progress (absent once solved). */
  progress?: { counts: number[]; elapsedMs: number };
  /** The player's final bridges as flat a, b, count triplets; sent to the server as proof. */
  bridges?: number[];
  /** True once the server has accepted this result. */
  synced?: boolean;
}
