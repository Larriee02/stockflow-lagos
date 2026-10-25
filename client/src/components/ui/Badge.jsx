import React from 'react';

const VARIANT_STYLES = {
  success: {
    backgroundColor: 'var(--badge-success-bg)',
    color: 'var(--badge-success-text)',
    borderColor: 'var(--badge-success-border)',
  },
  danger: {
    backgroundColor: 'var(--badge-danger-bg)',
    color: 'var(--badge-danger-text)',
    borderColor: 'var(--badge-danger-border)',
  },
  warning: {
    backgroundColor: 'var(--badge-warning-bg)',
    color: 'var(--badge-warning-text)',
    borderColor: 'var(--badge-warning-border)',
  },
  neutral: {
    backgroundColor: 'var(--badge-neutral-bg)',
    color: 'var(--badge-neutral-text)',
    borderColor: 'var(--badge-neutral-border)',
  },
  info: {
    backgroundColor: 'var(--badge-info-bg)',
    color: 'var(--badge-info-text)',
    borderColor: 'var(--badge-info-border)',
  },
};

export function Badge({ variant = 'neutral', children, icon: Icon }) {
  const style = VARIANT_STYLES[variant] || VARIANT_STYLES.neutral;
  return (
    <span
      style={{
        ...style,
        boxShadow: 'inset 0 1px 0 0 rgba(255, 255, 255, 0.22)',
      }}
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-tight border backdrop-blur-xs"
    >
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      {children}
    </span>
  );
}
