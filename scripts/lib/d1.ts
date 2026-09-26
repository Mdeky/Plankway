/**
 * Shared helpers for the scripts that fill D1 (daily puzzles, endless levels).
 * Generation runs here, not in the Worker: the free Workers plan has too little CPU time.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const apiDir = join(root, 'apps', 'api');

export type Target = 'local' | 'remote';

export function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/** Reads `--apply local|remote`; exits on anything else. */
export function applyTarget(): Target | undefined {
  const apply = arg('apply');
  if (apply !== undefined && apply !== 'local' && apply !== 'remote') {
    console.error('--apply must be "local" or "remote"');
    process.exit(1);
  }
  if (apply === 'remote') checkCloudflareEnv();
  return apply;
}

/** Catches the most common CI mistake early: a secret pasted with extra text or line breaks. */
function checkCloudflareEnv(): void {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (token !== undefined && (/\s/.test(token) || token.length < 30)) {
    console.error(
      'CLOUDFLARE_API_TOKEN looks wrong: it must be the bare token on one line (no spaces, line breaks, ' +
        '"Bearer" or curl command). Edit the secret in GitHub → Settings → Secrets and variables → Actions.',
    );
    process.exit(1);
  }
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (account !== undefined && !/^[0-9a-f]{32}$/.test(account.trim())) {
    console.error('CLOUDFLARE_ACCOUNT_ID looks wrong: expected the 32-character account id.');
    process.exit(1);
  }
}

export function wrangler(args: string[]): string {
  // One command string: pnpm is a .cmd shim on Windows and needs a shell. Only our own
  // fixed arguments go in here, never outside input.
  const res = spawnSync(['pnpm', 'exec', 'wrangler', ...args].join(' '), { cwd: apiDir, encoding: 'utf8', shell: true });
  if (res.status !== 0) {
    console.error(res.stdout, res.stderr);
    throw new Error(`wrangler ${args.join(' ')} failed`);
  }
  return res.stdout;
}

export function migrate(target: Target): void {
  wrangler(['d1', 'migrations', 'apply', 'plankway', `--${target}`]);
}

/** Runs a read-only query; `sql` must be a fixed string from our own code. */
export function query<T>(target: Target, sql: string): T[] {
  const out = wrangler(['d1', 'execute', 'plankway', `--${target}`, '--json', '--command', `"${sql}"`]);
  const parsed = JSON.parse(out.slice(out.indexOf('['))) as { results: T[] }[];
  return parsed.flatMap((r) => r.results);
}

/** Writes the statements to scripts/out/<name>.sql and, with a target, runs them. */
export function writeAndApply(name: string, sql: string[], target: Target | undefined): void {
  const outDir = join(root, 'scripts', 'out');
  mkdirSync(outDir, { recursive: true });
  const file = join(outDir, `${name}.sql`);
  writeFileSync(file, sql.join('\n') + '\n');
  console.log(`Wrote ${sql.length} statements to ${file}`);
  if (target) {
    wrangler(['d1', 'execute', 'plankway', `--${target}`, '--file', `"${file}"`, ...(target === 'remote' ? ['--yes'] : [])]);
    console.log(`Applied to ${target} D1.`);
  }
}

export const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;
