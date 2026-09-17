import { Link } from 'react-router-dom';
import { Card, PageHeader } from '@/components/ui';

const TOOLS = [
  {
    to: '/tools/plates',
    icon: '🥏',
    title: 'Plate calculator',
    description: 'Exact plates per side, based on your bar and the plates available.',
  },
  {
    to: '/tools/warmup',
    icon: '🔥',
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
              <Card className="h-full p-4 hover:border-accent/60">
                <span aria-hidden="true" className="text-2xl">
                  {tool.icon}
                </span>
                <h2 className="mt-2 text-sm font-semibold text-ink">{tool.title}</h2>
                <p className="mt-1 text-xs text-ink-muted">{tool.description}</p>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
