import { useEffect, useState } from 'preact/hooks';

/** Every screen has its own URL, so the phone's back button and deep links work. */
export type Route = 'home' | 'daily' | 'endless' | 'leaderboard' | 'how-to-play' | 'about' | 'privacy' | 'cookies' | 'terms';

export const PATHS: Record<Route, string> = {
  home: '/',
  daily: '/daily',
  endless: '/endless',
  leaderboard: '/leaderboard',
  'how-to-play': '/how-to-play',
  about: '/about',
  privacy: '/privacy',
  cookies: '/cookies',
  terms: '/terms',
};

const EVENT = 'bridgle-route';

export function routeFromPath(pathname: string): Route {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const hit = (Object.entries(PATHS) as [Route, string][]).find(([, p]) => p === clean);
  return hit ? hit[0] : 'home';
}

export function navigate(route: Route): void {
  if (routeFromPath(location.pathname) === route) return;
  history.pushState({ bridgle: true }, '', PATHS[route]);
  window.dispatchEvent(new Event(EVENT));
  window.scrollTo(0, 0);
}

/** Back within the app if we navigated here ourselves, otherwise to the home screen. */
export function goBack(): void {
  if ((history.state as { bridgle?: boolean } | null)?.bridgle) history.back();
  else {
    history.replaceState(null, '', PATHS.home);
    window.dispatchEvent(new Event(EVENT));
  }
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => routeFromPath(location.pathname));
  useEffect(() => {
    const sync = () => setRoute(routeFromPath(location.pathname));
    window.addEventListener('popstate', sync);
    window.addEventListener(EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener(EVENT, sync);
    };
  }, []);
  return route;
}
