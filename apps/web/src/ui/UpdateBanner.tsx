import { useEffect, useState } from 'preact/hooks';
import { t } from '../i18n.ts';
import { applyUpdate, onUpdateReady, updateReady } from '../pwa.ts';

export function UpdateBanner() {
  const [ready, setReady] = useState(updateReady);
  useEffect(() => onUpdateReady(() => setReady(true)), []);
  if (!ready) return null;
  return (
    <div class="update-banner" role="status">
      <span>{t('update.ready')}</span>
      <button class="btn primary" onClick={applyUpdate}>
        {t('update.reload')}
      </button>
    </div>
  );
}
