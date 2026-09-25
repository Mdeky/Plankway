import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import {
  computeStats,
  formatDate,
  parseDate,
  parsePuzzle,
  parseSolution,
  puzzleNumber,
  PuzzleFormatError,
  validateSolution,
  type CalendarDate,
} from '@bridgle/core';
import type { Env } from './db.ts';
import { keyedHash, newRecoveryCode, newToken, normalizeRecoveryCode } from './security.ts';

export const COOKIE_NAME = 'bridgle_token';
const COOKIE_MAX_AGE = 400 * 24 * 3600; // the longest browsers accept

/** Requests per hour. */
export const RATE_LIMITS = {
  createProfile: 10,
  recover: 10,
  submitResult: 60,
} as const;

const MAX_TIME_MS = 7 * 24 * 3600 * 1000;
const MAX_COUNTER = 100_000;

export interface AppOptions {
  /** Injectable clock for tests. */
  now?: () => number;
}

type AppEnv = { Bindings: Env; Variables: { profileId: string } };

interface ResultRow {
  puzzle_number: number;
  time_ms: number;
  undos: number;
  hints: number;
  solved_at: number;
}

function dateAtOffset(now: number, hours: number): CalendarDate {
  const d = new Date(now + hours * 3_600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

function fail(status: 400 | 401 | 404 | 429 | 500, error: string): never {
  throw new HTTPException(status, { res: Response.json({ error }, { status }) });
}

export function createApp(options: AppOptions = {}) {
  const now = options.now ?? Date.now;
  const app = new Hono<AppEnv>().basePath('/api');

  /** Latest date on earth right now (UTC+14) and earliest (UTC−12). */
  const latestNumber = () => puzzleNumber(dateAtOffset(now(), 14));
  const earliestNumber = () => puzzleNumber(dateAtOffset(now(), -12));

  const pepper = (c: Context<AppEnv>): string => {
    const p = c.env.HASH_PEPPER;
    if (!p) fail(500, 'server-misconfigured');
    return p;
  };

  const rateLimit = async (c: Context<AppEnv>, action: keyof typeof RATE_LIMITS, subject: string) => {
    const win = Math.floor(now() / 3_600_000);
    const key = `${action}:${subject}`;
    const row = await c.env.DB.prepare(
      `INSERT INTO rate_limits (key, win, count) VALUES (?, ?, 1)
       ON CONFLICT(key) DO UPDATE SET count = CASE WHEN win = excluded.win THEN count + 1 ELSE 1 END, win = excluded.win
       RETURNING count`,
    )
      .bind(key, win)
      .first<{ count: number }>();
    if ((row?.count ?? 0) > RATE_LIMITS[action]) fail(429, 'rate-limited');
  };

  const ipKey = async (c: Context<AppEnv>) =>
    keyedHash(pepper(c), 'ip', c.req.header('CF-Connecting-IP') ?? 'unknown');

  const issueCookie = (c: Context<AppEnv>, token: string) =>
    setCookie(c, COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/api', maxAge: COOKIE_MAX_AGE });

  const findProfile = async (c: Context<AppEnv>): Promise<string | null> => {
    const token = getCookie(c, COOKIE_NAME);
    if (!token) return null;
    const hash = await keyedHash(pepper(c), 'token', token);
    const row = await c.env.DB.prepare('SELECT id FROM profiles WHERE token_hash = ?').bind(hash).first<{ id: string }>();
    return row?.id ?? null;
  };

  const requireProfile = async (c: Context<AppEnv>): Promise<string> => {
    const id = await findProfile(c);
    if (!id) fail(401, 'no-profile');
    return id;
  };

  const readJson = async (c: Context<AppEnv>): Promise<Record<string, unknown>> => {
    try {
      const body = await c.req.json();
      if (body && typeof body === 'object' && !Array.isArray(body)) return body as Record<string, unknown>;
    } catch {
      // fall through
    }
    return fail(400, 'invalid-json');
  };

  const profileResults = async (c: Context<AppEnv>, profileId: string) => {
    const { results } = await c.env.DB.prepare(
      'SELECT puzzle_number, time_ms, undos, hints, solved_at FROM results WHERE profile_id = ? ORDER BY puzzle_number',
    )
      .bind(profileId)
      .all<ResultRow>();
    return results.map((r) => ({ number: r.puzzle_number, timeMs: r.time_ms, undos: r.undos, hints: r.hints, solvedAt: r.solved_at }));
  };

  const statsFor = async (c: Context<AppEnv>, profileId: string, requestedToday: number | null) => {
    const results = await profileResults(c, profileId);
    const lo = earliestNumber();
    const hi = latestNumber();
    const today = requestedToday === null ? hi : Math.min(hi, Math.max(lo, requestedToday));
    return { stats: computeStats(results.map((r) => ({ number: r.number, solved: true, timeMs: r.timeMs })), today), results };
  };

  // ── Daily puzzles ─────────────────────────────────────────────────────────

  app.get('/daily/:date', async (c) => {
    const date = parseDate(c.req.param('date'));
    if (!date) fail(400, 'invalid-date');
    // Never hand out puzzles for dates that haven't started anywhere on earth.
    if (puzzleNumber(date) > latestNumber() || puzzleNumber(date) < 1) fail(404, 'not-available');
    const row = await c.env.DB.prepare('SELECT number, date, data FROM puzzles WHERE date = ?')
      .bind(formatDate(date))
      .first<{ number: number; date: string; data: string }>();
    if (!row) fail(404, 'not-found');
    c.header('Cache-Control', 'public, max-age=3600');
    return c.json({ number: row.number, date: row.date, puzzle: JSON.parse(row.data) });
  });

  app.post('/daily/:number/result', async (c) => {
    const profileId = await requireProfile(c);
    await rateLimit(c, 'submitResult', profileId);

    const number = Number(c.req.param('number'));
    if (!Number.isInteger(number) || number < 1 || number > latestNumber()) fail(404, 'not-available');

    const body = await readJson(c);
    const { timeMs, undos, hints } = body;
    const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_COUNTER;
    if (!Number.isInteger(timeMs) || (timeMs as number) < 0 || (timeMs as number) > MAX_TIME_MS) fail(400, 'invalid-time');
    if (!isCount(undos) || !isCount(hints)) fail(400, 'invalid-counters');

    const row = await c.env.DB.prepare('SELECT data FROM puzzles WHERE number = ?').bind(number).first<{ data: string }>();
    if (!row) fail(404, 'not-found');

    let valid = false;
    try {
      valid = validateSolution(parsePuzzle(row.data), parseSolution(body.solution)).valid;
    } catch (err) {
      if (!(err instanceof PuzzleFormatError)) throw err;
    }
    if (!valid) fail(400, 'invalid-solution');

    const insert = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO results (profile_id, puzzle_number, time_ms, undos, hints, solved_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(profileId, number, timeMs, undos, hints, now())
      .run();

    const today = c.req.query('today');
    return c.json({ accepted: true, duplicate: insert.meta.changes === 0, ...(await statsFor(c, profileId, today ? Number(today) : number)) });
  });

  // ── Profiles ──────────────────────────────────────────────────────────────

  app.post('/profile', async (c) => {
    const existing = await findProfile(c);
    if (existing) return c.json({ id: existing, existing: true });

    await rateLimit(c, 'createProfile', await ipKey(c));
    const p = pepper(c);
    const id = crypto.randomUUID();
    const token = newToken();
    const recoveryCode = newRecoveryCode();
    await c.env.DB.prepare('INSERT INTO profiles (id, token_hash, recovery_hash, created_at) VALUES (?, ?, ?, ?)')
      .bind(id, await keyedHash(p, 'token', token), await keyedHash(p, 'recovery', recoveryCode), now())
      .run();
    issueCookie(c, token);
    return c.json({ id, recoveryCode, existing: false }, 201);
  });

  app.get('/profile/stats', async (c) => {
    const profileId = await requireProfile(c);
    const today = c.req.query('today');
    return c.json({ id: profileId, ...(await statsFor(c, profileId, today ? Number(today) : null)) });
  });

  /** Codes are only stored hashed, so a lost code can't be shown again: issue a new one. */
  app.post('/profile/recovery-code', async (c) => {
    const profileId = await requireProfile(c);
    await rateLimit(c, 'recover', profileId);
    const recoveryCode = newRecoveryCode();
    await c.env.DB.prepare('UPDATE profiles SET recovery_hash = ? WHERE id = ?')
      .bind(await keyedHash(pepper(c), 'recovery', recoveryCode), profileId)
      .run();
    return c.json({ recoveryCode });
  });

  app.post('/profile/recover', async (c) => {
    await rateLimit(c, 'recover', await ipKey(c));
    const body = await readJson(c);
    const code = typeof body.code === 'string' ? normalizeRecoveryCode(body.code) : null;
    if (!code) fail(400, 'invalid-code');

    const p = pepper(c);
    const row = await c.env.DB.prepare('SELECT id FROM profiles WHERE recovery_hash = ?')
      .bind(await keyedHash(p, 'recovery', code))
      .first<{ id: string }>();
    if (!row) fail(404, 'unknown-code');

    // A fresh token for this device; other devices keep working until they're recovered again.
    const token = newToken();
    await c.env.DB.prepare('UPDATE profiles SET token_hash = ? WHERE id = ?').bind(await keyedHash(p, 'token', token), row.id).run();
    issueCookie(c, token);
    const today = c.req.query('today');
    return c.json({ id: row.id, ...(await statsFor(c, row.id, today ? Number(today) : null)) });
  });

  app.delete('/profile', async (c) => {
    const profileId = await requireProfile(c);
    await c.env.DB.batch([
      c.env.DB.prepare('DELETE FROM results WHERE profile_id = ?').bind(profileId),
      c.env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(`submitResult:${profileId}`),
      c.env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(profileId),
    ]);
    deleteCookie(c, COOKIE_NAME, { path: '/api', secure: true });
    return c.body(null, 204);
  });

  app.notFound((c) => c.json({ error: 'not-found' }, 404));
  app.onError((err, c) => {
    if (err instanceof HTTPException) return err.getResponse();
    console.error(err);
    return c.json({ error: 'internal' }, 500);
  });

  return app;
}
