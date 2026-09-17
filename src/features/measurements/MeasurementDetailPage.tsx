import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRepositoryData } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { CHART_COLORS, ChartCard } from '@/components/Chart';
import {
  Button,
  Card,
  EmptyState,
  PageHeader,
  Segmented,
  Spinner,
  StatTile,
} from '@/components/ui';
import { MEASUREMENT_METRICS, metricKind, metricLabel } from '@/domain/taxonomy';
import { formatDate, isWithin, resolveRange, type RangeKey } from '@/domain/time';
import { formatLength, formatWeight, fromGrams, fromMillimetres, trimNumber } from '@/domain/units';
import type { BodyMeasurement, MeasurementMetric } from '@/domain/types';
import { MeasurementEntrySheet } from './MeasurementsPage';

/** Trend, absolute change and average weekly delta for one measurement. */
export function MeasurementDetailPage() {
  const { metric } = useParams<{ metric: string }>();
  const { weightUnit, lengthUnit } = useSettings();
  const [range, setRange] = useState<RangeKey>('12w');
  const [editing, setEditing] = useState<BodyMeasurement | null>(null);
  const [adding, setAdding] = useState(false);

  const valid = MEASUREMENT_METRICS.some((entry) => entry.value === metric);
  const metricValue = (valid ? metric : 'bodyweight') as MeasurementMetric;
  const kind = metricKind(metricValue);
  const unit = kind === 'mass' ? weightUnit : lengthUnit;

  const { data, loading, reload } = useRepositoryData(
    (repository) => repository.listMeasurements(metricValue),
    [metricValue],
  );

  const view = useMemo(() => {
    const all = [...(data ?? [])].sort((a, b) => a.recordedAt.localeCompare(b.recordedAt));
    const resolved = resolveRange(range);
    const inRange = all.filter((entry) => isWithin(resolved, new Date(entry.recordedAt)));

    if (inRange.length === 0)
      return { all, inRange, change: 0, weekly: 0, first: null, last: null };

    const first = inRange[0]!;
    const last = inRange[inRange.length - 1]!;
    const change = last.value - first.value;
    const days = Math.max(
      1,
      (new Date(last.recordedAt).getTime() - new Date(first.recordedAt).getTime()) / 86_400_000,
    );
    const weekly = (change / days) * 7;

    return { all, inRange, change, weekly, first, last };
  }, [data, range]);

  const display = (value: number) =>
    kind === 'mass' ? formatWeight(value, weightUnit) : formatLength(value, lengthUnit);

  const displaySigned = (value: number) => {
    const converted =
      kind === 'mass' ? fromGrams(value, weightUnit) : fromMillimetres(value, lengthUnit);
    const rounded = Math.round(converted * 100) / 100;
    return `${rounded > 0 ? '+' : ''}${trimNumber(rounded)}`;
  };

  if (loading && !data) return <Spinner label="Loading measurements" />;

  return (
    <>
      <PageHeader
        title={metricLabel(metricValue)}
        subtitle={`${view.all.length} entr${view.all.length === 1 ? 'y' : 'ies'} · stored in ${
          kind === 'mass' ? 'grams' : 'millimetres'
        }, shown in ${unit}`}
        actions={
          <Button variant="primary" onClick={() => setAdding(true)}>
            Log
          </Button>
        }
      />

      <div className="mb-3">
        <Segmented
          label="Time range"
          size="sm"
          value={range}
          onChange={setRange}
          options={[
            { value: 'this_week', label: 'This week' },
            { value: '4w', label: '4W' },
            { value: '8w', label: '8W' },
            { value: '12w', label: '12W' },
            { value: '6m', label: '6M' },
            { value: '1y', label: '1Y' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {view.inRange.length === 0 ? (
        <EmptyState
          title="Nothing logged in this range"
          description="Pick a wider range, or add an entry to start the trend."
          icon="📏"
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              Log {metricLabel(metricValue).toLowerCase()}
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <StatTile
              label="Latest"
              value={`${display(view.last!.value)}`}
              sub={unit}
              tone="accent"
            />
            <StatTile label="Change" value={`${displaySigned(view.change)}`} sub={unit} />
            <StatTile
              label="Per week"
              value={`${displaySigned(view.weekly)}`}
              sub={`${unit}/week`}
            />
          </div>

          <ChartCard
            title={`${metricLabel(metricValue)} trend`}
            summary={`${view.inRange.length} entries from ${formatDate(view.first!.recordedAt)} to ${formatDate(
              view.last!.recordedAt,
            )}. Change ${displaySigned(view.change)} ${unit}, averaging ${displaySigned(view.weekly)} ${unit} per week.`}
            valueLabel={`${metricLabel(metricValue)} (${unit})`}
            formatValue={display}
            series={[
              {
                id: 'value',
                name: `${metricLabel(metricValue)} (${unit})`,
                color: CHART_COLORS[1]!,
                points: view.inRange.map((entry) => ({
                  date: entry.recordedAt,
                  label: formatDate(entry.recordedAt, { day: 'numeric', month: 'short' }),
                  value: entry.value,
                  detail: entry.note,
                })),
              },
            ]}
          />

          <h2 className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wide text-ink-subtle">
            Entries
          </h2>
          <ul className="space-y-1.5">
            {[...view.inRange].reverse().map((entry) => (
              <li key={entry.id}>
                <button
                  type="button"
                  onClick={() => setEditing(entry)}
                  className="rf-card flex w-full items-center justify-between gap-2 p-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {formatDate(entry.recordedAt)}
                    </span>
                    {entry.note && (
                      <span className="block truncate text-xs text-ink-subtle">{entry.note}</span>
                    )}
                  </span>
                  <span className="shrink-0 text-sm tabular-nums text-ink-muted">
                    {display(entry.value)} {unit}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Card className="mt-4 text-xs text-ink-subtle">
        Left and right limbs are tracked separately — see{' '}
        <Link to="/measurements" className="text-accent">
          all metrics
        </Link>
        .
      </Card>

      <MeasurementEntrySheet
        open={adding || !!editing}
        metric={editing?.metric ?? metricValue}
        existing={editing ?? undefined}
        onClose={() => {
          setAdding(false);
          setEditing(null);
        }}
        onSaved={reload}
      />

      <div className="h-8" aria-hidden="true" />
    </>
  );
}
