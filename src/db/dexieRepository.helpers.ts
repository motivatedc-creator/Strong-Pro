import { uuid } from '@/domain/ids';
import type { Exercise, UUID, WorkoutExercise } from '@/domain/types';

export class ActiveWorkoutExistsError extends Error {
  constructor(public readonly workoutId: UUID) {
    super('A workout is already in progress.');
    this.name = 'ActiveWorkoutExistsError';
  }
}

export function snapshotExercise(
  workoutId: UUID,
  exercise: Exercise,
  order: number,
  options: { restSeconds?: number; notes?: string; supersetGroup?: string } = {},
): WorkoutExercise {
  return {
    id: uuid(),
    workoutId,
    exerciseId: exercise.id,
    order,
    exerciseNameSnapshot: exercise.name,
    primaryMuscleGroupSnapshot: exercise.primaryMuscleGroup,
    secondaryMuscleGroupsSnapshot: exercise.secondaryMuscleGroups,
    equipmentSnapshot: exercise.equipment,
    trackingTypeSnapshot: exercise.trackingType,
    restSeconds: options.restSeconds ?? 120,
    notes: options.notes,
    supersetGroup: options.supersetGroup,
  };
}

export function defaultWorkoutName(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return 'Morning workout';
  if (hour < 16) return 'Afternoon workout';
  if (hour < 21) return 'Evening workout';
  return 'Night workout';
}
