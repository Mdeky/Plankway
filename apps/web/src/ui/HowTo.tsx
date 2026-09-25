import { t } from '../i18n.ts';
import { Dialog } from './Dialog.tsx';

export function HowTo({ onClose }: { onClose(): void }) {
  return (
    <Dialog title={t('howto.title')} onClose={onClose}>
      <ul class="rules">
        <li>{t('howto.1')}</li>
        <li>{t('howto.2')}</li>
        <li>{t('howto.3')}</li>
        <li>{t('howto.4')}</li>
        <li>{t('howto.5')}</li>
      </ul>
      <p class="muted">{t('howto.controls')}</p>
      <div class="dialog-actions">
        <button class="btn primary" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Dialog>
  );
}
