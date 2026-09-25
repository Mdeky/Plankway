import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n.ts';
import { loadDailyRecord, loadDailyStats, todayNumber } from '../game/daily-store.ts';
import type { DailyStats } from '../game/stats.ts';
import { loadEndlessProgress } from '../game/storage.ts';
import { Dialog } from './Dialog.tsx';
import { ProfileDialog } from './ProfileDialog.tsx';
import { Countdown, StatsPanel } from './StatsPanel.tsx';

type DailyState = 'new' | 'playing' | 'solved';

interface Props {
  onDaily(): void;
  onEndless(): void;
  onHowTo(): void;
  onSettings(): void;
}

export function Home({ onDaily, onEndless, onHowTo, onSettings }: Props) {
  const progress = loadEndlessProgress();
  const [number, setNumber] = useState(todayNumber);
  const [daily, setDaily] = useState<DailyState>('new');
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let live = true;
    void loadDailyRecord(number).then((r) => live && setDaily(r?.solved ? 'solved' : r ? 'playing' : 'new'));
    void loadDailyStats(number).then((s) => live && setStats(s));
    return () => {
      live = false;
    };
  }, [number, refresh]);

  return (
    <main class="screen home">
      <div class="logo" aria-hidden="true">
        <svg viewBox="0 0 120 60">
          <ellipse cx="22" cy="36" rx="18" ry="12" class="logo-island" />
          <ellipse cx="98" cy="36" rx="18" ry="12" class="logo-island" />
          <path d="M36 32h48M36 40h48" class="logo-bridge" />
        </svg>
      </div>
      <h1 class="title">{t('app.title')}</h1>
      <p class="tagline">{t('app.tagline')}</p>
      <div class="menu">
        <button class="btn primary big" onClick={onDaily}>
          <span>{t('menu.daily', { number })}</span>
          <small>{t(`menu.daily.${daily}`, { streak: stats?.currentStreak ?? 0 })}</small>
        </button>
        <button class="btn big" onClick={onEndless}>
          <span>{t('menu.endless')}</span>
          <small>{t('menu.endless.sub', { level: progress.level, best: progress.best })}</small>
        </button>
        <div class="menu-row">
          <button class="btn" onClick={() => setShowStats(true)}>
            {t('stats.title')}
          </button>
          <button class="btn" onClick={onHowTo}>
            {t('menu.howto')}
          </button>
          <button class="btn" onClick={() => setShowProfile(true)}>
            {t('menu.profile')}
          </button>
          <button class="btn" onClick={onSettings}>
            {t('menu.settings')}
          </button>
        </div>
      </div>

      {showStats && stats && (
        <Dialog title={t('stats.title')} onClose={() => setShowStats(false)}>
          <StatsPanel stats={stats} />
          <Countdown onNewDay={() => setNumber(todayNumber())} />
          <div class="dialog-actions">
            <button class="btn primary" autofocus onClick={() => setShowStats(false)}>
              {t('common.close')}
            </button>
          </div>
        </Dialog>
      )}
      {showProfile && <ProfileDialog onClose={() => setShowProfile(false)} onDataChanged={() => setRefresh((r) => r + 1)} />}
    </main>
  );
}
