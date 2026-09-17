import { resolveRange } from '@/domain/time';
import { fromGrams, type WeightUnit } from '@/domain/units';
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

export interface WeeklyVerdictCopy {
  available: boolean;
  lines: string[];
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

/**
 * Turns the weekly comparison into the Bible's intentionally short verdict: three factual
 * sentences, no opaque coaching score and no verdict at all until the baseline is complete.
 */
export function weeklyVerdictCopy(
  verdict: WeeklyVerdict,
  weightUnit: WeightUnit,
): WeeklyVerdictCopy {
  if (!verdict.hasFullBaseline) {
    return {
      available: false,
      lines: [
        'Weekly verdict unlocks after four complete prior weeks, so partial history is never presented as a trustworthy baseline.',
      ],
    };
  }

  const { current, fourWeekAverage } = verdict;
  const currentWorkoutLabel = plural(current.workouts, 'workout');
  const currentSetLabel = plural(current.completedSets, 'completed set');
  const baselineWorkoutLabel = pluralAverage(fourWeekAverage.workouts, 'workout');
  const baselineSetLabel = pluralAverage(fourWeekAverage.completedSets, 'completed set');

  return {
    available: true,
    lines: [
      `This week so far: ${current.workouts} ${currentWorkoutLabel} and ${current.completedSets} ${currentSetLabel}.`,
      volumeComparison(current.volumeG, fourWeekAverage.volumeG, weightUnit),
      `Your 4-week baseline averages ${formatAverage(fourWeekAverage.workouts)} ${baselineWorkoutLabel} and ${formatAverage(fourWeekAverage.completedSets)} ${baselineSetLabel} per full week; this is a live comparison, not a forecast.`,
    ],
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

function volumeComparison(currentVolumeG: number, baselineVolumeG: number, unit: WeightUnit): string {
  if (baselineVolumeG <= 0) {
    return 'Your 4-week baseline has no comparable weighted volume, so a percentage comparison would be misleading.';
  }

  const percent = Math.round(((currentVolumeG - baselineVolumeG) / baselineVolumeG) * 100);
  const currentDisplay = compactVolume(currentVolumeG, unit);
  const baselineDisplay = compactVolume(baselineVolumeG, unit);

  if (percent === 0) {
    return `Weighted volume so far is in line with your 4-week full-week average (${currentDisplay} vs ${baselineDisplay} ${unit} × reps).`;
  }

  return `Weighted volume so far is ${Math.abs(percent)}% ${percent > 0 ? 'above' : 'below'} your 4-week full-week average (${currentDisplay} vs ${baselineDisplay} ${unit} × reps).`;
}

function compactVolume(gramsReps: number, unit: WeightUnit): string {
  const value = fromGrams(gramsReps, unit);
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatAverage(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, '');
}

function plural(value: number, singular: string): string {
  return value === 1 ? singular : `${singular}s`;
}

function pluralAverage(value: number, singular: string): string {
  return Math.abs(value - 1) < 0.0001 ? singular : `${singular}s`;
}
