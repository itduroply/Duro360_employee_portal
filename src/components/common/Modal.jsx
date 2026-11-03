import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CloseIcon } from './icons.jsx';

// Centered dialog on a dimmed backdrop. Esc, the ✕ or a click outside call
// onClose, unless `locked` (e.g. while saving). The body scrolls when tall;
// `footer` stays pinned under it.
export default function Modal({ open, title, subtitle, icon, onClose, locked = false, size = 'md', footer, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && !locked && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, locked, onClose]);

  if (!open) return null;
  const width = size === '2xl' ? 'max-w-6xl' : size === 'xl' ? 'max-w-3xl' : size === 'lg' ? 'max-w-2xl' : 'max-w-md';

  // Rendered on <body> so no animated page wrapper can trap `fixed` and let the
  // sidebar or header paint over the dialog.
  return createPortal(
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-gray-900/50 p-4 backdrop-blur-sm"
      onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`flex max-h-[90vh] w-full ${width} animate-fade-in-up flex-col overflow-hidden rounded-2xl bg-white shadow-2xl ring-1 ring-black/5`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div className="flex items-center gap-3">
            {icon && <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-500">{icon}</span>}
            <div>
              <h3 id="modal-title" className="text-base font-semibold text-gray-800">
                {title}
              </h3>
              {subtitle && <p className="text-theme-sm text-gray-500">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={locked}
            aria-label="Close"
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-3 border-t border-gray-100 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}
