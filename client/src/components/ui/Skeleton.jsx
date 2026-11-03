import React from 'react';

/**
 * Production Loading Skeleton Primitives
 *
 * Implements smooth pulse animations with glassmorphic backgrounds to eliminate
 * Cumulative Layout Shift (CLS) and deliver high-perceived-performance loading states.
 */
export function Skeleton({ className = '', ...props }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-slate-200/70 dark:bg-slate-800/60 ${className}`}
      {...props}
    />
  );
}

export function SkeletonCard({ className = '' }) {
  return (
    <div
      className={`liquid-glass-card rounded-2xl p-5 space-y-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-7 w-7 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-24" />
      <Skeleton className="h-3 w-40" />
    </div>
  );
}

export function SkeletonTable({ rows = 5, columns = 4, className = '' }) {
  return (
    <div
      className={`liquid-glass-card rounded-2xl overflow-hidden divide-y divide-[var(--divider-color)] ${className}`}
    >
      <div className="p-4 flex gap-4 bg-slate-500/5">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={`head-${i}`} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={`row-${r}`} className="p-4 flex gap-4 items-center">
          {Array.from({ length: columns }).map((_, c) => (
            <Skeleton
              key={`cell-${r}-${c}`}
              className={`h-4 flex-1 ${c === 0 ? 'w-1/3' : ''}`}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function SkeletonStatRow({ count = 3 }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
