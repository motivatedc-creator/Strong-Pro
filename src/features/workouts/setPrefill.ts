import { usesDistance, usesDuration, usesReps, usesWeight } from '@/domain/taxonomy';
import { uuid } from '@/domain/ids';
import type { SetType, TrackingType, UUID, WorkoutSet } from '@/domain/types';
import type { NewSetInput } from '@/db/repository';

/**
 * Build the values accepted when a user completes an otherwise empty set.
 * Existing values always win; effort ratings and notes are session-specific and never copied.
 */
export function previousSetPatch(
  current: WorkoutSet,
  previous: WorkoutSet | undefined,
  trackingType: TrackingType,
): Partial<WorkoutSet> {
  if (!previous) return {};
  const patch: Partial<WorkoutSet> = {};

  if (usesWeight(trackingType) && current.weightG === undefined && previous.weightG !== undefined) {
    patch.weightG = previous.weightG;
  }
  if (usesReps(trackingType) && current.reps === undefined && previous.reps !== undefined) {
    patch.reps = previous.reps;
  }
  if (
    usesDuration(trackingType) &&
    current.durationSeconds === undefined &&
    previous.durationSeconds !== undefined
  ) {
    patch.durationSeconds = previous.durationSeconds;
  }
  if (
    usesDistance(trackingType) &&
    current.distanceM === undefined &&
    previous.distanceM !== undefined
  ) {
    patch.distanceM = previous.distanceM;
  }

  return patch;
}

/**
 * Finds the previous-session row to ghost against for one row of the current set.
 *
 * Bilateral sets (side undefined on every row) filter to a no-op — this is byte-identical to
 * the old flat `previous[index]` lookup. Unilateral sets are ranked within their own side, so
 * a left row only ever ghosts against another left row's history, and a right row against
 * right history.
 */
export function previousForRow(
  previousSets: WorkoutSet[],
  currentSets: WorkoutSet[],
  set: WorkoutSet,
): WorkoutSet | undefined {
  const previousForSide = previousSets.filter((s) => s.side === set.side);
  const currentForSide = currentSets.filter((s) => s.side === set.side);
  const rank = currentForSide.findIndex((s) => s.id === set.id);
  if (rank === -1 || previousForSide.length === 0) return undefined;
  return previousForSide[rank] ?? previousForSide[previousForSide.length - 1];
}

/**
 * Builds the paired left/right `NewSetInput`s for a unilateral working set, sharing one
 * `pairId` so the UI can group and jointly delete them. Each side templates only from its own
 * last row (weight/reps), matching how the existing single-set add already templates.
 */
export function pairedSetInputs(
  workoutExerciseId: UUID,
  templates: { left?: WorkoutSet; right?: WorkoutSet },
  setType?: SetType,
): [NewSetInput, NewSetInput] {
  const pairId = uuid();
  const left: NewSetInput = {
    workoutExerciseId,
    side: 'left',
    pairId,
    weightG: templates.left?.weightG,
    reps: templates.left?.reps,
    setType: setType ?? templates.left?.setType ?? 'working',
  };
  const right: NewSetInput = {
    workoutExerciseId,
    side: 'right',
    pairId,
    weightG: templates.right?.weightG,
    reps: templates.right?.reps,
    setType: setType ?? templates.right?.setType ?? 'working',
  };
  return [left, right];
}
