import { parsePuzzle, type Puzzle, type SerializedPuzzle } from '@bridgle/core';

const TIMEOUT_MS = 5000;
const PROFILE_KEY = 'bridgle.profile.v1';

export interface ProfileInfo {
  id: string;
  /** Only known on the device that created or recovered the profile. */
  recoveryCode?: string;
}

export interface RemoteResult {
  number: number;
  timeMs: number;
  undos: number;
  hints: number;
  solvedAt: number;
}

type Reply = { status: number; data: Record<string, unknown> | null };

/** status 0 = network error or timeout (offline). */
async function request(method: string, path: string, body?: unknown): Promise<Reply> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    let data: Record<string, unknown> | null = null;
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : null;
    } catch {
      data = null;
    }
    return { status: res.status, data };
  } catch {
    return { status: 0, data: null };
  } finally {
    clearTimeout(timer);
  }
}

export function loadProfileInfo(): ProfileInfo | null {
  try {
    const raw = localStorage.getItem(PROFILE_KEY);
    return raw ? (JSON.parse(raw) as ProfileInfo) : null;
  } catch {
    return null;
  }
}

function saveProfileInfo(info: ProfileInfo | null): void {
  try {
    if (info) localStorage.setItem(PROFILE_KEY, JSON.stringify(info));
    else localStorage.removeItem(PROFILE_KEY);
  } catch {
    // ignore
  }
}

/** The canonical daily from the server, or null when offline / not published yet. */
export async function fetchDaily(date: string): Promise<{ number: number; puzzle: Puzzle } | null> {
  const { status, data } = await request('GET', `/daily/${date}`);
  if (status !== 200 || !data) return null;
  try {
    return { number: Number(data.number), puzzle: parsePuzzle(data.puzzle as SerializedPuzzle) };
  } catch {
    return null;
  }
}

/** A published endless level (the same for everyone), or null when offline / not published. */
export async function fetchEndless(level: number): Promise<Puzzle | null> {
  const { status, data } = await request('GET', `/endless/${level}`);
  if (status !== 200 || !data) return null;
  try {
    return parsePuzzle(data.puzzle as SerializedPuzzle);
  } catch {
    return null;
  }
}

/**
 * Asks the server to sign the moment this puzzle started, so the time can be verified
 * later. Undefined when offline; the result then still counts, just unverified.
 */
export async function requestStartToken(mode: 'daily' | 'endless', id: number): Promise<string | undefined> {
  if (!(await ensureProfile())) return undefined;
  const { status, data } = await request('POST', `/${mode}/${id}/start`);
  return status === 200 && typeof data?.token === 'string' ? data.token : undefined;
}

/** Makes sure this device has an anonymous profile (cookie). Returns null when offline. */
export async function ensureProfile(force = false): Promise<ProfileInfo | null> {
  const known = loadProfileInfo();
  if (known && !force) return known;
  const { status, data } = await request('POST', '/profile');
  if ((status !== 200 && status !== 201) || !data) return null;
  const info: ProfileInfo = {
    id: String(data.id),
    recoveryCode: typeof data.recoveryCode === 'string' ? data.recoveryCode : known?.recoveryCode,
  };
  saveProfileInfo(info);
  return info;
}

export type SubmitOutcome = 'ok' | 'offline' | 'rejected' | 'no-profile';

function outcome(status: number): SubmitOutcome {
  if (status === 200) return 'ok';
  if (status === 401) return 'no-profile';
  if (status === 400 || status === 404) return 'rejected';
  return 'offline';
}

export async function submitResult(
  number: number,
  result: { timeMs: number; undos: number; hints: number; solution: number[]; startToken?: string },
): Promise<SubmitOutcome> {
  return outcome((await request('POST', `/daily/${number}/result`, result)).status);
}

export async function submitEndless(
  level: number,
  result: { timeMs: number; hints: number; solution: number[]; startToken?: string },
): Promise<SubmitOutcome> {
  return outcome((await request('POST', `/endless/${level}/result`, result)).status);
}

export type RecoverOutcome = { ok: true; results: RemoteResult[] } | { ok: false; error: 'unknown-code' | 'invalid-code' | 'rate-limited' | 'offline' };

export async function recoverProfile(code: string): Promise<RecoverOutcome> {
  const { status, data } = await request('POST', '/profile/recover', { code });
  if (status === 200 && data) {
    saveProfileInfo({ id: String(data.id), recoveryCode: code.trim().toLowerCase().split(/[^a-z]+/).filter(Boolean).join('-') });
    return { ok: true, results: (data.results as RemoteResult[]) ?? [] };
  }
  if (status === 404) return { ok: false, error: 'unknown-code' };
  if (status === 400) return { ok: false, error: 'invalid-code' };
  if (status === 429) return { ok: false, error: 'rate-limited' };
  return { ok: false, error: 'offline' };
}

/** Deletes the server profile. Returns false when the server couldn't be reached. */
export async function deleteRemoteProfile(): Promise<boolean> {
  const { status } = await request('DELETE', '/profile');
  if (status === 204 || status === 401) {
    saveProfileInfo(null);
    return true;
  }
  return false;
}

export function forgetProfile(): void {
  saveProfileInfo(null);
}

// ── Leaderboards ────────────────────────────────────────────────────────────

export interface BoardEntry {
  rank: number;
  name: string;
  country: string | null;
  /** Time boards: time plus 30 s per hint. Furthest board: level. */
  value: number;
  /** Hints included in a time (only when there were any). */
  hints?: number;
  you?: true;
}

export interface Board {
  entries: BoardEntry[];
  you: { rank: number; value: number } | { rank: null; reason: string } | null;
}

export type BoardKind = { kind: 'daily'; number: number } | { kind: 'level'; level: number } | { kind: 'run' };

/** Whole world (null), one country, or the player and their friends. */
export type BoardScope = { country: string } | { friends: true } | null;

/** A leaderboard, or null when offline. */
export async function fetchBoard(board: BoardKind, scope: BoardScope): Promise<Board | null> {
  const path =
    board.kind === 'daily'
      ? `/leaderboard/daily/${board.number}`
      : board.kind === 'level'
        ? `/leaderboard/endless/level/${board.level}`
        : '/leaderboard/endless/run';
  const query = !scope ? '' : 'country' in scope ? `?country=${encodeURIComponent(scope.country)}` : '?friends=1';
  const { status, data } = await request('GET', path + query);
  if (status !== 200 || !data || !Array.isArray(data.entries)) return null;
  return data as unknown as Board;
}

// ── Friends ─────────────────────────────────────────────────────────────────

export interface Friend {
  key: string;
  name: string;
  country: string | null;
  since: number;
}

export interface FriendsView {
  code: string;
  friends: Friend[];
  max: number;
}

export type FriendsReply = { ok: true; view: FriendsView; added?: { name: string }; already?: boolean } | { ok: false; error: string };

async function friendsCall(method: string, path: string, body?: unknown): Promise<FriendsReply> {
  const { status, data } = await request(method, path, body);
  if (status === 200 && data && typeof data.code === 'string') {
    return {
      ok: true,
      view: { code: data.code, friends: (data.friends as Friend[]) ?? [], max: Number(data.max) || 0 },
      added: data.added as { name: string } | undefined,
      already: data.already === true,
    };
  }
  return { ok: false, error: typeof data?.error === 'string' ? data.error : 'offline' };
}

export const fetchFriends = () => friendsCall('GET', '/friends');
export const addFriend = (code: string) => friendsCall('POST', '/friends', { code });
export const removeFriend = (key: string) => friendsCall('DELETE', `/friends/${encodeURIComponent(key)}`);
export const renewFriendCode = () => friendsCall('POST', '/friends/code');

/** "K7M2QX9P" → "K7M2-QX9P" */
export const formatFriendCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;

/** Invite link that adds you as a friend when opened. */
export const inviteLink = (code: string) => `${location.origin}/?friend=${code}`;

const PENDING_FRIEND_KEY = 'bridgle.pendingFriend';

/** A friend code from an invite link, kept until the player can use it (after signing in). */
export function pendingFriendCode(): string | null {
  try {
    return sessionStorage.getItem(PENDING_FRIEND_KEY);
  } catch {
    return null;
  }
}

export function setPendingFriendCode(code: string | null): void {
  try {
    if (code) sessionStorage.setItem(PENDING_FRIEND_KEY, code);
    else sessionStorage.removeItem(PENDING_FRIEND_KEY);
  } catch {
    // ignore
  }
}

// ── Accounts ────────────────────────────────────────────────────────────────

export interface Account {
  providers: string[];
  displayName: string | null;
  country: string | null;
}

export interface Me {
  id: string;
  account: Account | null;
  endless: { best: number; solved: number };
}

/** Sign-in providers this server offers (empty when offline or none configured). */
export async function fetchProviders(): Promise<string[]> {
  const { status, data } = await request('GET', '/auth/providers');
  return status === 200 && Array.isArray(data?.providers) ? (data.providers as string[]) : [];
}

/** Starts a sign-in: the server redirects to the provider and back to the home screen. */
export function signInUrl(provider: string): string {
  return `/api/auth/${encodeURIComponent(provider)}/start?return=/`;
}

/** This device's profile and account, or null when offline or without a profile. */
export async function fetchMe(): Promise<Me | null> {
  const { status, data } = await request('GET', '/profile/me');
  if (status !== 200 || !data) return null;
  const me = data as unknown as Me;
  const known = loadProfileInfo();
  // Signing in can switch this device to another profile; a code only belongs to its own.
  if (known?.id !== me.id) saveProfileInfo({ id: me.id });
  return me;
}

export async function fetchRemoteResults(): Promise<RemoteResult[] | null> {
  const { status, data } = await request('GET', '/profile/stats');
  return status === 200 && Array.isArray(data?.results) ? (data.results as RemoteResult[]) : null;
}

export type AccountUpdate = { ok: true; displayName: string | null; country: string | null } | { ok: false; error: string };

export async function updateAccount(changes: { displayName?: string; country?: string | null }): Promise<AccountUpdate> {
  const { status, data } = await request('PUT', '/profile/account', changes);
  if (status === 200 && data) return { ok: true, displayName: (data.displayName as string) ?? null, country: (data.country as string) ?? null };
  return { ok: false, error: typeof data?.error === 'string' ? data.error : 'offline' };
}

/** Signs this device out. False when the server couldn't be reached. */
export async function signOut(): Promise<boolean> {
  const { status } = await request('POST', '/auth/logout');
  if (status !== 204) return false;
  saveProfileInfo(null);
  return true;
}

/** Replaces the recovery code (the old one stops working). Null when offline. */
export async function newRecoveryCode(): Promise<ProfileInfo | null> {
  const { status, data } = await request('POST', '/profile/recovery-code');
  if (status !== 200 || !data || typeof data.recoveryCode !== 'string') return null;
  const known = loadProfileInfo();
  if (!known) return null;
  const info: ProfileInfo = { ...known, recoveryCode: data.recoveryCode };
  saveProfileInfo(info);
  return info;
}
