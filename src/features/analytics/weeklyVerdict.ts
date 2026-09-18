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

function buildDirection(current: WeeklyMetrics, baseline: WeeklyMetrics): WeeklyMetrics extends never ? never : WeeklyDirection {
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
