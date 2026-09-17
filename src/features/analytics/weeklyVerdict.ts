import { resolveRange } from '@/domain/time';
import type { VolumeTotals } from '@/domain/volume';
import {
  filterByRange,
  summarise,
  type AnalyticsOptions,
  type LoggedEntry,
  type PeriodSummary,
} from './compute';

const BASELINE_WEEKS = 4;
const BASELINE_DAYS = BASELINE_WEEKS * 7;

export interface WeeklyVerdict {
  current: PeriodSummary;
  fourWeekAverage: PeriodSummary;
  hasFullBaseline: boolean;
  weekStartedAt: string;
  baselineStartedAt: string;
}

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
