import React, { forwardRef } from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Production Button Component
 *
 * Variants:
 *  - primary: Vibrant cobalt gradient with subtle inner glow
 *  - secondary: Glassmorphic elevated surface
 *  - outline: Subtle border with translucent fill
 *  - danger: Soft rose danger surface for irreversible operations
 *  - ghost: Transparent background with hover glow
 *  - luxury: Champagne gold accent gradient
 *
 * Sizes: 'xs' | 'sm' | 'md' | 'lg'
 */
export const Button = forwardRef(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    disabled = false,
    className = '',
    type = 'button',
    children,
    ...props
  },
  ref
) {
  const isDisabled = disabled || isLoading;

  const sizeClasses = {
    xs: 'px-2.5 py-1 text-[11px] gap-1 rounded-lg font-bold',
    sm: 'px-3 py-1.5 text-xs gap-1.5 rounded-xl font-bold',
    md: 'px-4 py-2.5 text-xs sm:text-sm gap-2 rounded-xl font-bold',
    lg: 'px-5 py-3 text-sm sm:text-base gap-2.5 rounded-2xl font-extrabold',
  }[size] || 'px-4 py-2.5 text-xs sm:text-sm gap-2 rounded-xl font-bold';

  const variantClasses = {
    primary:
      'liquid-btn-primary text-white shadow-sm hover:shadow-md active:scale-[0.98]',
    secondary:
      'liquid-glass-elevated hover:opacity-95 text-[var(--text-primary)] border border-[var(--border-outer)] active:scale-[0.98]',
    outline:
      'liquid-glass-subtle hover:bg-white/40 dark:hover:bg-white/10 text-[var(--text-primary)] border border-[var(--border-outer)] active:scale-[0.98]',
    danger:
      'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 hover:bg-rose-500/20 active:scale-[0.98]',
    ghost:
      'bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] active:scale-[0.98]',
    luxury:
      'bg-gradient-to-r from-amber-500 to-amber-600 text-white hover:from-amber-600 hover:to-amber-700 shadow-sm active:scale-[0.98]',
  }[variant] || 'liquid-btn-primary text-white';

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={isLoading ? 'true' : 'false'}
      className={`inline-flex items-center justify-center transition-all cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${sizeClasses} ${variantClasses} ${className}`}
      {...props}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
      ) : (
        LeftIcon && <LeftIcon className="w-4 h-4 shrink-0" />
      )}
      <span>{children}</span>
      {!isLoading && RightIcon && <RightIcon className="w-4 h-4 shrink-0" />}
    </button>
  );
});
