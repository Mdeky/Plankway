import { describe, expect, it } from 'vitest';
import {
  dateForNumber,
  formatDate,
  generateDaily,
  LAUNCH_DATE,
  localDate,
  msUntilNextDay,
  parseDate,
  puzzleNumber,
  serializePuzzle,
  weekday,
} from '../src/index.ts';

describe('daily numbering', () => {
  it('launch day is Plankway #1', () => {
    expect(formatDate(LAUNCH_DATE)).toBe('2026-09-25');
    expect(puzzleNumber(LAUNCH_DATE)).toBe(1);
    expect(puzzleNumber({ y: 2026, m: 9, d: 26 })).toBe(2);
    expect(puzzleNumber({ y: 2026, m: 9, d: 24 })).toBe(0);
  });

  it('is unaffected by daylight saving and leap years', () => {
    // Europe switches to winter time on 2026-10-25.
    expect(puzzleNumber({ y: 2026, m: 10, d: 26 }) - puzzleNumber({ y: 2026, m: 10, d: 24 })).toBe(2);
    expect(puzzleNumber({ y: 2028, m: 3, d: 1 }) - puzzleNumber({ y: 2028, m: 2, d: 28 })).toBe(2);
  });

  it('maps numbers back to dates', () => {
    for (const n of [1, 2, 38, 365, 1000]) expect(puzzleNumber(dateForNumber(n))).toBe(n);
    expect(dateForNumber(8)).toEqual({ y: 2026, m: 10, d: 2 });
  });

  it('uses the local calendar date', () => {
    expect(localDate(new Date(2026, 8, 25, 0, 5))).toEqual({ y: 2026, m: 9, d: 25 });
    expect(localDate(new Date(2026, 8, 25, 23, 59))).toEqual({ y: 2026, m: 9, d: 25 });
  });

  it('knows the weekday', () => {
    expect(weekday(LAUNCH_DATE)).toBe(5); // Friday
  });

  it('parses and validates ISO dates', () => {
    expect(parseDate('2026-09-25')).toEqual(LAUNCH_DATE);
    expect(parseDate('2026-02-30')).toBeNull();
    expect(parseDate('25/09/2026')).toBeNull();
  });

  it('counts down to local midnight', () => {
    expect(msUntilNextDay(new Date(2026, 8, 25, 23, 59, 0))).toBe(60_000);
  });
});

describe('daily puzzles', () => {
  it('are the same for everyone', () => {
    expect(serializePuzzle(generateDaily(7).puzzle)).toBe(serializePuzzle(generateDaily(7).puzzle));
    expect(generateDaily(7).puzzle.id).toBe('daily-7');
  });

  it('follow the weekly rhythm', () => {
    // #4 is Monday 2026-09-28, #10 is Sunday 2026-10-04.
    expect(weekday(dateForNumber(4))).toBe(1);
    expect(generateDaily(4).puzzle.width).toBe(7);
    expect(generateDaily(10).puzzle.width).toBe(10);
  });
});
