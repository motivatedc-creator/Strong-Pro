import type { TemplateExercise, Workout, WorkoutExercise } from '@/domain/types';

/**
 * A set/rep prescription resolved from the Routine a workout was started from.
 *
 * Derived on read from the template link — nothing is stored on the workout or its sets, and
 * nothing here ever prefills an input. `repMin`/`repMax` are only present together; a target
 * with just one bound is treated as no target at all.
 */
export interface ExerciseTarget {
  sets: number;
  repMin: number;
  repMax: number;
}

/**
 * Resolve the prescribed sets/reps for a workout exercise from the Routine it came from.
 *
 * Returns null whenever there is nothing honest to show: no `templateId` on the workout, no
 * matching `TemplateExercise` for this exercise (e.g. the template was deleted or edited since,
 * or this exercise was added ad hoc mid-workout), or a target missing either rep bound.
 */
export function resolveExerciseTarget(
  workout: Pick<Workout, 'templateId'>,
  workoutExercise: Pick<WorkoutExercise, 'exerciseId'>,
  templateExercises: TemplateExercise[] | undefined,
): ExerciseTarget | null {
  if (!workout.templateId || !templateExercises) return null;
  const match = templateExercises.find(
    (templateExercise) => templateExercise.exerciseId === workoutExercise.exerciseId,
  );
  if (!match) return null;
  if (match.targetRepMin === undefined || match.targetRepMax === undefined) return null;
  return { sets: match.targetSets, repMin: match.targetRepMin, repMax: match.targetRepMax };
}

export type SetVerdict = 'hit' | 'under' | 'over';

/**
 * Classify a completed set's reps against a resolved target's rep range.
 *
 * Only meaningful for a numeric rep count against a target with both bounds; anything else
 * (no target, no reps logged) returns null so the caller falls through to today's rendering.
 */
export function classifySetReps(
  reps: number | undefined,
  target: { repMin?: number; repMax?: number } | undefined | null,
): SetVerdict | null {
  if (reps === undefined || !target) return null;
  if (target.repMin === undefined || target.repMax === undefined) return null;
  if (reps < target.repMin) return 'under';
  if (reps > target.repMax) return 'over';
  return 'hit';
}

/** Format the target for the exercise header, e.g. "3 × 8-12". */
export function formatTarget(target: ExerciseTarget): string {
  return `${target.sets} × ${target.repMin}–${target.repMax}`;
}
