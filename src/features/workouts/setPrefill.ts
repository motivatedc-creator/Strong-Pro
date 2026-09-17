import { usesDistance, usesDuration, usesReps, usesWeight } from '@/domain/taxonomy';
import type { TrackingType, WorkoutSet } from '@/domain/types';

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
