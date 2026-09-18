import { Card, Sheet } from '@/components/ui';
import { formatWeight } from '@/domain/units';
import type { WeightUnit } from '@/domain/units';
import {
  metricEvidenceFor,
  type MetricEvidence,
  type VerdictEvidenceKey,
  type WeeklyMetrics,
  type WeeklyVerdict,
} from './weeklyVerdict';

export function VerdictEvidenceSheet({
  open,
  onClose,
  verdict,
  weightUnit,
  focusKey,
}: {
  open: boolean;
  onClose: () => void;
  verdict: WeeklyVerdict;
  weightUnit: WeightUnit;
  focusKey?: VerdictEvidenceKey;
}) {
  const focused = focusKey ? metricEvidenceFor(verdict, focusKey, weightUnit) : null;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={focused ? `${focused.label} evidence` : 'Weekly Verdict evidence'}
      description="The logged weeks and calculation behind this number."
      size="lg"
    >
      <div className="space-y-4 text-sm">
        {focused ? (
          <FocusedMetricEvidence evidence={focused} />
        ) : (
          <OverviewEvidence verdict={verdict} weightUnit={weightUnit} />
        )}
      </div>
    </Sheet>
  );
}

function FocusedMetricEvidence({ evidence }: { evidence: MetricEvidence }) {
  return (
    <>
      <Card className="p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Formula</p>
        <p className="mt-1 font-medium text-ink">{evidence.label}</p>
        <p className="mt-1 text-ink-muted">{evidence.formula}</p>
      </Card>

      <section aria-labelledby="subject-metric-evidence">
        <h3 id="subject-metric-evidence" className="font-semibold text-ink">
          {evidence.subjectLabel}
        </h3>
        <p className="mt-1 text-base font-semibold tabular-nums text-ink">{evidence.subjectValue}</p>
      </section>

      <section aria-labelledby="baseline-metric-evidence">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 id="baseline-metric-evidence" className="font-semibold text-ink">
              Baseline weeks
            </h3>
            <p className="text-xs text-ink-subtle">Date range and value for each selected week.</p>
          </div>
          <span className="text-xs font-semibold text-accent">Mean {evidence.baselineMean}</span>
        </div>
        <div className="mt-2 overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[22rem] text-left text-xs">
            <thead className="bg-surface-raised text-ink-subtle">
              <tr>
                <th className="px-3 py-2" scope="col">
                  Week
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Value
                </th>
              </tr>
            </thead>
            <tbody>
              {evidence.baselineWeeks.map((week) => (
                <tr key={week.startDate} className="border-t border-line/60 text-ink-muted">
                  <th className="px-3 py-2 font-medium text-ink" scope="row">
                    {formatDateRange(week.startDate, week.endDate)}
                  </th>
                  <td className="px-3 py-2 text-right tabular-nums">{week.value}</td>
                </tr>
              ))}
              <tr className="border-t border-line bg-surface-raised font-semibold text-ink">
                <th className="px-3 py-2" scope="row">
                  Mean
                </th>
                <td className="px-3 py-2 text-right tabular-nums">{evidence.baselineMean}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function OverviewEvidence({
  verdict,
  weightUnit,
}: {
  verdict: WeeklyVerdict;
  weightUnit: WeightUnit;
}) {
  return (
    <>
      <Card className="p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">Formula</p>
        <p className="mt-1 font-medium text-ink">Completed working sets only</p>
        <p className="mt-1 text-ink-muted">
          Direction compares last completed week's hard sets with the mean of the selected prior
          training weeks. Warm-up, drop and failure sets do not count.
        </p>
      </Card>

      <section aria-labelledby="subject-week-evidence">
        <h3 id="subject-week-evidence" className="font-semibold text-ink">
          Last completed week
        </h3>
        <p className="text-xs text-ink-subtle">
          {formatDateRange(verdict.subject.startDate, verdict.subject.endDate)}
        </p>
        <MetricRow metrics={verdict.subject.metrics} weightUnit={weightUnit} />
      </section>

      <section aria-labelledby="baseline-evidence">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h3 id="baseline-evidence" className="font-semibold text-ink">
              Baseline weeks
            </h3>
            <p className="text-xs text-ink-subtle">Non-empty weeks, oldest to newest.</p>
          </div>
          <span className="text-xs font-semibold text-accent">
            {verdict.baseline.weeks.length}-week mean
          </span>
        </div>
        <div className="mt-2 overflow-x-auto rounded border border-line">
          <table className="w-full min-w-[34rem] text-left text-xs">
            <thead className="bg-surface-raised text-ink-subtle">
              <tr>
                <th className="px-3 py-2" scope="col">
                  Week
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Hard sets
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Sessions
                </th>
                <th className="px-3 py-2 text-right" scope="col">
                  Tonnage
                </th>
              </tr>
            </thead>
            <tbody>
              {verdict.baseline.weeks.map((week) => {
                const metrics = metricsForWeek(week.entries, week.sessionCount);
                return (
                  <tr key={week.startDate} className="border-t border-line/60 text-ink-muted">
                    <th className="px-3 py-2 font-medium text-ink" scope="row">
                      {formatDateRange(week.startDate, week.endDate)}
                    </th>
                    <td className="px-3 py-2 text-right tabular-nums">{metrics.hardSets}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{metrics.sessions}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatWeight(metrics.tonnageG, weightUnit)} {weightUnit}
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-line bg-surface-raised font-semibold text-ink">
                <th className="px-3 py-2" scope="row">
                  Mean
                </th>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMetric(verdict.baseline.metrics.hardSets)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatMetric(verdict.baseline.metrics.sessions)}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {formatWeight(verdict.baseline.metrics.tonnageG, weightUnit)} {weightUnit}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {verdict.pulse && (
        <section aria-labelledby="pulse-evidence">
          <h3 id="pulse-evidence" className="font-semibold text-ink">
            Same-span comparison
          </h3>
          <p className="mt-1 text-ink-muted">
            <span className="font-semibold tabular-nums text-ink">
              {formatMetric(verdict.pulse.currentHardSets)} vs{' '}
              {formatMetric(verdict.pulse.baselineHardSetsAverage)} hard sets
            </span>{' '}
            by this point in the week.
          </p>
          <p className="mt-1 text-xs text-ink-subtle">
            The current week is compared only with the identical elapsed-day slice of the{' '}
            {verdict.pulse.baselineWeeks} selected baseline weeks. It is never compared with full
            weeks.
          </p>
        </section>
      )}
    </>
  );
}

function MetricRow({ metrics, weightUnit }: { metrics: WeeklyMetrics; weightUnit: WeightUnit }) {
  return (
    <div className="mt-2 grid grid-cols-3 gap-2">
      <Metric label="Hard sets" value={`${formatMetric(metrics.hardSets)} hard sets`} />
      <Metric label="Sessions" value={`${formatMetric(metrics.sessions)} sessions`} />
      <Metric
        label="Tonnage"
        value={`${formatWeight(metrics.tonnageG, weightUnit)} ${weightUnit}`}
      />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-surface-raised p-2">
      <p className="text-[11px] uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-0.5 font-semibold tabular-nums text-ink">{value}</p>
    </div>
  );
}

function metricsForWeek(
  entries: WeeklyVerdict['baseline']['weeks'][number]['entries'],
  sessionCount: number,
): WeeklyMetrics {
  const workoutIds = new Set<string>();
  let hardSets = 0;
  let tonnageG = 0;
  for (const entry of entries) {
    workoutIds.add(entry.workout.id);
    for (const set of entry.sets) {
      if (!set.isCompleted) continue;
      if (set.setType === 'working') hardSets += 1;
      if (
        set.setType !== 'warmup' &&
        entry.exercise.trackingTypeSnapshot === 'weight_reps' &&
        (set.weightG ?? 0) > 0 &&
        (set.reps ?? 0) > 0
      ) {
        tonnageG += (set.weightG ?? 0) * (set.reps ?? 0);
      }
    }
  }
  return { hardSets, sessions: workoutIds.size || sessionCount, tonnageG };
}

export function formatDateRange(start: string, end: string): string {
  const startDate = new Date(`${start}T00:00:00Z`);
  const endDate = new Date(`${end}T00:00:00Z`);
  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth();
  const startLabel = new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(startDate);
  const endLabel = new Intl.DateTimeFormat(undefined, {
    month: sameMonth ? undefined : 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(endDate);
  return `${startLabel}–${endLabel}`;
}

function formatMetric(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}
