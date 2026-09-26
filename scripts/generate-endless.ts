/**
 * Keeps enough endless levels in D1: at least --min levels, and always --ahead levels past
 * the furthest level any player has solved. Levels never change once written. Run from
 * the repo root:
 *
 *   node scripts/generate-endless.ts                 # write SQL to scripts/out/, touch nothing
 *   node scripts/generate-endless.ts --apply local   # into the local wrangler D1
 *   node scripts/generate-endless.ts --apply remote  # into production D1 (needs CLOUDFLARE_API_TOKEN)
 *
 * Options: --min <n> (default 1000), --ahead <n> (default 500).
 */
import { generateEndless, serializePuzzle } from '../packages/core/src/index.ts';
import { applyTarget, arg, migrate, query, sqlString, writeAndApply } from './lib/d1.ts';

const min = Number(arg('min') ?? 1000);
const ahead = Number(arg('ahead') ?? 500);
const target = applyTarget();

let stored = 0;
let reached = 0;
if (target) {
  migrate(target);
  stored = query<{ n: number | null }>(target, 'SELECT MAX(level) AS n FROM endless_puzzles')[0]?.n ?? 0;
  reached = query<{ n: number | null }>(target, 'SELECT MAX(level) AS n FROM endless_results')[0]?.n ?? 0;
}

const last = Math.max(min, reached + ahead);
if (stored >= last) {
  console.log(`Levels 1–${stored} exist; the furthest solved level is ${reached}. Nothing to do.`);
  process.exit(0);
}

const t0 = performance.now();
const sql: string[] = [];
for (let level = stored + 1; level <= last; level++) {
  const g = generateEndless(level);
  sql.push(`INSERT OR IGNORE INTO endless_puzzles (level, data, difficulty) VALUES (${level}, ${sqlString(serializePuzzle(g.puzzle))}, ${g.report.score});`);
}
console.log(`Generated levels ${stored + 1}–${last} in ${Math.round(performance.now() - t0)} ms`);
writeAndApply(`endless-${stored + 1}-${last}`, sql, target);
