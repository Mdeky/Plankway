import { useEffect, useState } from 'preact/hooks';
import { afterSignIn } from './game/sync.ts';
import { markTutorialSeen, tutorialSeen } from './game/storage.ts';
import { getLang, setLang, type Lang, type MessageKey } from './i18n.ts';
import { goBack, navigate, useRoute } from './route.ts';
import { DailyGame } from './ui/DailyGame.tsx';
import { EndlessGame } from './ui/EndlessGame.tsx';
import { Home } from './ui/Home.tsx';
import { HowTo } from './ui/HowTo.tsx';
import { LazyInfoPage } from './ui/LazyInfoPage.tsx';
import { LazyLeaderboard } from './ui/LazyLeaderboard.tsx';
import { SettingsDialog } from './ui/SettingsDialog.tsx';
import { UpdateBanner } from './ui/UpdateBanner.tsx';

export function App() {
  const route = useRoute();
  // New players get the tutorial once, on the home screen.
  const [howTo, setHowTo] = useState(() => route === 'home' && !tutorialSeen() && !location.search.includes('login='));
  const [settings, setSettings] = useState(false);
  const [profileNotice, setProfileNotice] = useState<MessageKey | null>(null);

  // Back from a sign-in (?login=…): pull in the account's progress, then show the profile.
  useEffect(() => {
    const url = new URL(location.href);
    const outcome = url.searchParams.get('login');
    if (!outcome) return;
    url.searchParams.delete('login');
    history.replaceState(history.state, '', url.pathname + url.search + url.hash);
    if (outcome === 'new' || outcome === 'welcome-back') {
      void afterSignIn().then((me) => {
        if (!me) setProfileNotice('account.error.offline');
        else if (!me.account?.displayName) setProfileNotice('account.welcome');
        else setProfileNotice('account.welcomeBack');
      });
    } else {
      setProfileNotice(outcome === 'cancelled' ? 'account.cancelled' : 'account.error.sign-in');
    }
  }, []);
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
          onLeaderboard={() => navigate('leaderboard')}
          onHowTo={() => setHowTo(true)}
          onSettings={() => setSettings(true)}
          profileNotice={profileNotice}
        />
      )}
      {route === 'daily' && <DailyGame onExit={goBack} />}
      {route === 'endless' && <EndlessGame onExit={goBack} />}
      {route === 'leaderboard' && <LazyLeaderboard />}
      {(route === 'how-to-play' || route === 'about' || route === 'privacy' || route === 'cookies' || route === 'terms') && (
        <LazyInfoPage id={route} />
      )}
      {howTo && (
        <HowTo
          onClose={() => {
            markTutorialSeen();
            setHowTo(false);
          }}
        />
      )}
      <UpdateBanner />
      {settings && <SettingsDialog onClose={() => setSettings(false)} onLangChange={changeLang} />}
    </div>
  );
}
