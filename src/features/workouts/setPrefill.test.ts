import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '@/domain/types';
import { previousSetPatch } from './setPrefill';

const workoutSet = (patch: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: patch.id ?? 'set',
  workoutId: 'workout',
  workoutExerciseId: 'exercise',
  order: 0,
  setType: 'working',
  isCompleted: false,
  ...patch,
});

describe('previousSetPatch', () => {
  const previous = workoutSet({
    id: 'previous',
    weightG: 100_000,
    reps: 8,
    durationSeconds: 75,
    distanceM: 500,
    rpe: 9,
  });

  it('fills missing weight and reps for loaded exercises', () => {
    expect(previousSetPatch(workoutSet(), previous, 'weight_reps')).toEqual({
      weightG: 100_000,
      reps: 8,
    });
  });

  it('never overwrites values the user already entered', () => {
    expect(
      previousSetPatch(workoutSet({ weightG: 102_500, reps: 0 }), previous, 'weight_reps'),
    ).toEqual({});
  });

  it('copies only fields used by the exercise tracking type', () => {
    expect(previousSetPatch(workoutSet(), previous, 'reps_only')).toEqual({ reps: 8 });
    expect(previousSetPatch(workoutSet(), previous, 'duration')).toEqual({
      durationSeconds: 75,
    });
    expect(previousSetPatch(workoutSet(), previous, 'distance_duration')).toEqual({
      durationSeconds: 75,
      distanceM: 500,
    });
  });

  it('does nothing without a previous set', () => {
    expect(previousSetPatch(workoutSet(), undefined, 'weight_reps')).toEqual({});
  });
});
