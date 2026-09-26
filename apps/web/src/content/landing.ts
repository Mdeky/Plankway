import type { Lang } from '../i18n.ts';

/**
 * The "About Plankway" text on the home screen. Also written into the pre-rendered
 * index.html (see build/prerender.ts), so search engines read it without running the app.
 * Written for people, but it names what they search for: bridges puzzle, Hashi,
 * Hashiwokakero, daily logic puzzle.
 */
export interface Landing {
  heading: string;
  intro: string;
  stepsTitle: string;
  steps: string[];
  featuresTitle: string;
  features: string[];
  faqTitle: string;
  faq: [question: string, answer: string][];
}

const en: Landing = {
  heading: 'Plankway: a free daily bridges puzzle',
  intro:
    'Plankway is a free logic puzzle game you play right in your browser. Connect the islands with bridges so every island gets exactly the number of bridges shown on it. It is the classic Hashiwokakero (Hashi) puzzle, with reefs as a twist: a new puzzle every day, and an endless mode that gets harder level by level.',
  stepsTitle: 'How to play',
  steps: [
    'Draw bridges between islands: straight lines, horizontal or vertical, and at most two between the same islands.',
    'Every island needs exactly its number of bridges. Bridges may not cross each other and can never pass over a reef.',
    'Connect all islands into one network. Every puzzle has exactly one solution that you can find with pure logic.',
  ],
  featuresTitle: 'What you get',
  features: [
    'One new daily puzzle for everyone, from easy on Monday to hard on Sunday',
    'Endless mode: the same levels for every player, harder as you go',
    'Leaderboards for each day and level, per country and with your friends',
    'Hints when you are stuck, offline play, and an app you can add to your home screen',
    'Free, no download, no account needed',
  ],
  faqTitle: 'Questions',
  faq: [
    [
      'Is Plankway free?',
      'Yes. Plankway is free to play in any browser, on a phone, tablet or computer. There is nothing to download and you do not need an account.',
    ],
    [
      'What is a bridges puzzle?',
      'A bridges puzzle, also called Hashiwokakero or Hashi, is a Japanese logic puzzle. Numbered islands must be connected with bridges so each island has exactly as many bridges as its number, without crossings, until all islands form one connected group.',
    ],
    [
      'Is there a new puzzle every day?',
      'Yes. Every day there is one Plankway, the same for everyone. Keep your streak going and compare your time on the daily leaderboard.',
    ],
    ['Can I play offline?', 'Yes. Once loaded, Plankway works offline, and you can add it to your home screen like an app.'],
  ],
};

const nl: Landing = {
  heading: 'Plankway: een gratis dagelijkse bruggenpuzzel',
  intro:
    'Plankway is een gratis logische puzzel die je gewoon in je browser speelt. Verbind de eilanden met bruggen zodat elk eiland precies zoveel bruggen krijgt als het getal erop. Het is de klassieke Hashiwokakero-puzzel (Hashi), met riffen als twist: elke dag een nieuwe puzzel, en een eindeloze modus die level na level moeilijker wordt.',
  stepsTitle: 'Hoe speel je',
  steps: [
    'Leg bruggen tussen eilanden: rechte lijnen, horizontaal of verticaal, en maximaal twee tussen dezelfde eilanden.',
    'Elk eiland heeft precies zijn aantal bruggen nodig. Bruggen mogen elkaar niet kruisen en nooit over een rif lopen.',
    'Verbind alle eilanden tot één netwerk. Elke puzzel heeft precies één oplossing die je met pure logica vindt.',
  ],
  featuresTitle: 'Wat je krijgt',
  features: [
    'Elke dag één nieuwe puzzel voor iedereen, van makkelijk op maandag tot moeilijk op zondag',
    'Eindeloos: dezelfde levels voor elke speler, steeds moeilijker',
    'Klassementen per dag en per level, per land en met je vrienden',
    'Hints als je vastzit, offline spelen, en een app voor je beginscherm',
    'Gratis, geen download, geen account nodig',
  ],
  faqTitle: 'Vragen',
  faq: [
    [
      'Is Plankway gratis?',
      'Ja. Plankway speel je gratis in elke browser, op je gsm, tablet of computer. Je hoeft niets te downloaden en geen account te maken.',
    ],
    [
      'Wat is een bruggenpuzzel?',
      'Een bruggenpuzzel, ook Hashiwokakero of Hashi genoemd, is een Japanse logische puzzel. Genummerde eilanden verbind je met bruggen zodat elk eiland precies zoveel bruggen heeft als zijn getal, zonder kruisingen, tot alle eilanden één geheel vormen.',
    ],
    [
      'Is er elke dag een nieuwe puzzel?',
      'Ja. Elke dag is er één Plankway, dezelfde voor iedereen. Houd je reeks vol en vergelijk je tijd in het daily-klassement.',
    ],
    ['Kan ik offline spelen?', 'Ja. Eenmaal geladen werkt Plankway offline, en je kan het als app op je beginscherm zetten.'],
  ],
};

export function landing(lang: Lang): Landing {
  return lang === 'nl' ? nl : en;
}
