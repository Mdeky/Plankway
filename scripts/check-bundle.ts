/**
 * Fails when the initial JavaScript of the web app exceeds the budget (100 KB gzip,
 * excluding ad scripts). Run after `pnpm --filter @bridgle/web build`:
 *
 *   node scripts/check-bundle.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

const BUDGET_KB = 100;
const dist = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'apps', 'web', 'dist');
if (!existsSync(join(dist, 'index.html'))) {
  console.error('No build found. Run: pnpm --filter @bridgle/web build');
  process.exit(1);
}

const html = readFileSync(join(dist, 'index.html'), 'utf8');
// Everything the browser loads before the app starts: entry scripts and module preloads.
const initial = [
  ...html.matchAll(/<script[^>]+src="([^"]+\.js)"/g),
  ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+\.js)"/g),
].map((m) => m[1]!);

const kb = (bytes: number) => bytes / 1024;
let total = 0;
for (const file of new Set(initial)) {
  const size = gzipSync(readFileSync(join(dist, file))).length;
  total += size;
  console.log(`${file.padEnd(40)} ${kb(size).toFixed(1).padStart(6)} KB gzip`);
}
console.log(`${'initial JS total'.padEnd(40)} ${kb(total).toFixed(1).padStart(6)} KB gzip (budget ${BUDGET_KB} KB)`);
if (kb(total) > BUDGET_KB) {
  console.error('Over budget!');
  process.exit(1);
}
