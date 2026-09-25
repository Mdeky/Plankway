/**
 * Draws the app icons procedurally and writes them as PNG into apps/web/public/icons.
 * No image files or fonts with unclear licences: everything is geometry, rasterized with
 * 4×4 supersampling and encoded with Node's built-in zlib.
 *
 *   node scripts/make-icons.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

type RGBA = [number, number, number, number];

const hex = (h: string, a = 1): RGBA => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), a];

// ── PNG encoding ───────────────────────────────────────────────────────────

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  out.set(new TextEncoder().encode(type), 4);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    raw.set(rgba.subarray(y * width * 4, (y + 1) * width * 4), y * (width * 4 + 1) + 1);
  }
  const parts = [
    new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', new Uint8Array()),
  ];
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

// ── Scene (unit coordinates 0..1) ──────────────────────────────────────────

type Shape = { inside(x: number, y: number): boolean; color: RGBA | ((x: number, y: number) => RGBA) };

const circle = (cx: number, cy: number, r: number, color: Shape['color']): Shape => ({
  inside: (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r,
  color,
});

const rect = (x0: number, y0: number, x1: number, y1: number, color: Shape['color'], radius = 0): Shape => ({
  inside: (x, y) => {
    if (x < x0 || x > x1 || y < y0 || y > y1) return false;
    const cx = Math.min(Math.max(x, x0 + radius), x1 - radius);
    const cy = Math.min(Math.max(y, y0 + radius), y1 - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius;
  },
  color,
});

/** Two islands joined by a double plank bridge on a gradient sea. `inset` shrinks the art for maskable icons. */
function scene(maskable: boolean): Shape[] {
  const s = maskable ? 0.78 : 1;
  const m = (v: number) => 0.5 + (v - 0.5) * s;
  const sea = (_: number, y: number): RGBA => {
    const a = hex('#8adbdf');
    const b = hex('#4fb0c6');
    return [a[0] + (b[0] - a[0]) * y, a[1] + (b[1] - a[1]) * y, a[2] + (b[2] - a[2]) * y, 1];
  };
  const shapes: Shape[] = [maskable ? rect(0, 0, 1, 1, sea) : rect(0, 0, 1, 1, sea, 0.22)];

  // Little waves.
  for (const [wx, wy] of [
    [0.2, 0.26],
    [0.62, 0.2],
    [0.45, 0.82],
    [0.8, 0.86],
  ] as const) {
    shapes.push(rect(m(wx), m(wy), m(wx + 0.1), m(wy + 0.018), hex('#ffffff', 0.55), 0.009 * s));
  }

  // Bridge: one wide lane of planks with rope rails.
  const y0 = 0.555;
  const y1 = 0.665;
  for (let i = 0; i < 9; i++) {
    const x = 0.3 + i * 0.047;
    shapes.push(rect(m(x), m(y0), m(x + 0.03), m(y1), hex('#c68a4f'), 0.005 * s));
  }
  shapes.push(rect(m(0.28), m(y0 + 0.004), m(0.72), m(y0 + 0.016), hex('#5e3b1e'), 0.006 * s));
  shapes.push(rect(m(0.28), m(y1 - 0.016), m(0.72), m(y1 - 0.004), hex('#5e3b1e'), 0.006 * s));

  for (const cx of [0.2, 0.8]) {
    shapes.push(circle(m(cx), m(0.62), 0.16 * s, hex('#c99a5b')));
    shapes.push(circle(m(cx), m(0.615), 0.145 * s, hex('#f7e2a8')));
    shapes.push(circle(m(cx), m(0.6), 0.1 * s, hex('#8fcf6a')));
  }

  // Palm tree on the left island.
  shapes.push(rect(m(0.19), m(0.36), m(0.225), m(0.62), hex('#8a5a32'), 0.012 * s));
  const leaf = (cx: number, cy: number, rx: number, ry: number, rot: number): Shape => ({
    inside: (x, y) => {
      const dx = x - m(cx);
      const dy = y - m(cy);
      const u = dx * Math.cos(rot) + dy * Math.sin(rot);
      const v = -dx * Math.sin(rot) + dy * Math.cos(rot);
      return (u / (rx * s)) ** 2 + (v / (ry * s)) ** 2 <= 1;
    },
    color: hex('#3f9a45'),
  });
  shapes.push(leaf(0.13, 0.37, 0.09, 0.035, 0.45));
  shapes.push(leaf(0.28, 0.37, 0.09, 0.035, -0.45));
  shapes.push(leaf(0.21, 0.32, 0.035, 0.08, 0));
  shapes.push(circle(m(0.2), m(0.39), 0.018 * s, hex('#7a4f2a')));

  // A flag on the right island: "solved".
  shapes.push(rect(m(0.795), m(0.33), m(0.815), m(0.6), hex('#7a4f2a'), 0.006 * s));
  shapes.push(rect(m(0.815), m(0.33), m(0.93), m(0.41), hex('#ffcf3f'), 0.012 * s));
  return shapes;
}

function render(size: number, maskable: boolean): Uint8Array {
  const shapes = scene(maskable);
  const out = new Uint8Array(size * size * 4);
  const N = 4;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < N; sy++) {
        for (let sx = 0; sx < N; sx++) {
          const x = (px + (sx + 0.5) / N) / size;
          const y = (py + (sy + 0.5) / N) / size;
          let col: RGBA = [0, 0, 0, 0];
          for (const shape of shapes) {
            if (shape.inside(x, y)) col = typeof shape.color === 'function' ? shape.color(x, y) : shape.color;
          }
          r += col[0] * col[3];
          g += col[1] * col[3];
          b += col[2] * col[3];
          a += col[3];
        }
      }
      const i = (py * size + px) * 4;
      out[i] = a ? Math.round(r / a) : 0;
      out[i + 1] = a ? Math.round(g / a) : 0;
      out[i + 2] = a ? Math.round(b / a) : 0;
      out[i + 3] = Math.round((a / (N * N)) * 255);
    }
  }
  return out;
}

const outDir = join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'apps', 'web', 'public', 'icons');
mkdirSync(outDir, { recursive: true });
const icons: [string, number, boolean][] = [
  ['icon-192.png', 192, false],
  ['icon-512.png', 512, false],
  ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true],
  ['favicon-32.png', 32, false],
];
for (const [name, size, maskable] of icons) {
  const png = encodePng(size, size, render(size, maskable));
  writeFileSync(join(outDir, name), png);
  console.log(`${name} ${size}×${size} ${(png.length / 1024).toFixed(1)} KB`);
}
