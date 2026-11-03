import React from 'react';

/**
 * Production Card Primitives
 *
 * Provides consistent glassmorphic elevation, border hierarchy,
 * and dark/light mode responsiveness across all dashboard modules.
 */
export function Card({
  className = '',
  elevated = false,
  hoverable = false,
  children,
  ...props
}) {
  return (
    <div
      className={`rounded-2xl sm:rounded-3xl transition-all duration-200 ${
        elevated ? 'liquid-glass-elevated' : 'liquid-glass-card'
      } ${
        hoverable
          ? 'hover:border-[var(--brand-blue-border)] hover:shadow-lg'
          : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className = '', children, ...props }) {
  return (
    <div
      className={`p-4 sm:p-5 flex items-start justify-between gap-3 border-b border-[var(--divider-color)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children, ...props }) {
  return (
    <h3
      className={`text-sm sm:text-base font-extrabold font-luxury text-[var(--text-primary)] tracking-tight ${className}`}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({ className = '', children, ...props }) {
  return (
    <p
      className={`text-xs text-[var(--text-secondary)] font-medium mt-0.5 ${className}`}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({ className = '', children, ...props }) {
  return (
    <div className={`p-4 sm:p-5 ${className}`} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({ className = '', children, ...props }) {
  return (
    <div
      className={`p-4 sm:p-5 pt-3 flex items-center justify-between gap-3 border-t border-[var(--divider-color)] ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
