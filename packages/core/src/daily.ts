import { dailyConfig } from './curves.ts';
import { generatePuzzle, type GeneratedPuzzle } from './generator.ts';

/** Calendar date without a time zone. Month is 1–12. */
export interface CalendarDate {
  y: number;
  m: number;
  d: number;
}

/** Plankway #1. */
export const LAUNCH_DATE: CalendarDate = { y: 2026, m: 9, d: 25 };

const DAY_MS = 86_400_000;

function dayIndex(date: CalendarDate): number {
  return Math.floor(Date.UTC(date.y, date.m - 1, date.d) / DAY_MS);
}

/** The player's local calendar date (the daily follows local time, like a newspaper). */
export function localDate(now: Date = new Date()): CalendarDate {
  return { y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() };
}

export function formatDate(date: CalendarDate): string {
  return `${date.y}-${String(date.m).padStart(2, '0')}-${String(date.d).padStart(2, '0')}`;
}

export function parseDate(iso: string): CalendarDate | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return null;
  const date = { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
  const check = new Date(Date.UTC(date.y, date.m - 1, date.d));
  if (check.getUTCMonth() !== date.m - 1 || check.getUTCDate() !== date.d) return null;
  return date;
}

/** Puzzle number for a date; 1 on launch day, < 1 before it. */
export function puzzleNumber(date: CalendarDate): number {
  return dayIndex(date) - dayIndex(LAUNCH_DATE) + 1;
}

export function dateForNumber(number: number): CalendarDate {
  const t = new Date((dayIndex(LAUNCH_DATE) + number - 1) * DAY_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(date: CalendarDate): number {
  return new Date(Date.UTC(date.y, date.m - 1, date.d)).getUTCDay();
}

export function dailySeed(number: number): string {
  return `bridgle-daily-${number}`;
}

/** Deterministic daily puzzle; the server-side generator uses exactly the same call. */
export function generateDaily(number: number): GeneratedPuzzle {
  const date = dateForNumber(number);
  return generatePuzzle(dailyConfig(weekday(date)), dailySeed(number), `daily-${number}`);
}

/** Milliseconds until the next local midnight. */
export function msUntilNextDay(now: Date = new Date()): number {
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return next.getTime() - now.getTime();
}
