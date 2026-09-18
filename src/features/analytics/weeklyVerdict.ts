import { bestOneRepMax } from '@/domain/oneRepMax';
import { localDateOf } from '@/domain/time';
import type { WeekStartDay } from '@/domain/types';
import type { AnalyticsOptions, LoggedEntry } from './compute';
import {
  elapsedDayIndex,
  entriesInWeek,
  getCompletedWeekWindows,
  selectTrainingBaseline,
  shiftLocalDate,
  startOfTrainingWeekDate,
  weekWindow,
  windowThroughElapsedDay,
  type TrainingBaselineWeek,
  type TrainingWeekWindow,
} from './trainingWeeks';
import { metricsFor } from './weeklyVerdict.metrics';

export const MIN_BASELINE_WEEKS = 3;
const MAX_GOAL_LIFTS = 3;

export type WeeklyVerdictState = 'not_enough_history' | 'welcome_back' | 'deload' | 'full';
export type DirectionBand = 'big_jump' | 'up' | 'steady' | 'down' | 'well_down';

export interface WeeklyMetrics {
  hardSets: number;
  sessions: number;
  tonnageG: number;
}

export interface WeeklyVerdictRule {
  id: string;
  text?: string;
}

export interface WeeklyDirection extends WeeklyVerdictRule {
  band: DirectionBand;
  changePercent: number | null;
}

export interface WeeklyPulse {
  currentHardSets: number;
  baselineHardSetsAverage: number;
  baselineWeeks: number;
  changePercent: number | null;
}

export interface WeeklyVerdict {
  state: WeeklyVerdictState;
  subject: {
    startDate: string;
    endDate: string;
    metrics: WeeklyMetrics;
  };
  baseline: {
    weeks: TrainingBaselineWeek[];
    metrics: WeeklyMetrics;
  };
  direction: WeeklyDirection | null;
  standout: WeeklyVerdictRule | null;
  watchout: WeeklyVerdictRule | null;
  pulse: WeeklyPulse | null;
}

export type VerdictEvidenceKey =
  | 'hard_sets'
  | 'sessions'
  | 'tonnage'
  | 'direction_change'
  | 'pulse_hard_sets'
  | 'e1rm'
  | 'baseline_weeks'
  | 'muscle_balance';

export interface SentencePart {
  type: 'text' | 'metric';
  text: string;
  evidenceKey?: VerdictEvidenceKey;
}

export interface VerdictSentence {
  plain: string;
  parts: SentencePart[];
}

export interface WeeklyVerdictCopy {
  available: boolean;
  title: string;
  baselineLabel: string;
  lines: VerdictSentence[];
  /** Dedicated muscle-band balance slot for the subject (last completed) week. */
  balance?: VerdictSentence;
  /** Stable id for the balance sentence (tests / a11y). */
  balanceId?: string;
  pulse?: VerdictSentence;
}

export interface BaselineWeekEvidence {
  startDate: string;
  endDate: string;
  value: string;
}

export interface MetricEvidence {
  key: VerdictEvidenceKey;
  label: string;
  formula: string;
  subjectLabel: string;
  subjectValue: string;
  baselineMean: string;
  baselineWeeks: BaselineWeekEvidence[];
}

export function weeklyVerdict(
  entries: readonly LoggedEntry[],
  options: AnalyticsOptions,
  weekStart: WeekStartDay = 'monday',
  reference: Date = new Date(),
): WeeklyVerdict {
  const referenceLocalDate = localDateOf(reference);
  const currentWeekStart = startOfTrainingWeekDate(referenceLocalDate, weekStart);
  const subjectWindow = weekWindow(shiftLocalDate(currentWeekStart, -7));
  const subjectEntries = entriesInWeek(entries, subjectWindow);
  const subjectMetrics = metricsFor(subjectEntries);
  const baselineWeeks = selectTrainingBaseline(entries, subjectWindow.startDate, weekStart);
  const baselineMetrics = averageMetrics(baselineWeeks.map((week) => metricsFor(week.entries)));
  const pulse = buildPulse(entries, currentWeekStart, referenceLocalDate, weekStart);

  if (baselineWeeks.length < MIN_BASELINE_WEEKS) {
    return result(
      'not_enough_history',
      subjectWindow,
      subjectMetrics,
      baselineWeeks,
      baselineMetrics,
      null,
      null,
      null,
      pulse,
    );
  }

  const priorTwo = getCompletedWeekWindows(subjectWindow.startDate, weekStart, 2);
  const returningFromBreak =
    subjectMetrics.sessions > 0 &&
    priorTwo.length === 2 &&
    priorTwo.every((window) => metricsFor(entriesInWeek(entries, window)).sessions === 0);

  if (returningFromBreak) {
    return result(
      'welcome_back',
      subjectWindow,
      subjectMetrics,
      baselineWeeks,
      baselineMetrics,
      null,
      null,
      null,
      pulse,
    );
  }

  const deloadShaped =
    baselineMetrics.hardSets > 0 &&
    subjectMetrics.hardSets < baselineMetrics.hardSets * 0.6 &&
    subjectMetrics.sessions >= Math.round(baselineMetrics.sessions);

  if (deloadShaped) {
    return result(
      'deload',
      subjectWindow,
      subjectMetrics,
      baselineWeeks,
      baselineMetrics,
      null,
      null,
      null,
      pulse,
    );
  }

  const direction = buildDirection(subjectMetrics, baselineMetrics);
  const goalLifts = topGoalLifts(baselineWeeks);
  const standout = buildStandout(
    entries,
    subjectEntries,
    subjectWindow,
    baselineWeeks,
    subjectMetrics,
    baselineMetrics,
    goalLifts,
    options,
  );
  const watchout = buildWatchout(
    entries,
    subjectEntries,
    subjectWindow,
    baselineWeeks,
    subjectMetrics,
    baselineMetrics,
    goalLifts,
    direction,
    options,
  );

  return result(
    'full',
    subjectWindow,
    subjectMetrics,
    baselineWeeks,
    baselineMetrics,
    direction,
    standout,
    watchout,
    pulse,
  );
}

function result(
  state: WeeklyVerdictState,
  subjectWindow: TrainingWeekWindow,
  subjectMetrics: WeeklyMetrics,
  baselineWeeks: TrainingBaselineWeek[],
  baselineMetrics: WeeklyMetrics,
  direction: WeeklyDirection | null,
  standout: WeeklyVerdictRule | null,
  watchout: WeeklyVerdictRule | null,
  pulse: WeeklyPulse | null,
): WeeklyVerdict {
  return {
    state,
    subject: { ...subjectWindow, metrics: subjectMetrics },
    baseline: { weeks: baselineWeeks, metrics: baselineMetrics },
    direction,
    standout,
    watchout,
    pulse,
  };
}

function averageMetrics(values: readonly WeeklyMetrics[]): WeeklyMetrics {
  if (values.length === 0) return { hardSets: 0, sessions: 0, tonnageG: 0 };
  return {
    hardSets: average(values.map((value) => value.hardSets)),
    sessions: average(values.map((value) => value.sessions)),
    tonnageG: average(values.map((value) => value.tonnageG)),
  };
}

function buildDirection(current: WeeklyMetrics, baseline: WeeklyMetrics): WeeklyDirection {
  if (baseline.hardSets <= 0) {
    return { id: 'direction_no_hard_set_baseline', band: 'steady', changePercent: null };
  }
  const changePercent = percent(current.hardSets, baseline.hardSets)!;
  const band: DirectionBand =
    changePercent > 50
      ? 'big_jump'
      : changePercent >= 10
        ? 'up'
        : changePercent <= -30
          ? 'well_down'
          : changePercent <= -10
            ? 'down'
            : 'steady';
  return { id: `direction_${band}`, band, changePercent };
}

function buildPulse(
  entries: readonly LoggedEntry[],
  currentWeekStart: string,
  referenceLocalDate: string,
  weekStart: WeekStartDay,
): WeeklyPulse | null {
  const dayIndex = elapsedDayIndex(referenceLocalDate, currentWeekStart);
  if (dayIndex < 1) return null;

  const baselineWeeks = selectTrainingBaseline(entries, currentWeekStart, weekStart);
  if (baselineWeeks.length < MIN_BASELINE_WEEKS) return null;

  const currentWindow = windowThroughElapsedDay(weekWindow(currentWeekStart), dayIndex);
  const currentHardSets = metricsFor(entriesInWeek(entries, currentWindow)).hardSets;
  const baselineHardSets = baselineWeeks.map((week) =>
    metricsFor(entriesInWeek(entries, windowThroughElapsedDay(week, dayIndex))).hardSets,
  );
  const baselineHardSetsAverage = average(baselineHardSets);

  return {
    currentHardSets,
    baselineHardSetsAverage,
    baselineWeeks: baselineWeeks.length,
    changePercent: percent(currentHardSets, baselineHardSetsAverage),
  };
}

interface GoalLift {
  id: string;
  name: string;
  sessions: number;
}

function topGoalLifts(weeks: readonly TrainingBaselineWeek[]): GoalLift[] {
  const byLift = new Map<string, GoalLift & { workoutIds: Set<string> }>();
  for (const entry of weeks.flatMap((week) => week.entries)) {
    const current = byLift.get(entry.exercise.exerciseId) ?? {
      id: entry.exercise.exerciseId,
      name: entry.exercise.exerciseNameSnapshot,
      sessions: 0,
      workoutIds: new Set<string>(),
    };
    current.workoutIds.add(entry.workout.id);
    byLift.set(current.id, current);
  }
  return [...byLift.values()]
    .map(({ workoutIds, ...lift }) => ({ ...lift, sessions: workoutIds.size }))
    .sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name))
    .slice(0, MAX_GOAL_LIFTS);
}

function bestEstimateForLift(
  entries: readonly LoggedEntry[],
  liftId: string,
  options: AnalyticsOptions,
): number | null {
  const sets = entries
    .filter((entry) => entry.exercise.exerciseId === liftId)
    .flatMap((entry) => entry.sets);
  return bestOneRepMax(sets, options.formula, { includeWarmups: false })?.value ?? null;
}

function buildStandout(
  allEntries: readonly LoggedEntry[],
  subjectEntries: readonly LoggedEntry[],
  subjectWindow: TrainingWeekWindow,
  baselineWeeks: readonly TrainingBaselineWeek[],
  subject: WeeklyMetrics,
  baseline: WeeklyMetrics,
  goalLifts: readonly GoalLift[],
  options: AnalyticsOptions,
): WeeklyVerdictRule {
  const baselineEntries = baselineWeeks.flatMap((week) => week.entries);
  const historicalEntries = allEntries.filter((entry) => entry.workout.localDate < subjectWindow.startDate);

  for (const lift of goalLifts) {
    const current = bestEstimateForLift(subjectEntries, lift.id, options);
    const previousBest = bestEstimateForLift(historicalEntries, lift.id, options);
    if (current !== null && previousBest !== null && current > previousBest) {
      return { id: 'standout_new_e1rm_best', text: `${lift.name}|${current}` };
    }
  }

  for (const lift of goalLifts) {
    const current = bestEstimateForLift(subjectEntries, lift.id, options);
    const baselineBest = bestEstimateForLift(baselineEntries, lift.id, options);
    const change = current !== null && baselineBest !== null ? percent(current, baselineBest) : null;
    if (change !== null && change >= 2.5) {
      return { id: 'standout_e1rm_up', text: `${lift.name}|${Math.round(change)}` };
    }
  }

  const movers = [
    { name: 'Hard sets', change: percent(subject.hardSets, baseline.hardSets) },
    { name: 'Sessions', change: percent(subject.sessions, baseline.sessions) },
    { name: 'Tonnage', change: percent(subject.tonnageG, baseline.tonnageG) },
  ]
    .filter((value): value is { name: string; change: number } => value.change !== null)
    .sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  if (movers[0] && Math.abs(movers[0].change) >= 15) {
    return {
      id: 'standout_metric_mover',
      text: `${movers[0].name}|${Math.round(movers[0].change)}`,
    };
  }

  return { id: 'standout_none' };
}

function buildWatchout(
  allEntries: readonly LoggedEntry[],
  subjectEntries: readonly LoggedEntry[],
  subjectWindow: TrainingWeekWindow,
  baselineWeeks: readonly TrainingBaselineWeek[],
  subject: WeeklyMetrics,
  baseline: WeeklyMetrics,
  goalLifts: readonly GoalLift[],
  direction: WeeklyDirection,
  options: AnalyticsOptions,
): WeeklyVerdictRule {
  if (direction.band === 'big_jump') return { id: 'watchout_big_jump' };

  const baselineEntries = baselineWeeks.flatMap((week) => week.entries);
  const previousWindow = weekWindow(shiftLocalDate(subjectWindow.startDate, -7));
  const previousEntries = entriesInWeek(allEntries, previousWindow);

  for (const lift of goalLifts) {
    const baselineBest = bestEstimateForLift(baselineEntries, lift.id, options);
    const current = bestEstimateForLift(subjectEntries, lift.id, options);
    const previous = bestEstimateForLift(previousEntries, lift.id, options);
    if (
      baselineBest !== null &&
      current !== null &&
      previous !== null &&
      current <= baselineBest * 0.95 &&
      previous <= baselineBest * 0.95
    ) {
      return { id: 'watchout_e1rm_slip', text: lift.name };
    }
  }

  const roundedBaselineSessions = Math.round(baseline.sessions);
  if (subject.sessions <= roundedBaselineSessions - 1) {
    return {
      id: 'watchout_sessions_down',
      text: `${subject.sessions}|${roundedBaselineSessions}`,
    };
  }

  return { id: 'watchout_none' };
}

function percent(current: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export { metricEvidenceFor, weeklyVerdictCopy } from './weeklyVerdict.presentation';
