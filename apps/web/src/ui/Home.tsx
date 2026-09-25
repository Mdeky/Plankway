import { t } from '../i18n.ts';
import { loadEndlessProgress } from '../game/storage.ts';

export function Home({ onEndless, onHowTo }: { onEndless(): void; onHowTo(): void }) {
  const progress = loadEndlessProgress();
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
        <button class="btn primary big" onClick={onEndless}>
          <span>{t('menu.endless')}</span>
          <small>{t('menu.endless.sub', { level: progress.level, best: progress.best })}</small>
        </button>
        <button class="btn big" onClick={onHowTo}>
          {t('menu.howto')}
        </button>
      </div>
    </main>
  );
}
