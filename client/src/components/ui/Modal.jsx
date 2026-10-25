import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ isOpen, onClose, title, subtitle, children }) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-950/55 backdrop-blur-md p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        style={{ color: 'var(--text-primary)' }}
        className="liquid-glass-elevated rounded-t-3xl sm:rounded-3xl max-w-lg w-full p-5 sm:p-6 space-y-4 max-h-[92dvh] overflow-y-auto pb-safe transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{ borderColor: 'var(--border-outer)' }}
          className="flex items-start justify-between gap-4 border-b pb-3.5"
        >
          <div className="min-w-0">
            <h2
              id="modal-title"
              className="text-base sm:text-lg font-extrabold font-luxury tracking-tight break-words"
            >
              {title}
            </h2>
            {subtitle && (
              <p
                style={{ color: 'var(--text-secondary)' }}
                className="text-xs mt-0.5 break-words font-medium"
              >
                {subtitle}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            style={{ color: 'var(--text-secondary)' }}
            className="liquid-glass-subtle p-2 -mr-1 rounded-xl hover:opacity-80 transition cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
