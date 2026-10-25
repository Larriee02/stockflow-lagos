import React from 'react';

export function EmptyState({ icon: Icon, title, description, actionLabel, onAction }) {
  return (
    <div className="p-12 text-center space-y-3">
      {Icon && (
        <div
          style={{
            backgroundColor: 'var(--brand-blue-soft)',
            color: 'var(--brand-blue)',
            boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.45)',
          }}
          className="mx-auto w-12 h-12 rounded-2xl border border-white/40 dark:border-white/10 flex items-center justify-center"
        >
          <Icon className="w-5 h-5" />
        </div>
      )}
      <div className="space-y-1">
        <p
          style={{ color: 'var(--text-primary)' }}
          className="text-sm font-extrabold font-luxury"
        >
          {title}
        </p>
        <p
          style={{ color: 'var(--text-secondary)' }}
          className="text-xs max-w-sm mx-auto font-medium"
        >
          {description}
        </p>
      </div>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="liquid-btn-primary mt-2 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
