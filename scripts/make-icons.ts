/**
 * Makes the app icons (favicon, Apple touch icon, PWA icons) from the PlankWay logo in
 * assets/brand/plankway-logo.png and writes them into apps/web/public/icons.
 * Needs ffmpeg on the PATH.
 *
 *   node scripts/make-icons.ts
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = join(root, 'assets', 'brand', 'plankway-logo.png');
const outDir = join(root, 'apps', 'web', 'public', 'icons');

/** The logo's own off-white, so padding blends in. */
const BACKGROUND = '0xFEFDF8';
/** The round badge inside the 1254×1254 logo, with a little breathing room. */
const BADGE = { x: 62, y: 60, size: 1138 };
/**
 * Maskable icons get cropped to a circle or squircle by the launcher; only the middle 80%
 * is guaranteed to show. Padding the badge to this canvas keeps it inside that zone.
 */
const MASKABLE_CANVAS = 1340;

const icons: { file: string; size: number; maskable?: boolean }[] = [
  { file: 'favicon-32.png', size: 32 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'maskable-512.png', size: 512, maskable: true },
];

mkdirSync(outDir, { recursive: true });
for (const icon of icons) {
  const crop = `crop=${BADGE.size}:${BADGE.size}:${BADGE.x}:${BADGE.y}`;
  const pad = (MASKABLE_CANVAS - BADGE.size) / 2;
  const filters = icon.maskable
    ? `${crop},pad=${MASKABLE_CANVAS}:${MASKABLE_CANVAS}:${pad}:${pad}:color=${BACKGROUND},scale=${icon.size}:${icon.size}:flags=lanczos`
    : `${crop},scale=${icon.size}:${icon.size}:flags=lanczos`;
  const out = join(outDir, icon.file);
  // Cartoon art survives a 256-colour palette well, at a fraction of the size (the icons
  // are precached by the service worker, so every player downloads them).
  const graph = `[0:v]${filters},split[a][b];[a]palettegen=max_colors=256:stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a`;
  const res = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', source, '-filter_complex', graph, '-compression_level', '100', out], {
    encoding: 'utf8',
  });
  if (res.status !== 0) {
    console.error(res.stderr || res.error);
    process.exit(1);
  }
  console.log(`${icon.file} (${icon.size}px${icon.maskable ? ', maskable' : ''})`);
}
