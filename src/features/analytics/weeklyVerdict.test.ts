import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutExercise, WorkoutSet } from '@/domain/types';
import type { AnalyticsOptions, LoggedEntry } from './compute';
import { weeklyVerdict, weeklyVerdictCopy } from './weeklyVerdict';

const options: AnalyticsOptions = {
  formula: 'epley',
  includeWarmups: false,
  secondaryCredit: 0.5,
};

function entry(date: string, id: string, weightG = 100_000, reps = 5): LoggedEntry {
  const workout: Workout = {
    id: `workout-${id}`,
    name: 'Session',
    status: 'completed',
    startedAt: date,
    endedAt: date,
    localDate: date.slice(0, 10),
    tzOffsetMinutes: 0,
    pausedSeconds: 0,
    createdAt: date,
    updatedAt: date,
  };
  const exercise: WorkoutExercise = {
    id: `exercise-${id}`,
    workoutId: workout.id,
    exerciseId: 'bench',
    order: 0,
    exerciseNameSnapshot: 'Bench Press',
    primaryMuscleGroupSnapshot: 'chest',
    secondaryMuscleGroupsSnapshot: ['triceps'],
    equipmentSnapshot: 'barbell',
    trackingTypeSnapshot: 'weight_reps',
    restSeconds: 120,
  };
  const set: WorkoutSet = {
    id: `set-${id}`,
    workoutId: workout.id,
    workoutExerciseId: exercise.id,
    order: 0,
    setType: 'working',
    weightG,
    reps,
    isCompleted: true,
    completedAt: date,
  };
  return { workout, exercise, sets: [set] };
}

describe('weeklyVerdict', () => {
  it('compares the in-progress week against the average of the four complete previous weeks', () => {
    const reference = new Date('2026-09-17T12:00:00.000Z');
    const result = weeklyVerdict(
      [
        entry('2026-08-17T10:00:00.000Z', 'baseline-start'),
        entry('2026-08-24T10:00:00.000Z', 'w1'),
        entry('2026-08-31T10:00:00.000Z', 'w2'),
        entry('2026-09-07T10:00:00.000Z', 'w3'),
        entry('2026-09-14T10:00:00.000Z', 'current-a'),
        entry('2026-09-16T10:00:00.000Z', 'current-b'),
      ],
      options,
      reference,
    );

    expect(result.current.workouts).toBe(2);
    expect(result.fourWeekAverage.workouts).toBe(1);
    expect(result.hasFullBaseline).toBe(true);
  });

  it('does not treat partial history as a trustworthy four-week baseline', () => {
    const reference = new Date('2026-09-17T12:00:00.000Z');
    const result = weeklyVerdict(
      [entry('2026-09-07T10:00:00.000Z', 'recent'), entry('2026-09-14T10:00:00.000Z', 'current')],
      options,
      reference,
    );

    expect(result.hasFullBaseline).toBe(false);
  });
});

describe('weeklyVerdictCopy', () => {
  it('produces exactly three factual sentences when a full baseline exists', () => {
    const reference = new Date('2026-09-17T12:00:00.000Z');
    const verdict = weeklyVerdict(
      [
        entry('2026-08-17T10:00:00.000Z', 'baseline-start'),
        entry('2026-08-24T10:00:00.000Z', 'w1'),
        entry('2026-08-31T10:00:00.000Z', 'w2'),
        entry('2026-09-07T10:00:00.000Z', 'w3'),
        entry('2026-09-14T10:00:00.000Z', 'current-a'),
        entry('2026-09-16T10:00:00.000Z', 'current-b'),
      ],
      options,
      reference,
    );

    const copy = weeklyVerdictCopy(verdict, 'kg');

    expect(copy.available).toBe(true);
    expect(copy.lines).toHaveLength(3);
    expect(copy.lines[0]).toContain('2 workouts');
    expect(copy.lines[1]).toContain('100% above');
    expect(copy.lines[2]).toContain('4-week baseline');
  });

  it('withholds the verdict until four complete baseline weeks exist', () => {
    const reference = new Date('2026-09-17T12:00:00.000Z');
    const verdict = weeklyVerdict(
      [entry('2026-09-07T10:00:00.000Z', 'recent'), entry('2026-09-14T10:00:00.000Z', 'current')],
      options,
      reference,
    );

    const copy = weeklyVerdictCopy(verdict, 'kg');

    expect(copy.available).toBe(false);
    expect(copy.lines).toHaveLength(1);
    expect(copy.lines[0]).toContain('four complete prior weeks');
  });
});
