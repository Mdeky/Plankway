import type { Lang } from '../i18n.ts';
import { LEGAL } from './legal.ts';

/**
 * Long-form page content (how to play, about, privacy, cookies) in both languages.
 * A section body is a list of paragraphs; a nested array is a bullet list.
 * The privacy and cookie texts describe what the app and API actually do — keep them in
 * sync when the data handling changes. DRAFT: have them reviewed before launch.
 */
export type PageId = 'how-to-play' | 'about' | 'privacy' | 'cookies';

export interface Section {
  h: string;
  body: (string | string[])[];
}

export interface Page {
  title: string;
  intro?: string;
  sections: Section[];
  updated?: boolean;
}

const L = LEGAL;

const nl: Record<PageId, Page> = {
  'how-to-play': {
    title: 'Hoe speel je Plankway',
    intro: 'Plankway is een logische puzzel: verbind alle eilanden met bruggen. Je hoeft nooit te gokken.',
    sections: [
      {
        h: 'De regels',
        body: [
          [
            'Het getal op een eiland is het aantal bruggen dat eraan vastzit.',
            'Bruggen lopen recht, horizontaal of verticaal, tussen twee eilanden.',
            'Tussen twee eilanden liggen hoogstens twee bruggen.',
            'Bruggen kruisen elkaar niet en lopen niet over een eiland.',
            'Riffen zijn rotsen in het water: een brug kan nooit over een rif.',
            'Op het einde vormen alle eilanden één verbonden netwerk.',
          ],
        ],
      },
      {
        h: 'Bediening',
        body: [
          [
            'Sleep van een eiland naar een ander (of gewoon in een richting) om een brug te leggen.',
            'Nog eens slepen geeft een dubbele brug. Tik op een brug om ze weg te halen.',
            'Of tik op een eiland en daarna op een buur.',
            'Toetsenbord: pijltjes om te bewegen, spatie om een eiland te kiezen, een pijltje om te bouwen, Esc om te annuleren.',
          ],
        ],
      },
      {
        h: 'Tips',
        body: [
          [
            'Begin bij eilanden met weinig buren: een 4 met twee buren krijgt twee dubbele bruggen.',
            'Een 1 krijgt nooit een dubbele brug.',
            'Twee eilanden met een 1 mogen niet met elkaar verbonden worden: dan raken ze afgesneden.',
            'Kijk naar de riffen: eilanden die op één lijn liggen, kunnen toch onbereikbaar zijn.',
            'Een eiland met een geel vlaggetje is af. Een rode rand met "!" betekent: te veel bruggen.',
            'Een oranje vlaggetje betekent: deze groep eilanden is af, maar ligt afgesneden van de rest. Alle eilanden moeten één netwerk vormen.',
          ],
        ],
      },
      {
        h: 'Daily en Eindeloos',
        body: [
          'Elke dag is er één Plankway, dezelfde voor iedereen. Maandag is het makkelijkst, zondag het moeilijkst. Je reeks groeit met elke dag dat je hem oplost.',
          'In Eindeloos speel je zoveel puzzels als je wil, steeds een beetje moeilijker. Daar mag je hints gebruiken zoveel je wil.',
        ],
      },
    ],
  },
  about: {
    title: 'Over Plankway',
    sections: [
      {
        h: 'Wat is Plankway?',
        body: [
          'Plankway is een korte, dagelijkse puzzel gebaseerd op het klassieke bruggenpuzzeltje (Hashiwokakero), met een eigen twist: riffen. Elke puzzel heeft precies één oplossing en is op te lossen met pure logica.',
          'Een puzzel duurt een paar minuten. Je kan ook offline spelen en de app op je gsm installeren.',
        ],
      },
      {
        h: 'Gratis, met advertenties',
        body: [
          'Plankway is gratis. Om de kosten te dekken tonen we advertenties onder het speelveld en in het resultaatscherm — nooit op het speelveld zelf en nooit midden in een puzzel.',
        ],
      },
      {
        h: 'Wie zit erachter?',
        body: [`Plankway wordt gemaakt door ${L.controller}. Vragen of ideeën? Mail naar ${L.email}.`],
      },
    ],
  },
  privacy: {
    title: 'Privacybeleid',
    updated: true,
    intro: 'Plankway verzamelt zo weinig mogelijk. Je hebt geen account, e-mailadres of wachtwoord nodig.',
    sections: [
      {
        h: 'Wie is verantwoordelijk?',
        body: [
          `${L.controller}, ${L.address}${L.companyNumber ? ` (${L.companyNumber})` : ''}. Contact over privacy: ${L.email}.`,
        ],
      },
      {
        h: 'Wat we verwerken en waarom',
        body: [
          [
            'Spelgegevens op je toestel: je voortgang, daily-resultaten, statistieken en instellingen worden in de opslag van je browser bewaard (localStorage en IndexedDB). Dat is nodig om het spel te laten werken en blijft op je toestel.',
            'Anoniem profiel: bij je eerste bezoek maken we een profiel met een willekeurige code, zodat je reeks bewaard blijft en je ze op een ander toestel kan verderzetten. Je toestel krijgt een geheime sleutel in een cookie; op onze server bewaren we daarvan enkel een onomkeerbare hash. Hetzelfde geldt voor je herstelcode.',
            'Daily-resultaten: per opgeloste daily het puzzelnummer, je tijd, het aantal undo’s en hints, en het tijdstip. Je oplossing wordt gecontroleerd maar niet bewaard.',
            'Eindeloos-resultaten: per opgelost level het levelnummer, je tijd, het aantal hints en het tijdstip. Om tijden te kunnen controleren, geeft de server bij de start van een puzzel een ondertekend starttijdstip mee; dat wordt niet apart bewaard.',
            'IP-adres: nodig om de website te leveren (door onze hostingpartner Cloudflare). Onze eigen server gebruikt het enkel als onomkeerbare hash om misbruik te beperken (maximaal aantal aanvragen per uur) en wist die na 24 uur.',
            'Bezoekersstatistieken: we gebruiken Cloudflare Web Analytics. Dat werkt zonder cookies en maakt geen profielen van bezoekers.',
            'Advertenties: we tonen advertenties via Google AdSense. Voor gepersonaliseerde advertenties vragen we eerst je toestemming via een gecertificeerde toestemmingsbanner (IAB TCF v2.2). Zonder toestemming krijg je niet-gepersonaliseerde of geen advertenties.',
          ],
        ],
      },
      {
        h: 'Rechtsgronden',
        body: [
          [
            'Het leveren van het spel en je profiel: noodzakelijk om de dienst te leveren die je gebruikt.',
            'Misbruik beperken en beveiliging: ons gerechtvaardigd belang.',
            'Gepersonaliseerde advertenties en advertentiecookies: je toestemming, die je altijd kan intrekken.',
          ],
        ],
      },
      {
        h: 'Hoe lang we gegevens bewaren',
        body: [
          [
            'Je profiel en daily-resultaten: tot je ze zelf wist via Profiel → Mijn data wissen.',
            'Gehashte IP-adressen voor misbruikbeperking: maximaal 24 uur.',
            'Gegevens op je toestel: tot je ze wist in de app of in je browser.',
          ],
        ],
      },
      {
        h: 'Wie je gegevens nog ziet',
        body: [
          'Cloudflare (hosting, database en statistieken) verwerkt gegevens in onze opdracht. Google treedt voor advertenties op als zelfstandige verantwoordelijke; lees hoe Google gegevens gebruikt op policies.google.com/technologies/partner-sites. Deze partijen kunnen gegevens buiten de EU verwerken, met de wettelijke waarborgen (EU-standaardcontractbepalingen of het EU-VS Data Privacy Framework).',
          'We verkopen je gegevens nooit.',
        ],
      },
      {
        h: 'Je rechten',
        body: [
          'Je hebt recht op inzage, verbetering, wissing, beperking, bezwaar en overdraagbaarheid van je gegevens. Wissen kan meteen in de app (Profiel → Mijn data wissen). Je toestemming voor advertenties pas je aan via Instellingen → Privacykeuzes.',
          `Voor andere vragen: ${L.email}. Je kan ook klacht indienen bij de toezichthouder, in België de Gegevensbeschermingsautoriteit (gegevensbeschermingsautoriteit.be), of bij die van je eigen land.`,
        ],
      },
      {
        h: 'Wijzigingen',
        body: ['Als we dit beleid aanpassen, passen we de datum hieronder aan. Bij belangrijke wijzigingen laten we het in de app weten.'],
      },
    ],
  },
  cookies: {
    title: 'Cookiebeleid',
    updated: true,
    intro: 'Plankway gebruikt zo weinig mogelijk cookies. Hieronder staat precies welke.',
    sections: [
      {
        h: 'Noodzakelijk (geen toestemming nodig)',
        body: [
          [
            'plankway_token — onze eigen cookie met de geheime sleutel van je anonieme profiel. Enkel leesbaar door onze server (HttpOnly, Secure). Bewaard tot 400 dagen.',
            'Opslag in je browser (localStorage/IndexedDB) voor je voortgang, statistieken, instellingen en herstelcode. Dat zijn technisch geen cookies, maar ze blijven ook op je toestel.',
          ],
        ],
      },
      {
        h: 'Statistieken',
        body: ['Geen cookies: Cloudflare Web Analytics werkt cookieloos.'],
      },
      {
        h: 'Advertenties (enkel met je keuze)',
        body: [
          'Voor advertenties gebruiken Google en zijn partners cookies en vergelijkbare technieken, bijvoorbeeld om je keuze te onthouden (zoals FCCDCF) en om advertenties te tonen en te meten (zoals __gads en __gpi). Die worden pas geplaatst als de advertenties actief zijn, en voor gepersonaliseerde advertenties enkel met je toestemming.',
        ],
      },
      {
        h: 'Je keuzes beheren',
        body: [
          [
            'Advertentietoestemming aanpassen of intrekken: Instellingen → Privacykeuzes.',
            'Al je Plankway-gegevens wissen: Profiel → Mijn data wissen.',
            'Cookies kan je ook in je browser bekijken en verwijderen.',
          ],
        ],
      },
    ],
  },
};

const en: Record<PageId, Page> = {
  'how-to-play': {
    title: 'How to play Plankway',
    intro: 'Plankway is a logic puzzle: connect all islands with bridges. You never need to guess.',
    sections: [
      {
        h: 'The rules',
        body: [
          [
            'The number on an island is how many bridges touch it.',
            'Bridges run straight, horizontally or vertically, between two islands.',
            'At most two bridges connect the same two islands.',
            'Bridges don’t cross each other and don’t run over an island.',
            'Reefs are rocks in the water: a bridge can never pass over a reef.',
            'In the end all islands form one connected network.',
          ],
        ],
      },
      {
        h: 'Controls',
        body: [
          [
            'Drag from one island to another (or just in a direction) to build a bridge.',
            'Drag again for a double bridge. Tap a bridge to remove it.',
            'Or tap an island and then a neighbour.',
            'Keyboard: arrows to move, space to pick an island, an arrow to build, Esc to cancel.',
          ],
        ],
      },
      {
        h: 'Tips',
        body: [
          [
            'Start with islands that have few neighbours: a 4 with two neighbours gets two double bridges.',
            'A 1 never gets a double bridge.',
            'Two 1s may not be connected to each other: they would be cut off.',
            'Watch the reefs: islands that line up can still be unreachable.',
            'An island with a yellow flag is complete. A red ring with "!" means too many bridges.',
            'An orange flag means: this group of islands is complete but cut off from the rest. All islands must form one network.',
          ],
        ],
      },
      {
        h: 'Daily and Endless',
        body: [
          'Every day there is one Plankway, the same for everyone. Monday is the easiest, Sunday the hardest. Your streak grows with every day you solve it.',
          'In Endless you play as many puzzles as you like, each a little harder. Use as many hints as you want there.',
        ],
      },
    ],
  },
  about: {
    title: 'About Plankway',
    sections: [
      {
        h: 'What is Plankway?',
        body: [
          'Plankway is a short daily puzzle based on the classic bridges puzzle (Hashiwokakero), with a twist of its own: reefs. Every puzzle has exactly one solution and can be solved with pure logic.',
          'A puzzle takes a few minutes. You can also play offline and install the app on your phone.',
        ],
      },
      {
        h: 'Free, with ads',
        body: [
          'Plankway is free. To cover the costs we show ads below the board and on the result screen — never on the board itself and never in the middle of a puzzle.',
        ],
      },
      {
        h: 'Who makes it?',
        body: [`Plankway is made by ${L.controller}. Questions or ideas? Write to ${L.email}.`],
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    updated: true,
    intro: 'Plankway collects as little as possible. You don’t need an account, e-mail address or password.',
    sections: [
      {
        h: 'Who is responsible?',
        body: [`${L.controller}, ${L.address}${L.companyNumber ? ` (${L.companyNumber})` : ''}. Privacy contact: ${L.email}.`],
      },
      {
        h: 'What we process and why',
        body: [
          [
            'Game data on your device: your progress, daily results, statistics and settings are kept in your browser’s storage (localStorage and IndexedDB). This is needed for the game to work and stays on your device.',
            'Anonymous profile: on your first visit we create a profile with a random id, so your streak is kept and you can continue it on another device. Your device gets a secret key in a cookie; our server only stores an irreversible hash of it. The same goes for your recovery code.',
            'Daily results: for each solved daily the puzzle number, your time, the number of undos and hints, and when you solved it. Your solution is checked but not stored.',
            'Endless results: for each solved level the level number, your time, the number of hints and when you solved it. To check times, the server hands out a signed start time when a puzzle begins; it is not stored separately.',
            'IP address: needed to deliver the website (by our hosting partner Cloudflare). Our own server only uses it as an irreversible hash to limit abuse (a maximum number of requests per hour) and deletes it after 24 hours.',
            'Visitor statistics: we use Cloudflare Web Analytics, which works without cookies and doesn’t build visitor profiles.',
            'Advertising: we show ads through Google AdSense. For personalized ads we first ask your consent through a certified consent banner (IAB TCF v2.2). Without consent you get non-personalized ads or none.',
          ],
        ],
      },
      {
        h: 'Legal bases',
        body: [
          [
            'Providing the game and your profile: necessary to deliver the service you use.',
            'Limiting abuse and security: our legitimate interest.',
            'Personalized ads and ad cookies: your consent, which you can withdraw at any time.',
          ],
        ],
      },
      {
        h: 'How long we keep data',
        body: [
          [
            'Your profile and daily results: until you delete them via Profile → Delete my data.',
            'Hashed IP addresses for abuse limiting: at most 24 hours.',
            'Data on your device: until you delete it in the app or in your browser.',
          ],
        ],
      },
      {
        h: 'Who else sees your data',
        body: [
          'Cloudflare (hosting, database and statistics) processes data on our behalf. For ads, Google acts as an independent controller; see how Google uses data at policies.google.com/technologies/partner-sites. These parties may process data outside the EU with the legal safeguards (EU standard contractual clauses or the EU–US Data Privacy Framework).',
          'We never sell your data.',
        ],
      },
      {
        h: 'Your rights',
        body: [
          'You have the right to access, correct, erase, restrict, object to and port your data. Deleting is instant in the app (Profile → Delete my data). You can change your ad consent in Settings → Privacy choices.',
          `For anything else: ${L.email}. You can also lodge a complaint with a supervisory authority — in Belgium the Data Protection Authority (dataprotectionauthority.be) — or the one in your own country.`,
        ],
      },
      {
        h: 'Changes',
        body: ['When we change this policy we update the date below. We announce important changes in the app.'],
      },
    ],
  },
  cookies: {
    title: 'Cookie policy',
    updated: true,
    intro: 'Plankway uses as few cookies as possible. Here is exactly which ones.',
    sections: [
      {
        h: 'Necessary (no consent needed)',
        body: [
          [
            'plankway_token — our own cookie with the secret key of your anonymous profile. Only readable by our server (HttpOnly, Secure). Kept for up to 400 days.',
            'Browser storage (localStorage/IndexedDB) for your progress, statistics, settings and recovery code. Technically not cookies, but they also stay on your device.',
          ],
        ],
      },
      {
        h: 'Statistics',
        body: ['No cookies: Cloudflare Web Analytics is cookieless.'],
      },
      {
        h: 'Advertising (only with your choice)',
        body: [
          'For ads, Google and its partners use cookies and similar technologies, for example to remember your choice (such as FCCDCF) and to show and measure ads (such as __gads and __gpi). They are only set once ads are active, and for personalized ads only with your consent.',
        ],
      },
      {
        h: 'Managing your choices',
        body: [
          [
            'Change or withdraw ad consent: Settings → Privacy choices.',
            'Delete all your Plankway data: Profile → Delete my data.',
            'You can also view and delete cookies in your browser.',
          ],
        ],
      },
    ],
  },
};

export function page(lang: Lang, id: PageId): Page {
  return (lang === 'nl' ? nl : en)[id];
}
