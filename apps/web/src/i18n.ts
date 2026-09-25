import type { TechniqueId } from '@bridgle/core';

const en = {
  'app.title': 'Bridgle',
  'app.tagline': 'Connect the islands. Mind the reefs.',
  'menu.daily': 'Bridgle #{number}',
  'menu.daily.new': 'Today’s puzzle',
  'menu.daily.playing': 'In progress',
  'menu.daily.solved': 'Solved · streak {streak}',
  'stats.title': 'Statistics',
  'stats.played': 'Played',
  'stats.winPct': 'Solved %',
  'stats.streak': 'Current streak',
  'stats.maxStreak': 'Longest streak',
  'stats.distribution': 'Solve times',
  'stats.range': '{from}–{to} min',
  'stats.over': '{m}+ min',
  'stats.next': 'Next Bridgle in',
  'stats.newPuzzle': 'Play the new puzzle',
  'share.button': 'Share',
  'share.preview': 'Result to share',
  'share.copied': 'Copied to clipboard!',
  'share.failed': 'Couldn’t share. Select the text above to copy it.',
  'share.undo': '{n} undo',
  'share.undos': '{n} undos',
  'share.hint': '{n} hint',
  'share.hints': '{n} hints',
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
  'common.cancel': 'Cancel',
  'menu.settings': 'Settings',
  'settings.title': 'Settings',
  'settings.theme': 'Look',
  'settings.themeSystem': 'Follow my device',
  'settings.themeLight': 'Day',
  'settings.themeDark': 'Night',
  'settings.sound': 'Sound',
  'settings.soundOn': 'Sound effects',
  'settings.language': 'Language',
  'settings.motion': 'Animations follow your device’s “reduce motion” setting.',
  'game.mute': 'Sound off',
  'game.unmute': 'Sound on',
  'win.skip': 'Tap to continue',
  'a11y.island': 'Island {n}, row {row}, column {col}. {have} of {n} bridges.',
  'a11y.islandShort': '{n} at row {row}, column {col}',
  'a11y.selected': ' Selected: press an arrow key to build a bridge.',
  'a11y.bridge': '{count} bridges between island {a} and island {b}.',
  'a11y.solved': 'Puzzle solved!',
  'menu.profile': 'Profile',
  'profile.title': 'Your profile',
  'profile.intro': 'Bridgle keeps an anonymous profile for your daily results and streak. No e-mail, no password.',
  'profile.codeTitle': 'Recovery code',
  'profile.codeHelp': 'Write this down. With it you can continue your streak on another device.',
  'profile.codeUnknown': 'Your code isn’t stored on this device. Make a new one; the old code then stops working.',
  'profile.newCode': 'Make a new code',
  'profile.connect': 'Connect profile',
  'profile.offline': 'Could not reach the server. Your results are kept on this device and synced later.',
  'profile.recoverTitle': 'Use your profile on this device',
  'profile.recoverLabel': 'Recovery code',
  'profile.recoverButton': 'Restore',
  'profile.recovered': 'Profile restored. Your results are back.',
  'profile.error.unknown-code': 'That code doesn’t match a profile.',
  'profile.error.invalid-code': 'A recovery code is four short words, like lumo-taki-ravo-nesi.',
  'profile.error.rate-limited': 'Too many attempts. Try again in an hour.',
  'profile.error.offline': 'Could not reach the server. Try again when you are online.',
  'profile.deleteTitle': 'Delete my data',
  'profile.deleteStart': 'Delete profile and data…',
  'profile.deleteConfirm':
    'This permanently deletes your profile, results and streaks on the server and on this device. This cannot be undone.',
  'profile.deleteButton': 'Delete permanently',
  'profile.deleteOffline': 'Could not reach the server, so nothing was deleted. Try again when you are online.',
  'profile.deleted': 'Your profile and all data have been deleted.',
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
  'menu.daily': 'Bridgle #{number}',
  'menu.daily.new': 'Puzzel van vandaag',
  'menu.daily.playing': 'Bezig',
  'menu.daily.solved': 'Opgelost · reeks {streak}',
  'stats.title': 'Statistieken',
  'stats.played': 'Gespeeld',
  'stats.winPct': '% opgelost',
  'stats.streak': 'Huidige reeks',
  'stats.maxStreak': 'Langste reeks',
  'stats.distribution': 'Oplostijden',
  'stats.range': '{from}–{to} min',
  'stats.over': '{m}+ min',
  'stats.next': 'Volgende Bridgle over',
  'stats.newPuzzle': 'Speel de nieuwe puzzel',
  'share.button': 'Delen',
  'share.preview': 'Resultaat om te delen',
  'share.copied': 'Gekopieerd naar het klembord!',
  'share.failed': 'Delen lukte niet. Selecteer de tekst hierboven om te kopiëren.',
  'share.undo': '{n} undo',
  'share.undos': '{n} undo’s',
  'share.hint': '{n} hint',
  'share.hints': '{n} hints',
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
  'common.cancel': 'Annuleren',
  'menu.settings': 'Instellingen',
  'settings.title': 'Instellingen',
  'settings.theme': 'Uitzicht',
  'settings.themeSystem': 'Zoals mijn toestel',
  'settings.themeLight': 'Dag',
  'settings.themeDark': 'Nacht',
  'settings.sound': 'Geluid',
  'settings.soundOn': 'Geluidseffecten',
  'settings.language': 'Taal',
  'settings.motion': 'Animaties volgen de instelling “beweging beperken” van je toestel.',
  'game.mute': 'Geluid uit',
  'game.unmute': 'Geluid aan',
  'win.skip': 'Tik om verder te gaan',
  'a11y.island': 'Eiland {n}, rij {row}, kolom {col}. {have} van {n} bruggen.',
  'a11y.islandShort': '{n} op rij {row}, kolom {col}',
  'a11y.selected': ' Gekozen: druk op een pijltje om een brug te bouwen.',
  'a11y.bridge': '{count} bruggen tussen eiland {a} en eiland {b}.',
  'a11y.solved': 'Puzzel opgelost!',
  'menu.profile': 'Profiel',
  'profile.title': 'Jouw profiel',
  'profile.intro': 'Bridgle bewaart een anoniem profiel voor je daily-resultaten en reeks. Geen e-mail, geen wachtwoord.',
  'profile.codeTitle': 'Herstelcode',
  'profile.codeHelp': 'Schrijf deze op. Hiermee zet je je reeks verder op een ander toestel.',
  'profile.codeUnknown': 'Je code staat niet op dit toestel. Maak een nieuwe; de oude code werkt dan niet meer.',
  'profile.newCode': 'Nieuwe code maken',
  'profile.connect': 'Profiel koppelen',
  'profile.offline': 'De server is niet bereikbaar. Je resultaten blijven op dit toestel en worden later gesynchroniseerd.',
  'profile.recoverTitle': 'Je profiel op dit toestel gebruiken',
  'profile.recoverLabel': 'Herstelcode',
  'profile.recoverButton': 'Herstellen',
  'profile.recovered': 'Profiel hersteld. Je resultaten zijn terug.',
  'profile.error.unknown-code': 'Die code hoort bij geen enkel profiel.',
  'profile.error.invalid-code': 'Een herstelcode bestaat uit vier korte woorden, zoals lumo-taki-ravo-nesi.',
  'profile.error.rate-limited': 'Te veel pogingen. Probeer het over een uur opnieuw.',
  'profile.error.offline': 'De server is niet bereikbaar. Probeer het opnieuw als je online bent.',
  'profile.deleteTitle': 'Mijn data wissen',
  'profile.deleteStart': 'Profiel en data wissen…',
  'profile.deleteConfirm':
    'Dit wist je profiel, resultaten en reeksen definitief, op de server en op dit toestel. Dit kan niet ongedaan gemaakt worden.',
  'profile.deleteButton': 'Definitief wissen',
  'profile.deleteOffline': 'De server is niet bereikbaar, dus er is niets gewist. Probeer het opnieuw als je online bent.',
  'profile.deleted': 'Je profiel en al je data zijn gewist.',
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

const LANG_KEY = 'bridgle.lang.v1';

function detect(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'en' || saved === 'nl') return saved;
  } catch {
    // ignore
  }
  const langs = typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language];
  return langs.some((l) => l?.toLowerCase().startsWith('nl')) ? 'nl' : 'en';
}

let lang: Lang = detect();

/** With remember = true the choice is stored; otherwise the browser language is used. */
export function setLang(next: Lang, remember = false): void {
  lang = next;
  if (remember) {
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      // ignore
    }
  }
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
