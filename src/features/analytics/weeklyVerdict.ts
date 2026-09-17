import { resolveRange } from '@/domain/time';
import type { VolumeTotals } from '@/domain/volume';
import { filterByRange, summarise, type AnalyticsOptions, type LoggedEntry, type PeriodSummary } from './compute';

const BASELINE_WEEKS = 4;
const BASELINE_DAYS = BASELINE_WEEKS * 7;

export interface WeeklyVerdict {
  /** Monday-through-now totals for the current week. */
  current: PeriodSummary;
  /** Per-week average across the four complete weeks immediately before this week. */
  fourWeekAverage: PeriodSummary;
  /** True only when the history reaches the start of the full four-week baseline. */
  hasFullBaseline: boolean;
  weekStartedAt: string;
  baselineStartedAt: string;
}

/**
 * Builds the data behind Ink's three-sentence weekly verdict.
 *
 * The comparison deliberately uses the four *complete* calendar weeks before the current
 * week. The in-progress week is never allowed to contaminate its own baseline.
 *
 * `hasFullBaseline` prevents a new user from receiving inflated/deflated advice simply
 * because only part of the four-week comparison window exists in their history.
 */
export function weeklyVerdict(
  entries: readonly LoggedEntry[],
  options: AnalyticsOptions,
  reference: Date = new Date(),
): WeeklyVerdict {
  const currentRange = resolveRange('this_week', reference);
  const weekStart = currentRange.from!;

  const baselineStart = new Date(weekStart);
  baselineStart.setDate(baselineStart.getDate() - BASELINE_DAYS);
  baselineStart.setHours(0, 0, 0, 0);

  const baselineEnd = new Date(weekStart.getTime() - 1);

  const current = summarise(filterByRange(entries, currentRange), options);
  const baselineTotal = summarise(
    filterByRange(entries, { from: baselineStart, to: baselineEnd }),
    options,
  );

  const earliest = earliestValidWorkout(entries, reference);

  return {
    current,
    fourWeekAverage: averageSummary(baselineTotal, BASELINE_WEEKS),
    hasFullBaseline: earliest !== null && earliest <= baselineStart,
    weekStartedAt: weekStart.toISOString(),
    baselineStartedAt: baselineStart.toISOString(),
  };
}

function earliestValidWorkout(entries: readonly LoggedEntry[], reference: Date): Date | null {
  let earliest: Date | null = null;
  for (const entry of entries) {
    const date = new Date(entry.workout.startedAt);
    if (Number.isNaN(date.getTime()) || date > reference) continue;
    if (!earliest || date < earliest) earliest = date;
  }
  return earliest;
}

function averageSummary(summary: PeriodSummary, divisor: number): PeriodSummary {
  const volume: VolumeTotals = {
    volumeG: summary.volumeG / divisor,
    completedSets: summary.completedSets / divisor,
    totalReps: summary.totalReps / divisor,
    repsOnlySets: summary.repsOnlySets / divisor,
    assistedSets: summary.assistedSets / divisor,
    durationSeconds: summary.durationSeconds / divisor,
    distanceM: summary.distanceM / divisor,
  };

  return {
    ...volume,
    workouts: summary.workouts / divisor,
  };
}
