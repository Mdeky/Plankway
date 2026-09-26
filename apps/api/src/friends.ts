/**
 * Friends: every named account gets a friend code; entering someone's code makes you
 * friends both ways right away (no requests). That is safe because friends see nothing
 * beyond the public leaderboards: it only adds a "friends" filter. Either side can remove
 * the friendship, and a new code stops the old one from working.
 */
import type { D1Database } from './db.ts';

export const MAX_FRIENDS = 200;

/** No 0/O or 1/I: codes get read aloud and typed over. 32⁸ ≈ 10¹² codes. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

export function newFriendCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  // 256 is a multiple of 32, so this is unbiased.
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

/** Accepts "k7m2-qx9p", "K7M2 QX9P", …; null when it can't be a code. */
export function normalizeFriendCode(input: unknown): string | null {
  if (typeof input !== 'string') return null;
  const code = input.toUpperCase().replace(/[\s-]/g, '');
  return code.length === CODE_LENGTH && [...code].every((ch) => ALPHABET.includes(ch)) ? code : null;
}

/** The player's code, created on first use. */
export async function friendCode(db: D1Database, profileId: string): Promise<string> {
  const row = await db.prepare('SELECT friend_code FROM profiles WHERE id = ?').bind(profileId).first<{ friend_code: string | null }>();
  if (row?.friend_code) return row.friend_code;
  return resetFriendCode(db, profileId);
}

export async function resetFriendCode(db: D1Database, profileId: string): Promise<string> {
  // A clash is astronomically unlikely, but the unique index would reject it: just retry.
  for (let attempt = 0; ; attempt++) {
    const code = newFriendCode();
    try {
      await db.prepare('UPDATE profiles SET friend_code = ? WHERE id = ?').bind(code, profileId).run();
      return code;
    } catch (err) {
      if (attempt >= 3) throw err;
    }
  }
}

export interface Friend {
  /** Opaque, stable per friend; used to remove them. Never the profile id. */
  key: string;
  name: string;
  country: string | null;
  since: number;
}

export async function listFriends(
  db: D1Database,
  profileId: string,
  keyFor: (friendId: string) => Promise<string>,
): Promise<Friend[]> {
  const { results } = await db
    .prepare(
      `SELECT p.id AS id, p.display_name AS name, p.country AS country, f.created_at AS since
       FROM friendships f JOIN profiles p ON p.id = f.friend_id
       WHERE f.profile_id = ? ORDER BY p.display_name COLLATE NOCASE`,
    )
    .bind(profileId)
    .all<{ id: string; name: string | null; country: string | null; since: number }>();
  return Promise.all(results.map(async (r) => ({ key: await keyFor(r.id), name: r.name ?? '?', country: r.country, since: r.since })));
}

export type AddOutcome =
  | { ok: true; friend: { name: string; country: string | null }; already: boolean }
  | { ok: false; error: 'unknown-code' | 'self' | 'too-many' };

export async function addFriend(db: D1Database, profileId: string, code: string, now: number): Promise<AddOutcome> {
  const other = await db
    .prepare(
      `SELECT p.id AS id, p.display_name AS name, p.country AS country FROM profiles p
       WHERE p.friend_code = ? AND p.display_name IS NOT NULL AND EXISTS (SELECT 1 FROM identities i WHERE i.profile_id = p.id)`,
    )
    .bind(code)
    .first<{ id: string; name: string; country: string | null }>();
  if (!other) return { ok: false, error: 'unknown-code' };
  if (other.id === profileId) return { ok: false, error: 'self' };

  const existing = await db.prepare('SELECT 1 AS x FROM friendships WHERE profile_id = ? AND friend_id = ?').bind(profileId, other.id).first();
  const friend = { name: other.name, country: other.country };
  if (existing) return { ok: true, friend, already: true };

  const counts = await db
    .prepare('SELECT (SELECT COUNT(*) FROM friendships WHERE profile_id = ?) AS mine, (SELECT COUNT(*) FROM friendships WHERE profile_id = ?) AS theirs')
    .bind(profileId, other.id)
    .first<{ mine: number; theirs: number }>();
  if ((counts?.mine ?? 0) >= MAX_FRIENDS || (counts?.theirs ?? 0) >= MAX_FRIENDS) return { ok: false, error: 'too-many' };

  await db.batch([
    db.prepare('INSERT OR IGNORE INTO friendships (profile_id, friend_id, created_at) VALUES (?, ?, ?)').bind(profileId, other.id, now),
    db.prepare('INSERT OR IGNORE INTO friendships (profile_id, friend_id, created_at) VALUES (?, ?, ?)').bind(other.id, profileId, now),
  ]);
  return { ok: true, friend, already: false };
}

/** Removes a friendship both ways. False when the key matches none of the player's friends. */
export async function removeFriend(
  db: D1Database,
  profileId: string,
  key: string,
  keyFor: (friendId: string) => Promise<string>,
): Promise<boolean> {
  const { results } = await db.prepare('SELECT friend_id FROM friendships WHERE profile_id = ?').bind(profileId).all<{ friend_id: string }>();
  for (const { friend_id } of results) {
    if ((await keyFor(friend_id)) !== key) continue;
    await db.batch([
      db.prepare('DELETE FROM friendships WHERE profile_id = ? AND friend_id = ?').bind(profileId, friend_id),
      db.prepare('DELETE FROM friendships WHERE profile_id = ? AND friend_id = ?').bind(friend_id, profileId),
    ]);
    return true;
  }
  return false;
}
