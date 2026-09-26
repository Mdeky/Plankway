import { beforeEach, describe, expect, it } from 'vitest';
import { dateForNumber, formatDate, generateDaily, generateEndless, serializePuzzle, serializeSolution } from '@bridgle/core';
import migration from '../migrations/0001_init.sql?raw';
import migration2 from '../migrations/0002_endless_and_verified_times.sql?raw';
import { COOKIE_NAME, createApp, RATE_LIMITS } from '../src/app.ts';
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
  env = { DB: createTestDb([migration, migration2]), HASH_PEPPER: 'test-pepper' };
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
  app = createApp({ now: () => clock });
});

/** Tiny cookie-aware client. */
function client(ip = '203.0.113.7') {
  let cookie = '';
  const call = async (method: string, path: string, body?: unknown) => {
    const headers: Record<string, string> = { 'CF-Connecting-IP': ip };
    if (cookie) headers.Cookie = cookie;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const res = await app.request(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) }, env);
    const setCookie = res.headers.get('Set-Cookie');
    if (setCookie) {
      const [pair] = setCookie.split(';');
      cookie = pair!.endsWith('=') ? '' : pair!;
    }
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) : null, setCookie, headers: res.headers };
  };
  return { call, get cookie() { return cookie; }, set cookie(v: string) { cookie = v; } };
}

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

describe('recovery codes', () => {
  it('normalizes what people type', () => {
    expect(normalizeRecoveryCode(' Lumo TAKI, ravo-nesi ')).toBe('lumo-taki-ravo-nesi');
    expect(normalizeRecoveryCode('lumo-taki-ravo')).toBeNull();
    expect(normalizeRecoveryCode('lumo-taki-ravo-xyzw')).toBeNull();
  });
});
