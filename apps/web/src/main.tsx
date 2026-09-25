import { render } from 'preact';
import { App } from './app.tsx';
import { syncResults } from './game/sync.ts';
import { applyTheme } from './game/theme.ts';
import { getLang, setLang } from './i18n.ts';
import { registerServiceWorker } from './pwa.ts';
import './styles.css';

applyTheme();
setLang(getLang());
render(<App />, document.getElementById('app')!);

// Anonymous profile + catch up on results solved offline.
void syncResults();
window.addEventListener('online', () => void syncResults());

// Offline play and installability (production builds only).
void registerServiceWorker();
