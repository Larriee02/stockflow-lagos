import React, { forwardRef, useId } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Reusable Production Select Dropdown Primitive
 */
export const Select = forwardRef(function Select(
  {
    label,
    error,
    hint,
    id: externalId,
    options = [],
    className = '',
    containerClassName = '',
    disabled = false,
    required = false,
    children,
    ...props
  },
  ref
) {
  const autoId = useId();
  const selectId = externalId || autoId;
  const errorId = `${selectId}-error`;
  const hintId = `${selectId}-hint`;

  return (
    <div className={`space-y-1.5 w-full text-left ${containerClassName}`}>
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider"
        >
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
      )}

      <div className="relative flex items-center">
        <select
          ref={ref}
          id={selectId}
          disabled={disabled}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={
            error ? errorId : hint ? hintId : undefined
          }
          className={`liquid-input appearance-none w-full px-3.5 py-2.5 pr-10 text-xs sm:text-sm font-medium rounded-xl transition-all outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed ${
            error
              ? 'border-rose-500/80 focus:border-rose-500 focus:ring-rose-500/30'
              : ''
          } ${className}`}
          {...props}
        >
          {options.length > 0
            ? options.map((opt) => (
                <option
                  key={opt.value}
                  value={opt.value}
                  className="bg-[var(--bg-option)] text-[var(--text-primary)]"
                >
                  {opt.label}
                </option>
              ))
            : children}
        </select>

        <div className="absolute right-3.5 pointer-events-none text-[var(--text-muted)] flex items-center">
          <ChevronDown className="w-4 h-4" />
        </div>
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
