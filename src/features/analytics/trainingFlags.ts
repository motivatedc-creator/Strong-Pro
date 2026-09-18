import { localDateOf } from '@/domain/time';
import type { WeekStartDay } from '@/domain/types';
import type { AnalyticsOptions, LoggedEntry } from './compute';
import {
  selectTrainingBaseline,
  shiftLocalDate,
  startOfTrainingWeekDate,
  weekWindow,
} from './trainingWeeks';
import {
  bestEstimateForLift,
  topGoalLifts,
  weeklyVerdict,
  type DirectionBand,
} from './weeklyVerdict';

export const STALL_WINDOW_DAYS = 28;
export const STALL_MIN_SESSIONS = 3;
export const DELOAD_CLAIM_ID = 'weekly-verdict-deload-shape' as const;

export type FlagActivity = 'active' | 'inactive' | 'partial';

export interface DeloadFlag {
  id: 'deload';
  status: 'active' | 'inactive';
  label: 'Deload';
  subjectStartDate: string;
  subjectEndDate: string;
  subjectHardSets: number;
  baselineHardSetsMean: number;
  subjectSessions: number;
  baselineSessionsMean: number;
  sessionFloor: number;
  claimId: typeof DELOAD_CLAIM_ID;
  receipt: string;
}

export interface SpikeFlag {
  id: 'spike';
  status: 'active' | 'inactive';
  label: 'Spike';
  subjectStartDate: string;
  subjectEndDate: string;
  directionBand: DirectionBand | null;
  changePercent: number | null;
  watchoutId: string | null;
  receipt: string;
}

export interface StallFlag {
  id: 'stall';
  status: FlagActivity;
  label: string;
  liftId: string;
  liftName: string;
  windowStartDate: string;
  windowEndDate: string;
  sessionsInWindow: number;
  bestE1rmInWindowG: number | null;
  comparisonBestE1rmG: number | null;
  comparisonSource: 'prior_equal_window' | 'prior_best' | null;
  receipt: string;
}

export interface TrainingFlags {
  deload: DeloadFlag;
  spike: SpikeFlag;
  stalls: StallFlag[];
  /** Active flags only (stall Partial is not active). */
  active: Array<DeloadFlag | SpikeFlag | StallFlag>;
}

function formatSets(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercent(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded}%`;
}

/** Entries whose workout localDate falls in [startDate, endDate] inclusive. */
function entriesInLocalRange(
  entries: readonly LoggedEntry[],
  startDate: string,
  endDate: string,
): LoggedEntry[] {
  return entries.filter(
    (entry) => entry.workout.localDate >= startDate && entry.workout.localDate <= endDate,
  );
}

function sessionsForLift(entries: readonly LoggedEntry[], liftId: string): LoggedEntry[] {
  const byWorkout = new Map<string, LoggedEntry>();
  for (const entry of entries) {
    if (entry.exercise.exerciseId !== liftId) continue;
    if (!byWorkout.has(entry.workout.id)) byWorkout.set(entry.workout.id, entry);
  }
  return [...byWorkout.values()].sort((a, b) =>
    a.workout.localDate.localeCompare(b.workout.localDate),
  );
}

export function deloadFlag(
  entries: readonly LoggedEntry[],
  options: AnalyticsOptions,
  weekStart: WeekStartDay = 'monday',
  reference: Date = new Date(),
): DeloadFlag {
  const verdict = weeklyVerdict(entries, options, weekStart, reference);
  const subjectHardSets = verdict.subject.metrics.hardSets;
  const baselineHardSetsMean = verdict.baseline.metrics.hardSets;
  const subjectSessions = verdict.subject.metrics.sessions;
  const baselineSessionsMean = verdict.baseline.metrics.sessions;
  const sessionFloor = Math.round(baselineSessionsMean);
  const active = verdict.state === 'deload';
  const receipt = active
    ? `Subject week ${verdict.subject.startDate} → ${verdict.subject.endDate}: ${subjectHardSets} hard sets (< 60% of baseline mean ${formatSets(baselineHardSetsMean)}) with ${subjectSessions} sessions (≥ floor ${sessionFloor}). Receipt: deload-shaped week.`
    : `Subject week ${verdict.subject.startDate} → ${verdict.subject.endDate}: not deload-shaped (${subjectHardSets} hard sets vs baseline mean ${formatSets(baselineHardSetsMean)}; ${subjectSessions} sessions vs floor ${sessionFloor}).`;

  return {
    id: 'deload',
    status: active ? 'active' : 'inactive',
    label: 'Deload',
    subjectStartDate: verdict.subject.startDate,
    subjectEndDate: verdict.subject.endDate,
    subjectHardSets,
    baselineHardSetsMean,
    subjectSessions,
    baselineSessionsMean,
    sessionFloor,
    claimId: DELOAD_CLAIM_ID,
    receipt,
  };
}

export function spikeFlag(
  entries: readonly LoggedEntry[],
  options: AnalyticsOptions,
  weekStart: WeekStartDay = 'monday',
  reference: Date = new Date(),
): SpikeFlag {
  const verdict = weeklyVerdict(entries, options, weekStart, reference);
  const band = verdict.direction?.band ?? null;
  const changePercent = verdict.direction?.changePercent ?? null;
  const watchoutId = verdict.watchout?.id ?? null;
  const active = band === 'big_jump' || watchoutId === 'watchout_big_jump';
  const receipt = active
    ? `Subject week ${verdict.subject.startDate} → ${verdict.subject.endDate}: hard sets ${changePercent != null ? formatPercent(changePercent) : 'up'} vs baseline — big jump.`
    : `Subject week ${verdict.subject.startDate} → ${verdict.subject.endDate}: no big-jump spike${
        band ? ` (direction ${band.replaceAll('_', ' ')})` : ' (no direction band on this verdict state)'
      }.`;

  return {
    id: 'spike',
    status: active ? 'active' : 'inactive',
    label: 'Spike',
    subjectStartDate: verdict.subject.startDate,
    subjectEndDate: verdict.subject.endDate,
    directionBand: band,
    changePercent,
    watchoutId,
    receipt,
  };
}

export function stallFlags(
  entries: readonly LoggedEntry[],
  options: AnalyticsOptions,
  weekStart: WeekStartDay = 'monday',
  reference: Date = new Date(),
): StallFlag[] {
  const referenceLocalDate = localDateOf(reference);
  const windowEndDate = referenceLocalDate;
  const windowStartDate = shiftLocalDate(referenceLocalDate, -(STALL_WINDOW_DAYS - 1));
  const currentWeekStart = startOfTrainingWeekDate(referenceLocalDate, weekStart);
  const subjectWindow = weekWindow(shiftLocalDate(currentWeekStart, -7));
  const baselineWeeks = selectTrainingBaseline(entries, subjectWindow.startDate, weekStart);
  const goalLifts = topGoalLifts(baselineWeeks);

  return goalLifts.map((lift) => {
    const windowEntries = entriesInLocalRange(entries, windowStartDate, windowEndDate).filter(
      (entry) => entry.exercise.exerciseId === lift.id,
    );
    const windowSessions = sessionsForLift(windowEntries, lift.id);
    const sessionsInWindow = windowSessions.length;
    const label = `Stall — ${lift.name}`;

    if (sessionsInWindow < STALL_MIN_SESSIONS) {
      return {
        id: 'stall' as const,
        status: 'partial' as const,
        label,
        liftId: lift.id,
        liftName: lift.name,
        windowStartDate,
        windowEndDate,
        sessionsInWindow,
        bestE1rmInWindowG: bestEstimateForLift(windowEntries, lift.id, options),
        comparisonBestE1rmG: null,
        comparisonSource: null,
        receipt: `${lift.name}: ${sessionsInWindow} completed session${
          sessionsInWindow === 1 ? '' : 's'
        } in the trailing ${STALL_WINDOW_DAYS} local days (need ${STALL_MIN_SESSIONS}). Partial — no stall claim.`,
      };
    }

    const bestE1rmInWindowG = bestEstimateForLift(windowEntries, lift.id, options);
    const priorEntries = entries.filter(
      (entry) =>
        entry.exercise.exerciseId === lift.id && entry.workout.localDate < windowStartDate,
    );
    const priorSessions = sessionsForLift(priorEntries, lift.id);
    const equalPriorSessions = priorSessions.slice(-sessionsInWindow);
    let comparisonBestE1rmG: number | null = null;
    let comparisonSource: StallFlag['comparisonSource'] = null;

    if (equalPriorSessions.length === sessionsInWindow) {
      comparisonBestE1rmG = bestEstimateForLift(equalPriorSessions, lift.id, options);
      comparisonSource = 'prior_equal_window';
    }

    if (comparisonBestE1rmG === null) {
      comparisonBestE1rmG = bestEstimateForLift(priorEntries, lift.id, options);
      comparisonSource = comparisonBestE1rmG !== null ? 'prior_best' : null;
    }

    if (bestE1rmInWindowG === null || comparisonBestE1rmG === null) {
      return {
        id: 'stall' as const,
        status: 'partial' as const,
        label,
        liftId: lift.id,
        liftName: lift.name,
        windowStartDate,
        windowEndDate,
        sessionsInWindow,
        bestE1rmInWindowG,
        comparisonBestE1rmG,
        comparisonSource,
        receipt: `${lift.name}: ${sessionsInWindow} sessions in the trailing ${STALL_WINDOW_DAYS} days, but e1RM comparison is incomplete. Partial — no stall claim.`,
      };
    }

    const stalled = bestE1rmInWindowG <= comparisonBestE1rmG;
    const receipt = stalled
      ? `${lift.name}: best e1RM in trailing ${STALL_WINDOW_DAYS} days is flat or down vs ${
          comparisonSource === 'prior_equal_window' ? 'prior equal-count window' : 'prior best'
        } (${sessionsInWindow} sessions). Stall.`
      : `${lift.name}: best e1RM in trailing ${STALL_WINDOW_DAYS} days improved vs ${
          comparisonSource === 'prior_equal_window' ? 'prior equal-count window' : 'prior best'
        }. No stall.`;

    return {
      id: 'stall' as const,
      status: stalled ? ('active' as const) : ('inactive' as const),
      label,
      liftId: lift.id,
      liftName: lift.name,
      windowStartDate,
      windowEndDate,
      sessionsInWindow,
      bestE1rmInWindowG,
      comparisonBestE1rmG,
      comparisonSource,
      receipt,
    };
  });
}

/** Recompute stall / spike / deload flags from logged entries (no Dexie table). */
export function trainingFlags(
  entries: readonly LoggedEntry[],
  options: AnalyticsOptions,
  weekStart: WeekStartDay = 'monday',
  reference: Date = new Date(),
): TrainingFlags {
  const deload = deloadFlag(entries, options, weekStart, reference);
  const spike = spikeFlag(entries, options, weekStart, reference);
  const stalls = stallFlags(entries, options, weekStart, reference);
  const active = [
    ...(deload.status === 'active' ? [deload] : []),
    ...(spike.status === 'active' ? [spike] : []),
    ...stalls.filter((flag) => flag.status === 'active'),
  ];
  return { deload, spike, stalls, active };
}

export const CHANGE_FLAGS_EMPTY =
  'No stall, spike, or deload flags on the current subject week / lift windows.';
