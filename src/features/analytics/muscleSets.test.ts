import { describe, expect, it } from 'vitest';
import type { MuscleGroup, SetType, Workout, WorkoutExercise, WorkoutSet } from '@/domain/types';
import type { LoggedEntry } from './compute';
import { muscleSetInsight } from './muscleSets';

let id = 0;

function entry({
  date,
  primary = 'chest',
  secondary = ['triceps'],
  setTypes = ['working'],
  completed = true,
  exerciseName = 'Bench Press',
}: {
  date: string;
  primary?: MuscleGroup;
  secondary?: MuscleGroup[];
  setTypes?: SetType[];
  completed?: boolean;
  exerciseName?: string;
}): LoggedEntry {
  id += 1;
  const suffix = String(id);
  const workout: Workout = {
    id: `workout-${suffix}`,
    name: 'Session',
    status: 'completed',
    startedAt: `${date}T10:00:00.000Z`,
    endedAt: `${date}T11:00:00.000Z`,
    localDate: date,
    tzOffsetMinutes: 0,
    pausedSeconds: 0,
    createdAt: `${date}T10:00:00.000Z`,
    updatedAt: `${date}T11:00:00.000Z`,
  };
  const exercise: WorkoutExercise = {
    id: `workout-exercise-${suffix}`,
    workoutId: workout.id,
    exerciseId: `exercise-${exerciseName}`,
    order: 0,
    exerciseNameSnapshot: exerciseName,
    primaryMuscleGroupSnapshot: primary,
    secondaryMuscleGroupsSnapshot: secondary,
    equipmentSnapshot: 'barbell',
    trackingTypeSnapshot: 'weight_reps',
    restSeconds: 120,
  };
  const sets: WorkoutSet[] = setTypes.map((setType, index) => ({
    id: `set-${suffix}-${index}`,
    workoutId: workout.id,
    workoutExerciseId: exercise.id,
    order: index,
    setType,
    weightG: 100_000,
    reps: 5,
    isCompleted: completed,
    completedAt: completed ? `${date}T10:30:00.000Z` : undefined,
  }));
  return { workout, exercise, sets };
}

describe('muscleSetInsight', () => {
  it('counts only completed working sets with full primary and fractional secondary credit', () => {
    const rows = muscleSetInsight(
      [
        entry({
          date: '2026-09-14',
          setTypes: ['working', 'working', 'warmup', 'drop', 'failure'],
        }),
        entry({ date: '2026-09-15', completed: false }),
      ],
      {
        referenceLocalDate: '2026-09-17',
        weekStart: 'monday',
        secondaryCredit: 0.5,
      },
    );

    expect(rows.map(({ muscle, sets }) => ({ muscle, sets }))).toEqual([
      { muscle: 'chest', sets: 2 },
      { muscle: 'triceps', sets: 1 },
    ]);
    expect(rows[0]?.evidence).toHaveLength(2);
    expect(rows[0]?.evidence.every((item) => item.role === 'primary')).toBe(true);
    expect(rows[1]?.evidence.every((item) => item.credit === 0.5)).toBe(true);
  });

  it.each([
    ['saturday' as const, '2026-09-12', 2],
    ['sunday' as const, '2026-09-13', 1],
    ['monday' as const, '2026-09-14', 0],
  ])('uses the configured %s training-week boundary', (weekStart, includedDate, expected) => {
    const rows = muscleSetInsight(
      [entry({ date: '2026-09-12', secondary: [] }), entry({ date: '2026-09-13', secondary: [] })],
      { referenceLocalDate: includedDate, weekStart, secondaryCredit: 0.5 },
    );

    expect(rows.find((row) => row.muscle === 'chest')?.sets ?? 0).toBe(expected);
  });

  it('keeps unmapped work visible with its exact contributing sets', () => {
    const rows = muscleSetInsight(
      [entry({ date: '2026-09-15', primary: 'unmapped', secondary: [], setTypes: ['working'] })],
      { referenceLocalDate: '2026-09-17', weekStart: 'monday', secondaryCredit: 0.5 },
    );

    expect(rows).toMatchObject([
      {
        muscle: 'unmapped',
        sets: 1,
        state: 'unmapped',
        evidence: [{ exerciseName: 'Bench Press', credit: 1, role: 'primary' }],
      },
    ]);
  });

  it('classifies targetable muscles against the 10–20 research default', () => {
    const rows = muscleSetInsight(
      [entry({ date: '2026-09-15', primary: 'chest', secondary: [], setTypes: ['working'] })],
      {
        referenceLocalDate: '2026-09-17',
        weekStart: 'monday',
        secondaryCredit: 0.5,
      },
    );

    expect(rows).toMatchObject([
      {
        muscle: 'chest',
        sets: 1,
        state: 'below',
        target: { min: 10, max: 20 },
        targetSource: 'research',
      },
    ]);
  });

  it('uses a valid personal target instead of the research default', () => {
    const entries = [
      entry({ date: '2026-09-15', primary: 'chest', secondary: [], setTypes: ['working'] }),
      entry({
        date: '2026-09-16',
        primary: 'back',
        secondary: [],
        setTypes: ['working', 'working', 'working'],
      }),
      entry({
        date: '2026-09-17',
        primary: 'quads',
        secondary: [],
        setTypes: ['working', 'working', 'working', 'working', 'working'],
      }),
      entry({ date: '2026-09-17', primary: 'calves', secondary: [] }),
    ];
    const rows = muscleSetInsight(entries, {
      referenceLocalDate: '2026-09-17',
      weekStart: 'monday',
      secondaryCredit: 0.5,
      personalTargetBands: {
        chest: { min: 2, max: 4 },
        back: { min: 2, max: 4 },
        quads: { min: 2, max: 4 },
      },
    });

    expect(Object.fromEntries(rows.map((row) => [row.muscle, row.state]))).toEqual({
      back: 'in_range',
      calves: 'below',
      chest: 'below',
      quads: 'above',
    });
    expect(rows.find((row) => row.muscle === 'chest')).toMatchObject({
      target: { min: 2, max: 4 },
      targetSource: 'personal',
    });
    expect(rows.find((row) => row.muscle === 'calves')).toMatchObject({
      target: { min: 10, max: 20 },
      targetSource: 'research',
    });
  });

  it('does not apply research targets to unmapped, full-body or cardio work', () => {
    const rows = muscleSetInsight(
      [
        entry({ date: '2026-09-15', primary: 'unmapped', secondary: [] }),
        entry({ date: '2026-09-15', primary: 'full body', secondary: [] }),
        entry({ date: '2026-09-15', primary: 'cardio', secondary: [] }),
      ],
      {
        referenceLocalDate: '2026-09-17',
        weekStart: 'monday',
        secondaryCredit: 0.5,
      },
    );

    expect(Object.fromEntries(rows.map((row) => [row.muscle, row.state]))).toEqual({
      cardio: 'not_set',
      'full body': 'not_set',
      unmapped: 'unmapped',
    });
  });
});
