import { defineConfig } from 'vite';

export default defineConfig({
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
  server: {
    // Local API: `pnpm --filter @bridgle/api dev` (wrangler on :8787). In production the
    // Worker is routed on the same domain under /api, so the app always uses relative URLs.
    proxy: {
      '/api': 'http://127.0.0.1:8787',
    },
  },
});
