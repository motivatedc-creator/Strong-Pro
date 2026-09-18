import type {
  MuscleGroup,
  MuscleTargetBand,
  PersonalMuscleTargets,
  WeekStartDay,
} from '@/domain/types';
import { RESEARCH_WEEKLY_SET_BAND } from '@/domain/evidence';
import { clampCredit } from '@/domain/volume';
import type { LoggedEntry } from './compute';
import { shiftLocalDate, startOfTrainingWeekDate } from './trainingWeeks';

export type { MuscleTargetBand } from '@/domain/types';

export const RESEARCH_MUSCLE_TARGET: Readonly<MuscleTargetBand> = RESEARCH_WEEKLY_SET_BAND;
export const NON_TARGETABLE_MUSCLES = new Set<MuscleGroup>(['unmapped', 'full body', 'cardio']);

export type MuscleTargetState = 'below' | 'in_range' | 'above' | 'not_set' | 'unmapped';

export interface MuscleSetEvidence {
  setId: string;
  workoutId: string;
  localDate: string;
  exerciseId: string;
  exerciseName: string;
  role: 'primary' | 'secondary';
  credit: number;
  reps?: number;
  weightG?: number;
}

export interface MuscleSetInsight {
  muscle: MuscleGroup;
  sets: number;
  state: MuscleTargetState;
  target?: MuscleTargetBand;
  targetSource?: 'research' | 'personal';
  evidence: MuscleSetEvidence[];
}

export interface MuscleSetInsightOptions {
  referenceLocalDate: string;
  weekStart: WeekStartDay;
  secondaryCredit: number;
  personalTargetBands?: PersonalMuscleTargets;
}

/**
 * Attributes completed working sets in the current configured training week.
 * Targetable muscle groups use the research default unless the user saved a personal target.
 */
export function muscleSetInsight(
  entries: readonly LoggedEntry[],
  options: MuscleSetInsightOptions,
): MuscleSetInsight[] {
  const startDate = startOfTrainingWeekDate(options.referenceLocalDate, options.weekStart);
  const endDate = shiftLocalDate(startDate, 6);
  const secondaryCredit = clampCredit(options.secondaryCredit);
  const rows = new Map<MuscleGroup, { sets: number; evidence: MuscleSetEvidence[] }>();
  const seen = new Set<string>();

  const add = (
    muscle: MuscleGroup,
    entry: LoggedEntry,
    set: LoggedEntry['sets'][number],
    role: MuscleSetEvidence['role'],
    credit: number,
  ) => {
    if (credit <= 0) return;
    const row = rows.get(muscle) ?? { sets: 0, evidence: [] };
    row.sets += credit;
    row.evidence.push({
      setId: set.id,
      workoutId: entry.workout.id,
      localDate: entry.workout.localDate,
      exerciseId: entry.exercise.exerciseId,
      exerciseName: entry.exercise.exerciseNameSnapshot,
      role,
      credit,
      reps: set.reps,
      weightG: set.weightG,
    });
    rows.set(muscle, row);
  };

  for (const entry of entries) {
    if (entry.workout.localDate < startDate || entry.workout.localDate > endDate) continue;
    const primary = entry.exercise.primaryMuscleGroupSnapshot;
    const secondaries = new Set(
      entry.exercise.secondaryMuscleGroupsSnapshot.filter((muscle) => muscle !== primary),
    );

    for (const set of entry.sets) {
      if (seen.has(set.id)) continue;
      seen.add(set.id);
      if (!set.isCompleted || set.setType !== 'working') continue;

      add(primary, entry, set, 'primary', 1);
      for (const secondary of secondaries) {
        add(secondary, entry, set, 'secondary', secondaryCredit);
      }
    }
  }

  return [...rows.entries()]
    .map(([muscle, row]): MuscleSetInsight => {
      if (muscle === 'unmapped') return { muscle, ...row, state: 'unmapped' };
      const personalTarget = validBand(options.personalTargetBands?.[muscle]);
      const target = personalTarget ?? researchTargetFor(muscle);
      if (!target) return { muscle, ...row, state: 'not_set' };
      const state = row.sets < target.min ? 'below' : row.sets > target.max ? 'above' : 'in_range';
      return {
        muscle,
        ...row,
        target,
        targetSource: personalTarget ? 'personal' : 'research',
        state,
      };
    })
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

export function researchTargetFor(muscle: MuscleGroup): MuscleTargetBand | undefined {
  return NON_TARGETABLE_MUSCLES.has(muscle) ? undefined : { ...RESEARCH_MUSCLE_TARGET };
}

function validBand(band: MuscleTargetBand | undefined): MuscleTargetBand | undefined {
  if (!band || !Number.isFinite(band.min) || !Number.isFinite(band.max)) return undefined;
  if (band.min < 0 || band.max > 100 || band.max < band.min) return undefined;
  return band;
}
