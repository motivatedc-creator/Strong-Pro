import { Link } from 'react-router-dom';
import { Card, PageHeader } from '@/components/ui';
import { Icon } from '@/components/icons';
import { NAV_ITEMS } from '@/app/navigation';

const DESCRIPTIONS: Record<string, string> = {
  '/measurements': 'Body weight and circumferences with trends and weekly change.',
  '/tools': 'Plate calculator and warm-up generator.',
  '/exercises': 'Your exercise library: browse, edit, archive, add custom movements.',
  '/settings': 'Units, formulas, equipment, timers, themes, backup and import.',
};

/** Phone-only hub for the destinations that do not fit in the bottom bar. */
export function MorePage() {
  return (
    <>
      <PageHeader title="More" />
      <ul className="space-y-2">
        {NAV_ITEMS.filter((item) => !item.primary).map((item) => (
          <li key={item.to}>
            <Link to={item.to} className="block">
              <Card className="flex items-center gap-3 p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised text-ink-muted">
                  <Icon icon={item.icon} size={18} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-ink">{item.label}</span>
                  <span className="block text-xs text-ink-muted">{DESCRIPTIONS[item.to]}</span>
                </span>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-center text-xs text-ink-subtle">
        Lock'd is subscription-free. Everything you log stays on this device unless you export
        it.
      </p>
    </>
  );
}
