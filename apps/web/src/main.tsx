import { render } from 'preact';
import { App } from './app.tsx';
import { getLang, setLang } from './i18n.ts';
import './styles.css';

setLang(getLang());
render(<App />, document.getElementById('app')!);
