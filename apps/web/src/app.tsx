import { useState } from 'preact/hooks';
import { EndlessGame } from './ui/EndlessGame.tsx';
import { Home } from './ui/Home.tsx';
import { HowTo } from './ui/HowTo.tsx';

type Screen = 'home' | 'endless';

export function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [howTo, setHowTo] = useState(false);

  return (
    <>
      {screen === 'home' && <Home onEndless={() => setScreen('endless')} onHowTo={() => setHowTo(true)} />}
      {screen === 'endless' && <EndlessGame onExit={() => setScreen('home')} />}
      {howTo && <HowTo onClose={() => setHowTo(false)} />}
    </>
  );
}
