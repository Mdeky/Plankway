const encoder = new TextEncoder();

function toHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
}

function toBase64Url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** HMAC-SHA256 with the server pepper, hex encoded. Used for tokens, codes and IPs. */
export async function keyedHash(pepper: string, purpose: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(pepper), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  return toHex(await crypto.subtle.sign('HMAC', key, encoder.encode(`${purpose}:${value}`)));
}

/** 256-bit random session token. */
export function newToken(): string {
  return toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
}

const CONSONANTS = 'bdfghjklmnprstvz';
const VOWELS = 'aeiou';

/** Unbiased random integer in [0, max). */
function randomInt(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0]! >= limit);
  return buf[0]! % max;
}

/**
 * Four pronounceable words like "lumo-taki-ravo-nesi": 6400⁴ ≈ 2⁵⁰ combinations,
 * language-neutral and easy to write down. Brute force is stopped by rate limits.
 */
export function newRecoveryCode(): string {
  const word = () => {
    let w = '';
    for (let i = 0; i < 2; i++) w += CONSONANTS[randomInt(CONSONANTS.length)]! + VOWELS[randomInt(VOWELS.length)]!;
    return w;
  };
  return [word(), word(), word(), word()].join('-');
}

/** Accepts any spacing, case or separators the player may type. */
export function normalizeRecoveryCode(input: string): string | null {
  const words = input.toLowerCase().split(/[^a-z]+/).filter(Boolean);
  if (words.length !== 4 || !words.every((w) => /^[bdfghjklmnprstvz][aeiou][bdfghjklmnprstvz][aeiou]$/.test(w))) {
    return null;
  }
  return words.join('-');
}
