import { useEffect, useRef } from 'preact/hooks';
import type { Board } from '@bridgle/core';
import { t } from '../i18n.ts';
import { BoardView, type ViewModel } from '../game/view.ts';

interface Props {
  model: ViewModel;
  onCycle(edge: number): void;
  /** Receives the view so the parent can flash a blocking bridge. */
  viewRef?: { current: BoardView | null };
}

export function BoardCanvas({ model, onCycle, viewRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<BoardView | null>(null);
  const cycleRef = useRef(onCycle);
  cycleRef.current = onCycle;

  useEffect(() => {
    const v = new BoardView(canvasRef.current!, { onCycle: (edge) => cycleRef.current(edge) });
    view.current = v;
    if (viewRef) viewRef.current = v;
    return () => {
      v.destroy();
      view.current = null;
      if (viewRef) viewRef.current = null;
    };
  }, []);

  useEffect(() => {
    view.current?.setModel(model);
  }, [model]);

  return (
    <div class="board-frame" style={{ aspectRatio: aspect(model.board) }}>
      <canvas ref={canvasRef} class="board" tabIndex={0} role="application" aria-label={t('game.board')} />
    </div>
  );
}

function aspect(board: Board): string {
  return `${board.width} / ${board.height}`;
}
