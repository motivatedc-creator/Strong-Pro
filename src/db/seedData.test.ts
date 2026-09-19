import { describe, expect, it } from 'vitest';
import { normaliseExerciseName } from '@/features/data-transfer/strongImport';
import { seedExercises } from './seedData';

describe('seed exercise library', () => {
  it('has no duplicate names', () => {
    const names = seedExercises('now').map((exercise) => exercise.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('has no duplicate deterministic ids', () => {
    const ids = seedExercises('now').map((exercise) => exercise.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('flags single-arm/single-leg exercises as unilateral and leaves the rest undefined', () => {
    const byName = new Map(seedExercises('now').map((exercise) => [exercise.name, exercise]));
    const unilateralNames = [
      'One-Arm Dumbbell Row',
      'Single-Arm Dumbbell Shoulder Press',
      'Bulgarian Split Squat',
      'Dumbbell Walking Lunge',
    ];
    for (const name of unilateralNames) {
      expect(byName.get(name)?.unilateral).toBe(true);
    }
    for (const [name, exercise] of byName) {
      if (unilateralNames.includes(name)) continue;
      expect(exercise.unilateral).toBeFalsy();
    }
  });

  it('has no two names that normalise to the same value', () => {
    // Growing the library must not create an ambiguous exact match — two seed exercises
    // that collapse to the same normalised key would make import matching non-deterministic.
    const keys = seedExercises('now').map((exercise) => normaliseExerciseName(exercise.name));
    const seen = new Map<string, string>();
    for (const key of keys) {
      const previous = seen.get(key);
      expect(previous, `"${key}" collides with an earlier seed name`).toBeUndefined();
      seen.set(key, key);
    }
  });
});
