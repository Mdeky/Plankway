import { useState } from 'preact/hooks';
import { getThemePref, setThemePref, type ThemePref } from '../game/theme.ts';
import { t, type MessageKey } from '../i18n.ts';
import { Icon, type IconName } from './icons.tsx';

/** Auto / light / dark, used in the profile and the settings. */
export function ThemeSwitch() {
  const [pref, setPref] = useState<ThemePref>(getThemePref);
  const options: [ThemePref, IconName, MessageKey][] = [
    ['system', 'auto', 'profile.theme.auto'],
    ['light', 'sun', 'profile.theme.light'],
    ['dark', 'moon', 'profile.theme.dark'],
  ];
  return (
    <div class="segmented theme-switch" role="group" aria-label={t('settings.theme')}>
      {options.map(([value, icon, label]) => (
        <button
          key={value}
          class={pref === value ? 'active' : ''}
          aria-pressed={pref === value}
          onClick={() => {
            setPref(value);
            setThemePref(value);
          }}
        >
          <Icon name={icon} />
          {t(label)}
        </button>
      ))}
    </div>
  );
}
