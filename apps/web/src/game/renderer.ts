import type { Board, IslandStatus } from '@bridgle/core';
import {
  drawBoat,
  drawBridge,
  drawDecor,
  drawGull,
  drawWave,
  makeIslandArt,
  makeReefArt,
  makeWaves,
  type IslandArt,
  type Palette,
  type Wave,
} from './art.ts';
import { cellCenter, islandCenter, type Layout, type Point } from './layout.ts';

export type { Palette } from './art.ts';

const PALETTE_VARS: Record<Exclude<keyof Palette, 'night'>, string> = {
  waterTop: '--water',
  waterBottom: '--water-deep',
  wave: '--wave',
  waterDot: '--water-dot',
  sand: '--sand',
  sandEdge: '--sand-edge',
  grass: '--grass',
  grassFull: '--grass-full',
  grassDark: '--grass-dark',
  over: '--island-over',
  sign: '--sign',
  signEdge: '--sign-edge',
  text: '--island-text',
  textGlow: '--text-glow',
  plank: '--plank',
  plankDark: '--plank-dark',
  rope: '--rope',
  preview: '--bridge-preview',
  rock: '--rock',
  rockDark: '--rock-dark',
  rockLight: '--rock-light',
  foam: '--foam',
  trunk: '--trunk',
  roof: '--roof',
  focus: '--focus',
  hint: '--hint',
  mistake: '--mistake',
  full: '--full',
  glow: '--glow',
  sail: '--sail',
  sailStripe: '--sail-stripe',
  hull: '--hull',
  bird: '--bird',
  sun: '--sun',
};

export function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const out = { night: Number(style.getPropertyValue('--night').trim()) || 0 } as Palette;
  for (const [key, cssVar] of Object.entries(PALETTE_VARS) as [Exclude<keyof Palette, 'night'>, string][]) {
    out[key] = style.getPropertyValue(cssVar).trim() || '#888';
  }
  return out;
}

export const BUILD_MS = 220;
export const FADE_MS = 320;
export const SPLASH_MS = 520;
export const WIN_MS = 2600;

export interface Build {
  edge: number;
  from: number;
  start: number;
}

export interface Fade {
  edge: number;
  count: number;
  start: number;
}

export interface Splash {
  at: Point;
  start: number;
}

export interface Scene {
  board: Board;
  layout: Layout;
  counts: ArrayLike<number>;
  statuses: IslandStatus[];
  selected: number;
  focused: number;
  showFocus: boolean;
  preview: number;
  hintEdges: number[];
  hintIsland: number;
  mistakeEdges: number[];
  flashEdge: number;
  now: number;
  /** Reduced motion: no waves, no pulsing, no transitions. */
  still: boolean;
  builds: Map<number, Build>;
  fades: Fade[];
  splashes: Splash[];
  winStart: number | null;
}

/** Per-layout cache of seeded shapes (rebuilt when the board or its size changes). */
export class ArtCache {
  private key = '';
  islands: IslandArt[] = [];
  reefs: ReturnType<typeof makeReefArt>[] = [];
  waves: Wave[] = [];

  get(board: Board, layout: Layout): this {
    const key = `${board.puzzle.id}|${board.puzzle.seed}|${layout.cell}|${layout.ox}|${layout.oy}`;
    if (key === this.key) return this;
    this.key = key;
    const seed = `${board.puzzle.seed}/${board.puzzle.id}`;
    this.islands = board.puzzle.islands.map((_, i) => makeIslandArt(`${seed}/island-${i}`, islandCenter(board, layout, i), layout.radius));
    this.reefs = board.puzzle.reefs.map((r, i) => makeReefArt(`${seed}/reef-${i}`, cellCenter(layout, r.x, r.y), layout.cell));
    this.waves = makeWaves(seed, board.width, board.height);
    return this;
  }
}

const ease = (t: number) => 1 - (1 - t) ** 3;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette, art: ArtCache): void {
  const { board, layout, now, still } = scene;
  const cell = layout.cell;
  ctx.clearRect(0, 0, layout.width, layout.height);

  // ── Sea ──
  const sea = ctx.createLinearGradient(0, 0, 0, layout.height);
  sea.addColorStop(0, p.waterTop);
  sea.addColorStop(1, p.waterBottom);
  ctx.fillStyle = sea;
  ctx.fillRect(0, 0, layout.width, layout.height);
  if (p.night) {
    const moon = ctx.createRadialGradient(layout.width * 0.85, 0, 0, layout.width * 0.85, 0, layout.width * 0.7);
    moon.addColorStop(0, p.glow);
    moon.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = moon;
    ctx.fillRect(0, 0, layout.width, layout.height);
  }

  ctx.fillStyle = p.waterDot;
  const dot = Math.max(1, cell * 0.03);
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const c = cellCenter(layout, x, y);
      ctx.fillRect(c.x - dot / 2, c.y - dot / 2, dot, dot);
    }
  }

  ctx.save();
  ctx.strokeStyle = p.wave;
  ctx.lineWidth = Math.max(1, cell * 0.035);
  ctx.lineCap = 'round';
  for (const w of art.waves) {
    const t = still ? 0 : now / 1800 + w.phase;
    ctx.globalAlpha = still ? 0.45 : 0.3 + 0.3 * (0.5 + 0.5 * Math.sin(t * 0.7));
    drawWave(ctx, layout.ox + w.x * cell + Math.sin(t) * cell * 0.08, layout.oy + w.y * cell, cell * 0.34, cell * 0.06);
  }
  ctx.restore();

  // ── Reefs ──
  art.reefs.forEach((reef, i) => {
    const c = cellCenter(layout, board.puzzle.reefs[i]!.x, board.puzzle.reefs[i]!.y);
    const s = still ? 1 : 1 + 0.05 * Math.sin(now / 650 + i);
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(s, s);
    ctx.translate(-c.x, -c.y);
    ctx.fillStyle = p.foam;
    ctx.fill(reef.foam);
    ctx.restore();
    ctx.lineWidth = Math.max(1, cell * 0.03);
    for (const rock of reef.rocks) {
      ctx.fillStyle = p.rock;
      ctx.strokeStyle = p.rockDark;
      ctx.fill(rock.path);
      ctx.stroke(rock.path);
      ctx.fillStyle = p.rockLight;
      ctx.beginPath();
      ctx.ellipse(rock.hx, rock.hy, rock.r * 0.3, rock.r * 0.18, -0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // ── Bridges ──
  for (const f of scene.fades) {
    const t = clamp01((now - f.start) / FADE_MS);
    drawBridge(ctx, { ...bridgeGeom(scene, f.edge), count: f.count, seed: f.edge + 1, progress: [1, 1], alpha: 1 - t, drop: t * cell * 0.12 }, p);
  }
  for (const e of board.edges) {
    const count = scene.counts[e.id] as number;
    if (count === 0) continue;
    const build = scene.builds.get(e.id);
    const t = build ? ease(clamp01((now - build.start) / BUILD_MS)) : 1;
    const progress: [number, number] = [build && build.from < 1 ? t : 1, build && build.from < 2 ? t : 1];
    drawBridge(ctx, { ...bridgeGeom(scene, e.id), count, seed: e.id + 1, progress, alpha: 1, drop: 0 }, p);
  }

  const pulse = still ? 0.6 : 0.5 + 0.5 * Math.sin(now / 250);
  for (const e of scene.hintEdges) highlight(ctx, scene, e, p.hint, pulse);
  for (const e of scene.mistakeEdges) highlight(ctx, scene, e, p.mistake, pulse);
  if (scene.flashEdge >= 0) highlight(ctx, scene, scene.flashEdge, p.mistake, pulse);
  if (scene.preview >= 0) {
    const next = ((scene.counts[scene.preview] as number) + 1) % 3;
    if (next > 0) {
      drawBridge(ctx, { ...bridgeGeom(scene, scene.preview), count: next, seed: scene.preview + 1, progress: [1, 1], alpha: 0.55, drop: 0, color: p.preview }, p);
    } else highlight(ctx, scene, scene.preview, p.preview, 0.5);
  }

  for (const s of scene.splashes) drawSplash(ctx, s, now, cell, p);

  // ── Islands ──
  board.puzzle.islands.forEach((isl, i) => drawIsland(ctx, scene, art.islands[i]!, i, isl.n, p, pulse));

  if (scene.winStart !== null) drawWin(ctx, scene, p);
}

function bridgeGeom(scene: Scene, edge: number) {
  const { board, layout } = scene;
  const e = board.edges[edge]!;
  const a = islandCenter(board, layout, e.a);
  const b = islandCenter(board, layout, e.b);
  const r = layout.radius * 0.72;
  return {
    a: e.horizontal ? { x: a.x + r, y: a.y } : { x: a.x, y: a.y + r },
    b: e.horizontal ? { x: b.x - r, y: b.y } : { x: b.x, y: b.y - r },
    horizontal: e.horizontal,
    cell: layout.cell,
  };
}

function highlight(ctx: CanvasRenderingContext2D, scene: Scene, edge: number, color: string, pulse: number) {
  const { a, b } = bridgeGeom(scene, edge);
  const cell = scene.layout.cell;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.4 + 0.4 * pulse;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(6, cell * 0.34);
  ctx.setLineDash([cell * 0.14, cell * 0.12]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawSplash(ctx: CanvasRenderingContext2D, s: Splash, now: number, cell: number, p: Palette) {
  const t = clamp01((now - s.start) / SPLASH_MS);
  if (t >= 1) return;
  ctx.save();
  ctx.strokeStyle = p.foam;
  ctx.fillStyle = p.foam;
  ctx.globalAlpha = 1 - t;
  ctx.lineWidth = Math.max(1.5, cell * 0.04);
  for (const k of [0, 0.35]) {
    const r = cell * (0.1 + 0.45 * ease(clamp01(t - k)));
    ctx.beginPath();
    ctx.ellipse(s.at.x, s.at.y, r, r * 0.45, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (let i = 0; i < 6; i++) {
    const a = -Math.PI / 2 + (i - 2.5) * 0.45;
    const d = cell * 0.4 * t;
    const x = s.at.x + Math.cos(a) * d;
    const y = s.at.y + Math.sin(a) * d * 1.4 + cell * 0.9 * t * t;
    ctx.beginPath();
    ctx.arc(x, y, Math.max(1, cell * 0.035 * (1 - t)), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawIsland(ctx: CanvasRenderingContext2D, scene: Scene, art: IslandArt, i: number, n: number, p: Palette, pulse: number) {
  const { board, layout } = scene;
  const c = islandCenter(board, layout, i);
  const cell = layout.cell;
  const r = layout.radius;
  const status = scene.statuses[i];

  ctx.save();
  if (scene.hintIsland === i) {
    ctx.fillStyle = p.hint;
    ctx.globalAlpha = 0.35 + 0.35 * pulse;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 1.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Soft shadow in the water, sand rim, grass top.
  ctx.save();
  ctx.translate(0, cell * 0.05);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fill(art.outer);
  ctx.restore();
  ctx.fillStyle = p.sand;
  ctx.strokeStyle = p.sandEdge;
  ctx.lineWidth = Math.max(1.2, cell * 0.03);
  ctx.fill(art.outer);
  ctx.stroke(art.outer);
  ctx.fillStyle = status === 'full' ? p.grassFull : status === 'over' ? p.over : p.grass;
  ctx.fill(art.inner);

  drawDecor(ctx, art.decor, c.x + art.decorAt.x * cell, c.y + art.decorAt.y * cell, cell * 0.36, p);

  // Number sign.
  const sr = cell * 0.22;
  ctx.fillStyle = p.sign;
  ctx.strokeStyle = status === 'over' ? p.mistake : p.signEdge;
  ctx.lineWidth = status === 'over' ? Math.max(2, cell * 0.05) : Math.max(1, cell * 0.025);
  ctx.beginPath();
  ctx.arc(c.x, c.y + cell * 0.03, sr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (p.night) {
    ctx.shadowColor = p.textGlow;
    ctx.shadowBlur = cell * 0.18;
  }
  ctx.fillStyle = p.text;
  ctx.font = `800 ${Math.round(sr * 1.35)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), c.x, c.y + cell * 0.045);
  ctx.shadowBlur = 0;

  // Status as shape, not only colour: a flag when complete, a "!" badge when over.
  if (status === 'full') drawFlag(ctx, c.x + r * 0.55, c.y - r * 0.2, cell * 0.28, p);
  if (status === 'over') drawBang(ctx, c.x + r * 0.72, c.y - r * 0.72, cell * 0.13, p);

  if (scene.selected === i) {
    ctx.strokeStyle = p.focus;
    ctx.lineWidth = Math.max(3, cell * 0.06);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 1.2, 0, Math.PI * 2);
    ctx.stroke();
  } else if (scene.showFocus && scene.focused === i) {
    ctx.strokeStyle = p.focus;
    ctx.lineWidth = Math.max(2, cell * 0.04);
    ctx.setLineDash([r * 0.25, r * 0.2]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 1.2, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
}

function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: Palette) {
  ctx.save();
  ctx.strokeStyle = p.plankDark;
  ctx.lineWidth = Math.max(1.2, s * 0.08);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.5);
  ctx.lineTo(x, y - s * 0.5);
  ctx.stroke();
  ctx.fillStyle = p.full;
  ctx.strokeStyle = p.plankDark;
  ctx.lineWidth = Math.max(1, s * 0.05);
  ctx.beginPath();
  ctx.moveTo(x, y - s * 0.5);
  ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.42, x + s * 0.55, y - s * 0.3);
  ctx.quadraticCurveTo(x + s * 0.3, y - s * 0.2, x, y - s * 0.12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawBang(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, p: Palette) {
  ctx.save();
  ctx.fillStyle = p.mistake;
  ctx.strokeStyle = p.sign;
  ctx.lineWidth = Math.max(1.2, r * 0.2);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = p.sign;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(1.5, r * 0.28);
  ctx.beginPath();
  ctx.moveTo(x, y - r * 0.5);
  ctx.lineTo(x, y + r * 0.1);
  ctx.moveTo(x, y + r * 0.48);
  ctx.lineTo(x, y + r * 0.5);
  ctx.stroke();
  ctx.restore();
}

/** Short celebration: the sun (or moon) comes out, gulls fly over, a boat sails by. */
function drawWin(ctx: CanvasRenderingContext2D, scene: Scene, p: Palette) {
  const { layout, now } = scene;
  const t = clamp01((now - scene.winStart!) / WIN_MS);
  const W = layout.width;
  const H = layout.height;
  const s = Math.min(W, H);
  const fadeIn = clamp01(t * 4);
  const fadeOut = clamp01((1 - t) * 5);
  const alpha = Math.min(fadeIn, fadeOut);

  ctx.save();
  ctx.globalAlpha = alpha;
  const cx = W * 0.86;
  const cy = H * 0.12;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, s * 0.7);
  glow.addColorStop(0, p.sun);
  glow.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = p.sun;
  ctx.lineWidth = s * 0.012;
  ctx.lineCap = 'round';
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 + t * 1.2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * s * 0.1, cy + Math.sin(a) * s * 0.1);
    ctx.lineTo(cx + Math.cos(a) * s * (0.16 + 0.04 * Math.sin(t * 20 + i)), cy + Math.sin(a) * s * (0.16 + 0.04 * Math.sin(t * 20 + i)));
    ctx.stroke();
  }
  ctx.fillStyle = p.sun;
  ctx.beginPath();
  ctx.arc(cx, cy, s * 0.075, 0, Math.PI * 2);
  ctx.fill();

  for (let g = 0; g < 3; g++) {
    const gt = clamp01(t * 1.3 - g * 0.12);
    const gx = -s * 0.1 + gt * (W + s * 0.2);
    const gy = H * (0.22 + g * 0.07) + Math.sin(gt * 9 + g) * s * 0.02;
    drawGull(ctx, gx, gy, s * 0.05, 0.5 + 0.5 * Math.sin(now / 110 + g * 2), p.bird);
  }
  const bt = ease(t);
  drawBoat(ctx, -s * 0.15 + bt * (W + s * 0.3), H * 0.9 + Math.sin(now / 180) * s * 0.008, s * 0.14, p);
  ctx.restore();
}
