import type { ComponentChildren } from 'preact';
import { useEffect } from 'preact/hooks';

interface Props {
  title: string;
  onClose: () => void;
  children: ComponentChildren;
}

/** Bottom sheet used for all forms. Closes on backdrop tap or Escape. */
export function Sheet({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div class="backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <header class="sheet-head">
          <h2>{title}</h2>
          <button type="button" class="btn ghost" onClick={onClose}>
            Cancel
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
