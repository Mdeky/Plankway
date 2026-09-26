import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import {
  computeStats,
  formatDate,
  isCountry,
  normalizeDisplayName,
  parseDate,
  parsePuzzle,
  parseSolution,
  puzzleNumber,
  PuzzleFormatError,
  validateSolution,
  type CalendarDate,
  type Solution,
} from '@bridgle/core';
import type { Env } from './db.ts';
import { addFriend, friendCode, listFriends, MAX_FRIENDS, normalizeFriendCode, removeFriend, resetFriendCode } from './friends.ts';
import { runBoard, timeBoard, updateRun, type Scope } from './leaderboard.ts';
import { isNameAllowed } from './names.ts';
import { authorizeUrl, configuredProviders, exchangeCode, OAuthError, pkceChallenge, type Provider } from './oauth.ts';
import { keyedHash, newRecoveryCode, newToken, normalizeRecoveryCode, signStart, verifyStart, type PlayMode } from './security.ts';

export const COOKIE_NAME = 'plankway_token';
const COOKIE_MAX_AGE = 400 * 24 * 3600; // the longest browsers accept
/** Short-lived cookie that carries state, PKCE verifier and nonce through a sign-in. */
export const OAUTH_COOKIE = 'plankway_oauth';
const OAUTH_MAX_AGE = 10 * 60;

/** Requests per hour. */
export const RATE_LIMITS = {
  createProfile: 10,
  recover: 10,
  submitResult: 60,
  submitEndless: 240,
  start: 300,
  signIn: 30,
  account: 30,
  friends: 30,
} as const;

const MAX_TIME_MS = 7 * 24 * 3600 * 1000;
const MAX_COUNTER = 100_000;
/** Highest endless level the API accepts (far beyond anything that is generated). */
const MAX_LEVEL = 100_000;

/** A time only counts as verified when it fits inside what the server saw pass. */
const START_SLACK_MS = 5_000;
const START_TOKEN_MAX_AGE_MS = 30 * 24 * 3600 * 1000;
/** Nobody places a bridge faster than this, not even with perfect knowledge. */
const MIN_MS_PER_BRIDGE = 150;

export interface AppOptions {
  /** Injectable clock for tests. */
  now?: () => number;
  /** Injectable fetch for tests (calls to sign-in providers). */
  fetch?: typeof fetch;
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

function fail(status: 400 | 401 | 403 | 404 | 429 | 500, error: string): never {
  throw new HTTPException(status, { res: Response.json({ error }, { status }) });
}

export function createApp(options: AppOptions = {}) {
  const now = options.now ?? Date.now;
  const fetcher = options.fetch ?? ((input, init) => fetch(input, init));
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
    // Hashed IPs are kept for at most 24 hours (promised in the privacy policy).
    await c.env.DB.prepare('DELETE FROM rate_limits WHERE win < ?').bind(win - 24).run();
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
    const row = await c.env.DB.prepare('SELECT profile_id FROM sessions WHERE token_hash = ?').bind(hash).first<{ profile_id: string }>();
    return row?.profile_id ?? null;
  };

  /** Signs this device in to a profile: a new session next to any other devices. */
  const startSession = async (c: Context<AppEnv>, profileId: string) => {
    const token = newToken();
    await c.env.DB.prepare('INSERT INTO sessions (token_hash, profile_id, created_at) VALUES (?, ?, ?)')
      .bind(await keyedHash(pepper(c), 'token', token), profileId, now())
      .run();
    issueCookie(c, token);
  };

  /** Ends this device's session (other devices stay signed in). */
  const endSession = async (c: Context<AppEnv>) => {
    const token = getCookie(c, COOKIE_NAME);
    if (token) await c.env.DB.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await keyedHash(pepper(c), 'token', token)).run();
  };

  const createProfile = async (c: Context<AppEnv>, country: string | null = null) => {
    const p = pepper(c);
    const id = crypto.randomUUID();
    const recoveryCode = newRecoveryCode();
    // profiles.token_hash is legacy (sessions hold the real tokens) but still NOT NULL UNIQUE.
    await c.env.DB.prepare('INSERT INTO profiles (id, token_hash, recovery_hash, country, created_at) VALUES (?, ?, ?, ?, ?)')
      .bind(id, await keyedHash(p, 'token', newToken()), await keyedHash(p, 'recovery', recoveryCode), country, now())
      .run();
    await startSession(c, id);
    return { id, recoveryCode };
  };

  const hasAccount = async (c: Context<AppEnv>, profileId: string) =>
    !!(await c.env.DB.prepare('SELECT 1 AS x FROM identities WHERE profile_id = ?').bind(profileId).first());

  /** Everything that belongs to a profile, for deletion. */
  const deleteProfileRows = (c: Context<AppEnv>, profileId: string) => [
    c.env.DB.prepare('DELETE FROM results WHERE profile_id = ?').bind(profileId),
    c.env.DB.prepare('DELETE FROM endless_results WHERE profile_id = ?').bind(profileId),
    c.env.DB.prepare('DELETE FROM sessions WHERE profile_id = ?').bind(profileId),
    c.env.DB.prepare('DELETE FROM identities WHERE profile_id = ?').bind(profileId),
    c.env.DB.prepare('DELETE FROM friendships WHERE profile_id = ? OR friend_id = ?').bind(profileId, profileId),
    c.env.DB.prepare('DELETE FROM rate_limits WHERE key IN (?, ?, ?, ?, ?)').bind(
      `submitResult:${profileId}`,
      `submitEndless:${profileId}`,
      `start:${profileId}`,
      `account:${profileId}`,
      `friends:${profileId}`,
    ),
    c.env.DB.prepare('DELETE FROM profiles WHERE id = ?').bind(profileId),
  ];

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

  const readCounters = (body: Record<string, unknown>) => {
    const { timeMs, hints } = body;
    const isCount = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= MAX_COUNTER;
    if (!Number.isInteger(timeMs) || (timeMs as number) < 0 || (timeMs as number) > MAX_TIME_MS) fail(400, 'invalid-time');
    if (!isCount(hints)) fail(400, 'invalid-counters');
    return { timeMs: timeMs as number, hints: hints as number };
  };

  /** Parses and checks a submitted solution against the stored puzzle. */
  const checkSolution = (data: string, submitted: unknown): Solution => {
    try {
      const solution = parseSolution(submitted);
      if (validateSolution(parsePuzzle(data), solution).valid) return solution;
    } catch (err) {
      if (!(err instanceof PuzzleFormatError)) throw err;
    }
    return fail(400, 'invalid-solution');
  };

  /**
   * Whether a reported time is backed by a start token: signed for this profile and
   * puzzle, not older than the reported time allows, and not impossibly fast.
   */
  const isVerified = async (
    c: Context<AppEnv>,
    profileId: string,
    mode: PlayMode,
    id: number,
    token: unknown,
    timeMs: number,
    solution: Solution,
  ): Promise<boolean> => {
    const issuedAt = await verifyStart(pepper(c), profileId, mode, id, token);
    if (issuedAt === null) return false;
    const elapsed = now() - issuedAt;
    if (elapsed < 0 || elapsed > START_TOKEN_MAX_AGE_MS) return false;
    const bridges = solution.reduce((sum, b) => sum + b.count, 0);
    return timeMs <= elapsed + START_SLACK_MS && timeMs >= bridges * MIN_MS_PER_BRIDGE;
  };

  const startToken = async (c: Context<AppEnv>, mode: PlayMode, id: number) => {
    const profileId = await requireProfile(c);
    await rateLimit(c, 'start', profileId);
    return c.json({ token: await signStart(pepper(c), profileId, mode, id, now()) });
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
    const { timeMs, hints } = readCounters(body);
    // Undos can only come from Ctrl+Z now; clients that stop sending them count as 0.
    const undos = body.undos === undefined ? 0 : body.undos;
    if (!Number.isInteger(undos) || (undos as number) < 0 || (undos as number) > MAX_COUNTER) fail(400, 'invalid-counters');

    const row = await c.env.DB.prepare('SELECT data FROM puzzles WHERE number = ?').bind(number).first<{ data: string }>();
    if (!row) fail(404, 'not-found');
    const solution = checkSolution(row.data, body.solution);
    const verified = await isVerified(c, profileId, 'daily', number, body.startToken, timeMs, solution);

    const insert = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO results (profile_id, puzzle_number, time_ms, undos, hints, verified, solved_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(profileId, number, timeMs, undos, hints, verified ? 1 : 0, now())
      .run();

    const today = c.req.query('today');
    return c.json({
      accepted: true,
      duplicate: insert.meta.changes === 0,
      verified,
      ...(await statsFor(c, profileId, today ? Number(today) : number)),
    });
  });

  app.post('/daily/:number/start', async (c) => {
    const number = Number(c.req.param('number'));
    if (!Number.isInteger(number) || number < 1 || number > latestNumber()) fail(404, 'not-available');
    return startToken(c, 'daily', number);
  });

  // ── Endless levels ────────────────────────────────────────────────────────

  const readLevel = (c: Context<AppEnv>): number => {
    const level = Number(c.req.param('level'));
    if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) fail(404, 'not-available');
    return level;
  };

  app.get('/endless/:level', async (c) => {
    const level = readLevel(c);
    const row = await c.env.DB.prepare('SELECT data FROM endless_puzzles WHERE level = ?').bind(level).first<{ data: string }>();
    if (!row) fail(404, 'not-found');
    // A level never changes once it is published.
    c.header('Cache-Control', 'public, max-age=86400');
    return c.json({ level, puzzle: JSON.parse(row.data) });
  });

  app.post('/endless/:level/start', async (c) => startToken(c, 'endless', readLevel(c)));

  app.post('/endless/:level/result', async (c) => {
    const profileId = await requireProfile(c);
    await rateLimit(c, 'submitEndless', profileId);
    const level = readLevel(c);
    const body = await readJson(c);
    const { timeMs, hints } = readCounters(body);

    const row = await c.env.DB.prepare('SELECT data FROM endless_puzzles WHERE level = ?').bind(level).first<{ data: string }>();
    if (!row) fail(404, 'not-found');
    const solution = checkSolution(row.data, body.solution);
    const verified = await isVerified(c, profileId, 'endless', level, body.startToken, timeMs, solution);

    const insert = await c.env.DB.prepare(
      `INSERT OR IGNORE INTO endless_results (profile_id, level, time_ms, hints, verified, solved_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(profileId, level, timeMs, hints, verified ? 1 : 0, now())
      .run();
    if (insert.meta.changes > 0) await updateRun(c.env.DB, profileId);
    return c.json({ accepted: true, duplicate: insert.meta.changes === 0, verified });
  });

  // ── Profiles ──────────────────────────────────────────────────────────────

  app.post('/profile', async (c) => {
    const existing = await findProfile(c);
    if (existing) return c.json({ id: existing, existing: true });

    await rateLimit(c, 'createProfile', await ipKey(c));
    const { id, recoveryCode } = await createProfile(c);
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

    // A new session for this device; other devices keep theirs.
    await endSession(c);
    await startSession(c, row.id);
    const today = c.req.query('today');
    return c.json({ id: row.id, ...(await statsFor(c, row.id, today ? Number(today) : null)) });
  });

  app.delete('/profile', async (c) => {
    const profileId = await requireProfile(c);
    await c.env.DB.batch(deleteProfileRows(c, profileId));
    deleteCookie(c, COOKIE_NAME, { path: '/api', secure: true });
    return c.body(null, 204);
  });

  // ── Leaderboards ──────────────────────────────────────────────────────────

  /**
   * `?country=BE` narrows a board to one country, `?friends=1` to the player and their
   * friends; without either it covers the whole world.
   */
  const boardScope = (c: Context<AppEnv>, profileId: string | null): Scope => {
    if (c.req.query('friends') === '1') {
      if (!profileId) fail(401, 'no-profile');
      return { friendsOf: profileId };
    }
    const country = c.req.query('country');
    if (country === undefined || country === '') return null;
    if (!isCountry(country)) fail(400, 'invalid-country');
    return { country };
  };

  app.get('/leaderboard/daily/:number', async (c) => {
    const number = Number(c.req.param('number'));
    if (!Number.isInteger(number) || number < 1 || number > latestNumber()) fail(404, 'not-available');
    const profileId = await findProfile(c);
    return c.json({ number, ...(await timeBoard(c.env.DB, 'daily', number, boardScope(c, profileId), profileId)) });
  });

  app.get('/leaderboard/endless/run', async (c) => {
    const profileId = await findProfile(c);
    return c.json(await runBoard(c.env.DB, boardScope(c, profileId), profileId));
  });

  app.get('/leaderboard/endless/level/:level', async (c) => {
    const level = readLevel(c);
    const profileId = await findProfile(c);
    return c.json({ level, ...(await timeBoard(c.env.DB, 'level', level, boardScope(c, profileId), profileId)) });
  });

  // ── Friends ───────────────────────────────────────────────────────────────

  /** Friends need an account and a name, so both sides know who they're adding. */
  const requireNamedAccount = async (c: Context<AppEnv>): Promise<string> => {
    const profileId = await requireProfile(c);
    if (!(await hasAccount(c, profileId))) fail(403, 'account-required');
    const row = await c.env.DB.prepare('SELECT display_name FROM profiles WHERE id = ?').bind(profileId).first<{ display_name: string | null }>();
    if (!row?.display_name) fail(403, 'name-required');
    return profileId;
  };

  /** Per viewer and friend, so keys can't be compared across friend lists. */
  const friendKey = (c: Context<AppEnv>, profileId: string) => (friendId: string) =>
    keyedHash(pepper(c), 'friend', `${profileId}:${friendId}`).then((h) => h.slice(0, 24));

  const friendsView = async (c: Context<AppEnv>, profileId: string) => ({
    code: await friendCode(c.env.DB, profileId),
    friends: await listFriends(c.env.DB, profileId, friendKey(c, profileId)),
    max: MAX_FRIENDS,
  });

  app.get('/friends', async (c) => {
    const profileId = await requireNamedAccount(c);
    return c.json(await friendsView(c, profileId));
  });

  app.post('/friends', async (c) => {
    const profileId = await requireNamedAccount(c);
    await rateLimit(c, 'friends', profileId);
    const body = await readJson(c);
    const code = normalizeFriendCode(body.code);
    if (!code) fail(400, 'invalid-code');
    const outcome = await addFriend(c.env.DB, profileId, code, now());
    if (!outcome.ok) fail(outcome.error === 'unknown-code' ? 404 : 400, outcome.error);
    return c.json({ added: outcome.friend, already: outcome.already, ...(await friendsView(c, profileId)) });
  });

  app.delete('/friends/:key', async (c) => {
    const profileId = await requireNamedAccount(c);
    if (!(await removeFriend(c.env.DB, profileId, c.req.param('key'), friendKey(c, profileId)))) fail(404, 'not-found');
    return c.json(await friendsView(c, profileId));
  });

  /** A new code: the old one stops working (existing friends stay). */
  app.post('/friends/code', async (c) => {
    const profileId = await requireNamedAccount(c);
    await rateLimit(c, 'friends', profileId);
    await resetFriendCode(c.env.DB, profileId);
    return c.json(await friendsView(c, profileId));
  });

  // ── Accounts ──────────────────────────────────────────────────────────────

  app.get('/profile/me', async (c) => {
    const profileId = await requireProfile(c);
    const profile = await c.env.DB.prepare('SELECT display_name, country FROM profiles WHERE id = ?')
      .bind(profileId)
      .first<{ display_name: string | null; country: string | null }>();
    const { results: ids } = await c.env.DB.prepare('SELECT DISTINCT provider FROM identities WHERE profile_id = ?')
      .bind(profileId)
      .all<{ provider: string }>();
    const endless = await c.env.DB.prepare('SELECT MAX(level) AS best, COUNT(*) AS solved FROM endless_results WHERE profile_id = ?')
      .bind(profileId)
      .first<{ best: number | null; solved: number }>();
    return c.json({
      id: profileId,
      account: ids.length > 0 ? { providers: ids.map((r) => r.provider), displayName: profile?.display_name ?? null, country: profile?.country ?? null } : null,
      endless: { best: endless?.best ?? 0, solved: endless?.solved ?? 0 },
    });
  });

  app.put('/profile/account', async (c) => {
    const profileId = await requireProfile(c);
    await rateLimit(c, 'account', profileId);
    if (!(await hasAccount(c, profileId))) fail(403, 'account-required');
    const body = await readJson(c);
    const sets: string[] = [];
    const values: unknown[] = [];
    if (body.displayName !== undefined) {
      const name = normalizeDisplayName(body.displayName);
      if (!name) fail(400, 'invalid-name');
      if (!isNameAllowed(name)) fail(400, 'name-not-allowed');
      sets.push('display_name = ?');
      values.push(name);
    }
    if (body.country !== undefined) {
      if (body.country !== null && !isCountry(body.country)) fail(400, 'invalid-country');
      sets.push('country = ?');
      values.push(body.country);
    }
    if (sets.length > 0) await c.env.DB.prepare(`UPDATE profiles SET ${sets.join(', ')} WHERE id = ?`).bind(...values, profileId).run();
    const row = await c.env.DB.prepare('SELECT display_name, country FROM profiles WHERE id = ?')
      .bind(profileId)
      .first<{ display_name: string | null; country: string | null }>();
    return c.json({ displayName: row?.display_name ?? null, country: row?.country ?? null });
  });

  // ── Sign-in ───────────────────────────────────────────────────────────────

  app.get('/auth/providers', (c) => c.json({ providers: configuredProviders(c.env).map((p) => p.id) }));

  const providerFor = (c: Context<AppEnv>): Provider => {
    const provider = configuredProviders(c.env).find((p) => p.id === c.req.param('provider'));
    if (!provider) fail(404, 'unknown-provider');
    return provider;
  };

  /**
   * The site as the player sees it, so cookies line up: the host that was asked for,
   * always https. Local development sets SITE_ORIGIN, because wrangler dev rewrites
   * URL and Host to the production domain.
   */
  const siteOrigin = (c: Context<AppEnv>): string => {
    if (c.env.SITE_ORIGIN) return c.env.SITE_ORIGIN;
    const url = new URL(c.req.url);
    return url.hostname === 'localhost' ? url.origin : `https://${url.host}`;
  };

  /** Where the provider sends the player back. */
  const callbackUrl = (c: Context<AppEnv>, provider: Provider) => `${siteOrigin(c)}/api/auth/${provider.id}/callback`;

  /** Only paths on this site, never another host ("//evil.example"). */
  const safeReturn = (value: unknown): string =>
    typeof value === 'string' && /^\/(?![\/\\])[\w\-./]{0,100}$/.test(value) ? value : '/';

  app.get('/auth/:provider/start', async (c) => {
    const provider = providerFor(c);
    await rateLimit(c, 'signIn', await ipKey(c));
    const state = newToken();
    const verifier = newToken();
    const nonce = newToken();
    const returnTo = safeReturn(c.req.query('return'));
    setCookie(c, OAUTH_COOKIE, [provider.id, state, verifier, nonce, returnTo].join(' '), {
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/api/auth',
      maxAge: OAUTH_MAX_AGE,
    });
    return c.redirect(
      authorizeUrl(provider, { redirectUri: callbackUrl(c, provider), state, nonce, codeChallenge: await pkceChallenge(verifier) }),
      302,
    );
  });

  app.get('/auth/:provider/callback', async (c) => {
    const provider = providerFor(c);
    const [cookieProvider, state, verifier, nonce, returnTo] = (getCookie(c, OAUTH_COOKIE) ?? '').split(' ');
    deleteCookie(c, OAUTH_COOKIE, { path: '/api/auth', secure: true });
    const back = (outcome: string) => {
      const url = new URL(safeReturn(returnTo), siteOrigin(c));
      url.searchParams.set('login', outcome);
      return c.redirect(url.toString(), 302);
    };

    const code = c.req.query('code');
    if (!code || !state || cookieProvider !== provider.id || c.req.query('state') !== state) {
      return back(c.req.query('error') === 'access_denied' ? 'cancelled' : 'error');
    }
    let subject: string;
    try {
      subject = await exchangeCode(provider, { code, redirectUri: callbackUrl(c, provider), verifier: verifier!, nonce: nonce!, now: now() }, fetcher);
    } catch (err) {
      if (!(err instanceof OAuthError)) throw err;
      console.warn('sign-in failed:', err.message);
      return back('error');
    }

    const subjectHash = await keyedHash(pepper(c), 'identity', `${provider.id}:${subject}`);
    const linked = await c.env.DB.prepare('SELECT profile_id FROM identities WHERE provider = ? AND subject_hash = ?')
      .bind(provider.id, subjectHash)
      .first<{ profile_id: string }>();
    const current = await findProfile(c);
    const country = (c.req.raw as { cf?: { country?: unknown } }).cf?.country;
    const guessedCountry = isCountry(country) ? country : null;

    if (linked) {
      // Known account. Progress made anonymously on this device moves into it.
      if (current && current !== linked.profile_id) {
        if (await hasAccount(c, current)) {
          await endSession(c);
        } else {
          await c.env.DB.batch([
            c.env.DB.prepare(
              `INSERT OR IGNORE INTO results (profile_id, puzzle_number, time_ms, undos, hints, verified, solved_at)
               SELECT ?, puzzle_number, time_ms, undos, hints, verified, solved_at FROM results WHERE profile_id = ?`,
            ).bind(linked.profile_id, current),
            c.env.DB.prepare(
              `INSERT OR IGNORE INTO endless_results (profile_id, level, time_ms, hints, verified, solved_at)
               SELECT ?, level, time_ms, hints, verified, solved_at FROM endless_results WHERE profile_id = ?`,
            ).bind(linked.profile_id, current),
            ...deleteProfileRows(c, current),
          ]);
          await updateRun(c.env.DB, linked.profile_id);
        }
      }
      if (current !== linked.profile_id) await startSession(c, linked.profile_id);
      return back('welcome-back');
    }

    // New account: attach it to this device's profile, unless that one already has a
    // different account of this provider (then the new account gets a fresh profile).
    let profileId = current;
    if (profileId) {
      const other = await c.env.DB.prepare('SELECT 1 AS x FROM identities WHERE profile_id = ? AND provider = ?').bind(profileId, provider.id).first();
      if (other) {
        await endSession(c);
        profileId = null;
      }
    }
    if (!profileId) profileId = (await createProfile(c, guessedCountry)).id;
    else if (guessedCountry) {
      await c.env.DB.prepare('UPDATE profiles SET country = COALESCE(country, ?) WHERE id = ?').bind(guessedCountry, profileId).run();
    }
    await c.env.DB.prepare('INSERT INTO identities (provider, subject_hash, profile_id, created_at) VALUES (?, ?, ?, ?)')
      .bind(provider.id, subjectHash, profileId, now())
      .run();
    return back('new');
  });

  /** Signs this device out. The account and its progress stay on the server. */
  app.post('/auth/logout', async (c) => {
    await endSession(c);
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
