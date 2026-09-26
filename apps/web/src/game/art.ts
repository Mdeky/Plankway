import { createRng, type Rng } from '@bridgle/core';
import type { Point } from './layout.ts';

/**
 * Cartoon drawing primitives. Everything is drawn with canvas paths; shapes are seeded
 * per puzzle so an island always looks the same.
 */
export interface Palette {
  waterTop: string;
  waterBottom: string;
  wave: string;
  waterDot: string;
  sand: string;
  sandEdge: string;
  grass: string;
  grassFull: string;
  grassDark: string;
  over: string;
  sign: string;
  signEdge: string;
  text: string;
  textGlow: string;
  plank: string;
  plankDark: string;
  rope: string;
  preview: string;
  rock: string;
  rockDark: string;
  rockLight: string;
  foam: string;
  trunk: string;
  roof: string;
  focus: string;
  hint: string;
  mistake: string;
  full: string;
  isolated: string;
  glow: string;
  sail: string;
  sailStripe: string;
  hull: string;
  bird: string;
  sun: string;
  /** 1 at night (dark theme), 0 by day. */
  night: number;
}

export type Decor = 'palm' | 'rock' | 'hut' | 'none';

export interface IslandArt {
  outer: Path2D;
  inner: Path2D;
  decor: Decor;
  /** Decoration position, relative to the island centre in cells. */
  decorAt: Point;
}

/** Smooth closed blob through jittered points on a circle. */
function blob(rng: Rng, cx: number, cy: number, r: number, points: number, jitter: number): Path2D {
  const pts: Point[] = [];
  const rot = rng.next() * Math.PI * 2;
  for (let i = 0; i < points; i++) {
    const a = rot + (i / points) * Math.PI * 2 + (rng.next() - 0.5) * 0.35;
    const rr = r * (1 - jitter / 2 + rng.next() * jitter);
    pts.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  const path = new Path2D();
  const mid = (p: Point, q: Point) => ({ x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 });
  const start = mid(pts[pts.length - 1]!, pts[0]!);
  path.moveTo(start.x, start.y);
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]!;
    const m = mid(p, pts[(i + 1) % pts.length]!);
    path.quadraticCurveTo(p.x, p.y, m.x, m.y);
  }
  path.closePath();
  return path;
}

export function makeIslandArt(seed: string, c: Point, radius: number): IslandArt {
  const rng = createRng(seed);
  const outer = blob(rng, c.x, c.y, radius, 9, 0.16);
  const inner = blob(rng, c.x + (rng.next() - 0.5) * radius * 0.1, c.y - radius * 0.06, radius * 0.74, 8, 0.2);
  const roll = rng.next();
  const decor: Decor = roll < 0.45 ? 'palm' : roll < 0.65 ? 'rock' : roll < 0.8 ? 'hut' : 'none';
  // Decoration top-left; the top-right corner is kept free for the status flag.
  return { outer, inner, decor, decorAt: { x: -0.27 - rng.next() * 0.04, y: -0.25 } };
}

export function makeReefArt(seed: string, c: Point, cell: number): { foam: Path2D; rocks: { path: Path2D; hx: number; hy: number; r: number }[] } {
  const rng = createRng(seed);
  const foam = blob(rng, c.x, c.y, cell * 0.36, 8, 0.25);
  const rocks = [
    [-0.12, 0.06, 0.15],
    [0.12, 0.07, 0.12],
    [0.01, -0.11, 0.12],
  ].map(([dx, dy, r]) => {
    const x = c.x + dx! * cell + (rng.next() - 0.5) * cell * 0.04;
    const y = c.y + dy! * cell + (rng.next() - 0.5) * cell * 0.04;
    return { path: blob(rng, x, y, r! * cell, 6, 0.3), hx: x - r! * cell * 0.35, hy: y - r! * cell * 0.4, r: r! * cell };
  });
  return { foam, rocks };
}

// ── Decorations ─────────────────────────────────────────────────────────────

export function drawDecor(ctx: CanvasRenderingContext2D, kind: Decor, x: number, y: number, s: number, p: Palette): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (kind === 'palm') {
    ctx.strokeStyle = p.trunk;
    ctx.lineWidth = s * 0.16;
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.45);
    ctx.quadraticCurveTo(x + s * 0.18, y + s * 0.05, x + s * 0.08, y - s * 0.35);
    ctx.stroke();
    const top = { x: x + s * 0.08, y: y - s * 0.35 };
    ctx.fillStyle = p.grassDark;
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.62;
      ctx.save();
      ctx.translate(top.x, top.y);
      ctx.rotate(a);
      ctx.beginPath();
      ctx.ellipse(s * 0.27, 0, s * 0.3, s * 0.09, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = p.trunk;
    ctx.beginPath();
    ctx.arc(top.x - s * 0.05, top.y + s * 0.06, s * 0.06, 0, Math.PI * 2);
    ctx.arc(top.x + s * 0.07, top.y + s * 0.07, s * 0.06, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'rock') {
    ctx.fillStyle = p.rock;
    ctx.strokeStyle = p.rockDark;
    ctx.lineWidth = Math.max(1, s * 0.06);
    ctx.beginPath();
    ctx.ellipse(x, y + s * 0.1, s * 0.28, s * 0.22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(x + s * 0.24, y + s * 0.2, s * 0.16, s * 0.13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.rockLight;
    ctx.beginPath();
    ctx.ellipse(x - s * 0.08, y, s * 0.08, s * 0.05, -0.4, 0, Math.PI * 2);
    ctx.fill();
  } else if (kind === 'hut') {
    ctx.fillStyle = p.plank;
    ctx.strokeStyle = p.plankDark;
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.rect(x - s * 0.24, y - s * 0.02, s * 0.48, s * 0.36);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.roof;
    ctx.beginPath();
    ctx.moveTo(x - s * 0.36, y);
    ctx.lineTo(x, y - s * 0.36);
    ctx.lineTo(x + s * 0.36, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.plankDark;
    ctx.fillRect(x - s * 0.06, y + s * 0.12, s * 0.12, s * 0.22);
  }
  ctx.restore();
}

// ── Bridges ─────────────────────────────────────────────────────────────────

/** Cheap deterministic noise in [0, 1) for plank wobble (no allocations per frame). */
function hash(a: number, b: number, c: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return h - Math.floor(h);
}

export interface BridgeDraw {
  a: Point;
  b: Point;
  horizontal: boolean;
  cell: number;
  count: number;
  seed: number;
  /** Build progress per lane, 0..1. */
  progress: [number, number];
  alpha: number;
  /** Extra vertical offset (e.g. falling into the water). */
  drop: number;
  color?: string;
}

export function drawBridge(ctx: CanvasRenderingContext2D, d: BridgeDraw, p: Palette): void {
  const { a, b, horizontal, cell, count } = d;
  const length = horizontal ? b.x - a.x : b.y - a.y;
  if (length <= 0) return;
  const laneWidth = count === 2 ? cell * 0.15 : cell * 0.22;
  const offsets = count === 2 ? [-cell * 0.11, cell * 0.11] : [0];
  const planks = Math.max(2, Math.round(length / (cell * 0.13)));
  const step = length / planks;
  const thick = Math.max(2, cell * 0.06);

  ctx.save();
  ctx.globalAlpha = d.alpha;
  offsets.forEach((off, lane) => {
    const progress = d.progress[lane] ?? 1;
    if (progress <= 0) return;
    // Local frame: u along the bridge, v across it.
    ctx.save();
    if (horizontal) ctx.translate(a.x, a.y + off + d.drop);
    else {
      ctx.translate(a.x + off, a.y + d.drop);
      ctx.rotate(Math.PI / 2);
    }
    const built = length * progress;

    ctx.fillStyle = d.color ?? p.plank;
    ctx.strokeStyle = p.plankDark;
    ctx.lineWidth = Math.max(0.8, cell * 0.018);
    for (let i = 0; i < planks; i++) {
      const u = (i + 0.5) * step;
      if (u > built) break;
      const wob = (hash(d.seed, lane, i) - 0.5) * 0.14;
      const len = laneWidth * (0.92 + hash(d.seed, lane, i + 99) * 0.14);
      ctx.save();
      ctx.translate(u, 0);
      ctx.rotate(wob);
      ctx.beginPath();
      ctx.rect(-thick / 2, -len / 2, thick, len);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // Rope rails with a slight sag.
    ctx.strokeStyle = d.color ?? p.rope;
    ctx.lineWidth = Math.max(1, cell * 0.024);
    for (const side of [-1, 1]) {
      const v = (side * laneWidth) / 2;
      ctx.beginPath();
      ctx.moveTo(0, v);
      ctx.quadraticCurveTo(built / 2, v + cell * 0.03, built, v);
      ctx.stroke();
    }
    ctx.restore();
  });
  ctx.restore();
}

// ── Water ───────────────────────────────────────────────────────────────────

export interface Wave {
  x: number;
  y: number;
  phase: number;
}

export function makeWaves(seed: string, width: number, height: number): Wave[] {
  const rng = createRng(`${seed}-waves`);
  const count = Math.round((width * height) / 3);
  return Array.from({ length: count }, () => ({ x: rng.next() * width, y: rng.next() * height, phase: rng.next() * Math.PI * 2 }));
}

export function drawWave(ctx: CanvasRenderingContext2D, x: number, y: number, len: number, amp: number): void {
  ctx.beginPath();
  ctx.moveTo(x - len / 2, y);
  ctx.quadraticCurveTo(x - len / 4, y - amp, x, y);
  ctx.quadraticCurveTo(x + len / 4, y + amp, x + len / 2, y);
  ctx.stroke();
}

// ── Win scene ───────────────────────────────────────────────────────────────

export function drawBoat(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, p: Palette): void {
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.fillStyle = p.hull;
  ctx.strokeStyle = p.plankDark;
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.55, y - s * 0.05);
  ctx.lineTo(x + s * 0.6, y - s * 0.05);
  ctx.lineTo(x + s * 0.4, y + s * 0.25);
  ctx.lineTo(x - s * 0.4, y + s * 0.25);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.plankDark;
  ctx.fillRect(x - s * 0.03, y - s * 0.85, s * 0.06, s * 0.8);
  ctx.fillStyle = p.sail;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.05, y - s * 0.82);
  ctx.lineTo(x + s * 0.5, y - s * 0.15);
  ctx.lineTo(x + s * 0.05, y - s * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = p.sailStripe;
  ctx.beginPath();
  ctx.moveTo(x + s * 0.05, y - s * 0.42);
  ctx.lineTo(x + s * 0.3, y - s * 0.45);
  ctx.lineTo(x + s * 0.34, y - s * 0.36);
  ctx.lineTo(x + s * 0.05, y - s * 0.33);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = p.sailStripe;
  ctx.beginPath();
  ctx.moveTo(x - s * 0.03, y - s * 0.85);
  ctx.lineTo(x - s * 0.25, y - s * 0.78);
  ctx.lineTo(x - s * 0.03, y - s * 0.72);
  ctx.fill();
  ctx.restore();
}

export function drawGull(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, flap: number, color: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.5, s * 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const lift = s * (0.15 + 0.3 * flap);
  ctx.beginPath();
  ctx.moveTo(x - s * 0.6, y);
  ctx.quadraticCurveTo(x - s * 0.3, y - lift, x, y + s * 0.08);
  ctx.quadraticCurveTo(x + s * 0.3, y - lift, x + s * 0.6, y);
  ctx.stroke();
  ctx.restore();
}
