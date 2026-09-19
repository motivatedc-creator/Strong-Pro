import { describe, expect, it } from 'vitest';
import type { TemplateExercise, Workout, WorkoutExercise } from '@/domain/types';
import { classifySetReps, formatTarget, resolveExerciseTarget } from './targetPrescription';

const templateExercise = (patch: Partial<TemplateExercise> = {}): TemplateExercise => ({
  id: patch.id ?? 'template-exercise',
  templateId: 'template',
  exerciseId: 'squat',
  order: 0,
  targetSets: 3,
  targetRepMin: 8,
  targetRepMax: 12,
  restSeconds: 90,
  defaultSetType: 'working',
  includeWarmup: false,
  ...patch,
});

const workout = (patch: Partial<Workout> = {}): Pick<Workout, 'templateId'> => ({
  templateId: 'template',
  ...patch,
});

const workoutExercise = (patch: Partial<WorkoutExercise> = {}): Pick<WorkoutExercise, 'exerciseId'> => ({
  exerciseId: 'squat',
  ...patch,
});

describe('resolveExerciseTarget', () => {
  it('resolves the target from a matching template exercise', () => {
    expect(resolveExerciseTarget(workout(), workoutExercise(), [templateExercise()])).toEqual({
      sets: 3,
      repMin: 8,
      repMax: 12,
    });
  });

  it('returns null with no templateId (ad-hoc / start-empty workout)', () => {
    expect(
      resolveExerciseTarget(workout({ templateId: undefined }), workoutExercise(), [
        templateExercise(),
      ]),
    ).toBeNull();
  });

  it('returns null when no template exercise matches this exercise', () => {
    expect(
      resolveExerciseTarget(workout(), workoutExercise({ exerciseId: 'bench' }), [
        templateExercise(),
      ]),
    ).toBeNull();
  });

  it('returns null when the template no longer resolves (deleted template)', () => {
    expect(resolveExerciseTarget(workout(), workoutExercise(), undefined)).toBeNull();
  });

  it('returns null when either rep bound is missing', () => {
    expect(
      resolveExerciseTarget(workout(), workoutExercise(), [
        templateExercise({ targetRepMax: undefined }),
      ]),
    ).toBeNull();
    expect(
      resolveExerciseTarget(workout(), workoutExercise(), [
        templateExercise({ targetRepMin: undefined }),
      ]),
    ).toBeNull();
  });
});

describe('classifySetReps', () => {
  const target = { repMin: 8, repMax: 12 };

  it('classifies a hit at each boundary', () => {
    expect(classifySetReps(8, target)).toBe('hit');
    expect(classifySetReps(12, target)).toBe('hit');
    expect(classifySetReps(10, target)).toBe('hit');
  });

  it('classifies under and over just outside the range', () => {
    expect(classifySetReps(7, target)).toBe('under');
    expect(classifySetReps(13, target)).toBe('over');
  });

  it('returns null without reps, without a target, or with a partial target', () => {
    expect(classifySetReps(undefined, target)).toBeNull();
    expect(classifySetReps(10, null)).toBeNull();
    expect(classifySetReps(10, undefined)).toBeNull();
    expect(classifySetReps(10, { repMin: 8, repMax: undefined })).toBeNull();
  });
});

describe('formatTarget', () => {
  it('formats sets by rep range', () => {
    expect(formatTarget({ sets: 3, repMin: 8, repMax: 12 })).toBe('3 × 8–12');
  });
});
