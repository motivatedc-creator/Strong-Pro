import { useId, useMemo, useState, type ReactNode } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Button, cx, EmptyState } from './ui';

/**
 * Charts.
 *
 * Every chart is paired with a text summary (always present for screen readers) and a
 * toggleable data table, so no information is available only as pixels. Series values are
 * computed by the caller from stored data — charts never calculate anything themselves.
 */

export interface ChartPoint {
  /** X-axis label, already formatted for display. */
  label: string;
  value: number;
  /** Extra line shown in the tooltip, e.g. "100 kg x 5 (Epley)". */
  detail?: string;
}

export interface ChartSeries {
  id: string;
  name: string;
  color: string;
  points: ChartPoint[];
}

export const CHART_COLORS = [
  'rgb(var(--rf-chart-1))',
  'rgb(var(--rf-chart-2))',
  'rgb(var(--rf-chart-3))',
  'rgb(var(--rf-chart-4))',
  'rgb(var(--rf-chart-5))',
  'rgb(var(--rf-chart-6))',
];

function ChartTooltip({
  active,
  payload,
  label,
  formatValue,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; payload?: ChartPoint & { detail?: string }; name?: string }>;
  label?: string;
  formatValue: (value: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-line bg-surface px-3 py-2 text-xs shadow-card">
      <p className="font-semibold text-ink">{label}</p>
      {payload.map((entry, index) => (
        <p key={index} className="mt-1 text-ink-muted">
          <span className="font-medium text-ink">{formatValue(entry.value ?? 0)}</span>
          {entry.payload?.detail && (
            <span className="block text-ink-subtle">{entry.payload.detail}</span>
          )}
        </p>
      ))}
    </div>
  );
}

export interface ChartCardProps {
  title: string;
  /** One sentence describing the trend; also the screen-reader summary. */
  summary: string;
  series: ChartSeries[];
  formatValue: (value: number) => string;
  kind?: 'line' | 'bar';
  height?: number;
  actions?: ReactNode;
  emptyMessage?: string;
  /** Column header for the data table's value column, and the chart's Y-axis label. */
  valueLabel?: string;
  /** The chart's X-axis label. Every RepForge chart plots against time, so this defaults to "Date". */
  xAxisLabel?: string;
}

/** Above this many points, X-axis ticks are thinned and rotated so labels stop overlapping. */
const DENSE_POINT_THRESHOLD = 12;
/** Target number of visible X-axis ticks once a chart is dense. */
const TARGET_TICK_COUNT = 8;

export function ChartCard({
  title,
  summary,
  series,
  formatValue,
  kind = 'line',
  height = 220,
  actions,
  emptyMessage = 'Log a few sessions and this chart will fill in.',
  valueLabel = 'Value',
  xAxisLabel = 'Date',
}: ChartCardProps) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const hasData = series.some((entry) => entry.points.length > 0);

  // Recharts wants one row per x value with a key per series.
  const rows = useMemo(() => {
    const byLabel = new Map<string, Record<string, string | number | undefined>>();
    for (const entry of series) {
      for (const point of entry.points) {
        const row = byLabel.get(point.label) ?? { label: point.label };
        row[entry.id] = point.value;
        if (point.detail) row[`${entry.id}__detail`] = point.detail;
        row.detail = point.detail;
        byLabel.set(point.label, row);
      }
    }
    return [...byLabel.values()];
  }, [series]);

  // A chart with many points (e.g. weekly volume over "All time") gets crowded and
  // illegible if every tick tries to render — thin them out and angle what remains.
  const isDense = rows.length > DENSE_POINT_THRESHOLD;
  const tickInterval = isDense ? Math.max(0, Math.ceil(rows.length / TARGET_TICK_COUNT) - 1) : 0;
  const chartHeight = isDense ? height + 26 : height;
  const xAxisProps = isDense
    ? { interval: tickInterval, angle: -35, textAnchor: 'end' as const, height: 52, dy: 8 }
    : { interval: 0 as const, height: 30 };

  return (
    <section className="rf-card p-4">
      <header className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <div className="flex items-center gap-2">{actions}</div>
      </header>

      <p className="mb-3 text-xs text-ink-muted">{summary}</p>

      {!hasData ? (
        <EmptyState title="No data in this range" description={emptyMessage} icon="📈" />
      ) : (
        <>
          <div style={{ height: chartHeight }} className="w-full">
            <ResponsiveContainer width="100%" height="100%">
              {kind === 'line' ? (
                <LineChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
                  <CartesianGrid
                    stroke="rgb(var(--rf-line))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'rgb(var(--rf-ink-subtle))' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgb(var(--rf-line))' }}
                    minTickGap={isDense ? 4 : 24}
                    {...xAxisProps}
                    label={
                      isDense
                        ? undefined
                        : {
                            value: xAxisLabel,
                            position: 'insideBottom',
                            offset: -2,
                            fontSize: 11,
                            fill: 'rgb(var(--rf-ink-subtle))',
                          }
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'rgb(var(--rf-ink-subtle))' }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value: number) => formatValue(value)}
                    label={{
                      value: valueLabel,
                      angle: -90,
                      position: 'insideLeft',
                      offset: 8,
                      fontSize: 11,
                      fill: 'rgb(var(--rf-ink-subtle))',
                    }}
                  />
                  <Tooltip content={<ChartTooltip formatValue={formatValue} />} />
                  {series.map((entry) => (
                    <Line
                      key={entry.id}
                      type="monotone"
                      dataKey={entry.id}
                      name={entry.name}
                      stroke={entry.color}
                      strokeWidth={2}
                      dot={{ r: 2.5, strokeWidth: 0, fill: entry.color }}
                      activeDot={{ r: 5 }}
                      connectNulls
                      isAnimationActive={false}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart data={rows} margin={{ top: 4, right: 8, bottom: 0, left: 4 }}>
                  <CartesianGrid
                    stroke="rgb(var(--rf-line))"
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 11, fill: 'rgb(var(--rf-ink-subtle))' }}
                    tickLine={false}
                    axisLine={{ stroke: 'rgb(var(--rf-line))' }}
                    minTickGap={isDense ? 4 : 16}
                    {...xAxisProps}
                    label={
                      isDense
                        ? undefined
                        : {
                            value: xAxisLabel,
                            position: 'insideBottom',
                            offset: -2,
                            fontSize: 11,
                            fill: 'rgb(var(--rf-ink-subtle))',
                          }
                    }
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'rgb(var(--rf-ink-subtle))' }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value: number) => formatValue(value)}
                    label={{
                      value: valueLabel,
                      angle: -90,
                      position: 'insideLeft',
                      offset: 8,
                      fontSize: 11,
                      fill: 'rgb(var(--rf-ink-subtle))',
                    }}
                  />
                  <Tooltip
                    cursor={{ fill: 'rgb(var(--rf-surface-raised))' }}
                    content={<ChartTooltip formatValue={formatValue} />}
                  />
                  {series.map((entry) => (
                    <Bar
                      key={entry.id}
                      dataKey={entry.id}
                      name={entry.name}
                      fill={entry.color}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={56}
                      isAnimationActive={false}
                    />
                  ))}
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>

          <ul className="mt-2 flex flex-wrap gap-3">
            {series.map((entry) => (
              <li key={entry.id} className="flex items-center gap-1.5 text-xs text-ink-muted">
                <span
                  aria-hidden="true"
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </li>
            ))}
          </ul>

          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            aria-expanded={showTable}
            aria-controls={tableId}
            onClick={() => setShowTable((value) => !value)}
          >
            {showTable ? 'Hide data table' : 'Show data table'}
          </Button>

          <div id={tableId} className={cx('mt-2 overflow-x-auto', !showTable && 'rf-sr-only')}>
            <table className="w-full min-w-[18rem] border-collapse text-left text-xs">
              <caption className="rf-sr-only">{`${title}. ${summary}`}</caption>
              <thead>
                <tr className="border-b border-line text-ink-subtle">
                  <th scope="col" className="py-1 pr-3 font-medium">
                    Date
                  </th>
                  {series.map((entry) => (
                    <th key={entry.id} scope="col" className="py-1 pr-3 font-medium">
                      {series.length > 1 ? entry.name : valueLabel}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={String(row.label)} className="border-b border-line/60">
                    <th scope="row" className="py-1 pr-3 font-normal text-ink-muted">
                      {String(row.label)}
                    </th>
                    {series.map((entry) => {
                      const value = row[entry.id];
                      return (
                        <td key={entry.id} className="py-1 pr-3 tabular-nums text-ink">
                          {typeof value === 'number' ? formatValue(value) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
