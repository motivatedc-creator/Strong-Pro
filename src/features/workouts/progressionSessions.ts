import type { ExerciseSession } from '@/domain/progression';
import type { SetWithContext } from '@/domain/records';
import { localDateOf, parseIso } from '@/domain/time';
import type { AppSettings, Exercise } from '@/domain/types';

/**
 * Group a flat, already-sorted `SetWithContext[]` (as returned by
 * `repository.getSetHistoryForExercise`) into `ExerciseSession[]` for `suggestProgression`.
 *
 * Every set from one workout shares `performedAt` (the workout's `startedAt`), so that value
 * is both the grouping key and the source for each session's `localDate`. Sessions come back
 * newest-first, matching what `suggestProgression` expects.
 */
export function groupSetsIntoSessions(sets: readonly SetWithContext[]): ExerciseSession[] {
  const byPerformedAt = new Map<string, SetWithContext[]>();
  for (const set of sets) {
    const bucket = byPerformedAt.get(set.performedAt);
    if (bucket) bucket.push(set);
    else byPerformedAt.set(set.performedAt, [set]);
  }

  return [...byPerformedAt.entries()]
    .map(([performedAt, sessionSets]) => {
      const parsed = parseIso(performedAt);
      return {
        localDate: parsed ? localDateOf(parsed) : performedAt,
        sets: sessionSets,
      };
    })
    .sort((a, b) => b.localDate.localeCompare(a.localDate));
}

/**
 * The load increment to suggest with, in grams: the exercise's own increment when set, else
 * the user's quick-adjust step. `Exercise.incrementG` is optional and unset for most seeded
 * exercises, so this fallback is the honest default rather than treating "no increment" as
 * "no progression."
 */
export function resolveIncrementG(
  exercise: Pick<Exercise, 'incrementG'>,
  settings: Pick<AppSettings, 'quickIncrementG'>,
): number {
  return exercise.incrementG ?? settings.quickIncrementG;
}
