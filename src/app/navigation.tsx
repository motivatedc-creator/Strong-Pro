import { NavLink, useLocation } from 'react-router-dom';
import { cx } from '@/components/ui';
import { Icon, Icons, type LucideIcon } from '@/components/icons';

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
  icon: LucideIcon;
  /** Shown in the phone bottom bar. */
  primary: boolean;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { to: '/', label: 'Today', icon: Icons.today, primary: true, end: true },
  { to: '/templates', label: 'Routines', icon: Icons.routines, primary: true },
  { to: '/history', label: 'History', icon: Icons.history, primary: true },
  { to: '/analytics', label: 'Data Lab', icon: Icons.analytics, primary: true },
  { to: '/measurements', label: 'Measurements', icon: Icons.measurements, primary: false },
  { to: '/tools', label: 'Tools', icon: Icons.tools, primary: false },
  { to: '/exercises', label: 'Library', icon: Icons.library, primary: false },
  { to: '/settings', label: 'Settings', icon: Icons.settings, primary: false },
];

const MORE_PATHS = NAV_ITEMS.filter((item) => !item.primary).map((item) => item.to);

function NavGlyph({ icon, active }: { icon: LucideIcon; active: boolean }) {
  return (
    <Icon
      icon={icon}
      size={20}
      strokeWidth={active ? 2.1 : 1.7}
      className={active ? 'text-accent' : 'text-current'}
    />
  );
}

export function BottomNav() {
  const location = useLocation();
  const moreActive = MORE_PATHS.some((path) => location.pathname.startsWith(path));

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 bg-surface/92 backdrop-blur-xl lg:hidden"
      style={{ boxShadow: '0 -1px 0 rgb(var(--rf-line) / 0.7)' }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch justify-between px-1 pb-[env(safe-area-inset-bottom)]">
        {NAV_ITEMS.filter((item) => item.primary).map((item) => (
          <li key={item.to} className="flex-1">
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold tracking-wide transition-colors duration-150',
                  isActive ? 'text-accent' : 'text-ink-subtle hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cx(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-[background-color] duration-150',
                      isActive && 'bg-accent/15',
                    )}
                  >
                    <NavGlyph icon={item.icon} active={isActive} />
                  </span>
                  <span>{item.label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
        <li className="flex-1">
          <NavLink
            to="/more"
            className={cx(
              'flex min-h-[3.5rem] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold tracking-wide transition-colors duration-150',
              moreActive ? 'text-accent' : 'text-ink-subtle hover:text-ink',
            )}
            aria-current={moreActive ? 'page' : undefined}
          >
            <span
              className={cx(
                'flex h-8 w-8 items-center justify-center rounded-full transition-[background-color] duration-150',
                moreActive && 'bg-accent/15',
              )}
            >
              <NavGlyph icon={Icons.more} active={moreActive} />
            </span>
            <span>More</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  );
}

export function SideNav() {
  return (
    <nav aria-label="Primary" className="hidden w-60 shrink-0 bg-surface px-3 py-6 lg:block">
      <div className="mb-8 flex items-center gap-2.5 px-2">
        <img src="/brand/symbol.svg" alt="" aria-hidden="true" className="h-8 w-8" />
        <div>
          <span className="block font-display text-lg font-extrabold tracking-tight text-ink">
            LOCKD
          </span>
          <span className="block text-[10px] font-medium uppercase tracking-[0.16em] text-ink-subtle">
            Keep the receipt
          </span>
        </div>
      </div>
      <ul className="space-y-0.5">
        {NAV_ITEMS.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cx(
                  'flex min-h-tap items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors duration-150',
                  isActive
                    ? 'bg-accent/12 text-accent'
                    : 'text-ink-muted hover:bg-surface-raised hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <NavGlyph icon={item.icon} active={isActive} />
                  {item.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
      <p className="mt-8 px-3 text-xs leading-relaxed text-ink-subtle">
        Keep the receipt. Local-first, always.
      </p>
    </nav>
  );
}
