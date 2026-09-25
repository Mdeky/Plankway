import { localDate, puzzleNumber } from '@bridgle/core';
import { idbGet, idbGetAll, idbPut, STORES } from './idb.ts';
import { computeStats, type DailyRecord, type DailyStats } from './stats.ts';

/** Today's puzzle number in the player's local time zone (never below #1). */
export function todayNumber(now: Date = new Date()): number {
  return Math.max(1, puzzleNumber(localDate(now)));
}

export function loadDailyRecord(number: number): Promise<DailyRecord | undefined> {
  return idbGet<DailyRecord>(STORES.daily, number);
}

export function saveDailyRecord(record: DailyRecord): Promise<void> {
  return idbPut(STORES.daily, record, record.number);
}

export async function loadDailyStats(today = todayNumber()): Promise<DailyStats> {
  return computeStats(await idbGetAll<DailyRecord>(STORES.daily), today);
}
