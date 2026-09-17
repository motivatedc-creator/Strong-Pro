import { bestOneRepMax } from '@/domain/oneRepMax';
import { localDateOf } from '@/domain/time';
import type { WeekStartDay } from '@/domain/types';
import { fromGrams, type WeightUnit } from '@/domain/units';
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

const MIN_BASELINE_WEEKS = 3;
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

export interface WeeklyVerdictCopy {
  available: boolean;
  title: string;
  baselineLabel: string;
  lines: string[];
  pulseLine?: string;
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

export function weeklyVerdictCopy(
  verdict: WeeklyVerdict,
  weightUnit: WeightUnit,
): WeeklyVerdictCopy {
  const baselineCount = verdict.baseline.weeks.length;
  const baselineLabel =
    baselineCount === 4 ? '4-week baseline' : `Based on ${baselineCount} week${baselineCount === 1 ? '' : 's'}`;

  if (verdict.state === 'not_enough_history') {
    const remaining = Math.max(0, MIN_BASELINE_WEEKS - baselineCount);
    return {
      available: false,
      title: 'Building your baseline',
      baselineLabel,
      lines: [
        `Weekly Verdict needs ${remaining} more training week${remaining === 1 ? '' : 's'} before it can compare your training honestly.`,
      ],
      pulseLine: pulseCopy(verdict.pulse),
    };
  }

  if (verdict.state === 'welcome_back') {
    return {
      available: true,
      title: 'Last week',
      baselineLabel,
      lines: [
        `Welcome back — you logged ${verdict.subject.metrics.sessions} ${plural(verdict.subject.metrics.sessions, 'session')} last week after at least two weeks away.`,
        'No comparison this week; your older training stays intact as context.',
        'Build another week and the normal verdict resumes.',
      ],
      pulseLine: pulseCopy(verdict.pulse),
    };
  }

  if (verdict.state === 'deload') {
    return {
      available: true,
      title: 'Last week',
      baselineLabel,
      lines: [
        'Lighter week, consistent sessions — looks like a deload. Good.',
        'No single lift or metric needs calling out from this week.',
        'Nothing to fix — return to normal training when planned.',
      ],
      pulseLine: pulseCopy(verdict.pulse),
    };
  }

  return {
    available: true,
    title: 'Last week',
    baselineLabel,
    lines: [
      directionCopy(verdict.direction!, verdict.subject.metrics.hardSets, baselineCount),
      standoutCopy(verdict.standout!, weightUnit),
      watchoutCopy(verdict.watchout!),
    ],
    pulseLine: pulseCopy(verdict.pulse),
  };
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

function metricsFor(entries: readonly LoggedEntry[]): WeeklyMetrics {
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

  return { hardSets, sessions: workoutIds.size, tonnageG };
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

function directionCopy(direction: WeeklyDirection, hardSets: number, baselineWeeks: number): string {
  if (direction.changePercent === null) {
    return `${hardSets} hard ${plural(hardSets, 'set')} last week; your recent baseline has no working sets to compare yet.`;
  }

  const change = Math.abs(Math.round(direction.changePercent));
  const averageLabel = `${baselineWeeks}-week average`;
  switch (direction.band) {
    case 'big_jump':
      return `You did ${hardSets} hard sets, ${change}% above your ${averageLabel} — a big jump.`;
    case 'up':
      return `Training went up: ${hardSets} hard sets, ${change}% above your ${averageLabel}.`;
    case 'steady':
      return `A steady week: ${hardSets} hard sets, in line with your ${averageLabel}.`;
    case 'down':
      return `A lighter week: ${hardSets} hard sets, ${change}% below your ${averageLabel}.`;
    case 'well_down':
      return `Training dropped: ${hardSets} hard sets, ${change}% below your ${averageLabel}.`;
  }
}

function standoutCopy(rule: WeeklyVerdictRule, unit: WeightUnit): string {
  if (rule.id === 'standout_new_e1rm_best' && rule.text) {
    const [name, grams] = rule.text.split('|');
    return `${name} hit a new best estimate of ${formatWeight(Number(grams), unit)} ${unit}.`;
  }
  if (rule.id === 'standout_e1rm_up' && rule.text) {
    const [name, change] = rule.text.split('|');
    return `${name} is up ${change}% on your recent best.`;
  }
  if (rule.id === 'standout_metric_mover' && rule.text) {
    const [name, changeRaw] = rule.text.split('|');
    const change = Number(changeRaw);
    const signed = change > 0 ? `+${change}` : String(change);
    return `${name} was your biggest mover at ${signed}%.`;
  }
  return 'No single lift or metric stood out.';
}

function watchoutCopy(rule: WeeklyVerdictRule): string {
  if (rule.id === 'watchout_big_jump') {
    return "That's a sharp rise — keep an eye on recovery next week.";
  }
  if (rule.id === 'watchout_e1rm_slip' && rule.text) {
    return `${rule.text} has slipped 2 weeks running; check sleep, load or technique.`;
  }
  if (rule.id === 'watchout_sessions_down' && rule.text) {
    const [sessions, baseline] = rule.text.split('|');
    return `You trained ${sessions} times vs your usual ${baseline}; consistency is the easy win.`;
  }
  return 'Nothing to fix — repeat it.';
}

function pulseCopy(pulse: WeeklyPulse | null): string | undefined {
  if (!pulse) return undefined;
  if (pulse.changePercent === null || Math.abs(pulse.changePercent) < 10) {
    return `This week so far: ${pulse.currentHardSets} hard ${plural(pulse.currentHardSets, 'set')}, in line with your usual pace by this point.`;
  }
  const change = Math.abs(Math.round(pulse.changePercent));
  return `This week so far: ${pulse.currentHardSets} hard ${plural(pulse.currentHardSets, 'set')}, ${change}% ${pulse.changePercent > 0 ? 'above' : 'below'} your usual pace by this point.`;
}

function percent(current: number, baseline: number): number | null {
  if (baseline <= 0) return null;
  return ((current - baseline) / baseline) * 100;
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatWeight(grams: number, unit: WeightUnit): string {
  const value = fromGrams(grams, unit);
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
}

function plural(value: number, singular: string): string {
  return value === 1 ? singular : `${singular}s`;
}
