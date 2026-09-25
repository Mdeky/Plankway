/**
 * Generates the daily puzzles that are still missing for the coming days and writes them
 * to D1. Run from the repo root:
 *
 *   node scripts/generate-daily.ts                 # write SQL to scripts/out/, touch nothing
 *   node scripts/generate-daily.ts --apply local   # into the local wrangler D1
 *   node scripts/generate-daily.ts --apply remote  # into production D1 (needs CLOUDFLARE_API_TOKEN)
 *
 * Options: --days <n> (default 14).
 * Generation runs here, not in the Worker: the free Workers plan has too little CPU time.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dateForNumber, formatDate, generateDaily, puzzleNumber, serializePuzzle } from '../packages/core/src/index.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const apiDir = join(root, 'apps', 'api');

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const days = Number(arg('days') ?? 14);
const apply = arg('apply');
if (apply !== undefined && apply !== 'local' && apply !== 'remote') {
  console.error('--apply must be "local" or "remote"');
  process.exit(1);
}

// Catch the most common CI mistake early: a secret pasted with extra text or line breaks.
if (apply === 'remote' && process.env.CLOUDFLARE_API_TOKEN !== undefined) {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (/\s/.test(token) || token.length < 30) {
    console.error(
      'CLOUDFLARE_API_TOKEN looks wrong: it must be the bare token on one line (no spaces, line breaks, ' +
        '"Bearer" or curl command). Edit the secret in GitHub → Settings → Secrets and variables → Actions.',
    );
    process.exit(1);
  }
  if (process.env.CLOUDFLARE_ACCOUNT_ID !== undefined && !/^[0-9a-f]{32}$/.test(process.env.CLOUDFLARE_ACCOUNT_ID.trim())) {
    console.error('CLOUDFLARE_ACCOUNT_ID looks wrong: expected the 32-character account id.');
    process.exit(1);
  }
}

function wrangler(args: string[]): string {
  // One command string: pnpm is a .cmd shim on Windows and needs a shell. Only our own
  // fixed arguments go in here, never outside input.
  const res = spawnSync(['pnpm', 'exec', 'wrangler', ...args].join(' '), { cwd: apiDir, encoding: 'utf8', shell: true });
  if (res.status !== 0) {
    console.error(res.stdout, res.stderr);
    throw new Error(`wrangler ${args.join(' ')} failed`);
  }
  return res.stdout;
}

function dateAtOffset(hours: number) {
  const d = new Date(Date.now() + hours * 3_600_000);
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() };
}

// From the earliest "today" on earth (UTC−12) to `days` past the latest one (UTC+14).
const first = Math.max(1, puzzleNumber(dateAtOffset(-12)));
const last = Math.max(1, puzzleNumber(dateAtOffset(14))) + days;

let existing = new Set<number>();
if (apply) {
  const target = `--${apply}`;
  wrangler(['d1', 'migrations', 'apply', 'plankway', target]);
  const out = wrangler(['d1', 'execute', 'plankway', target, '--json', '--command', `"SELECT number FROM puzzles WHERE number >= ${first}"`]);
  const parsed = JSON.parse(out.slice(out.indexOf('['))) as { results: { number: number }[] }[];
  existing = new Set(parsed.flatMap((r) => r.results.map((row) => row.number)));
}

const sql: string[] = [];
for (let n = first; n <= last; n++) {
  if (existing.has(n)) continue;
  const t0 = performance.now();
  const g = generateDaily(n);
  const data = serializePuzzle(g.puzzle).replace(/'/g, "''");
  const date = formatDate(dateForNumber(n));
  sql.push(`INSERT OR IGNORE INTO puzzles (number, date, data, difficulty) VALUES (${n}, '${date}', '${data}', ${g.report.score});`);
  console.log(`#${n} ${date} ${g.puzzle.width}x${g.puzzle.height} ${g.report.tier} (${Math.round(performance.now() - t0)} ms)`);
}

if (sql.length === 0) {
  console.log(`All puzzles #${first}–#${last} already exist.`);
  process.exit(0);
}

const outDir = join(root, 'scripts', 'out');
mkdirSync(outDir, { recursive: true });
const file = join(outDir, `daily-${first}-${last}.sql`);
writeFileSync(file, sql.join('\n') + '\n');
console.log(`Wrote ${sql.length} puzzles to ${file}`);

if (apply) {
  wrangler(['d1', 'execute', 'plankway', `--${apply}`, '--file', `"${file}"`, ...(apply === 'remote' ? ['--yes'] : [])]);
  console.log(`Applied to ${apply} D1.`);
}
