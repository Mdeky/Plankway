import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface Props {
  title: string;
  onClose?: () => void;
  /** Keep the heading for screen readers only, e.g. when the content has its own header. */
  hideTitle?: boolean;
  class?: string;
  children: ComponentChildren;
}

/** Native <dialog> as a modal: focus trap, Esc and backdrop handled by the browser. */
export function Dialog({ title, onClose, hideTitle, class: extraClass, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current!;
    if (!el.open) el.showModal();
    return () => el.close();
  }, []);

  return (
    <dialog
      ref={ref}
      class={extraClass ? `dialog ${extraClass}` : 'dialog'}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
    >
      <h2 class={hideTitle ? 'sr-only' : undefined}>{title}</h2>
      {children}
    </dialog>
  );
}
