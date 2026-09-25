import { useState } from 'preact/hooks';
import { getLang, t, type Lang } from '../i18n.ts';
import { isSoundOn, setSoundOn } from '../game/sound.ts';
import { getThemePref, setThemePref, type ThemePref } from '../game/theme.ts';
import { Dialog } from './Dialog.tsx';

interface Props {
  onClose(): void;
  onLangChange(lang: Lang): void;
}

export function SettingsDialog({ onClose, onLangChange }: Props) {
  const [theme, setTheme] = useState<ThemePref>(getThemePref);
  const [sound, setSound] = useState(isSoundOn);
  const lang = getLang();

  const themes: [ThemePref, string][] = [
    ['system', t('settings.themeSystem')],
    ['light', t('settings.themeLight')],
    ['dark', t('settings.themeDark')],
  ];
  const langs: [Lang, string][] = [
    ['en', 'English'],
    ['nl', 'Nederlands'],
  ];

  return (
    <Dialog title={t('settings.title')} onClose={onClose}>
      <fieldset class="choice">
        <legend>{t('settings.theme')}</legend>
        {themes.map(([value, label]) => (
          <label key={value}>
            <input
              type="radio"
              name="theme"
              checked={theme === value}
              onChange={() => {
                setTheme(value);
                setThemePref(value);
              }}
            />
            {label}
          </label>
        ))}
      </fieldset>

      <fieldset class="choice">
        <legend>{t('settings.sound')}</legend>
        <label>
          <input
            type="checkbox"
            checked={sound}
            onChange={(e) => {
              const on = (e.target as HTMLInputElement).checked;
              setSound(on);
              setSoundOn(on);
            }}
          />
          {t('settings.soundOn')}
        </label>
      </fieldset>

      <fieldset class="choice">
        <legend>{t('settings.language')}</legend>
        {langs.map(([value, label]) => (
          <label key={value} lang={value}>
            <input type="radio" name="lang" checked={lang === value} onChange={() => onLangChange(value)} />
            {label}
          </label>
        ))}
      </fieldset>

      <p class="muted">{t('settings.motion')}</p>

      <div class="dialog-actions">
        <button class="btn primary" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Dialog>
  );
}
