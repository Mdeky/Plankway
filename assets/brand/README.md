# Brand artwork (sources)

Full-size originals. The site never loads these directly; smaller versions are made from them:

| Source | Used for | How |
|---|---|---|
| `plankway-logo.png` | App icons in `apps/web/public/icons/` | `node scripts/make-icons.ts` |
| `background-desktop.png` | Home background (wide screens) | `ffmpeg -i background-desktop.png -c:v libwebp -quality 78 -compression_level 6 ../../apps/web/src/assets/background-desktop.webp` |
| `background-mobile.png` | Home background (phones) | same, to `background-mobile.webp` |
| `background-desktop.png` | Link preview image `apps/web/public/og-image.jpg` | `ffmpeg -i background-desktop.png -vf "scale=1200:-1:flags=lanczos,crop=1200:630:0:(ih-630)/2" -q:v 3 ../../apps/web/public/og-image.jpg` |
| `plankway-bridge.png` | Not used yet | |
