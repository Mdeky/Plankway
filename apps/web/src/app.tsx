import { useState } from 'preact/hooks';
import { getLang, setLang, type Lang } from './i18n.ts';
import { DailyGame } from './ui/DailyGame.tsx';
import { EndlessGame } from './ui/EndlessGame.tsx';
import { Home } from './ui/Home.tsx';
import { HowTo } from './ui/HowTo.tsx';
import { SettingsDialog } from './ui/SettingsDialog.tsx';
import { UpdateBanner } from './ui/UpdateBanner.tsx';

type Screen = 'home' | 'daily' | 'endless';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [howTo, setHowTo] = useState(false);
  const [settings, setSettings] = useState(false);
  // Changing the language re-mounts the tree so every string is re-rendered.
  const [lang, setLangState] = useState<Lang>(getLang);
  const changeLang = (next: Lang) => {
    setLang(next, true);
    setLangState(next);
  };
  const home = () => setScreen('home');

  return (
    <div key={lang}>
      {screen === 'home' && (
        <Home
          onDaily={() => setScreen('daily')}
          onEndless={() => setScreen('endless')}
          onHowTo={() => setHowTo(true)}
          onSettings={() => setSettings(true)}
        />
      )}
      {screen === 'daily' && <DailyGame onExit={home} />}
      {screen === 'endless' && <EndlessGame onExit={home} />}
      {howTo && <HowTo onClose={() => setHowTo(false)} />}
      <UpdateBanner />
      {settings && <SettingsDialog onClose={() => setSettings(false)} onLangChange={changeLang} />}
    </div>
  );
}
