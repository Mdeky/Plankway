import { useState } from 'preact/hooks';
import { getLang, setLang, type Lang } from './i18n.ts';
import { goBack, navigate, useRoute } from './route.ts';
import { DailyGame } from './ui/DailyGame.tsx';
import { EndlessGame } from './ui/EndlessGame.tsx';
import { Home } from './ui/Home.tsx';
import { HowTo } from './ui/HowTo.tsx';
import { LazyInfoPage } from './ui/LazyInfoPage.tsx';
import { SettingsDialog } from './ui/SettingsDialog.tsx';
import { UpdateBanner } from './ui/UpdateBanner.tsx';

export function App() {
  const route = useRoute();
  const [howTo, setHowTo] = useState(false);
  const [settings, setSettings] = useState(false);
  // Changing the language re-mounts the tree so every string is re-rendered.
  const [lang, setLangState] = useState<Lang>(getLang);
  const changeLang = (next: Lang) => {
    setLang(next, true);
    setLangState(next);
  };

  return (
    <div key={lang}>
      {route === 'home' && (
        <Home
          onDaily={() => navigate('daily')}
          onEndless={() => navigate('endless')}
          onHowTo={() => setHowTo(true)}
          onSettings={() => setSettings(true)}
        />
      )}
      {route === 'daily' && <DailyGame onExit={goBack} />}
      {route === 'endless' && <EndlessGame onExit={goBack} />}
      {(route === 'how-to-play' || route === 'about' || route === 'privacy' || route === 'cookies') && <LazyInfoPage id={route} />}
      {howTo && <HowTo onClose={() => setHowTo(false)} />}
      <UpdateBanner />
      {settings && <SettingsDialog onClose={() => setSettings(false)} onLangChange={changeLang} />}
    </div>
  );
}
