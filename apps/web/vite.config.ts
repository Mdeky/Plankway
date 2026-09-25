import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/** Local API: `pnpm dev:api` (wrangler on :8787). In production /api is routed on the same domain. */
const apiProxy = { '/api': 'http://127.0.0.1:8787' };

/**
 * Builds sw.js from sw/sw.js after the bundle is written: injects the list of every built
 * file (so the whole app, including the generator worker, works offline) and a content
 * hash as cache version.
 */
function serviceWorker(): Plugin {
  let outDir = '';
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const full = join(dir, name);
      return statSync(full).isDirectory() ? walk(full) : [full];
    });
  return {
    name: 'bridgle-sw',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const files = walk(outDir)
        .map((f) => relative(outDir, f).split(sep).join('/'))
        .filter((f) => f !== 'sw.js' && f !== 'robots.txt' && f !== '_headers' && !f.endsWith('.map'))
        .sort();
      const template = readFileSync(resolve(outDir, '..', 'sw', 'sw.js'), 'utf8');
      const hash = createHash('sha256').update(template);
      for (const f of files) hash.update(f).update(readFileSync(join(outDir, f)));
      const version = hash.digest('hex').slice(0, 12);
      const code = template
        .replace('__VERSION__', JSON.stringify(version))
        .replace('__PRECACHE__', JSON.stringify(files.map((f) => `/${f}`)));
      writeFileSync(join(outDir, 'sw.js'), code);
      console.log(`bridgle-sw: ${files.length} files precached, version ${version}`);
    },
  };
}

export default defineConfig({
  plugins: [serviceWorker()],
  esbuild: {
    jsx: 'automatic',
    jsxImportSource: 'preact',
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2022',
  },
  server: { proxy: apiProxy },
  preview: { proxy: apiProxy },
});
