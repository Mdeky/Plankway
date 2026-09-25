import { t } from '../i18n.ts';
import { AdSlot } from './AdSlot.tsx';
import { Dialog } from './Dialog.tsx';

/** Endless only: between levels, after every N solved puzzles. Closable right away. */
export function Interstitial({ onContinue }: { onContinue(): void }) {
  return (
    <Dialog title={t('ads.break')} onClose={onContinue}>
      <AdSlot placement="interstitial" />
      <div class="dialog-actions">
        <button class="btn primary" autofocus onClick={onContinue}>
          {t('ads.continue')}
        </button>
      </div>
    </Dialog>
  );
}
