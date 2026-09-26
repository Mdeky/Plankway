/**
 * Leaderboards. Only players who signed in and picked a name appear; anonymous profiles
 * still count once they sign in (their results move into the account).
 *
 * - daily:   fastest verified time per daily puzzle; every hint adds 30 seconds
 * - level:   the same, per endless level
 * - run:     furthest endless level, counted as the unbroken run from level 1 (hints allowed)
 *
 * Each board covers the whole world, one country, or a player and their friends.
 */
import type { D1Database } from './db.ts';

export const BOARD_SIZE = 50;

/** Every hint used adds this much to a time on the time boards. */
export const HINT_PENALTY_MS = 30_000;
/** Must match the expression the board indexes use (migration 0006). */
const SCORE = `r.time_ms + r.hints * ${HINT_PENALTY_MS}`;

export interface BoardEntry {
  rank: number;
  name: string;
  country: string | null;
  /** Time boards: time plus hint penalty. Run board: furthest level. */
  value: number;
  /** Time boards: hints included in `value` (only when there were any). */
  hints?: number;
  you?: true;
}

/** Why the player isn't on the board (or null when they are, or have no profile). */
export type Absence = 'no-name' | 'not-played' | 'unverified';

export interface Board {
  entries: BoardEntry[];
  you: { rank: number; value: number } | { rank: null; reason: Absence } | null;
}

interface Row {
  id: string;
  name: string;
  country: string | null;
  value: number;
  at: number;
}

/** Recomputes a profile's unbroken endless run (after new or merged results). */
export async function updateRun(db: D1Database, profileId: string): Promise<void> {
  await db
    .prepare(
      `WITH RECURSIVE run(level, solved_at) AS (
         SELECT level, solved_at FROM endless_results WHERE profile_id = ?1 AND level = 1
         UNION ALL
         SELECT e.level, e.solved_at FROM endless_results e JOIN run ON e.profile_id = ?1 AND e.level = run.level + 1
       )
       UPDATE profiles SET
         endless_run = COALESCE((SELECT MAX(level) FROM run), 0),
         endless_run_at = (SELECT MAX(solved_at) FROM run)
       WHERE id = ?1`,
    )
    .bind(profileId)
    .run();
}

export type Scope = { country: string } | { friendsOf: string } | null;

/** Extra WHERE clause (on profiles `p`) and its values for a scope. */
function scopeFilter(scope: Scope): [string, unknown[]] {
  if (!scope) return ['', []];
  if ('country' in scope) return ['AND p.country = ?', [scope.country]];
  return ['AND (p.id = ? OR p.id IN (SELECT friend_id FROM friendships WHERE profile_id = ?))', [scope.friendsOf, scope.friendsOf]];
}

/** A player outside the chosen country simply isn't part of that board. */
const outsideScope = (scope: Scope, country: string | null) => !!scope && 'country' in scope && scope.country !== country;

/** Fastest times: `source` is results (daily) or endless_results (per level). */
export async function timeBoard(
  db: D1Database,
  kind: 'daily' | 'level',
  id: number,
  scope: Scope,
  profileId: string | null,
): Promise<Board> {
  const table = kind === 'daily' ? 'results' : 'endless_results';
  const key = kind === 'daily' ? 'puzzle_number' : 'level';
  const [filter, filterArgs] = scopeFilter(scope);
  const where = `r.${key} = ? AND r.verified = 1 AND p.display_name IS NOT NULL ${filter}`;
  const args = [id, ...filterArgs];

  const { results } = await db
    .prepare(
      `SELECT p.id AS id, p.display_name AS name, p.country AS country, ${SCORE} AS value, r.hints AS hints, r.solved_at AS at
       FROM ${table} r JOIN profiles p ON p.id = r.profile_id
       WHERE ${where} ORDER BY ${SCORE}, r.solved_at LIMIT ${BOARD_SIZE}`,
    )
    .bind(...args)
    .all<Row & { hints: number }>();
  const entries = toEntries(results, profileId).map((e, i) => (results[i]!.hints > 0 ? { ...e, hints: results[i]!.hints } : e));
  if (!profileId) return { entries, you: null };

  const own = await db
    .prepare(
      `SELECT ${SCORE} AS value, r.solved_at AS at, r.verified AS verified,
              p.display_name AS name, p.country AS country
       FROM profiles p LEFT JOIN ${table} r ON r.profile_id = p.id AND r.${key} = ?
       WHERE p.id = ?`,
    )
    .bind(id, profileId)
    .first<{ value: number | null; at: number | null; verified: number | null; name: string | null; country: string | null }>();

  if (!own?.name) return { entries, you: { rank: null, reason: 'no-name' } };
  if (own.value === null) return { entries, you: { rank: null, reason: 'not-played' } };
  if (!own.verified) return { entries, you: { rank: null, reason: 'unverified' } };
  if (outsideScope(scope, own.country)) return { entries, you: null };

  const ahead = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM ${table} r JOIN profiles p ON p.id = r.profile_id
       WHERE ${where} AND (${SCORE} < ? OR (${SCORE} = ? AND r.solved_at < ?))`,
    )
    .bind(...args, own.value, own.value, own.at)
    .first<{ n: number }>();
  return { entries, you: { rank: (ahead?.n ?? 0) + 1, value: own.value } };
}

export async function runBoard(db: D1Database, scope: Scope, profileId: string | null): Promise<Board> {
  const [filter, args] = scopeFilter(scope);
  const where = `p.display_name IS NOT NULL AND p.endless_run > 0 ${filter}`;
  const { results } = await db
    .prepare(
      `SELECT p.id AS id, p.display_name AS name, p.country AS country, p.endless_run AS value, p.endless_run_at AS at
       FROM profiles p WHERE ${where} ORDER BY p.endless_run DESC, p.endless_run_at LIMIT ${BOARD_SIZE}`,
    )
    .bind(...args)
    .all<Row>();
  const entries = toEntries(results, profileId);
  if (!profileId) return { entries, you: null };

  const own = await db
    .prepare('SELECT display_name AS name, country, endless_run AS value, endless_run_at AS at FROM profiles WHERE id = ?')
    .bind(profileId)
    .first<{ name: string | null; country: string | null; value: number; at: number | null }>();
  if (!own?.name) return { entries, you: { rank: null, reason: 'no-name' } };
  if (own.value === 0) return { entries, you: { rank: null, reason: 'not-played' } };
  if (outsideScope(scope, own.country)) return { entries, you: null };

  const ahead = await db
    .prepare(
      `SELECT COUNT(*) AS n FROM profiles p
       WHERE ${where} AND (p.endless_run > ? OR (p.endless_run = ? AND p.endless_run_at < ?))`,
    )
    .bind(...args, own.value, own.value, own.at)
    .first<{ n: number }>();
  return { entries, you: { rank: (ahead?.n ?? 0) + 1, value: own.value } };
}

function toEntries(rows: Row[], profileId: string | null): BoardEntry[] {
  return rows.map((r, i) => ({
    rank: i + 1,
    name: r.name,
    country: r.country,
    value: r.value,
    ...(r.id === profileId ? { you: true as const } : {}),
  }));
}
