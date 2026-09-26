import type { Route } from '../route.ts';

/**
 * Page titles and descriptions for search results and link previews. Used by the
 * pre-rendered HTML (build/prerender.ts) and by the app when it changes screens, so the
 * title Google reads after rendering matches the one in the HTML.
 */
export const SEO: Record<Route, { title: string; description: string }> = {
  home: {
    title: 'Plankway – Free Daily Bridges Puzzle Game (Hashi)',
    description:
      'Play Plankway, a free daily bridges puzzle (Hashiwokakero). Connect the islands with bridges and mind the reefs. A new logic puzzle every day, endless mode, no download.',
  },
  daily: {
    title: 'Today’s Plankway – Daily Bridges Puzzle',
    description:
      'Play today’s Plankway: one new bridges puzzle a day, the same for everyone. Connect the islands, keep your streak and beat the daily leaderboard.',
  },
  endless: {
    title: 'Plankway Endless – Bridges Puzzle Levels',
    description: 'Endless mode: bridges puzzle levels that get harder as you go, the same for every player. Free Hashi logic puzzles in your browser.',
  },
  leaderboard: {
    title: 'Plankway Leaderboard – Fastest Bridges Puzzle Times',
    description:
      'The fastest Plankway players: daily puzzle times, the furthest endless level and the fastest time per level, worldwide, per country and among friends.',
  },
  'how-to-play': {
    title: 'How to Play Plankway – Bridges Puzzle Rules and Tips',
    description:
      'The rules of Plankway, the bridges puzzle (Hashiwokakero): how to connect the islands, what reefs do, the controls and tips to solve every puzzle with logic.',
  },
  about: {
    title: 'About Plankway – a Free Daily Logic Puzzle',
    description:
      'What Plankway is: a short, free daily logic puzzle based on the classic bridges puzzle, with reefs as a twist. Who makes it and how it stays free.',
  },
  privacy: {
    title: 'Privacy Policy · Plankway',
    description: 'How Plankway handles your data: an anonymous profile, optional sign-in with Google, leaderboards and ads.',
  },
  cookies: { title: 'Cookie Policy · Plankway', description: 'Which cookies and browser storage Plankway uses, and why.' },
  terms: { title: 'Terms of Use · Plankway', description: 'The terms for playing Plankway: your profile, fair play, ownership and liability.' },
};
