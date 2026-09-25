import type { Board, IslandStatus } from '@bridgle/core';
import { cellCenter, islandCenter, type Layout, type Point } from './layout.ts';

export interface Palette {
  water: string;
  waterDot: string;
  island: string;
  islandStroke: string;
  islandFull: string;
  islandOver: string;
  text: string;
  bridge: string;
  preview: string;
  reef: string;
  foam: string;
  focus: string;
  hint: string;
  mistake: string;
}

const PALETTE_VARS: Record<keyof Palette, string> = {
  water: '--water',
  waterDot: '--water-dot',
  island: '--island',
  islandStroke: '--island-stroke',
  islandFull: '--island-full',
  islandOver: '--island-over',
  text: '--island-text',
  bridge: '--bridge',
  preview: '--bridge-preview',
  reef: '--reef',
  foam: '--foam',
  focus: '--focus',
  hint: '--hint',
  mistake: '--mistake',
};

export function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const out = {} as Palette;
  for (const [key, cssVar] of Object.entries(PALETTE_VARS) as [keyof Palette, string][]) {
    out[key] = style.getPropertyValue(cssVar).trim() || '#888';
  }
  return out;
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
  /** 0..1, animates hint and flash highlights. */
  pulse: number;
}

export function drawScene(ctx: CanvasRenderingContext2D, scene: Scene, palette: Palette): void {
  const { board, layout } = scene;
  ctx.clearRect(0, 0, layout.width, layout.height);

  // Faint dot grid for orientation.
  ctx.fillStyle = palette.waterDot;
  const dot = Math.max(1, layout.cell * 0.035);
  for (let y = 0; y < board.height; y++) {
    for (let x = 0; x < board.width; x++) {
      const c = cellCenter(layout, x, y);
      ctx.beginPath();
      ctx.arc(c.x, c.y, dot, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  for (const reef of board.puzzle.reefs) drawReef(ctx, cellCenter(layout, reef.x, reef.y), layout.cell, palette);

  for (const e of board.edges) {
    const count = scene.counts[e.id] as number;
    if (count > 0) drawBridge(ctx, scene, e.id, count, palette.bridge, 1);
  }
  for (const e of scene.hintEdges) drawHighlight(ctx, scene, e, palette.hint);
  for (const e of scene.mistakeEdges) drawHighlight(ctx, scene, e, palette.mistake);
  if (scene.flashEdge >= 0) drawHighlight(ctx, scene, scene.flashEdge, palette.mistake);
  if (scene.preview >= 0) {
    const next = ((scene.counts[scene.preview] as number) + 1) % 3;
    if (next > 0) drawBridge(ctx, scene, scene.preview, next, palette.preview, 0.9);
    else drawHighlight(ctx, scene, scene.preview, palette.preview);
  }

  board.puzzle.islands.forEach((isl, i) => drawIsland(ctx, scene, i, isl.n, palette));
}

function bridgeEnds(scene: Scene, edge: number): [Point, Point] {
  const { board, layout } = scene;
  const e = board.edges[edge]!;
  const a = islandCenter(board, layout, e.a);
  const b = islandCenter(board, layout, e.b);
  const r = layout.radius * 0.9;
  return e.horizontal
    ? [{ x: a.x + r, y: a.y }, { x: b.x - r, y: b.y }]
    : [{ x: a.x, y: a.y + r }, { x: b.x, y: b.y - r }];
}

function drawBridge(ctx: CanvasRenderingContext2D, scene: Scene, edge: number, count: number, color: string, alpha: number) {
  const [a, b] = bridgeEnds(scene, edge);
  const horizontal = scene.board.edges[edge]!.horizontal;
  const offsets = count === 2 ? [-1, 1] : [0];
  const gap = scene.layout.cell * 0.1;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = color;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(2.5, scene.layout.cell * 0.07);
  for (const o of offsets) {
    const dx = horizontal ? 0 : o * gap;
    const dy = horizontal ? o * gap : 0;
    ctx.beginPath();
    ctx.moveTo(a.x + dx, a.y + dy);
    ctx.lineTo(b.x + dx, b.y + dy);
    ctx.stroke();
  }
  ctx.restore();
}

function drawHighlight(ctx: CanvasRenderingContext2D, scene: Scene, edge: number, color: string) {
  const [a, b] = bridgeEnds(scene, edge);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.45 + 0.4 * scene.pulse;
  ctx.lineCap = 'round';
  ctx.lineWidth = Math.max(6, scene.layout.cell * 0.3);
  ctx.setLineDash([scene.layout.cell * 0.15, scene.layout.cell * 0.12]);
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
  ctx.restore();
}

function drawReef(ctx: CanvasRenderingContext2D, c: Point, cell: number, palette: Palette) {
  ctx.save();
  ctx.fillStyle = palette.foam;
  ctx.beginPath();
  ctx.arc(c.x, c.y, cell * 0.36, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = palette.reef;
  const rocks: [number, number, number][] = [
    [-0.13, 0.06, 0.16],
    [0.12, 0.08, 0.13],
    [0.02, -0.12, 0.12],
  ];
  for (const [dx, dy, r] of rocks) {
    ctx.beginPath();
    ctx.arc(c.x + dx * cell, c.y + dy * cell, r * cell, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawIsland(ctx: CanvasRenderingContext2D, scene: Scene, i: number, n: number, palette: Palette) {
  const { board, layout } = scene;
  const c = islandCenter(board, layout, i);
  const r = layout.radius;
  const status = scene.statuses[i];

  ctx.save();
  if (scene.hintIsland === i) {
    ctx.fillStyle = palette.hint;
    ctx.globalAlpha = 0.35 + 0.35 * scene.pulse;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 1.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = status === 'full' ? palette.islandFull : status === 'over' ? palette.islandOver : palette.island;
  ctx.strokeStyle = palette.islandStroke;
  ctx.lineWidth = Math.max(1.5, r * 0.1);
  ctx.beginPath();
  ctx.arc(c.x, c.y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  if (scene.selected === i) {
    ctx.strokeStyle = palette.focus;
    ctx.lineWidth = Math.max(3, r * 0.18);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 1.22, 0, Math.PI * 2);
    ctx.stroke();
  } else if (scene.showFocus && scene.focused === i) {
    ctx.strokeStyle = palette.focus;
    ctx.lineWidth = Math.max(2, r * 0.1);
    ctx.setLineDash([r * 0.25, r * 0.2]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, r * 1.22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.fillStyle = palette.text;
  ctx.font = `700 ${Math.round(r * 1.15)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(n), c.x, c.y + r * 0.05);

  // Status badges: shape as well as colour, so it works for colour-blind players.
  if (status === 'full') drawBadge(ctx, c, r, palette.islandFull, palette.islandStroke, 'check');
  if (status === 'over') drawBadge(ctx, c, r, palette.islandOver, palette.islandStroke, 'bang');
  ctx.restore();
}

function drawBadge(ctx: CanvasRenderingContext2D, c: Point, r: number, fill: string, stroke: string, kind: 'check' | 'bang') {
  const bx = c.x + r * 0.75;
  const by = c.y - r * 0.75;
  const br = r * 0.36;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = Math.max(1.2, br * 0.25);
  ctx.beginPath();
  ctx.arc(bx, by, br, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (kind === 'check') {
    ctx.moveTo(bx - br * 0.45, by);
    ctx.lineTo(bx - br * 0.1, by + br * 0.4);
    ctx.lineTo(bx + br * 0.5, by - br * 0.4);
  } else {
    ctx.moveTo(bx, by - br * 0.5);
    ctx.lineTo(bx, by + br * 0.1);
    ctx.moveTo(bx, by + br * 0.45);
    ctx.lineTo(bx, by + br * 0.47);
  }
  ctx.stroke();
}
