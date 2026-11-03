import React, { forwardRef, useId } from 'react';

/**
 * Reusable Production Form Input Primitive
 *
 * Features:
 *  - Accessible label association via `htmlFor` / `id`
 *  - Accessible error state via `aria-invalid` and `aria-describedby`
 *  - Optional left and right icons (e.g. search icon, currency symbol, show/hide password)
 *  - Integrated design system token styling (light & dark mode compliant)
 */
export const Input = forwardRef(function Input(
  {
    label,
    error,
    hint,
    leftIcon: LeftIcon,
    rightIcon: RightIcon,
    id: externalId,
    className = '',
    containerClassName = '',
    disabled = false,
    required = false,
    type = 'text',
    ...props
  },
  ref
) {
  const autoId = useId();
  const inputId = externalId || autoId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className={`space-y-1.5 w-full text-left ${containerClassName}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        {LeftIcon && (
          <div className="absolute left-3.5 pointer-events-none text-[var(--text-muted)] flex items-center">
            <LeftIcon className="w-4 h-4" />
          </div>
        )}

        <input
          ref={ref}
          id={inputId}
          type={type}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? errorId : hint ? hintId : undefined
          }
          className={`liquid-input w-full px-3.5 py-2.5 text-xs sm:text-sm font-medium rounded-xl transition-all outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${
            LeftIcon ? 'pl-10' : ''
          } ${RightIcon ? 'pr-10' : ''} ${
            error
              ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/30'
              : ''
          } ${className}`}
          {...props}
        />

        {RightIcon && (
          <div className="absolute right-3 flex items-center">
            {typeof RightIcon === 'function' ? <RightIcon /> : RightIcon}
          </div>
        )}
      </div>

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-[11px] font-semibold text-rose-500 flex items-center gap-1 mt-1"
        >
          <span>•</span>
          {error}
        </p>
      ) : hint ? (
        <p
          id={hintId}
          className="text-[11px] font-medium text-[var(--text-muted)] mt-1"
        >
          {hint}
        </p>
      ) : null}
    </div>
  );
});
