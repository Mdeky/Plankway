import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

interface Props {
  title: string;
  onClose?: () => void;
  children: ComponentChildren;
}

/** Native <dialog> as a modal: focus trap, Esc and backdrop handled by the browser. */
export function Dialog({ title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current!;
    if (!el.open) el.showModal();
    return () => el.close();
  }, []);

  return (
    <dialog
      ref={ref}
      class="dialog"
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        onClose?.();
      }}
    >
      <h2>{title}</h2>
      {children}
    </dialog>
  );
}
