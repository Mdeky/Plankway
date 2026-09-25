/**
 * Pre-launch checklist. Fails while something that must be filled in is still a
 * placeholder; warns about optional things (like ads).
 *
 *   node scripts/check-launch.ts
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEGAL } from '../apps/web/src/content/legal.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const blocking: string[] = [];
const warnings: string[] = [];

for (const [key, value] of Object.entries(LEGAL)) {
  if (value.includes('[')) blocking.push(`apps/web/src/content/legal.ts: "${key}" is still a placeholder`);
}

const wrangler = readFileSync(join(root, 'apps', 'api', 'wrangler.toml'), 'utf8');
if (wrangler.includes('00000000-0000-0000-0000-000000000000')) {
  blocking.push('apps/api/wrangler.toml: database_id is still the placeholder (run `wrangler d1 create plankway`)');
}

const envFile = join(root, 'apps', 'web', '.env.production.local');
const env = existsSync(envFile) ? readFileSync(envFile, 'utf8') : '';
const envValue = (name: string) => env.match(new RegExp(`^${name}=(.*)$`, 'm'))?.[1]?.trim() ?? '';
if (!envValue('VITE_SITE_URL')) warnings.push('VITE_SITE_URL not set in apps/web/.env.production.local (share text uses plankway.com)');
if (!envValue('VITE_ADSENSE_CLIENT')) warnings.push('No AdSense publisher id: the site launches without ads');

for (const w of warnings) console.log(`⚠  ${w}`);
for (const b of blocking) console.log(`✗  ${b}`);
if (blocking.length) {
  console.log(`\n${blocking.length} item(s) must be done before launch.`);
  process.exit(1);
}
console.log('✓  Ready for launch.');
