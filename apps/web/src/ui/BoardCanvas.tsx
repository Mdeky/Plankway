import { useEffect, useRef } from 'preact/hooks';
import type { Board } from '@bridgle/core';
import { t } from '../i18n.ts';
import { BoardView, type ViewModel } from '../game/view.ts';

interface Props {
  model: ViewModel;
  onCycle(edge: number): void;
  onFocus?(island: number, selected: boolean): void;
  /** Receives the view so the parent can flash a blocking bridge. */
  viewRef?: { current: BoardView | null };
}

export function BoardCanvas({ model, onCycle, onFocus, viewRef }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<BoardView | null>(null);
  const cycleRef = useRef(onCycle);
  cycleRef.current = onCycle;
  const focusRef = useRef(onFocus);
  focusRef.current = onFocus;

  useEffect(() => {
    const v = new BoardView(canvasRef.current!, {
      onCycle: (edge) => cycleRef.current(edge),
      onFocus: (island, selected) => focusRef.current?.(island, selected),
    });
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
    <div class="board-frame" style={frameStyle(model.board)}>
      <canvas ref={canvasRef} class="board" tabIndex={0} role="application" aria-label={t('game.board')} />
    </div>
  );
}

/** Keeps the frame at the puzzle's aspect ratio, also when max-height kicks in. */
function frameStyle(board: Board) {
  return {
    aspectRatio: `${board.width} / ${board.height}`,
    width: `min(100%, calc(70dvh * ${board.width} / ${board.height}))`,
  };
}
