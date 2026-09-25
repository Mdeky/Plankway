import { render } from 'preact';
import { App } from './app.tsx';
import { syncResults } from './game/sync.ts';
import { getLang, setLang } from './i18n.ts';
import './styles.css';

setLang(getLang());
render(<App />, document.getElementById('app')!);

// Anonymous profile + catch up on results solved offline.
void syncResults();
window.addEventListener('online', () => void syncResults());
