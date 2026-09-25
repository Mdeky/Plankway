import { findEdge, type Board, type IslandStatus } from '@bridgle/core';
import {
  bridgeAt,
  computeLayout,
  edgeInDirection,
  islandAt,
  islandCenter,
  islandInDirection,
  type Direction,
  type Layout,
  type Point,
} from './layout.ts';
import { drawScene, readPalette, type Palette } from './renderer.ts';

export interface ViewModel {
  board: Board;
  counts: ArrayLike<number>;
  statuses: IslandStatus[];
  hintEdges: number[];
  hintIsland: number;
  mistakeEdges: number[];
  locked: boolean;
}

export interface ViewCallbacks {
  /** Player wants to cycle this edge (0 → 1 → 2 → 0). */
  onCycle(edge: number): void;
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
};

const FLASH_MS = 600;

/**
 * Owns the canvas: sizing, drawing and all pointer/keyboard input. Game rules stay
 * outside; the view only reports which edge the player wants to change.
 */
export class BoardView {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly callbacks: ViewCallbacks;
  private readonly resizeObserver: ResizeObserver;
  private readonly themeQuery = matchMedia('(prefers-color-scheme: dark)');
  private readonly motionQuery = matchMedia('(prefers-reduced-motion: reduce)');
  private model: ViewModel | null = null;
  private layout: Layout | null = null;
  private palette: Palette;
  private frame = 0;

  private selected = -1;
  private focused = 0;
  private showFocus = false;
  private preview = -1;
  private flashEdge = -1;
  private flashUntil = 0;

  private pointer: { id: number; start: Point; island: number; bridge: number; moved: boolean } | null = null;

  constructor(canvas: HTMLCanvasElement, callbacks: ViewCallbacks) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not supported');
    this.ctx = ctx;
    this.palette = readPalette(canvas);

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
    canvas.addEventListener('pointercancel', this.onPointerCancel);
    canvas.addEventListener('keydown', this.onKeyDown);
    canvas.addEventListener('blur', this.onBlur);
    this.themeQuery.addEventListener('change', this.refreshPalette);
  }

  destroy(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerCancel);
    this.canvas.removeEventListener('keydown', this.onKeyDown);
    this.canvas.removeEventListener('blur', this.onBlur);
    this.themeQuery.removeEventListener('change', this.refreshPalette);
  }

  setModel(model: ViewModel): void {
    const boardChanged = this.model?.board !== model.board;
    this.model = model;
    if (boardChanged) {
      this.selected = -1;
      this.preview = -1;
      this.focused = 0;
      this.resize();
    }
    if (model.locked) {
      this.selected = -1;
      this.preview = -1;
    }
    this.requestDraw();
  }

  /** Briefly marks an edge, e.g. the bridge that blocked a move. */
  flash(edge: number): void {
    this.flashEdge = edge;
    this.flashUntil = performance.now() + FLASH_MS;
    this.requestDraw();
  }

  refreshPalette = (): void => {
    this.palette = readPalette(this.canvas);
    this.requestDraw();
  };

  private resize(): void {
    if (!this.model) return;
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.max(1, Math.round(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.round(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout = computeLayout(this.model.board, rect.width, rect.height);
    this.requestDraw();
  }

  private requestDraw(): void {
    if (this.frame) return;
    this.frame = requestAnimationFrame(this.draw);
  }

  private draw = (now: number): void => {
    this.frame = 0;
    const model = this.model;
    const layout = this.layout;
    if (!model || !layout) return;
    if (this.flashEdge >= 0 && now > this.flashUntil) this.flashEdge = -1;
    const animating = model.hintEdges.length > 0 || model.mistakeEdges.length > 0 || model.hintIsland >= 0 || this.flashEdge >= 0;
    const reduced = this.motionQuery.matches;
    const pulse = animating && !reduced ? 0.5 + 0.5 * Math.sin(now / 250) : 0.6;

    drawScene(
      this.ctx,
      {
        board: model.board,
        layout,
        counts: model.counts,
        statuses: model.statuses,
        selected: this.selected,
        focused: this.focused,
        showFocus: this.showFocus,
        preview: this.preview,
        hintEdges: model.hintEdges,
        hintIsland: model.hintIsland,
        mistakeEdges: model.mistakeEdges,
        flashEdge: this.flashEdge,
        pulse,
      },
      this.palette,
    );
    // Keep pulsing highlights alive; a flash also needs a frame to disappear.
    if ((animating && !reduced) || this.flashEdge >= 0) this.requestDraw();
  };

  // ── Input ────────────────────────────────────────────────────────────────

  private point(ev: PointerEvent): Point {
    const rect = this.canvas.getBoundingClientRect();
    return { x: ev.clientX - rect.left, y: ev.clientY - rect.top };
  }

  /** Edge the drag from `source` currently points at, or -1. */
  private dragTarget(source: number, p: Point): number {
    const { board } = this.model!;
    const layout = this.layout!;
    const over = islandAt(board, layout, p);
    if (over >= 0 && over !== source) return findEdge(board, source, over);
    const c = islandCenter(board, layout, source);
    const dx = p.x - c.x;
    const dy = p.y - c.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < layout.cell * 0.6) return -1;
    const dir: Direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
    return edgeInDirection(board, source, dir);
  }

  /** Re-measures if the canvas changed size without a ResizeObserver callback (e.g. hidden tab). */
  private ensureLayout(): void {
    const rect = this.canvas.getBoundingClientRect();
    if (!this.layout || Math.abs(rect.width - this.layout.width) > 0.5 || Math.abs(rect.height - this.layout.height) > 0.5) {
      this.resize();
    }
  }

  private onPointerDown = (ev: PointerEvent): void => {
    if (this.model) this.ensureLayout();
    if (!this.model || !this.layout || this.model.locked || this.pointer) return;
    if (ev.pointerType === 'mouse' && ev.button !== 0) return;
    const p = this.point(ev);
    const island = islandAt(this.model.board, this.layout, p);
    const bridge = island < 0 ? bridgeAt(this.model.board, this.layout, this.model.counts, p) : -1;
    this.pointer = { id: ev.pointerId, start: p, island, bridge, moved: false };
    this.showFocus = false;
    try {
      this.canvas.setPointerCapture(ev.pointerId);
    } catch {
      // The pointer is already gone (or synthetic); dragging still works without capture.
    }
    ev.preventDefault();
  };

  private onPointerMove = (ev: PointerEvent): void => {
    const ptr = this.pointer;
    if (!ptr || ptr.id !== ev.pointerId || ptr.island < 0) return;
    const p = this.point(ev);
    if (Math.hypot(p.x - ptr.start.x, p.y - ptr.start.y) > this.layout!.cell * 0.3) ptr.moved = true;
    const target = ptr.moved ? this.dragTarget(ptr.island, p) : -1;
    if (target !== this.preview) {
      this.preview = target;
      this.requestDraw();
    }
  };

  private onPointerUp = (ev: PointerEvent): void => {
    const ptr = this.pointer;
    if (!ptr || ptr.id !== ev.pointerId) return;
    this.pointer = null;
    this.preview = -1;
    const model = this.model;
    const layout = this.layout;
    if (!model || !layout || model.locked) return;
    const p = this.point(ev);

    if (ptr.island >= 0) {
      const target = ptr.moved ? this.dragTarget(ptr.island, p) : -1;
      if (target >= 0) {
        this.selected = -1;
        this.focused = ptr.island;
        this.callbacks.onCycle(target);
      } else if (!ptr.moved || islandAt(model.board, layout, p) === ptr.island) {
        this.tapIsland(ptr.island);
      }
    } else if (ptr.bridge >= 0) {
      if (bridgeAt(model.board, layout, model.counts, p) === ptr.bridge) this.callbacks.onCycle(ptr.bridge);
    } else {
      this.selected = -1;
    }
    this.requestDraw();
  };

  private onPointerCancel = (): void => {
    this.pointer = null;
    this.preview = -1;
    this.requestDraw();
  };

  private tapIsland(island: number): void {
    const { board } = this.model!;
    this.focused = island;
    if (this.selected === island) {
      this.selected = -1;
      return;
    }
    if (this.selected >= 0) {
      const edge = findEdge(board, this.selected, island);
      if (edge >= 0) {
        this.selected = -1;
        this.callbacks.onCycle(edge);
        return;
      }
    }
    this.selected = island;
  }

  private onKeyDown = (ev: KeyboardEvent): void => {
    if (this.model) this.ensureLayout();
    const model = this.model;
    if (!model || model.locked) return;
    const dir = KEY_DIRECTIONS[ev.key];
    const wasHidden = !this.showFocus;
    this.showFocus = true;

    if (dir) {
      ev.preventDefault();
      if (wasHidden && this.selected < 0) {
        this.requestDraw();
        return;
      }
      if (this.selected >= 0) {
        const edge = edgeInDirection(model.board, this.selected, dir);
        if (edge >= 0) this.callbacks.onCycle(edge);
      } else {
        const next = islandInDirection(model.board, this.focused, dir);
        if (next >= 0) this.focused = next;
      }
    } else if (ev.key === ' ' || ev.key === 'Enter') {
      ev.preventDefault();
      this.tapIsland(this.focused);
    } else if (ev.key === 'Escape') {
      this.selected = -1;
    } else {
      return;
    }
    this.requestDraw();
  };

  private onBlur = (): void => {
    this.showFocus = false;
    this.requestDraw();
  };
}
