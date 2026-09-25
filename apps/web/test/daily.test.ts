import { beforeEach, describe, expect, it } from 'vitest';
import { setLang } from '../src/i18n.ts';
import { islandRow, shareText } from '../src/game/share.ts';
import { computeStats, type DailyRecord } from '../src/game/stats.ts';

const rec = (number: number, solved: boolean, timeMs = 150_000): DailyRecord => ({
  number,
  date: '',
  startedAt: 0,
  solved,
  timeMs: solved ? timeMs : undefined,
  undos: 0,
  hints: 0,
});

describe('daily stats', () => {
  it('is empty for a new player', () => {
    const s = computeStats([], 10);
    expect(s).toMatchObject({ played: 0, won: 0, winPct: 0, currentStreak: 0, maxStreak: 0 });
  });

  it('counts consecutive solved numbers as a streak', () => {
    const s = computeStats([rec(1, true), rec(2, true), rec(4, true), rec(5, true), rec(6, true)], 6);
    expect(s.currentStreak).toBe(3);
    expect(s.maxStreak).toBe(3);
    expect(s.played).toBe(5);
    expect(s.winPct).toBe(100);
  });

  it('keeps the streak alive until today is over', () => {
    const records = [rec(8, true), rec(9, true)];
    expect(computeStats(records, 10).currentStreak).toBe(2); // today (#10) not played yet
    expect(computeStats(records, 11).currentStreak).toBe(0); // missed #10
  });

  it('an unsolved attempt counts as played but breaks nothing yet', () => {
    const s = computeStats([rec(9, true), rec(10, false)], 10);
    expect(s.played).toBe(2);
    expect(s.won).toBe(1);
    expect(s.winPct).toBe(50);
    expect(s.currentStreak).toBe(1);
  });

  it('buckets solve times', () => {
    const s = computeStats([rec(1, true, 30_000), rec(2, true, 150_000), rec(3, true, 170_000), rec(4, true, 11 * 60_000)], 4);
    expect(s.distribution.map((b) => b.count)).toEqual([1, 0, 2, 0, 0, 1]);
  });
});

describe('share text', () => {
  beforeEach(() => setLang('en'));

  it('matches the spoiler-free format', () => {
    expect(shareText({ number: 42, timeMs: 151_000, undos: 0, hints: 0 }, 'bridgle.com')).toBe(
      'Bridgle #42 🌉 2:31\n🏝️🏝️🏝️🏝️🏝️ 0 undos\nbridgle.com',
    );
  });

  it('is translated', () => {
    setLang('nl');
    expect(shareText({ number: 1, timeMs: 5_000, undos: 2, hints: 0 }, 'x')).toBe('Bridgle #1 🌉 0:05\n🏝️🏝️🏝️🏝️🏝️ 2 undo’s\nx');
  });

  it('mentions hints', () => {
    expect(shareText({ number: 3, timeMs: 61_000, undos: 1, hints: 2 }, 'x')).toBe('Bridgle #3 🌉 1:01\n🏝️🌊🌊🌊🌊 1 undo · 💡 2 hints\nx');
  });

  it('washes islands away for hints and undos, but keeps one', () => {
    expect(islandRow(0, 0)).toBe('🏝️🏝️🏝️🏝️🏝️');
    expect(islandRow(3, 0)).toBe('🏝️🏝️🏝️🏝️🌊');
    expect(islandRow(0, 1)).toBe('🏝️🏝️🏝️🌊🌊');
    expect(islandRow(50, 9)).toBe('🏝️🌊🌊🌊🌊');
  });
});
