import type { Config } from 'tailwindcss';

/**
 * RepForge design tokens.
 *
 * All colors are declared as CSS custom properties (see src/styles/tokens.css) holding
 * space-separated RGB channels, so that a single class (`bg-surface`) resolves correctly
 * in light mode, dark mode and each accent theme without duplicating utilities.
 */
const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        canvas: 'rgb(var(--rf-canvas) / <alpha-value>)',
        surface: 'rgb(var(--rf-surface) / <alpha-value>)',
        'surface-raised': 'rgb(var(--rf-surface-raised) / <alpha-value>)',
        line: 'rgb(var(--rf-line) / <alpha-value>)',
        ink: 'rgb(var(--rf-ink) / <alpha-value>)',
        'ink-muted': 'rgb(var(--rf-ink-muted) / <alpha-value>)',
        'ink-subtle': 'rgb(var(--rf-ink-subtle) / <alpha-value>)',
        accent: 'rgb(var(--rf-accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--rf-accent-ink) / <alpha-value>)',
        'accent-soft': 'rgb(var(--rf-accent-soft) / <alpha-value>)',
        success: 'rgb(var(--rf-success) / <alpha-value>)',
        warning: 'rgb(var(--rf-warning) / <alpha-value>)',
        danger: 'rgb(var(--rf-danger) / <alpha-value>)',
        'danger-ink': 'rgb(var(--rf-danger-ink) / <alpha-value>)',
      },
      borderRadius: {
        sm: '0.375rem',
        DEFAULT: '0.625rem',
        lg: '0.875rem',
        xl: '1.125rem',
        '2xl': '1.5rem',
      },
      fontFamily: {
        sans: ['"Inter var"', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      fontSize: {
        'data-lg': ['1.75rem', { lineHeight: '2rem', fontWeight: '700' }],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.06), 0 8px 24px -12px rgb(0 0 0 / 0.25)',
        sheet: '0 -8px 40px -12px rgb(0 0 0 / 0.45)',
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
        'safe-t': 'env(safe-area-inset-top, 0px)',
        tap: '2.75rem',
      },
      keyframes: {
        'rf-rise': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'rf-pop': {
          '0%': { transform: 'scale(0.96)' },
          '60%': { transform: 'scale(1.02)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        rise: 'rf-rise 180ms ease-out both',
        pop: 'rf-pop 160ms ease-out both',
      },
    },
  },
  plugins: [],
};

export default config;
