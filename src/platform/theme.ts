import type { AccentTheme, ThemeMode } from '@/domain/types';

/**
 * Theme application.
 *
 * The resolved theme lives on <html data-theme data-accent>; a small inline script in
 * index.html applies the persisted choice before first paint so there is no flash.
 * The same choice is mirrored into localStorage (fast, synchronous) and the settings
 * table (authoritative, exported in backups).
 */

export const THEME_STORAGE_KEY = 'repforge.theme';

/** Meta theme-color per resolved mode, matching --rf-canvas. */
const THEME_COLOR: Record<'light' | 'dark', string> = {
  dark: '#0b0f14',
  light: '#f6f7f9',
};

export interface StoredTheme {
  mode: ThemeMode;
  accent: AccentTheme;
}

export function resolveMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode !== 'system') return mode;
  if (typeof window === 'undefined' || !window.matchMedia) return 'dark';
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export function applyTheme(theme: StoredTheme): 'light' | 'dark' {
  const resolved = resolveMode(theme.mode);
  const root = document.documentElement;
  root.setAttribute('data-theme', resolved);
  root.setAttribute('data-accent', theme.accent);

  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', THEME_COLOR[resolved]);

  try {
    localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // Private mode or blocked storage: the theme still applies for this session.
  }
  return resolved;
}

export function readStoredTheme(): StoredTheme | null {
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTheme>;
    if (!parsed.mode || !parsed.accent) return null;
    return { mode: parsed.mode, accent: parsed.accent };
  } catch {
    return null;
  }
}

/** Calls back when the OS switches between light and dark, for `mode: 'system'`. */
export function watchSystemTheme(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: light)');
  const handler = () => callback();
  query.addEventListener?.('change', handler);
  return () => query.removeEventListener?.('change', handler);
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export const ACCENT_THEMES: Array<{
  id: AccentTheme;
  name: string;
  description: string;
  swatch: string;
}> = [
  { id: 'ember', name: 'Ember', description: 'Warm orange on graphite', swatch: '#f97316' },
  { id: 'glacier', name: 'Glacier', description: 'Cool blue on slate', swatch: '#38bdf8' },
  { id: 'moss', name: 'Moss', description: 'Deep green on charcoal', swatch: '#34d399' },
  { id: 'violet', name: 'Violet', description: 'Soft violet on ink', swatch: '#a78bfa' },
];
