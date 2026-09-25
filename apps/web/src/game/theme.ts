export type ThemePref = 'system' | 'light' | 'dark';

const KEY = 'bridgle.theme.v1';
/** Fired on window when the theme changes, so the canvas can re-read its colours. */
export const THEME_EVENT = 'bridgle-theme';

export function getThemePref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

/** Applies a theme: `data-theme` on <html> overrides prefers-color-scheme. */
export function applyTheme(pref: ThemePref = getThemePref()): void {
  const root = document.documentElement;
  if (pref === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', pref);
  const dark = pref === 'dark' || (pref === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]:not([media])')?.setAttribute('content', dark ? '#0f1c33' : '#7fd1d6');
  window.dispatchEvent(new Event(THEME_EVENT));
}

export function setThemePref(pref: ThemePref): void {
  try {
    if (pref === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, pref);
  } catch {
    // ignore
  }
  applyTheme(pref);
}
