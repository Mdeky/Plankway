/**
 * Word filter for display names. Deliberately small and conservative: it catches the
 * obvious slurs and insults (Dutch and English) and names that impersonate the game.
 * Anything it misses can be reset by hand in the database.
 */
const BLOCKED = [
  // impersonation
  'admin', 'plankway', 'moderator', 'support', 'official',
  // English (whole stems only where a short word hides inside innocent ones: grape, torpedo)
  'fuck', 'shit', 'cunt', 'bitch', 'nigg', 'faggot', 'retard', 'whore', 'slut', 'rapist', 'nazi', 'hitler', 'penis', 'vagina',
  'porn', 'pedophile',
  // Dutch (no "tering"/"lul": catering, Lulu)
  'kanker', 'tyfus', 'klootzak', 'hoer', 'neuk', 'mongool', 'flikker', 'pedofiel', 'kutwijf',
];

/** Letters that are often swapped in to dodge filters. */
const LOOKALIKES: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', $: 's' };

export function isNameAllowed(name: string): boolean {
  const flat = [...name.toLowerCase().normalize('NFKD').replace(/\p{M}/gu, '')]
    .map((ch) => LOOKALIKES[ch] ?? ch)
    .filter((ch) => /[a-z]/.test(ch))
    .join('');
  return !BLOCKED.some((word) => flat.includes(word));
}
