import { Link } from 'react-router-dom';
import { Card, PageHeader } from '@/components/ui';
import { Icon, Icons, type LucideIcon } from '@/components/icons';

const TOOLS: Array<{
  to: string;
  icon: LucideIcon;
  title: string;
  description: string;
}> = [
  {
    to: '/tools/plates',
    icon: Icons.plates,
    title: 'Plate calculator',
    description: 'Exact plates per side, based on your bar and the plates available.',
  },
  {
    to: '/tools/warmup',
    icon: Icons.flame,
    title: 'Warm-up generator',
    description: 'A ramp to your working weight, rounded to loads you can actually build.',
  },
];

/** Hub for the standalone calculators. Both are also reachable inside an active workout. */
export function ToolsPage() {
  return (
    <>
      <PageHeader title="Tools" subtitle="Available here and from inside any workout." />
      <ul className="grid gap-2 sm:grid-cols-2">
        {TOOLS.map((tool) => (
          <li key={tool.to}>
            <Link to={tool.to} className="block">
              <Card className="h-full p-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-raised text-ink-muted">
                  <Icon icon={tool.icon} size={20} />
                </span>
                <h2 className="mt-3 text-sm font-semibold text-ink">{tool.title}</h2>
                <p className="mt-1 text-xs text-ink-muted">{tool.description}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
