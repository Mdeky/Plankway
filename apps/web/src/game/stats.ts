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
  /** Set once the result has been sent to the server (milestone 4). */
  synced?: boolean;
}

export interface TimeBucket {
  /** Upper bound in minutes; Infinity for the last bucket. */
  maxMinutes: number;
  count: number;
}

export interface DailyStats {
  played: number;
  won: number;
  winPct: number;
  currentStreak: number;
  maxStreak: number;
  distribution: TimeBucket[];
}

export const TIME_BUCKETS = [1, 2, 3, 5, 10, Infinity] as const;

/**
 * Streak = consecutive puzzle numbers solved. Today's unsolved puzzle doesn't break
 * the streak yet: it still counts back from yesterday.
 */
export function computeStats(records: readonly DailyRecord[], today: number): DailyStats {
  const solved = new Set(records.filter((r) => r.solved).map((r) => r.number));

  let currentStreak = 0;
  for (let n = solved.has(today) ? today : today - 1; solved.has(n); n--) currentStreak++;

  let maxStreak = 0;
  let run = 0;
  let prev = Number.NaN;
  for (const n of [...solved].sort((a, b) => a - b)) {
    run = n === prev + 1 ? run + 1 : 1;
    maxStreak = Math.max(maxStreak, run);
    prev = n;
  }

  const distribution: TimeBucket[] = TIME_BUCKETS.map((maxMinutes) => ({ maxMinutes, count: 0 }));
  for (const r of records) {
    if (!r.solved || r.timeMs === undefined) continue;
    const minutes = r.timeMs / 60_000;
    distribution.find((b) => minutes < b.maxMinutes)!.count++;
  }

  const played = records.length;
  return {
    played,
    won: solved.size,
    winPct: played === 0 ? 0 : Math.round((solved.size / played) * 100),
    currentStreak,
    maxStreak,
    distribution,
  };
}
