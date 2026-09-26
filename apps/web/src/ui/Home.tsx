import { useEffect, useState } from 'preact/hooks';
import { t, type MessageKey } from '../i18n.ts';
import { loadDailyRecord, loadDailyStats, todayNumber } from '../game/daily-store.ts';
import type { DailyStats } from '../game/stats.ts';
import { loadEndlessProgress } from '../game/storage.ts';
import { Dialog } from './Dialog.tsx';
import { Footer } from './Footer.tsx';
import { ProfileDialog } from './ProfileDialog.tsx';
import { Countdown, StatsPanel } from './StatsPanel.tsx';

type DailyState = 'new' | 'playing' | 'solved';

interface Props {
  onDaily(): void;
  onEndless(): void;
  onLeaderboard(): void;
  onHowTo(): void;
  onSettings(): void;
  /** Opens the profile dialog with this message (after returning from a sign-in). */
  profileNotice?: MessageKey | null;
}

export function Home({ onDaily, onEndless, onLeaderboard, onHowTo, onSettings, profileNotice }: Props) {
  const progress = loadEndlessProgress();
  const [number, setNumber] = useState(todayNumber);
  const [daily, setDaily] = useState<DailyState>('new');
  const [stats, setStats] = useState<DailyStats | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  useEffect(() => {
    if (profileNotice) setShowProfile(true);
  }, [profileNotice]);
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
      {/* The background shows the PlankWay logo; the heading stays for screen readers. */}
      <div class="home-backdrop" aria-hidden="true" />
      <h1 class="sr-only">{t('app.title')}</h1>
      <div class="home-card">
        <p class="tagline">{t('app.tagline')}</p>
        <div class="menu">
          <button class="btn primary big" onClick={onDaily}>
            <span>{t('menu.daily', { number })}</span>
            <small>{t(`menu.daily.${daily}`, { streak: stats?.currentStreak ?? 0 })}</small>
          </button>
          <button class="btn big sea" onClick={onEndless}>
            <span>{t('menu.endless')}</span>
            <small>{t('menu.endless.sub', { level: progress.level, best: progress.best })}</small>
          </button>
          <button class="btn" onClick={onLeaderboard}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4a3 3 0 003 4M17 6h3a3 3 0 01-3 4" />
            </svg>
            {t('board.title')}
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
      <Footer />
      {showProfile && (
        <ProfileDialog notice={profileNotice} onClose={() => setShowProfile(false)} onDataChanged={() => setRefresh((r) => r + 1)} />
      )}
    </main>
  );
}
