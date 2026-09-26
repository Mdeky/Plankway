import { beforeEach, describe, expect, it } from 'vitest';
import { dateForNumber, formatDate, generateDaily, generateEndless, serializePuzzle, serializeSolution } from '@bridgle/core';
import migration from '../migrations/0001_init.sql?raw';
import migration2 from '../migrations/0002_endless_and_verified_times.sql?raw';
import migration3 from '../migrations/0003_accounts_and_sessions.sql?raw';
import migration4 from '../migrations/0004_leaderboards.sql?raw';
import migration5 from '../migrations/0005_friends.sql?raw';
import { COOKIE_NAME, createApp, OAUTH_COOKIE, RATE_LIMITS } from '../src/app.ts';
import type { Env } from '../src/db.ts';
import { normalizeRecoveryCode } from '../src/security.ts';
import { createTestDb } from './d1-sqlite.ts';

// 2026-09-26 12:00 UTC: puzzle #2 is "today" in UTC; at UTC+14 it's already #3.
const NOW = Date.UTC(2026, 8, 26, 12, 0);
const puzzles = new Map([1, 2, 3, 4].map((n) => [n, generateDaily(n)]));
const levels = new Map([1, 2, 3].map((n) => [n, generateEndless(n)]));

let env: Env & { DB: ReturnType<typeof createTestDb> };
let app: ReturnType<typeof createApp>;
let clock = NOW;

beforeEach(() => {
  env = { DB: createTestDb([migration, migration2, migration3, migration4, migration5]), HASH_PEPPER: 'test-pepper' };
  for (const [n, g] of puzzles) {
    env.DB.raw
      .prepare('INSERT INTO puzzles (number, date, data, difficulty) VALUES (?, ?, ?, ?)')
      .run(n, formatDate(dateForNumber(n)), serializePuzzle(g.puzzle), g.report.score);
  }
  for (const [level, g] of levels) {
    env.DB.raw
      .prepare('INSERT INTO endless_puzzles (level, data, difficulty) VALUES (?, ?, ?)')
      .run(level, serializePuzzle(g.puzzle), g.report.score);
  }
  clock = NOW;
  google = { sub: 'google-user-1', aud: 'test-client.apps.googleusercontent.com', iss: 'https://accounts.google.com', expIn: 3600, status: 200 };
  tokenRequests.length = 0;
  app = createApp({ now: () => clock, fetch: fakeGoogle });
});

/** What the fake Google token endpoint puts in the next ID token. */
let google: { sub: string; aud: string; iss: string; expIn: number; status: number; nonce?: string };
const tokenRequests: URLSearchParams[] = [];

const b64url = (v: unknown) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(v))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

/** Stands in for https://oauth2.googleapis.com/token and echoes the nonce from the last sign-in start. */
const fakeGoogle: typeof fetch = async (input, init) => {
  expect(String(input)).toBe('https://oauth2.googleapis.com/token');
  const form = new URLSearchParams(String(init?.body));
  tokenRequests.push(form);
  if (google.status !== 200) return new Response('{}', { status: google.status });
  const claims = { iss: google.iss, aud: google.aud, sub: google.sub, exp: Math.floor(clock / 1000) + google.expIn, nonce: google.nonce ?? lastNonce };
  return Response.json({ id_token: `${b64url({ alg: 'RS256' })}.${b64url(claims)}.sig` });
};
let lastNonce = '';

/** Tiny cookie-aware client. */
function client(ip = '203.0.113.7') {
  const jar = new Map<string, string>();
  const call = async (method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { 'CF-Connecting-IP': ip };
    if (jar.size > 0) headers.Cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
    for (const line of res.headers.getSetCookie()) {
      const pair = line.split(';')[0]!;
      const name = pair.slice(0, pair.indexOf('='));
      const value = pair.slice(pair.indexOf('=') + 1);
      if (!value || /Max-Age=0/i.test(line)) jar.delete(name);
      else jar.set(name, value);
    }
    const setCookie = res.headers.get('Set-Cookie');
    const text = await res.text();
    const isJson = res.headers.get('Content-Type')?.includes('json');
    return { status: res.status, json: text && isJson ? JSON.parse(text) : null, setCookie, headers: res.headers };
  };
  return {
    call,
    jar,
    get cookie() {
      return jar.has(COOKIE_NAME) ? `${COOKIE_NAME}=${jar.get(COOKIE_NAME)}` : '';
    },
  };
}

/** Runs a full sign-in: start (redirect to Google), then the callback Google would call. */
async function signIn(c: ReturnType<typeof client>, opts: { returnTo?: string; state?: string } = {}) {
  const start = await c.call('GET', `/api/auth/google/start${opts.returnTo ? `?return=${encodeURIComponent(opts.returnTo)}` : ''}`);
  expect(start.status).toBe(302);
  const to = new URL(start.headers.get('Location')!);
  lastNonce = to.searchParams.get('nonce')!;
  const state = opts.state ?? to.searchParams.get('state')!;
  const back = await c.call('GET', `/api/auth/google/callback?code=abc&state=${encodeURIComponent(state)}`);
  expect(back.status).toBe(302);
  return { authorize: to, back: new URL(back.headers.get('Location')!) };
}

const withGoogle = () => {
  env.GOOGLE_CLIENT_ID = 'test-client.apps.googleusercontent.com';
  env.GOOGLE_CLIENT_SECRET = 'test-secret';
};
const count = (table: string) => Number(env.DB.raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get()!.n);

const solutionFor = (n: number) => serializeSolution(puzzles.get(n)!.solution);
const levelSolution = (level: number) => serializeSolution(levels.get(level)!.solution);
const endlessResult = (level: number, extra: Record<string, unknown> = {}) => ({ timeMs: 40_000, hints: 0, solution: levelSolution(level), ...extra });
const result = (n: number, extra: Record<string, unknown> = {}) => ({ timeMs: 151_000, undos: 1, hints: 0, solution: solutionFor(n), ...extra });

describe('GET /api/daily/:date', () => {
  it('returns the puzzle without its solution', async () => {
    const { status, json, headers } = await client().call('GET', '/api/daily/2026-09-26');
    expect(status).toBe(200);
    expect(json.number).toBe(2);
    expect(json.puzzle.i.length).toBeGreaterThan(0);
    expect(JSON.stringify(json)).not.toMatch(/solution/i);
    expect(headers.get('Cache-Control')).toContain('max-age');
  });

  it('serves tomorrow only where it is already tomorrow (UTC+14)', async () => {
    expect((await client().call('GET', '/api/daily/2026-09-27')).status).toBe(200);
    expect((await client().call('GET', '/api/daily/2026-09-28')).json).toEqual({ error: 'not-available' });
    clock = Date.UTC(2026, 8, 26, 9, 59); // UTC+14 is still on the 26th
    expect((await client().call('GET', '/api/daily/2026-09-27')).status).toBe(404);
  });

  it('rejects bad dates and dates before launch', async () => {
    expect((await client().call('GET', '/api/daily/26-09-2026')).status).toBe(400);
    expect((await client().call('GET', '/api/daily/2026-09-24')).status).toBe(404);
  });
});

describe('profiles', () => {
  it('creates an anonymous profile with an httpOnly cookie and a recovery code', async () => {
    const c = client();
    const { status, json, setCookie } = await c.call('POST', '/api/profile');
    expect(status).toBe(201);
    expect(json.recoveryCode).toMatch(/^[a-z]{4}(-[a-z]{4}){3}$/);
    expect(setCookie).toContain(`${COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');

    const row = env.DB.raw.prepare('SELECT * FROM profiles').get()!;
    const token = c.cookie.split('=')[1]!;
    expect(row.token_hash).not.toContain(token);
    expect(row.recovery_hash).not.toContain(json.recoveryCode);
    expect(String(row.token_hash)).toMatch(/^[0-9a-f]{64}$/);

    // Asking again with the cookie returns the same profile.
    expect((await c.call('POST', '/api/profile')).json).toEqual({ id: json.id, existing: true });
  });

  it('rate-limits profile creation per IP', async () => {
    for (let i = 0; i < RATE_LIMITS.createProfile; i++) expect((await client('198.51.100.1').call('POST', '/api/profile')).status).toBe(201);
    expect((await client('198.51.100.1').call('POST', '/api/profile')).status).toBe(429);
    expect((await client('198.51.100.2').call('POST', '/api/profile')).status).toBe(201);
    clock += 3_600_000;
    expect((await client('198.51.100.1').call('POST', '/api/profile')).status).toBe(201);
    // Raw IPs are never stored.
    const keys = env.DB.raw.prepare('SELECT key FROM rate_limits').all().map((r) => String(r.key));
    expect(keys.some((k) => k.includes('198.51'))).toBe(false);
  });

  it('forgets rate-limit entries (hashed IPs) after 24 hours', async () => {
    await client('198.51.100.9').call('POST', '/api/profile');
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM rate_limits').get()!.n).toBe(1);
    clock += 25 * 3_600_000;
    await client('198.51.100.10').call('POST', '/api/profile');
    const keys = env.DB.raw.prepare('SELECT key FROM rate_limits').all();
    expect(keys).toHaveLength(1);
  });

  it('refuses to run without a pepper secret', async () => {
    env.HASH_PEPPER = undefined;
    expect((await client().call('POST', '/api/profile')).status).toBe(500);
  });
});

describe('results and stats', () => {
  it('requires a profile', async () => {
    expect((await client().call('POST', '/api/daily/2/result', result(2))).status).toBe(401);
    expect((await client().call('GET', '/api/profile/stats')).status).toBe(401);
  });

  it('validates the solution against the rules and computes streaks', async () => {
    const c = client();
    await c.call('POST', '/api/profile');
    const first = await c.call('POST', '/api/daily/1/result?today=2', result(1));
    expect(first.status).toBe(200);
    expect(first.json).toMatchObject({ accepted: true, duplicate: false });
    expect(first.json.stats.currentStreak).toBe(1);

    const second = await c.call('POST', '/api/daily/2/result?today=2', result(2, { timeMs: 30_000 }));
    expect(second.json.stats).toMatchObject({ played: 2, won: 2, currentStreak: 2, maxStreak: 2 });
    expect(second.json.stats.distribution[0].count).toBe(1);

    // The first accepted result stands.
    const again = await c.call('POST', '/api/daily/2/result', result(2, { timeMs: 1_000 }));
    expect(again.json.duplicate).toBe(true);
    const stats = await c.call('GET', '/api/profile/stats?today=2');
    expect(stats.json.results.find((r: { number: number }) => r.number === 2).timeMs).toBe(30_000);
  });

  it('rejects wrong solutions and bad input', async () => {
    const c = client();
    await c.call('POST', '/api/profile');
    const wrong = solutionFor(2).slice(3); // one bridge missing
    expect((await c.call('POST', '/api/daily/2/result', result(2, { solution: wrong }))).json).toEqual({ error: 'invalid-solution' });
    expect((await c.call('POST', '/api/daily/2/result', result(1))).status).toBe(400); // solution of another puzzle
    expect((await c.call('POST', '/api/daily/2/result', result(2, { solution: 'nope' }))).status).toBe(400);
    expect((await c.call('POST', '/api/daily/2/result', result(2, { timeMs: -5 }))).json).toEqual({ error: 'invalid-time' });
    expect((await c.call('POST', '/api/daily/2/result', result(2, { hints: 1.5 }))).json).toEqual({ error: 'invalid-counters' });
    const raw = await app.request('/api/daily/2/result', { method: 'POST', headers: { Cookie: c.cookie }, body: '{oops' }, env);
    expect(raw.status).toBe(400);
  });

  it('does not accept results for puzzles that are not out yet', async () => {
    const c = client();
    await c.call('POST', '/api/profile');
    expect((await c.call('POST', '/api/daily/4/result', result(4))).status).toBe(404);
  });

  it('clamps the client-provided "today" to real dates', async () => {
    const c = client();
    await c.call('POST', '/api/profile');
    await c.call('POST', '/api/daily/2/result', result(2));
    // A client claiming it's day 500 can't make the streak disappear or grow.
    expect((await c.call('GET', '/api/profile/stats?today=500')).json.stats.currentStreak).toBe(1);
  });

  it('rate-limits result submissions per profile', async () => {
    const c = client();
    await c.call('POST', '/api/profile');
    for (let i = 0; i < RATE_LIMITS.submitResult; i++) await c.call('POST', '/api/daily/2/result', result(2));
    expect((await c.call('POST', '/api/daily/2/result', result(2))).status).toBe(429);
  });
});

describe('recovery and deletion', () => {
  it('restores a profile on another device with the recovery code', async () => {
    const phone = client();
    const { json } = await phone.call('POST', '/api/profile');
    await phone.call('POST', '/api/daily/2/result', result(2));

    const laptop = client('192.0.2.50');
    const typed = json.recoveryCode.toUpperCase().replace(/-/g, ' ');
    const recovered = await laptop.call('POST', '/api/profile/recover?today=2', { code: typed });
    expect(recovered.status).toBe(200);
    expect(recovered.json.id).toBe(json.id);
    expect(recovered.json.results).toHaveLength(1);
    expect(recovered.json.stats.currentStreak).toBe(1);
    expect((await laptop.call('GET', '/api/profile/stats')).json.id).toBe(json.id);
  });

  it('can replace a lost recovery code; the old one stops working', async () => {
    const c = client();
    const { json } = await c.call('POST', '/api/profile');
    const fresh = await c.call('POST', '/api/profile/recovery-code');
    expect(fresh.json.recoveryCode).toMatch(/^[a-z]{4}(-[a-z]{4}){3}$/);
    expect(fresh.json.recoveryCode).not.toBe(json.recoveryCode);
    expect((await client('192.0.2.60').call('POST', '/api/profile/recover', { code: json.recoveryCode })).status).toBe(404);
    expect((await client('192.0.2.61').call('POST', '/api/profile/recover', { code: fresh.json.recoveryCode })).json.id).toBe(json.id);
    expect((await client().call('POST', '/api/profile/recovery-code')).status).toBe(401);
  });

  it('rejects unknown and malformed codes, with rate limiting', async () => {
    const c = client('192.0.2.99');
    expect((await c.call('POST', '/api/profile/recover', { code: 'bado-bado-bado-bado' })).status).toBe(404);
    expect((await c.call('POST', '/api/profile/recover', { code: 'hello world' })).status).toBe(400);
    for (let i = 2; i < RATE_LIMITS.recover; i++) await c.call('POST', '/api/profile/recover', { code: 'bado-bado-bado-bado' });
    expect((await c.call('POST', '/api/profile/recover', { code: 'bado-bado-bado-bado' })).status).toBe(429);
  });

  it('deletes the profile and all its data', async () => {
    const c = client();
    await c.call('POST', '/api/profile');
    await c.call('POST', '/api/daily/2/result', result(2));
    await c.call('POST', '/api/endless/1/result', endlessResult(1));
    const res = await c.call('DELETE', '/api/profile');
    expect(res.status).toBe(204);
    expect(res.setCookie).toContain('Max-Age=0');
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM profiles').get()!.n).toBe(0);
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM results').get()!.n).toBe(0);
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM endless_results').get()!.n).toBe(0);
    expect((await c.call('GET', '/api/profile/stats')).status).toBe(401);
  });
});

describe('endless levels', () => {
  it('serves the same published level to everyone, without its solution', async () => {
    const a = await client().call('GET', '/api/endless/2');
    const b = await client('192.0.2.1').call('GET', '/api/endless/2');
    expect(a.status).toBe(200);
    expect(a.json).toEqual(b.json);
    expect(a.json.puzzle.id).toBe('endless-2');
    expect(JSON.stringify(a.json)).not.toMatch(/solution/i);
    expect(a.headers.get('Cache-Control')).toContain('max-age');
  });

  it('answers 404 for levels that are not generated or not valid', async () => {
    expect((await client().call('GET', '/api/endless/4')).status).toBe(404);
    expect((await client().call('GET', '/api/endless/0')).status).toBe(404);
    expect((await client().call('GET', '/api/endless/abc')).status).toBe(404);
  });

  it('validates results against the stored level; the first one stands', async () => {
    const c = client();
    expect((await c.call('POST', '/api/endless/1/result', endlessResult(1))).status).toBe(401);
    await c.call('POST', '/api/profile');
    expect((await c.call('POST', '/api/endless/1/result', endlessResult(1, { solution: levelSolution(2) }))).json).toEqual({
      error: 'invalid-solution',
    });
    const first = await c.call('POST', '/api/endless/1/result', endlessResult(1));
    expect(first.json).toEqual({ accepted: true, duplicate: false, verified: false });
    expect((await c.call('POST', '/api/endless/1/result', endlessResult(1, { timeMs: 1 }))).json.duplicate).toBe(true);
    expect(env.DB.raw.prepare('SELECT time_ms FROM endless_results').get()!.time_ms).toBe(40_000);
    expect((await c.call('POST', '/api/endless/4/result', endlessResult(1))).status).toBe(404);
  });
});

describe('verified times', () => {
  /** Fresh profile: fetch a start token, let `elapsed` ms pass, then submit. */
  const play = async (mode: 'daily' | 'endless', id: number, elapsed: number, body: Record<string, unknown>, ip = '203.0.113.20') => {
    const c = client(ip);
    await c.call('POST', '/api/profile');
    const start = await c.call('POST', `/api/${mode}/${id}/start`);
    expect(start.status).toBe(200);
    clock += elapsed;
    const res = await c.call('POST', `/api/${mode}/${id}/result`, { ...body, startToken: start.json.token });
    return { c, token: start.json.token as string, res };
  };

  it('verifies a time that fits inside what the server saw pass', async () => {
    const { res } = await play('endless', 2, 60_000, endlessResult(2, { timeMs: 55_000 }));
    expect(res.json.verified).toBe(true);
    expect(env.DB.raw.prepare('SELECT verified FROM endless_results').get()!.verified).toBe(1);

    const daily = await play('daily', 2, 200_000, result(2, { timeMs: 151_000 }), '203.0.113.21');
    expect(daily.res.json.verified).toBe(true);
    expect(env.DB.raw.prepare('SELECT verified FROM results').get()!.verified).toBe(1);
  });

  it('accepts but does not verify a time longer than the real elapsed time', async () => {
    const { res } = await play('endless', 2, 10_000, endlessResult(2, { timeMs: 60_000 }));
    expect(res.json).toMatchObject({ accepted: true, verified: false });
  });

  it('does not verify impossibly fast solves', async () => {
    const { res } = await play('endless', 3, 60_000, endlessResult(3, { timeMs: 200 }));
    expect(res.json.verified).toBe(false);
  });

  it('does not verify without a token', async () => {
    const c = client();
    await c.call('POST', '/api/profile');
    clock += 60_000;
    expect((await c.call('POST', '/api/endless/1/result', endlessResult(1))).json.verified).toBe(false);
  });

  it("does not verify someone else's token, a token for another level, or a tampered one", async () => {
    const alice = client('192.0.2.70');
    await alice.call('POST', '/api/profile');
    const aliceToken = (await alice.call('POST', '/api/endless/2/start')).json.token as string;
    const levelOne = (await alice.call('POST', '/api/endless/1/start')).json.token as string;
    clock += 60_000;

    const bob = client('192.0.2.71');
    await bob.call('POST', '/api/profile');
    expect((await bob.call('POST', '/api/endless/2/result', endlessResult(2, { startToken: aliceToken }))).json.verified).toBe(false);

    const relabeled = levelOne.replace('.endless.1.', '.endless.3.');
    expect((await alice.call('POST', '/api/endless/3/result', endlessResult(3, { startToken: relabeled }))).json.verified).toBe(false);

    const parts = aliceToken.split('.');
    parts[3] = String(Number(parts[3]) - 3_600_000);
    expect((await alice.call('POST', '/api/endless/2/result', endlessResult(2, { startToken: parts.join('.') }))).json.verified).toBe(false);
  });

  it('needs a profile to start and only hands out tokens for playable puzzles', async () => {
    expect((await client().call('POST', '/api/endless/1/start')).status).toBe(401);
    const c = client();
    await c.call('POST', '/api/profile');
    expect((await c.call('POST', '/api/daily/4/start')).status).toBe(404);
    expect((await c.call('POST', '/api/endless/0/start')).status).toBe(404);
  });

  it('accepts daily results without an undo count', async () => {
    const c = client();
    await c.call('POST', '/api/profile');
    const { undos: _undos, ...withoutUndos } = result(2);
    expect((await c.call('POST', '/api/daily/2/result', withoutUndos)).status).toBe(200);
  });
});

describe('sessions', () => {
  it('keeps the first device signed in when the profile is recovered on a second one', async () => {
    const phone = client();
    const { json } = await phone.call('POST', '/api/profile');
    const laptop = client('192.0.2.30');
    expect((await laptop.call('POST', '/api/profile/recover', { code: json.recoveryCode })).status).toBe(200);
    expect((await phone.call('GET', '/api/profile/stats')).json.id).toBe(json.id);
    expect((await laptop.call('GET', '/api/profile/stats')).json.id).toBe(json.id);
  });
});

describe('sign in with Google', () => {
  it('is only offered when configured', async () => {
    expect((await client().call('GET', '/api/auth/providers')).json).toEqual({ providers: [] });
    expect((await client().call('GET', '/api/auth/google/start')).status).toBe(404);
    withGoogle();
    expect((await client().call('GET', '/api/auth/providers')).json).toEqual({ providers: ['google'] });
  });

  it('hides the button when a secret was pasted wrong (e.g. a Ctrl+V character)', async () => {
    withGoogle();
    env.GOOGLE_CLIENT_ID = '\x16';
    expect((await client().call('GET', '/api/auth/providers')).json).toEqual({ providers: [] });
    withGoogle();
    env.GOOGLE_CLIENT_SECRET = '\x16';
    expect((await client().call('GET', '/api/auth/providers')).json).toEqual({ providers: [] });
    // Stray whitespace around a correct value is fine.
    withGoogle();
    env.GOOGLE_CLIENT_ID = ' test-client.apps.googleusercontent.com\n';
    expect((await client().call('GET', '/api/auth/providers')).json).toEqual({ providers: ['google'] });
  });

  it('sends the player to Google with PKCE, a nonce and only the openid scope', async () => {
    withGoogle();
    const c = client();
    const start = await c.call('GET', '/api/auth/google/start?return=/endless');
    const to = new URL(start.headers.get('Location')!);
    expect(to.origin + to.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth');
    expect(to.searchParams.get('scope')).toBe('openid');
    expect(to.searchParams.get('client_id')).toBe('test-client.apps.googleusercontent.com');
    expect(to.searchParams.get('code_challenge_method')).toBe('S256');
    expect(to.searchParams.get('redirect_uri')).toBe('http://localhost/api/auth/google/callback');
    expect(to.searchParams.get('state')).toMatch(/^[\w-]{40,}$/);
    expect(to.searchParams.get('nonce')).toMatch(/^[\w-]{40,}$/);
    expect(start.setCookie).toContain(`${OAUTH_COOKIE}=`);
    expect(start.setCookie).toContain('HttpOnly');
  });

  it('creates a profile with the account on a new device; stores only a hash of the Google id', async () => {
    withGoogle();
    const c = client();
    const { back } = await signIn(c, { returnTo: '/endless' });
    expect(back.pathname).toBe('/endless');
    expect(back.searchParams.get('login')).toBe('new');
    expect(c.jar.has(OAUTH_COOKIE)).toBe(false);
    // The code is exchanged with the PKCE verifier and our secret.
    expect(tokenRequests[0]!.get('code_verifier')).toMatch(/^[\w-]{40,}$/);
    expect(tokenRequests[0]!.get('client_secret')).toBe('test-secret');

    const me = await c.call('GET', '/api/profile/me');
    expect(me.json.account).toEqual({ providers: ['google'], displayName: null, country: null });
    const identity = env.DB.raw.prepare('SELECT * FROM identities').get()!;
    expect(JSON.stringify(identity)).not.toContain('google-user-1');
  });

  it('links the account to the profile this device already has', async () => {
    withGoogle();
    const c = client();
    const { json } = await c.call('POST', '/api/profile');
    await c.call('POST', '/api/daily/2/result', result(2));
    await signIn(c);
    const me = await c.call('GET', '/api/profile/me');
    expect(me.json.id).toBe(json.id);
    expect(me.json.account.providers).toEqual(['google']);
    expect(count('results')).toBe(1);
  });

  it('moves anonymous progress into the account when signing in on a second device', async () => {
    withGoogle();
    const phone = client();
    const { json: account } = await phone.call('POST', '/api/profile');
    await phone.call('POST', '/api/daily/1/result', result(1));
    await signIn(phone);

    const tablet = client('192.0.2.40');
    const { json: anon } = await tablet.call('POST', '/api/profile');
    await tablet.call('POST', '/api/daily/2/result', result(2));
    await tablet.call('POST', '/api/endless/1/result', endlessResult(1));
    const { back } = await signIn(tablet);
    expect(back.searchParams.get('login')).toBe('welcome-back');

    const me = await tablet.call('GET', '/api/profile/me');
    expect(me.json.id).toBe(account.id);
    expect(me.json.endless).toEqual({ best: 1, solved: 1 });
    const stats = await tablet.call('GET', '/api/profile/stats?today=2');
    expect(stats.json.results.map((r: { number: number }) => r.number)).toEqual([1, 2]);
    // The anonymous profile is gone; the phone is still signed in.
    expect(env.DB.raw.prepare('SELECT COUNT(*) AS n FROM profiles WHERE id = ?').get(anon.id)!.n).toBe(0);
    expect((await phone.call('GET', '/api/profile/me')).json.id).toBe(account.id);
  });

  it('refuses a callback with the wrong state, and bad ID tokens', async () => {
    withGoogle();
    expect((await signIn(client(), { state: 'forged' })).back.searchParams.get('login')).toBe('error');
    expect(tokenRequests).toHaveLength(0);

    for (const bad of [{ aud: 'someone-else' }, { iss: 'https://evil.example' }, { expIn: -60 }, { nonce: 'replayed' }, { status: 400 }]) {
      Object.assign(google, bad);
      const c = client();
      expect((await signIn(c)).back.searchParams.get('login')).toBe('error');
      expect(c.jar.has(COOKIE_NAME)).toBe(false);
      google = { sub: 'google-user-1', aud: 'test-client.apps.googleusercontent.com', iss: 'https://accounts.google.com', expIn: 3600, status: 200 };
    }
    expect(count('identities')).toBe(0);
  });

  it('never redirects to another site after signing in', async () => {
    withGoogle();
    for (const evil of ['//evil.example/x', 'https://evil.example', '/\\evil.example']) {
      const { back } = await signIn(client(), { returnTo: evil });
      expect(back.origin).toBe('http://localhost');
      expect(back.pathname).toBe('/');
    }
  });

  it('signs out only this device; the account and progress stay', async () => {
    withGoogle();
    const phone = client();
    await signIn(phone);
    await phone.call('POST', '/api/daily/2/result', result(2));
    const laptop = client('192.0.2.41');
    await signIn(laptop);

    expect((await laptop.call('POST', '/api/auth/logout')).status).toBe(204);
    expect(laptop.jar.has(COOKIE_NAME)).toBe(false);
    expect((await laptop.call('GET', '/api/profile/me')).status).toBe(401);
    expect((await phone.call('GET', '/api/profile/me')).status).toBe(200);

    await signIn(laptop);
    expect((await laptop.call('GET', '/api/profile/stats')).json.results).toHaveLength(1);
  });

  it('deleting the profile removes the account link and every session', async () => {
    withGoogle();
    const c = client();
    await signIn(c);
    expect((await c.call('DELETE', '/api/profile')).status).toBe(204);
    expect([count('profiles'), count('identities'), count('sessions')]).toEqual([0, 0, 0]);
  });
});

describe('display name and country', () => {
  it('needs an account', async () => {
    const c = client();
    await c.call('POST', '/api/profile');
    expect((await c.call('PUT', '/api/profile/account', { displayName: 'Mathieu' })).status).toBe(403);
  });

  it('cleans up and checks names, and accepts only real country codes', async () => {
    withGoogle();
    const c = client();
    await signIn(c);
    const put = (body: unknown) => c.call('PUT', '/api/profile/account', body);
    expect((await put({ displayName: '  Brug   Bouwer ', country: 'BE' })).json).toEqual({ displayName: 'Brug Bouwer', country: 'BE' });
    expect((await put({ displayName: 'Zoë_2' })).json.displayName).toBe('Zoë_2');
    for (const bad of ['ab', 'x'.repeat(21), '<script>', 'a--b', ' _lead', '👍👍👍']) {
      expect((await put({ displayName: bad })).json).toEqual({ error: 'invalid-name' });
    }
    for (const rude of ['Plankway Admin', 'fvck3r', 'k4nker']) {
      expect((await put({ displayName: rude.replace('v', 'u') })).json).toEqual({ error: 'name-not-allowed' });
    }
    expect((await put({ displayName: 'Grape Catering' })).status).toBe(200);
    expect((await put({ country: 'XX' })).json).toEqual({ error: 'invalid-country' });
    expect((await put({ country: 'be' })).status).toBe(400);
    expect((await c.call('GET', '/api/profile/me')).json.account).toMatchObject({ displayName: 'Grape Catering', country: 'BE' });
  });
});

describe('leaderboards', () => {
  let ipCounter = 0;
  /** A signed-in player with a name (and country) who can appear on boards. */
  const player = async (name: string | null, country: string | null = null) => {
    withGoogle();
    google.sub = `google-${name ?? 'anon'}-${++ipCounter}`;
    const c = client(`198.18.0.${ipCounter}`);
    if (name === null) {
      await c.call('POST', '/api/profile');
      return c;
    }
    await signIn(c);
    await c.call('PUT', '/api/profile/account', { displayName: name, country });
    return c;
  };
  /** Starts (for a verified time unless `verified` is false), waits, then submits. */
  const solve = async (
    c: ReturnType<typeof client>,
    mode: 'daily' | 'endless',
    id: number,
    timeMs: number,
    opts: { verified?: boolean; hints?: number } = {},
  ) => {
    const token = opts.verified === false ? undefined : (await c.call('POST', `/api/${mode}/${id}/start`)).json.token;
    clock += timeMs + 1_000;
    const body = mode === 'daily' ? result(id, { timeMs, hints: opts.hints ?? 0 }) : endlessResult(id, { timeMs, hints: opts.hints ?? 0 });
    const res = await c.call('POST', `/api/${mode}/${id}/result`, { ...body, startToken: token });
    expect(res.status).toBe(200);
  };
  const names = (board: { entries: { name: string }[] }) => board.entries.map((e) => e.name);

  it('daily: fastest verified times without hints, named players only, world or one country', async () => {
    const anna = await player('Anna', 'BE');
    const bram = await player('Bram', 'NL');
    const cheat = await player('Cas', 'BE');
    const helped = await player('Dirk', 'BE');
    const anon = await player(null);
    await solve(anna, 'daily', 2, 60_000);
    await solve(bram, 'daily', 2, 30_000);
    await solve(cheat, 'daily', 2, 10_000, { verified: false });
    await solve(helped, 'daily', 2, 20_000, { hints: 1 });
    await solve(anon, 'daily', 2, 5_000);

    const world = (await anna.call('GET', '/api/leaderboard/daily/2')).json;
    expect(names(world)).toEqual(['Bram', 'Anna']);
    expect(world.entries[0]).toEqual({ rank: 1, name: 'Bram', country: 'NL', value: 30_000 });
    expect(world.entries[1].you).toBe(true);
    expect(world.you).toEqual({ rank: 2, value: 60_000 });
    expect(JSON.stringify(world)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/); // no profile ids

    const belgium = (await anna.call('GET', '/api/leaderboard/daily/2?country=BE')).json;
    expect(names(belgium)).toEqual(['Anna']);
    expect(belgium.you).toEqual({ rank: 1, value: 60_000 });

    expect((await cheat.call('GET', '/api/leaderboard/daily/2')).json.you).toEqual({ rank: null, reason: 'unverified' });
    expect((await helped.call('GET', '/api/leaderboard/daily/2')).json.you).toEqual({ rank: null, reason: 'hints' });
    expect((await anon.call('GET', '/api/leaderboard/daily/2')).json.you).toEqual({ rank: null, reason: 'no-name' });
    expect((await anna.call('GET', '/api/leaderboard/daily/1')).json.you).toEqual({ rank: null, reason: 'not-played' });
    expect((await client().call('GET', '/api/leaderboard/daily/2')).json.you).toBeNull();
  });

  it('checks its parameters', async () => {
    expect((await client().call('GET', '/api/leaderboard/daily/2?country=XX')).status).toBe(400);
    expect((await client().call('GET', '/api/leaderboard/daily/4')).status).toBe(404);
    expect((await client().call('GET', '/api/leaderboard/endless/level/0')).status).toBe(404);
  });

  it('endless run: the unbroken run from level 1 counts, hints allowed, order of solving does not matter', async () => {
    const steady = await player('Steady', 'BE');
    const gap = await player('Gap', 'BE');
    const late = await player('Late', 'FR');
    for (const level of [1, 2, 3]) await solve(steady, 'endless', level, 40_000, { hints: level === 2 ? 1 : 0 });
    await solve(gap, 'endless', 1, 40_000);
    await solve(gap, 'endless', 3, 40_000);
    // Synced out of order (offline play): level 2 arrives before level 1.
    await solve(late, 'endless', 2, 40_000);
    await solve(late, 'endless', 1, 40_000);

    const board = (await gap.call('GET', '/api/leaderboard/endless/run')).json;
    expect(board.entries.map((e: { name: string; value: number }) => [e.name, e.value])).toEqual([
      ['Steady', 3],
      ['Late', 2],
      ['Gap', 1],
    ]);
    expect(board.you).toEqual({ rank: 3, value: 1 });
    expect(names((await gap.call('GET', '/api/leaderboard/endless/run?country=FR')).json)).toEqual(['Late']);
  });

  it('endless run ties go to whoever got there first', async () => {
    const first = await player('First');
    const second = await player('Second');
    await solve(first, 'endless', 1, 40_000);
    await solve(second, 'endless', 1, 20_000);
    expect(names((await first.call('GET', '/api/leaderboard/endless/run')).json)).toEqual(['First', 'Second']);
  });

  it('per endless level: fastest verified time without hints', async () => {
    const quick = await player('Quick');
    const slow = await player('Slow');
    const helped = await player('Helped');
    await solve(slow, 'endless', 1, 50_000);
    await solve(quick, 'endless', 1, 25_000);
    await solve(helped, 'endless', 1, 10_000, { hints: 2 });
    const board = (await slow.call('GET', '/api/leaderboard/endless/level/1')).json;
    expect(board.level).toBe(1);
    expect(names(board)).toEqual(['Quick', 'Slow']);
    expect(board.you).toEqual({ rank: 2, value: 50_000 });
  });

  it('progress made before signing in counts once the account has a name', async () => {
    withGoogle();
    google.sub = 'returning-player';
    const phone = client('198.18.1.1');
    await signIn(phone);
    await phone.call('PUT', '/api/profile/account', { displayName: 'Returner' });

    const tablet = client('198.18.1.2');
    await tablet.call('POST', '/api/profile');
    await solve(tablet, 'endless', 1, 40_000);
    await solve(tablet, 'endless', 2, 40_000);
    await signIn(tablet);
    const board = (await tablet.call('GET', '/api/leaderboard/endless/run')).json;
    expect(board.entries).toEqual([{ rank: 1, name: 'Returner', country: null, value: 2, you: true }]);
  });

  it('the migration fills in runs for results that already existed', async () => {
    const db = createTestDb([migration, migration2, migration3]);
    db.raw.prepare("INSERT INTO profiles (id, token_hash, recovery_hash, created_at) VALUES ('p1', 't', 'r', 0)").run();
    for (const [level, at] of [[1, 10], [2, 30], [3, 20], [5, 40]]) {
      db.raw.prepare('INSERT INTO endless_results (profile_id, level, time_ms, hints, solved_at) VALUES (?, ?, 1000, 0, ?)').run('p1', level, at);
    }
    db.raw.exec(migration4);
    expect(db.raw.prepare('SELECT endless_run, endless_run_at FROM profiles').get()).toEqual({ endless_run: 3, endless_run_at: 30 });
  });
});

describe('friends', () => {
  let n = 0;
  const named = async (name: string, country: string | null = null) => {
    withGoogle();
    google.sub = `friend-${name}-${++n}`;
    const c = client(`198.19.0.${n}`);
    await signIn(c);
    await c.call('PUT', '/api/profile/account', { displayName: name, country });
    return c;
  };

  it('needs an account with a name', async () => {
    const anon = client('198.19.1.1');
    expect((await anon.call('GET', '/api/friends')).status).toBe(401);
    await anon.call('POST', '/api/profile');
    expect((await anon.call('GET', '/api/friends')).json).toEqual({ error: 'account-required' });
    withGoogle();
    google.sub = 'nameless';
    const nameless = client('198.19.1.2');
    await signIn(nameless);
    expect((await nameless.call('GET', '/api/friends')).json).toEqual({ error: 'name-required' });
  });

  it('adding a code makes both players friends right away; codes are forgiving to type', async () => {
    const anna = await named('Anna', 'BE');
    const bram = await named('Bram', 'NL');
    const annaCode = (await anna.call('GET', '/api/friends')).json.code as string;
    expect(annaCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/);
    expect((await anna.call('GET', '/api/friends')).json.code).toBe(annaCode); // stable

    const typed = `${annaCode.slice(0, 4).toLowerCase()}-${annaCode.slice(4)}`;
    const added = await bram.call('POST', '/api/friends', { code: typed });
    expect(added.json.added).toEqual({ name: 'Anna', country: 'BE' });
    expect(added.json.already).toBe(false);
    expect(added.json.friends.map((f: { name: string }) => f.name)).toEqual(['Anna']);
    expect((await anna.call('GET', '/api/friends')).json.friends.map((f: { name: string }) => f.name)).toEqual(['Bram']);
    expect((await bram.call('POST', '/api/friends', { code: annaCode })).json.already).toBe(true);
    // Friends are identified by an opaque key, never a profile id.
    expect(JSON.stringify(added.json)).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it('rejects bad, unknown and own codes', async () => {
    const anna = await named('Anna');
    const own = (await anna.call('GET', '/api/friends')).json.code;
    expect((await anna.call('POST', '/api/friends', { code: 'nope' })).json).toEqual({ error: 'invalid-code' });
    expect((await anna.call('POST', '/api/friends', { code: 'AAAAAAAA' })).json).toEqual({ error: 'unknown-code' });
    expect((await anna.call('POST', '/api/friends', { code: own })).json).toEqual({ error: 'self' });
  });

  it('either side can remove the friendship', async () => {
    const anna = await named('Anna');
    const bram = await named('Bram');
    await bram.call('POST', '/api/friends', { code: (await anna.call('GET', '/api/friends')).json.code });
    const key = (await anna.call('GET', '/api/friends')).json.friends[0].key as string;
    expect((await bram.call('DELETE', `/api/friends/${key}`)).status).toBe(404); // Anna's key for Bram isn't Bram's for Anna
    const after = await anna.call('DELETE', `/api/friends/${key}`);
    expect(after.json.friends).toEqual([]);
    expect((await bram.call('GET', '/api/friends')).json.friends).toEqual([]);
  });

  it('a new code stops the old one from working; existing friends stay', async () => {
    const anna = await named('Anna');
    const bram = await named('Bram');
    const cas = await named('Cas');
    const old = (await anna.call('GET', '/api/friends')).json.code;
    await bram.call('POST', '/api/friends', { code: old });
    const fresh = (await anna.call('POST', '/api/friends/code')).json;
    expect(fresh.code).not.toBe(old);
    expect(fresh.friends).toHaveLength(1);
    expect((await cas.call('POST', '/api/friends', { code: old })).json).toEqual({ error: 'unknown-code' });
    expect((await cas.call('POST', '/api/friends', { code: fresh.code })).status).toBe(200);
  });

  it('the friends leaderboard shows the player and their friends only', async () => {
    const anna = await named('Anna');
    const bram = await named('Bram');
    const stranger = await named('Stranger');
    await bram.call('POST', '/api/friends', { code: (await anna.call('GET', '/api/friends')).json.code });
    for (const [c, time] of [[anna, 60_000], [bram, 40_000], [stranger, 20_000]] as const) {
      const token = (await c.call('POST', '/api/daily/2/start')).json.token;
      clock += time + 1_000;
      await c.call('POST', '/api/daily/2/result', result(2, { timeMs: time, startToken: token }));
    }
    const board = (await anna.call('GET', '/api/leaderboard/daily/2?friends=1')).json;
    expect(board.entries.map((e: { name: string }) => e.name)).toEqual(['Bram', 'Anna']);
    expect(board.you).toEqual({ rank: 2, value: 60_000 });
    expect((await anna.call('GET', '/api/leaderboard/daily/2')).json.entries).toHaveLength(3);
    expect((await client('198.19.9.9').call('GET', '/api/leaderboard/daily/2?friends=1')).status).toBe(401);
  });

  it('deleting a profile ends its friendships', async () => {
    const anna = await named('Anna');
    const bram = await named('Bram');
    await bram.call('POST', '/api/friends', { code: (await anna.call('GET', '/api/friends')).json.code });
    await anna.call('DELETE', '/api/profile');
    expect(count('friendships')).toBe(0);
    expect((await bram.call('GET', '/api/friends')).json.friends).toEqual([]);
  });
});

describe('recovery codes', () => {
  it('normalizes what people type', () => {
    expect(normalizeRecoveryCode(' Lumo TAKI, ravo-nesi ')).toBe('lumo-taki-ravo-nesi');
    expect(normalizeRecoveryCode('lumo-taki-ravo')).toBeNull();
    expect(normalizeRecoveryCode('lumo-taki-ravo-xyzw')).toBeNull();
  });
});
