'use client';
import { useEffect, useRef, type ReactNode } from 'react';
import { Close } from './icons';

/** Bottom sheet with focus trap, Escape/back-to-close and focus restore. */
export function Sheet({
  open,
  onClose,
  label,
  children,
  restoreFocusTo,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
  restoreFocusTo?: HTMLElement | null | (() => HTMLElement | null);
}) {
  const ref = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const target = typeof restoreFocusTo === 'function' ? restoreFocusTo() : restoreFocusTo;
    opener.current = (target ?? (document.activeElement as HTMLElement | null)) || null;
    const node = ref.current;
    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? []).filter(
        (el) => !el.hasAttribute('disabled'),
      );
    const first = focusables()[0];
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
      if (e.key === 'Tab') {
        const list = focusables();
        if (!list.length) return;
        const idx = list.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && (idx <= 0 || idx === -1)) {
          e.preventDefault();
          list[list.length - 1].focus();
        } else if (!e.shiftKey && idx === list.length - 1) {
          e.preventDefault();
          list[0].focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener.current?.focus?.();
    };
  }, [open, onClose, restoreFocusTo]);

  if (!open) return null;
  return (
    <>
      <div className="scrim" onClick={onClose} aria-hidden />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={label} ref={ref}>
        <div className="sheet__grabber" aria-hidden />
        <button type="button" className="sheet__close" aria-label="Close" onClick={onClose}>
          <Close />
        </button>
        {children}
      </div>
    </>
  );
}
