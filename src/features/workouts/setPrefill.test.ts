import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '@/domain/types';
import { pairedSetInputs, previousForRow, previousSetPatch } from './setPrefill';

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

describe('previousForRow', () => {
  it('matches the old flat previous[index] behavior for bilateral sets', () => {
    const previous = [
      workoutSet({ id: 'p1', weightG: 100_000, reps: 8 }),
      workoutSet({ id: 'p2', weightG: 105_000, reps: 8 }),
    ];
    const current = [workoutSet({ id: 'c1' }), workoutSet({ id: 'c2' })];

    expect(previousForRow(previous, current, current[0]!)).toBe(previous[0]);
    expect(previousForRow(previous, current, current[1]!)).toBe(previous[1]);
  });

  it('falls back to the last bilateral value when current has more sets than history', () => {
    const previous = [workoutSet({ id: 'p1', weightG: 100_000 })];
    const current = [workoutSet({ id: 'c1' }), workoutSet({ id: 'c2' })];

    expect(previousForRow(previous, current, current[1]!)).toBe(previous[0]);
  });

  it('ghosts a left row only against left history, not the opposite side', () => {
    const previous = [
      workoutSet({ id: 'pl1', side: 'left', weightG: 20_000, reps: 10 }),
      workoutSet({ id: 'pr1', side: 'right', weightG: 22_500, reps: 10 }),
    ];
    const current = [
      workoutSet({ id: 'cl1', side: 'left' }),
      workoutSet({ id: 'cr1', side: 'right' }),
    ];

    expect(previousForRow(previous, current, current[0]!)).toBe(previous[0]);
    expect(previousForRow(previous, current, current[1]!)).toBe(previous[1]);
  });

  it('falls back to the last same-side value when a side has fewer history rows', () => {
    const previous = [workoutSet({ id: 'pl1', side: 'left', weightG: 20_000 })];
    const current = [
      workoutSet({ id: 'cl1', side: 'left' }),
      workoutSet({ id: 'cl2', side: 'left' }),
    ];

    expect(previousForRow(previous, current, current[1]!)).toBe(previous[0]);
  });

  it('returns undefined when that side has zero history', () => {
    const previous = [workoutSet({ id: 'pr1', side: 'right', weightG: 22_500 })];
    const current = [workoutSet({ id: 'cl1', side: 'left' })];

    expect(previousForRow(previous, current, current[0]!)).toBeUndefined();
  });
});

describe('pairedSetInputs', () => {
  it('returns two inputs sharing one pairId with correct sides', () => {
    const [left, right] = pairedSetInputs('exercise', {});
    expect(left.side).toBe('left');
    expect(right.side).toBe('right');
    expect(left.pairId).toBe(right.pairId);
    expect(left.pairId).toBeTruthy();
  });

  it('templates each side only from its own last row', () => {
    const leftTemplate = workoutSet({ weightG: 20_000, reps: 10 });
    const rightTemplate = workoutSet({ weightG: 22_500, reps: 9 });
    const [left, right] = pairedSetInputs('exercise', {
      left: leftTemplate,
      right: rightTemplate,
    });

    expect(left.weightG).toBe(20_000);
    expect(left.reps).toBe(10);
    expect(right.weightG).toBe(22_500);
    expect(right.reps).toBe(9);
  });

  it('produces two empty-templated inputs with a shared pairId when neither side has history', () => {
    const [left, right] = pairedSetInputs('exercise', {});
    expect(left.weightG).toBeUndefined();
    expect(right.weightG).toBeUndefined();
    expect(left.pairId).toBe(right.pairId);
  });
});
