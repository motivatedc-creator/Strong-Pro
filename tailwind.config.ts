import type { Config } from 'tailwindcss';

/**
 * Lock’d design tokens.
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
        sm: '0.5rem',
        DEFAULT: '0.75rem',
        lg: '1rem',
        xl: '1.25rem',
        '2xl': '1.5rem',
        '3xl': '1.75rem',
      },
      fontFamily: {
        sans: ['Archivo', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Barlow Condensed"', 'Arial Narrow', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"JetBrains Mono"', 'ui-monospace', 'Menlo', 'monospace'],
      },
      fontSize: {
        'data-lg': ['1.75rem', { lineHeight: '2rem', fontWeight: '700' }],
      },
      boxShadow: {
        card: '0 0 0 1px rgb(255 255 255 / 0.06), 0 12px 32px -16px rgb(0 0 0 / 0.55)',
        sheet: '0 -12px 48px -12px rgb(0 0 0 / 0.55)',
      },
      spacing: {
        'safe-b': 'env(safe-area-inset-bottom, 0px)',
        'safe-t': 'env(safe-area-inset-top, 0px)',
        tap: '2.75rem',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'rf-rise': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'rf-pop': {
          '0%': { transform: 'scale(0.96)' },
          '100%': { transform: 'scale(1)' },
        },
      },
      animation: {
        rise: 'rf-rise 250ms cubic-bezier(0.22, 1, 0.36, 1) both',
        pop: 'rf-pop 160ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
