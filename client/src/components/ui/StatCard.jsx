import React from 'react';

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  valueColor = 'text-theme-primary',
  loading,
}) {
  return (
    <div className="liquid-glass p-3.5 sm:p-5 rounded-2xl relative overflow-hidden group hover:-translate-y-0.5">
      {/* Subtle Top-Right Specular Liquid Glow */}
      <div
        style={{ backgroundColor: 'var(--brand-blue-soft)' }}
        className="w-24 h-24 rounded-full blur-2xl absolute -top-8 -right-8 pointer-events-none opacity-80"
      />

      <div className="relative flex items-center justify-between gap-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.06em] sm:tracking-[0.08em] text-theme-secondary">
        <span className="truncate">{title}</span>
        {Icon && (
          <div
            style={{
              backgroundColor: 'var(--brand-blue-soft)',
              color: 'var(--brand-blue)',
              borderColor: 'var(--brand-blue-border)',
              boxShadow: 'inset 0 1px 0 0 rgba(255,255,255,0.35)',
            }}
            className="p-1.5 sm:p-2 rounded-xl border shrink-0"
          >
            <Icon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          </div>
        )}
      </div>
      {loading ? (
        <div className="mt-3 space-y-2 animate-pulse">
          <div
            style={{ backgroundColor: 'var(--bg-subtle)' }}
            className="h-7 rounded-lg w-2/3"
          />
          <div
            style={{ backgroundColor: 'var(--bg-subtle)' }}
            className="h-3 rounded-lg w-1/2"
          />
        </div>
      ) : (
        <>
          <p
            className={`mt-2 text-lg sm:text-[26px] font-extrabold font-luxury tabular-nums tracking-tight truncate ${valueColor}`}
          >
            {value}
          </p>
          {subtitle && (
            <div className="mt-1 text-[11px] sm:text-xs font-medium leading-snug text-theme-secondary">
              {subtitle}
            </div>
          )}
        </>
      )}
    </div>
  );
}
