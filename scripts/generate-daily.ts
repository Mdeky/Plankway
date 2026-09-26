/**
 * Generates the daily puzzles that are still missing for the coming days and writes them
 * to D1. Run from the repo root:
 *
 *   node scripts/generate-daily.ts                 # write SQL to scripts/out/, touch nothing
 *   node scripts/generate-daily.ts --apply local   # into the local wrangler D1
 *   node scripts/generate-daily.ts --apply remote  # into production D1 (needs CLOUDFLARE_API_TOKEN)
 *
 * Options: --days <n> (default 14).
 */
import { dateForNumber, formatDate, generateDaily, puzzleNumber, serializePuzzle } from '../packages/core/src/index.ts';
import { applyTarget, arg, migrate, query, sqlString, writeAndApply } from './lib/d1.ts';

const days = Number(arg('days') ?? 14);
const target = applyTarget();

function dateAtOffset(hours: number) {
  const d = new Date(Date.now() + hours * 3_600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

// From the earliest "today" on earth (UTC−12) to `days` past the latest one (UTC+14).
const first = Math.max(1, puzzleNumber(dateAtOffset(-12)));
const last = Math.max(1, puzzleNumber(dateAtOffset(14))) + days;

let existing = new Set<number>();
if (target) {
  migrate(target);
  existing = new Set(query<{ number: number }>(target, `SELECT number FROM puzzles WHERE number >= ${first}`).map((r) => r.number));
}

const sql: string[] = [];
for (let n = first; n <= last; n++) {
  if (existing.has(n)) continue;
  const t0 = performance.now();
  const g = generateDaily(n);
  const date = formatDate(dateForNumber(n));
  sql.push(
    `INSERT OR IGNORE INTO puzzles (number, date, data, difficulty) VALUES (${n}, '${date}', ${sqlString(serializePuzzle(g.puzzle))}, ${g.report.score});`,
  );
  console.log(`#${n} ${date} ${g.puzzle.width}x${g.puzzle.height} ${g.report.tier} (${Math.round(performance.now() - t0)} ms)`);
}

if (sql.length === 0) {
  console.log(`All puzzles #${first}–#${last} already exist.`);
  process.exit(0);
}
writeAndApply(`daily-${first}-${last}`, sql, target);
