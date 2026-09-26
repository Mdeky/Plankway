import { useEffect, useState } from 'preact/hooks';

type Screen = typeof import('./LeaderboardScreen.tsx').LeaderboardScreen;

let loaded: Screen | null = null;

/** The leaderboard loads on demand, keeping the start bundle small. */
export function LazyLeaderboard() {
  const [Screen, setScreen] = useState<Screen | null>(() => loaded);
  useEffect(() => {
    if (Screen) return;
    void import('./LeaderboardScreen.tsx').then((m) => {
      loaded = m.LeaderboardScreen;
      setScreen(() => m.LeaderboardScreen);
    });
  }, []);
  return Screen ? <Screen /> : <main class="screen leaderboard" aria-busy="true" />;
}
