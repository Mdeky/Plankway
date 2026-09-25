import { useEffect, useState } from 'preact/hooks';
import { msUntilNextDay } from '@bridgle/core';
import { t } from '../i18n.ts';
import type { DailyStats } from '../game/stats.ts';
import { formatTime } from './format.ts';

export function StatsPanel({ stats }: { stats: DailyStats }) {
  const max = Math.max(1, ...stats.distribution.map((b) => b.count));
  return (
    <section class="stats-panel" aria-label={t('stats.title')}>
      <dl class="stats four">
        <div>
          <dd>{stats.played}</dd>
          <dt>{t('stats.played')}</dt>
        </div>
        <div>
          <dd>{stats.winPct}</dd>
          <dt>{t('stats.winPct')}</dt>
        </div>
        <div>
          <dd>{stats.currentStreak}</dd>
          <dt>{t('stats.streak')}</dt>
        </div>
        <div>
          <dd>{stats.maxStreak}</dd>
          <dt>{t('stats.maxStreak')}</dt>
        </div>
      </dl>
      <h3>{t('stats.distribution')}</h3>
      <ol class="histogram">
        {stats.distribution.map((b, i) => {
          const prev = i === 0 ? 0 : stats.distribution[i - 1]!.maxMinutes;
          const label =
            b.maxMinutes === Infinity ? t('stats.over', { m: prev }) : t('stats.range', { from: prev, to: b.maxMinutes });
          return (
            <li key={label}>
              <span class="hist-label">{label}</span>
              <span class="hist-bar" style={{ width: `${Math.max(8, (b.count / max) * 100)}%` }}>
                {b.count}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/** Live countdown to the next daily; calls `onNewDay` when it reaches zero. */
export function Countdown({ onNewDay }: { onNewDay?: () => void }) {
  const [left, setLeft] = useState(msUntilNextDay);
  useEffect(() => {
    const id = setInterval(() => {
      const ms = msUntilNextDay();
      // Wrapped past midnight: a new puzzle is out.
      if (ms > left + 1000) onNewDay?.();
      setLeft(ms);
    }, 1000);
    return () => clearInterval(id);
  }, [left]);
  return (
    <p class="countdown">
      {t('stats.next')} <strong role="timer">{formatTime(left)}</strong>
    </p>
  );
}
