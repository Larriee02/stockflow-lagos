import React from 'react';

/**
 * Light Mode Gradient Lab Embed (User-Provided Palette):
 * ["#1a2a4a", "#3a5a8a", "#8aa8d0", "#d0dcf0", "#f4f7fc"]
 * Mode: duo, n: 5, u_gap: 0.55, u_blend: 1.4, u_warp: 0.3, u_speed: 0.2
 */
const LIGHT_GRADIENT_EMBED_URL =
  'https://backgrounds.supply/gradient-lab/embed#s=eyJtIjoiZHVvIiwiYyI6WyIjMWEyYTRhIiwiIzNhNWE4YSIsIiM4YWE4ZDAiLCIjZDBkY2YwIiwiI2Y0ZjdmYyIsIiMwMDAwMDAiLCIjMDAwMDAwIiwiIzAwMDAwMCJdLCJvIjpbWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF1dLCJuIjo1LCJiIjoxLjAyLCJrIjoxLjAyLCJzIjoxLjAyLCJnIjowLjAxMiwicCI6eyJ1X2dhcCI6MC41NSwidV9ibGVuZCI6MS40LCJ1X3dhcnAiOjAuMywidV9zcGVlZCI6MC4yfX0';

/**
 * Complementary Dark Mode Gradient Lab Embed:
 * ["#050912", "#0b1528", "#13223e", "#1a2a4a", "#2c466f"]
 * Anchored in the same #1a2a4a & #3a5a8a nocturnal ocean-slate family with identical shader physics.
 */
const DARK_GRADIENT_EMBED_URL =
  'https://backgrounds.supply/gradient-lab/embed#s=eyJtIjoiZHVvIiwiYyI6WyIjMDUwOTEyIiwiIzBiMTUyOCIsIiMxMzIyM2UiLCIjMWEyYTRhIiwiIzJjNDY2ZiIsIiMwMDAwMDAiLCIjMDAwMDAwIiwiIzAwMDAwMCJdLCJvIjpbWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF0sWzAsMF1dLCJuIjo1LCJiIjoxLjAyLCJrIjoxLjAyLCJzIjoxLjAyLCJnIjowLjAxMiwicCI6eyJ1X2dhcCI6MC41NSwidV9ibGVuZCI6MS40LCJ1X3dhcnAiOjAuMywidV9zcGVlZCI6MC4yfX0';

export function GradientBackground({ darkMode }) {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 w-full h-full overflow-hidden pointer-events-none select-none z-0 no-print"
    >
      {/* 1. Instant Native CSS Gradient Mesh Fallback (Zero-flash before WebGL iframe initializes or when offline) */}
      <div
        className="absolute inset-0 w-full h-full transition-opacity duration-500"
        style={{
          background: darkMode
            ? 'radial-gradient(at 15% 15%, #1a2a4a 0%, transparent 55%), radial-gradient(at 85% 20%, #2c466f 0%, transparent 50%), radial-gradient(at 50% 85%, #13223e 0%, transparent 60%), linear-gradient(135deg, #050912 0%, #0b1528 50%, #13223e 100%)'
            : 'radial-gradient(at 12% 14%, rgba(26, 42, 74, 0.22) 0%, transparent 52%), radial-gradient(at 86% 18%, rgba(58, 90, 138, 0.28) 0%, transparent 54%), radial-gradient(at 70% 84%, rgba(138, 168, 208, 0.45) 0%, transparent 58%), linear-gradient(135deg, #d0dcf0 0%, #e5edf8 48%, #f4f7fc 100%)',
        }}
      />

      {/* 2. Primary Gradient Lab WebGL Embed (User-Provided Light Palette) */}
      <iframe
        src={LIGHT_GRADIENT_EMBED_URL}
        title="Gradient by Backgrounds Supply"
        loading="eager"
        allow="fullscreen"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '280px',
          border: 0,
          display: 'block',
          opacity: darkMode ? 0 : 1,
          transition: 'opacity 500ms cubic-bezier(0.22, 1, 0.36, 1)',
          pointerEvents: 'none',
        }}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* 3. Complementary Dark Mode Gradient Lab WebGL Embed */}
      <iframe
        src={DARK_GRADIENT_EMBED_URL}
        title="Dark Mode Gradient by Backgrounds Supply"
        loading="lazy"
        allow="fullscreen"
        style={{
          width: '100%',
          height: '100%',
          minHeight: '280px',
          border: 0,
          display: 'block',
          opacity: darkMode ? 1 : 0,
          transition: 'opacity 500ms cubic-bezier(0.22, 1, 0.36, 1)',
          pointerEvents: 'none',
        }}
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* 4. Subtle Atmospheric Glass Readability Veil (Ensures WCAG AAA contrast across all dynamic waves) */}
      <div
        className="absolute inset-0 w-full h-full transition-colors duration-500"
        style={{
          background: darkMode
            ? 'radial-gradient(circle at 50% 25%, rgba(5, 9, 18, 0.22) 0%, rgba(5, 9, 18, 0.56) 100%)'
            : 'radial-gradient(circle at 50% 25%, rgba(244, 247, 252, 0.38) 0%, rgba(208, 220, 240, 0.28) 100%)',
        }}
      />
    </div>
  );
}
