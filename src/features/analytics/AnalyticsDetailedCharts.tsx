import { Link } from 'react-router-dom';
import { CHART_COLORS, ChartCard } from '@/components/Chart';
import { Button, Card, Chip, Segmented, Select, StatTile, Toggle } from '@/components/ui';
import { FORMULA_EXPRESSION, FORMULA_LABEL } from '@/domain/oneRepMax';
import { RANGE_DESCRIPTIONS, type RangeKey } from '@/domain/time';
import { titleCase } from '@/domain/taxonomy';
import type { OneRepMaxFormula } from '@/domain/types';
import { formatCount, formatWeight, type WeightUnit } from '@/domain/units';
import { type ExerciseProgress, type PeriodBucket, type PeriodSummary } from './compute';
import { MUSCLE_HELP, RECORDS_HELP, VOLUME_HELP, oneRepMaxHelp } from './help';

type ExerciseOption = { id: string; name: string; sessions: number };

export function AnalyticsDetailedCharts({
  range,
  setRange,
  formula,
  setFormulaOverride,
  settingsFormula,
  includeWarmups,
  setIncludeWarmups,
  granularity,
  setGranularity,
  setExerciseId,
  weightUnit,
  view,
  formatWeightValue,
  setHelp,
  volumeChange,
  setsChange,
  selectedExercise,
}: {
  range: RangeKey;
  setRange: (value: RangeKey) => void;
  formula: OneRepMaxFormula;
  setFormulaOverride: (value: OneRepMaxFormula | null) => void;
  settingsFormula: OneRepMaxFormula;
  includeWarmups: boolean;
  setIncludeWarmups: (value: boolean) => void;
  granularity: 'week' | 'month';
  setGranularity: (value: 'week' | 'month') => void;
  setExerciseId: (value: string) => void;
  weightUnit: WeightUnit;
  view: {
    summary: PeriodSummary;
    buckets: PeriodBucket[];
    effectiveGranularity: 'week' | 'month';
    muscles: Array<{ muscle: string; attributedVolumeG: number; attributedSets: number }>;
    exercises: ExerciseOption[];
    selectedId: string;
    progress: ExerciseProgress | null;
  };
  formatWeightValue: (grams: number) => string;
  setHelp: (help: { title: string; lines: string[] } | null) => void;
  volumeChange: number | null;
  setsChange: number | null;
  selectedExercise: ExerciseOption | undefined;
}) {
  const settings = { oneRepMaxFormula: settingsFormula };
  const formulaOverride = formula !== settingsFormula ? formula : null;
  return (
<div id="detailed-analytics">
          <p className="mb-3 text-xs text-ink-muted">{RANGE_DESCRIPTIONS[range]}</p>
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

          <Card className="mb-4 p-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="text-xs text-ink-muted">
                1RM formula
                <Select
                  className="mt-1 h-10 min-h-0 py-0"
                  value={formula}
                  onChange={(event) => setFormulaOverride(event.target.value as OneRepMaxFormula)}
                >
                  <option value="epley">Epley</option>
                  <option value="brzycki">Brzycki</option>
                </Select>
                <span className="mt-1 block text-[11px] text-ink-subtle">
                  {FORMULA_EXPRESSION[formula]}
                </span>
              </label>
              <Toggle
                label="Include warm-up sets"
                description="Off by default: warm-ups inflate volume and estimates."
                checked={includeWarmups}
                onChange={setIncludeWarmups}
              />
            </div>
            {formulaOverride && formulaOverride !== settings.oneRepMaxFormula && (
              <p className="mt-1 text-xs text-ink-subtle">
                Overriding your default ({FORMULA_LABEL[settings.oneRepMaxFormula]}) for this screen
                only.
              </p>
            )}
          </Card>

          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <StatTile label="Workouts" value={formatCount(view.summary.workouts)} />
            <StatTile
              label="Sets"
              value={formatCount(view.summary.completedSets)}
              sub={changeLabel(setsChange)}
            />
            <StatTile
              label="Volume"
              value={formatWeightValue(view.summary.volumeG)}
              sub={`${weightUnit} (weight × reps)${volumeChange === null ? '' : ` · ${changeLabel(volumeChange)}`}`}
              tone="accent"
            />
            <StatTile label="Reps" value={formatCount(view.summary.totalReps)} />
          </div>

          {(view.summary.repsOnlySets > 0 ||
            view.summary.assistedSets > 0 ||
            view.summary.durationSeconds > 0) && (
            <p className="mb-4 flex flex-wrap gap-2 text-xs text-ink-subtle">
              {view.summary.repsOnlySets > 0 && (
                <Chip>{view.summary.repsOnlySets} bodyweight sets (no tonnage)</Chip>
              )}
              {view.summary.assistedSets > 0 && (
                <Chip>{view.summary.assistedSets} assisted sets (excluded)</Chip>
              )}
              {view.summary.durationSeconds > 0 && (
                <Chip>{Math.round(view.summary.durationSeconds / 60)} min of timed work</Chip>
              )}
            </p>
          )}

          <div className="mb-4">
            <ChartCard
              title={`${view.effectiveGranularity === 'week' ? 'Weekly' : 'Monthly'} volume`}
              summary={summariseBuckets(view.buckets, weightUnit)}
              valueLabel={`Volume (${weightUnit})`}
              xAxisLabel={view.effectiveGranularity === 'week' ? 'Week starting' : 'Month'}
              kind="bar"
              formatValue={formatWeightValue}
              series={[
                {
                  id: 'volume',
                  name: `Volume (${weightUnit})`,
                  color: CHART_COLORS[0]!,
                  points: view.buckets.map((bucket) => ({
                    date: bucket.date,
                    label: bucket.label,
                    value: bucket.volumeG,
                    detail: `${bucket.sets} sets across ${bucket.workouts} workouts`,
                  })),
                },
              ]}
              actions={
                <>
                  {range !== 'all' && (
                    <Segmented
                      label="Bucket size"
                      size="sm"
                      value={granularity}
                      onChange={setGranularity}
                      options={[
                        { value: 'week', label: 'Weekly' },
                        { value: 'month', label: 'Monthly' },
                      ]}
                    />
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setHelp({ title: 'How volume is calculated', lines: VOLUME_HELP })
                    }
                  >
                    ?
                  </Button>
                </>
              }
            />
          </div>

          <Card className="mb-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Muscle group balance</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setHelp({ title: 'Attributed volume', lines: MUSCLE_HELP })}
              >
                ?
              </Button>
            </div>
            {view.muscles.length === 0 ? (
              <p className="text-sm text-ink-muted">No attributed volume in this range.</p>
            ) : (
              <table className="w-full text-left text-sm">
                <caption className="rf-sr-only">
                  Attributed volume by muscle group. Primary muscles receive full credit, secondary
                  muscles a fraction.
                </caption>
                <thead>
                  <tr className="text-xs uppercase tracking-wide text-ink-subtle">
                    <th scope="col" className="py-1">
                      Muscle
                    </th>
                    <th scope="col" className="py-1 text-right">
                      Attributed volume ({weightUnit})
                    </th>
                    <th scope="col" className="py-1 text-right">
                      Sets
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {view.muscles.slice(0, 12).map((row) => {
                    const max = view.muscles[0]?.attributedVolumeG || 1;
                    return (
                      <tr key={row.muscle} className="border-t border-line/60">
                        <th scope="row" className="py-1.5 font-normal text-ink">
                          <span className="flex items-center gap-2">
                            <span
                              aria-hidden="true"
                              className="h-2 rounded-full bg-accent"
                              style={{
                                width: `${Math.max(4, (row.attributedVolumeG / max) * 64)}px`,
                              }}
                            />
                            {titleCase(row.muscle)}
                          </span>
                          {row.muscle === 'unmapped' && (
                            <Link to="/exercises" className="text-xs font-medium text-accent">
                              Fix in Library
                            </Link>
                          )}
                        </th>
                        <td className="py-1.5 text-right tabular-nums text-ink-muted">
                          {formatWeightValue(row.attributedVolumeG)}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-ink-muted">
                          {Math.round(row.attributedSets * 10) / 10}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </Card>

          <div className="mb-2 mt-6 border-t border-line pt-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
              Per-exercise detail
            </h2>
            <p className="text-xs text-ink-subtle">
              Everything below tracks one exercise at a time, separate from the totals above.
            </p>
          </div>

          <Card className="mb-3">
            <label className="text-xs text-ink-muted">
              Exercise
              <Select
                className="mt-1"
                value={view.selectedId}
                onChange={(event) => setExerciseId(event.target.value)}
              >
                {view.exercises.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name} ({option.sessions} session{option.sessions === 1 ? '' : 's'})
                  </option>
                ))}
              </Select>
            </label>
            {selectedExercise && (
              <Link
                to={`/exercises/${selectedExercise.id}`}
                className="mt-2 inline-block text-sm font-medium text-accent"
              >
                Open exercise history →
              </Link>
            )}
          </Card>

          {view.progress && (
            <div className="space-y-4">
              <ChartCard
                title={`Estimated 1RM — ${selectedExercise?.name ?? ''}`}
                summary={summariseSeries(
                  view.progress.oneRepMax.map((point) => point.value),
                  weightUnit,
                  FORMULA_LABEL[formula],
                )}
                valueLabel={`e1RM (${weightUnit})`}
                formatValue={formatWeightValue}
                series={[
                  {
                    id: 'e1rm',
                    name: `Estimated 1RM (${weightUnit})`,
                    color: CHART_COLORS[0]!,
                    points: view.progress.oneRepMax.map((point) => ({
                      date: point.date,
                      label: point.label,
                      value: point.value,
                      detail: point.detail ? describeSource(point.detail, weightUnit) : undefined,
                    })),
                  },
                ]}
                actions={
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setHelp({ title: 'Estimated 1RM', lines: oneRepMaxHelp(formula) })
                    }
                  >
                    ?
                  </Button>
                }
              />

              <ChartCard
                title="Heaviest set"
                summary={summariseSeries(
                  view.progress.bestWeight.map((point) => point.value),
                  weightUnit,
                )}
                valueLabel={`Weight (${weightUnit})`}
                formatValue={formatWeightValue}
                series={[
                  {
                    id: 'weight',
                    name: `Heaviest set (${weightUnit})`,
                    color: CHART_COLORS[1]!,
                    points: view.progress.bestWeight.map((point) => ({
                      date: point.date,
                      label: point.label,
                      value: point.value,
                      detail: point.detail,
                    })),
                  },
                ]}
              />

              <ChartCard
                title="Session volume"
                summary={summariseSeries(
                  view.progress.volume.map((point) => point.value),
                  weightUnit,
                )}
                valueLabel={`Volume (${weightUnit})`}
                kind="bar"
                formatValue={formatWeightValue}
                series={[
                  {
                    id: 'volume',
                    name: `Volume (${weightUnit})`,
                    color: CHART_COLORS[2]!,
                    points: view.progress.volume.map((point) => ({
                      date: point.date,
                      label: point.label,
                      value: point.value,
                    })),
                  },
                ]}
              />

              <Card>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-ink">Rep records in this range</h2>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setHelp({ title: 'How records work', lines: RECORDS_HELP })}
                  >
                    ?
                  </Button>
                </div>
                {view.progress.repMaxes.length === 0 ? (
                  <p className="text-sm text-ink-muted">
                    No weighted sets for this exercise in this range.
                  </p>
                ) : (
                  <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {view.progress.repMaxes.map((record) => (
                      <li
                        key={record.reps}
                        className="rounded border border-line bg-surface-raised px-3 py-2"
                      >
                        <p className="text-xs uppercase tracking-wide text-ink-subtle">
                          {record.reps}+ reps
                        </p>
                        <p className="text-sm font-bold tabular-nums text-ink">
                          {formatWeight(record.weightG, weightUnit)} {weightUnit}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}
        </div>
  );
}

function changeLabel(change: number | null): string {
  if (change === null) return 'no prior period';
  const rounded = Math.round(change);
  if (rounded === 0) return 'same as before';
  return `${rounded > 0 ? '+' : ''}${rounded}% vs previous`;
}

function summariseBuckets(
  buckets: Array<{ volumeG: number; label: string }>,
  unit: 'kg' | 'lb',
): string {
  if (buckets.length === 0) return 'No completed sets in this range.';
  const total = buckets.reduce((sum, bucket) => sum + bucket.volumeG, 0);
  const peak = buckets.reduce(
    (top, bucket) => (bucket.volumeG > top.volumeG ? bucket : top),
    buckets[0]!,
  );
  return `${buckets.length} periods, ${formatWeight(total, unit, { decimals: 0 })} ${unit} total. Peak ${formatWeight(peak.volumeG, unit, { decimals: 0 })} ${unit} in the period starting ${peak.label}.`;
}

function summariseSeries(values: number[], unit: 'kg' | 'lb', formulaLabel?: string): string {
  if (values.length === 0) return 'No data in this range.';
  const first = values[0]!;
  const last = values[values.length - 1]!;
  const max = Math.max(...values);
  const direction = last > first ? 'up' : last < first ? 'down' : 'flat';
  const change = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
  return `${values.length} sessions${formulaLabel ? ` (${formulaLabel})` : ''}. From ${formatWeight(first, unit)} to ${formatWeight(last, unit)} ${unit} — ${direction}${
    direction === 'flat' ? '' : ` ${Math.abs(change)}%`
  }. Best ${formatWeight(max, unit)} ${unit}.`;
}

/** Converts the stored "100000 g × 5 (epley)" detail into the user's units. */
function describeSource(detail: string, unit: 'kg' | 'lb'): string {
  const match = /^(\d+) g × (\d+) \((\w+)\)$/.exec(detail);
  if (!match) return detail;
  const [, grams, reps, formula] = match;
  return `from ${formatWeight(Number(grams), unit)} ${unit} × ${reps} (${titleCase(formula ?? '')})`;
}
