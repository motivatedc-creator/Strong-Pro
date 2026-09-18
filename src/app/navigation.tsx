import { NavLink, useLocation } from 'react-router-dom';
import { cx } from '@/components/ui';

/**
 * Navigation model.
 *
 * Phones get a five-item bottom bar (thumb-reachable, 44px+ targets) with a "More" hub
 * holding the remaining destinations. Tablets and desktops get a persistent sidebar with
 * every destination visible, so nothing is buried behind an extra tap on a big screen.
 */

export interface NavItem {
  to: string;
  label: string;
  icon: string;
  /** Shown in the phone bottom bar. */
  primary: boolean;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: '⌂', primary: true, end: true },
  { to: '/templates', label: 'Routines', icon: '▤', primary: true },
  { to: '/history', label: 'History', icon: '⏱', primary: true },
  { to: '/analytics', label: 'Data Lab', icon: '📈', primary: true },
  { to: '/measurements', label: 'Measurements', icon: '📏', primary: false },
  { to: '/tools', label: 'Tools', icon: '🧮', primary: false },
  { to: '/exercises', label: 'Library', icon: '🏋', primary: false },
  { to: '/settings', label: 'Settings', icon: '⚙', primary: false },
];

const MORE_PATHS = NAV_ITEMS.filter((item) => !item.primary).map((item) => item.to);

export function BottomNav() {
  const location = useLocation();
  const moreActive = MORE_PATHS.some((path) => location.pathname.startsWith(path));

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.filter((item) => item.primary).map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[11px] font-medium transition',
                  isActive ? 'text-accent' : 'text-ink-subtle hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span aria-hidden="true" className="text-lg leading-none">
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                  <span
                    aria-hidden="true"
                    className={cx(
                      'h-0.5 w-6 rounded-full',
                      isActive ? 'bg-accent' : 'bg-transparent',
                    )}
                  />
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <NavLink
            to="/more"
            className={cx(
              'flex min-h-[3.5rem] flex-col items-center justify-center gap-0.5 rounded px-1 py-1 text-[11px] font-medium transition',
              moreActive ? 'text-accent' : 'text-ink-subtle hover:text-ink',
            )}
            aria-current={moreActive ? 'page' : undefined}
          >
            <span aria-hidden="true" className="text-lg leading-none">
              ⋯
            </span>
            <span>More</span>
            <span
              aria-hidden="true"
              className={cx('h-0.5 w-6 rounded-full', moreActive ? 'bg-accent' : 'bg-transparent')}
            />
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

export function SideNav() {
  return (
    <nav
      aria-label="Primary"
      className="hidden w-60 shrink-0 border-r border-line bg-surface px-3 py-5 lg:block"
    >
      <div className="mb-6 flex items-center gap-2 px-2">
        <img src="/brand/symbol.svg" alt="" aria-hidden="true" className="h-8 w-8" />
        <span className="font-mono text-lg font-bold tracking-tight text-ink">CERTIFIED</span>
      </div>
      <ul className="space-y-1">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-tap items-center gap-3 rounded px-3 text-sm font-medium transition',
                  isActive
                    ? 'bg-accent/15 text-accent'
                    : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                )
              }
            >
              <span aria-hidden="true" className="text-base">
                {item.icon}
              </span>
              {item.label}
            </NavLink>
          </li>
        ))}
      </ul>
      <p className="mt-6 px-3 text-xs text-ink-subtle">
        Your reps. Your receipts. Local-first, always.
      </p>
    </nav>
  );
}
