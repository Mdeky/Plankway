import type { TechniqueId } from '@bridgle/core';

const en = {
  'app.title': 'Bridgle',
  'app.tagline': 'Connect the islands. Mind the reefs.',
  'menu.endless': 'Endless',
  'menu.endless.sub': 'Level {level} · best {best}',
  'menu.howto': 'How to play',
  'howto.title': 'How to play',
  'howto.1': 'Connect every island with bridges. The number on an island is how many bridges touch it.',
  'howto.2': 'Bridges run straight, horizontally or vertically. At most two bridges between the same islands.',
  'howto.3': 'Bridges may not cross each other or run over an island.',
  'howto.4': 'Reefs are rocks in the water: a bridge can never pass over a reef.',
  'howto.5': 'In the end all islands form one connected network.',
  'howto.controls':
    'Drag from one island to another to build a bridge. Drag again for a double bridge, a third time to remove it. You can also tap an island and then a neighbour, or tap a bridge. Keyboard: arrows to move, space to pick an island, then an arrow to build.',
  'common.close': 'Close',
  'common.back': 'Back',
  'game.level': 'Level {level}',
  'game.undo': 'Undo',
  'game.reset': 'Reset',
  'game.hint': 'Hint',
  'game.generating': 'Building islands…',
  'game.board': 'Puzzle board. Use arrow keys to move between islands, space to select.',
  'game.blocked': 'That bridge would cross another bridge.',
  'win.title': 'Solved!',
  'win.time': 'Time',
  'win.undos': 'Undos',
  'win.hints': 'Hints',
  'win.next': 'Next level',
  'win.record': 'New record!',
  'hint.mistake': 'One of your bridges is not part of the solution. It is marked in red.',
  'hint.reveal': 'Here is a bridge to get you going.',
  'hint.twist': ' Note the reef nearby.',
  'hint.full-island': 'This island already has all its bridges, so its other connections stay empty.',
  'hint.all-bridges': 'This island needs every bridge it can still get.',
  'hint.crossing': 'A placed bridge rules out the bridge that would cross it.',
  'hint.cap': 'The number on this island limits how many bridges can go this way.',
  'hint.forced-minimum': 'The other neighbours can’t supply enough bridges, so this connection is needed.',
  'hint.isolation': 'Anything else would cut off a finished group of islands from the rest.',
  'hint.connectivity': 'This group of islands has only one way out left, so it must be used.',
  'hint.lookahead': 'Try the alternative: a few steps later it leads to a contradiction.',
} as const;

export type MessageKey = keyof typeof en;

const nl: Record<MessageKey, string> = {
  'app.title': 'Bridgle',
  'app.tagline': 'Verbind de eilanden. Let op de riffen.',
  'menu.endless': 'Eindeloos',
  'menu.endless.sub': 'Level {level} · record {best}',
  'menu.howto': 'Hoe speel je',
  'howto.title': 'Hoe speel je',
  'howto.1': 'Verbind alle eilanden met bruggen. Het getal op een eiland is het aantal bruggen dat eraan vastzit.',
  'howto.2': 'Bruggen lopen recht, horizontaal of verticaal. Maximaal twee bruggen tussen dezelfde eilanden.',
  'howto.3': 'Bruggen mogen elkaar niet kruisen en niet over een eiland lopen.',
  'howto.4': 'Riffen zijn rotsen in het water: een brug kan nooit over een rif.',
  'howto.5': 'Uiteindelijk vormen alle eilanden één verbonden netwerk.',
  'howto.controls':
    'Sleep van een eiland naar een ander om een brug te leggen. Nog eens slepen geeft een dubbele brug, een derde keer haalt ze weg. Je kan ook op een eiland tikken en daarna op een buur, of op een brug tikken. Toetsenbord: pijltjes om te bewegen, spatie om een eiland te kiezen, dan een pijltje om te bouwen.',
  'common.close': 'Sluiten',
  'common.back': 'Terug',
  'game.level': 'Level {level}',
  'game.undo': 'Ongedaan maken',
  'game.reset': 'Opnieuw',
  'game.hint': 'Hint',
  'game.generating': 'Eilanden bouwen…',
  'game.board': 'Speelveld. Gebruik de pijltjestoetsen om tussen eilanden te bewegen, spatie om te kiezen.',
  'game.blocked': 'Die brug zou een andere brug kruisen.',
  'win.title': 'Opgelost!',
  'win.time': 'Tijd',
  'win.undos': 'Undo’s',
  'win.hints': 'Hints',
  'win.next': 'Volgend level',
  'win.record': 'Nieuw record!',
  'hint.mistake': 'Eén van je bruggen hoort niet bij de oplossing. Hij is rood gemarkeerd.',
  'hint.reveal': 'Hier is een brug om je op weg te helpen.',
  'hint.twist': ' Let op het rif in de buurt.',
  'hint.full-island': 'Dit eiland heeft al al zijn bruggen, dus zijn andere verbindingen blijven leeg.',
  'hint.all-bridges': 'Dit eiland heeft elke brug nodig die het nog kan krijgen.',
  'hint.crossing': 'Een gelegde brug sluit de brug uit die hem zou kruisen.',
  'hint.cap': 'Het getal op dit eiland beperkt hoeveel bruggen deze kant op kunnen.',
  'hint.forced-minimum': 'De andere buren kunnen niet genoeg bruggen leveren, dus deze verbinding is nodig.',
  'hint.isolation': 'Anders zou een afgewerkte groep eilanden afgesneden raken van de rest.',
  'hint.connectivity': 'Deze groep eilanden heeft nog maar één uitweg, dus die moet gebruikt worden.',
  'hint.lookahead': 'Probeer het alternatief: een paar stappen later loopt het vast.',
};

const catalogs = { en, nl } as const;
export type Lang = keyof typeof catalogs;

function detect(): Lang {
  const langs = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  return langs.some((l) => l?.toLowerCase().startsWith('nl')) ? 'nl' : 'en';
}

let lang: Lang = detect();

export function setLang(next: Lang): void {
  lang = next;
  if (typeof document !== 'undefined') document.documentElement.lang = next;
}

export function getLang(): Lang {
  return lang;
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const template: string = catalogs[lang][key] ?? en[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

export function techniqueKey(id: TechniqueId): MessageKey {
  return `hint.${id}`;
}
