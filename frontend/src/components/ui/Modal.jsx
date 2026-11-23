import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

const WIDTHS = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

/** Accessible modal: Esc closes, focus moves inside and returns to the opener on close. */
export default function Modal({ open, onClose, title, size = 'md', footer, children, closeDisabled = false }) {
  const titleId = useId();
  const panelRef = useRef(null);
  // Latest callbacks in a ref: the open/focus effect must run only when `open` changes.
  const closeRef = useRef({ onClose, closeDisabled });
  useEffect(() => {
    closeRef.current = { onClose, closeDisabled };
  });

  useEffect(() => {
    if (!open) return undefined;
    const opener = document.activeElement;
    const onKey = (e) => {
      if (e.key === 'Escape' && !closeRef.current.closeDisabled) closeRef.current.onClose?.();
    };
    document.addEventListener('keydown', onKey);
    const first = panelRef.current?.querySelector('input, textarea, select, button:not([data-close])');
    (first || panelRef.current)?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      opener?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-[2px]" onClick={closeDisabled ? undefined : onClose} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`relative w-full ${WIDTHS[size]} max-h-[92vh] flex flex-col glass rounded-t-[22px] sm:rounded-[22px] border border-white/60 bg-white/85 shadow-2xl focus:outline-none`}
      >
        <header className="flex items-center justify-between gap-3 border-b border-slate-200/70 px-5 py-3.5">
          <h2 id={titleId} className="text-base font-semibold text-zf-blue">
            {title}
          </h2>
          <button
            type="button"
            data-close
            onClick={onClose}
            disabled={closeDisabled}
            className="rounded-full p-1.5 text-text-muted hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:opacity-40"
            aria-label="Cerrar"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200/70 px-5 py-3">{footer}</footer>}
      </div>
    </div>,
    document.body,
  );
}
