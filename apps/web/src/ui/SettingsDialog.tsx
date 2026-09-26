import { useState } from 'preact/hooks';
import { getLang, t, type Lang } from '../i18n.ts';
import { isSoundOn, setSoundOn } from '../game/sound.ts';
import { adsEnabled } from '../ads/config.ts';
import { openPrivacyChoices } from '../ads/loader.ts';
import { Dialog } from './Dialog.tsx';
import { Icon } from './icons.tsx';
import { ThemeSwitch } from './ThemeSwitch.tsx';

interface Props {
  onClose(): void;
  onLangChange(lang: Lang): void;
}

const LANGS: [Lang, string][] = [
  ['en', 'English'],
  ['nl', 'Nederlands'],
];

/** Same look as the profile: grouped controls, a switch for sound, rows for the rest. */
export function SettingsDialog({ onClose, onLangChange }: Props) {
  const [sound, setSound] = useState(isSoundOn);
  const lang = getLang();

  return (
    <Dialog title={t('settings.title')} onClose={onClose} class="profile-dialog">
      <div class="profile-view">
        <section class="settings-group">
          <h3 class="settings-label">{t('settings.theme')}</h3>
          <ThemeSwitch />
        </section>

        <section class="settings-group">
          <h3 class="settings-label">{t('settings.language')}</h3>
          <div class="segmented" role="group" aria-label={t('settings.language')}>
            {LANGS.map(([value, label]) => (
              <button key={value} lang={value} class={lang === value ? 'active' : ''} aria-pressed={lang === value} onClick={() => onLangChange(value)}>
                {label}
              </button>
            ))}
          </div>
        </section>

        <div class="profile-menu">
          <label class="menu-item">
            <Icon name="volume" />
            <span class="menu-label">{t('settings.soundOn')}</span>
            <input
              type="checkbox"
              role="switch"
              class="switch"
              checked={sound}
              onChange={(e) => {
                const on = (e.target as HTMLInputElement).checked;
                setSound(on);
                setSoundOn(on);
              }}
            />
          </label>
          {(adsEnabled('board') || adsEnabled('result')) && (
            <button class="menu-item" onClick={() => openPrivacyChoices()}>
              <Icon name="shield" />
              <span class="menu-label">{t('settings.privacy')}</span>
              <Icon name="chevron" class="menu-chevron" />
            </button>
          )}
        </div>

        <p class="muted settings-note">{t('settings.motion')}</p>

        <div class="dialog-actions">
          <button class="btn primary" onClick={onClose}>
            {t('common.close')}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
