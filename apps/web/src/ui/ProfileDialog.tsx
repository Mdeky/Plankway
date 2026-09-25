import { useState } from 'preact/hooks';
import { t, type MessageKey } from '../i18n.ts';
import { ensureProfile, loadProfileInfo, newRecoveryCode } from '../game/api.ts';
import { deleteAllData, recoverWithCode } from '../game/sync.ts';
import { Dialog } from './Dialog.tsx';

type Busy = null | 'connect' | 'recover' | 'delete';

export function ProfileDialog({ onClose, onDataChanged }: { onClose(): void; onDataChanged(): void }) {
  const [profile, setProfile] = useState(loadProfileInfo);
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<MessageKey | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);

  const connect = async () => {
    setBusy('connect');
    const info = await ensureProfile();
    setBusy(null);
    setProfile(info);
    if (!info) setMessage('profile.offline');
  };

  const makeCode = async () => {
    setBusy('connect');
    const info = await newRecoveryCode();
    setBusy(null);
    if (info) setProfile(info);
    else setMessage('profile.error.offline');
  };

  const recover = async (ev: Event) => {
    ev.preventDefault();
    setBusy('recover');
    const outcome = await recoverWithCode(code);
    setBusy(null);
    if (outcome.ok) {
      setProfile(loadProfileInfo());
      setCode('');
      setMessage('profile.recovered');
      onDataChanged();
    } else {
      setMessage(`profile.error.${outcome.error}`);
    }
  };

  const remove = async () => {
    setBusy('delete');
    const { server } = await deleteAllData();
    setBusy(null);
    setConfirmDelete(false);
    if (!server) {
      setMessage('profile.deleteOffline');
      return;
    }
    setProfile(null);
    setMessage('profile.deleted');
    onDataChanged();
  };

  return (
    <Dialog title={t('profile.title')} onClose={onClose}>
      <p class="muted">{t('profile.intro')}</p>

      <section class="profile-section">
        <h3>{t('profile.codeTitle')}</h3>
        {profile?.recoveryCode ? (
          <>
            <p class="recovery-code" translate={false}>
              {profile.recoveryCode}
            </p>
            <p class="muted">{t('profile.codeHelp')}</p>
          </>
        ) : profile ? (
          <>
            <p class="muted">{t('profile.codeUnknown')}</p>
            <button class="btn" onClick={makeCode} disabled={busy !== null}>
              {t('profile.newCode')}
            </button>
          </>
        ) : (
          <button class="btn" onClick={connect} disabled={busy !== null}>
            {t('profile.connect')}
          </button>
        )}
      </section>

      <form class="profile-section" onSubmit={recover}>
        <h3>{t('profile.recoverTitle')}</h3>
        <label class="field">
          <span>{t('profile.recoverLabel')}</span>
          <input
            value={code}
            onInput={(e) => setCode((e.target as HTMLInputElement).value)}
            placeholder="lumo-taki-ravo-nesi"
            autocomplete="off"
            autocapitalize="none"
            spellcheck={false}
          />
        </label>
        <button class="btn" type="submit" disabled={busy !== null || code.trim().length < 8}>
          {t('profile.recoverButton')}
        </button>
      </form>

      <section class="profile-section">
        <h3>{t('profile.deleteTitle')}</h3>
        {confirmDelete ? (
          <>
            <p>{t('profile.deleteConfirm')}</p>
            <div class="dialog-actions">
              <button class="btn" onClick={() => setConfirmDelete(false)} disabled={busy !== null}>
                {t('common.cancel')}
              </button>
              <button class="btn danger" onClick={remove} disabled={busy !== null}>
                {t('profile.deleteButton')}
              </button>
            </div>
          </>
        ) : (
          <button class="btn" onClick={() => setConfirmDelete(true)}>
            {t('profile.deleteStart')}
          </button>
        )}
      </section>

      <p class="status" role="status" aria-live="polite">
        {message ? t(message) : ''}
      </p>
      <div class="dialog-actions">
        <button class="btn primary" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Dialog>
  );
}
