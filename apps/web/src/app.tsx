import { useState } from 'preact/hooks';
import { DailyGame } from './ui/DailyGame.tsx';
import { EndlessGame } from './ui/EndlessGame.tsx';
import { Home } from './ui/Home.tsx';
import { HowTo } from './ui/HowTo.tsx';

type Screen = 'home' | 'daily' | 'endless';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [howTo, setHowTo] = useState(false);
  const home = () => setScreen('home');

  return (
    <>
      {screen === 'home' && (
        <Home onDaily={() => setScreen('daily')} onEndless={() => setScreen('endless')} onHowTo={() => setHowTo(true)} />
      )}
      {screen === 'daily' && <DailyGame onExit={home} />}
      {screen === 'endless' && <EndlessGame onExit={home} />}
      {howTo && <HowTo onClose={() => setHowTo(false)} />}
    </>
  );
}
