import { describe, expect, it } from 'vitest';
import euroCsv from '@/test/fixtures/strong-euro.csv?raw';
import messyCsv from '@/test/fixtures/strong-messy.csv?raw';
import standardCsv from '@/test/fixtures/strong-standard.csv?raw';
import { toGrams } from '@/domain/units';
import type { Exercise } from '@/domain/types';
import {
  analyseStrongCsv,
  autoMap,
  buildImportBatch,
  findExerciseCandidates,
  parseDuration,
  parseNumber,
  parseStrongDate,
} from './strongImport';

const library: Exercise[] = [
  {
    id: 'seed-bench-press',
    name: 'Bench Press',
    primaryMuscleGroup: 'chest',
    secondaryMuscleGroups: ['triceps'],
    equipment: 'barbell',
    movementPattern: 'horizontal push',
    trackingType: 'weight_reps',
    isCustom: false,
    isArchived: false,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
];

describe('header mapping', () => {
  it('auto-maps the standard Strong header', () => {
    const analysis = analyseStrongCsv(standardCsv);
    expect(analysis.missingRequired).toEqual([]);
    expect(analysis.mapping.exerciseName).toBe(3);
    expect(analysis.mapping.weight).toBe(5);
    expect(analysis.detectedUnit).toBe('kg');
  });

  it('detects pounds from the header', () => {
    expect(analyseStrongCsv(messyCsv).detectedUnit).toBe('lb');
  });

  it('is case-insensitive', () => {
    const mapping = autoMap(['DATE', 'exercise name', 'Set ORDER', 'WEIGHT']);
    expect(mapping.date).toBe(0);
    expect(mapping.exerciseName).toBe(1);
    expect(mapping.setOrder).toBe(2);
    expect(mapping.weight).toBe(3);
  });

  it('reports missing required columns instead of importing garbage', () => {
    const analysis = analyseStrongCsv('foo,bar\n1,2\n');
    expect(analysis.missingRequired).toEqual(['date', 'exerciseName']);
    expect(analysis.workouts).toEqual([]);
  });

  it('lists unmapped columns so the user can map them', () => {
    const analysis = analyseStrongCsv('Date,Exercise Name,Mystery\n2026-01-01,Bench Press,7\n');
    expect(analysis.unmappedColumns).toEqual([{ index: 2, name: 'Mystery' }]);
  });

  it('accepts a user-supplied mapping override', () => {
    const analysis = analyseStrongCsv('Date,Exercise Name,Mystery\n2026-01-01,Bench Press,7\n', {
      mapping: { reps: 2 },
    });
    expect(analysis.workouts[0]?.exercises[0]?.sets[0]?.reps).toBe(7);
  });
});

describe('parsing', () => {
  it('groups rows into workouts and exercises', () => {
    const analysis = analyseStrongCsv(standardCsv);
    expect(analysis.workouts).toHaveLength(2);
    const [push, pull] = analysis.workouts;
    expect(push?.name).toBe('Push A');
    expect(push?.exercises.map((entry) => entry.name)).toEqual(['Bench Press', 'Overhead Press']);
    expect(push?.exercises[0]?.sets).toHaveLength(3);
    expect(push?.durationSeconds).toBe(3_900);
    expect(pull?.exercises).toHaveLength(3);
  });

  it('converts weights to canonical grams using the header unit', () => {
    const analysis = analyseStrongCsv(standardCsv);
    expect(analysis.workouts[0]?.exercises[0]?.sets[1]?.weightG).toBe(toGrams(80, 'kg'));

    const pounds = analyseStrongCsv(messyCsv);
    expect(pounds.workouts[0]?.exercises[0]?.sets[0]?.weightG).toBe(toGrams(135, 'lb'));
  });

  it('keeps distance and duration for cardio rows', () => {
    const analysis = analyseStrongCsv(standardCsv);
    const rowing = analysis.workouts[1]?.exercises.find((entry) => entry.name === 'Rowing Machine');
    expect(rowing?.sets[0]?.distanceM).toBe(2_000);
    expect(rowing?.sets[0]?.durationSeconds).toBe(480);
  });

  it('records RPE only within 1–10', () => {
    const analysis = analyseStrongCsv(standardCsv);
    const sets = analysis.workouts[0]?.exercises[0]?.sets ?? [];
    expect(sets[0]?.rpe).toBe(7);
    expect(sets[2]?.rpe).toBe(9.5);
    expect(analysis.workouts[0]?.exercises[1]?.sets[0]?.rpe).toBeUndefined();
  });

  it('reports row-level errors with row numbers and reasons', () => {
    const analysis = analyseStrongCsv(messyCsv);
    const messages = analysis.issues.map((issue) => `${issue.row}:${issue.severity}`);
    expect(messages).toContain('4:warning'); // "Rest Timer" set-order row
    expect(messages).toContain('5:error'); // unreadable date
    expect(messages).toContain('6:error'); // missing exercise name
    expect(analysis.skippedRows).toBe(3);
    expect(analysis.issues.find((issue) => issue.row === 5)?.message).toContain('not a date');
  });

  it('keeps quoted commas, formula text and multi-line notes intact', () => {
    const analysis = analyseStrongCsv(messyCsv);
    expect(analysis.workouts[0]?.name).toBe('Morning, quick');
    expect(analysis.workouts[0]?.exercises[0]?.sets[0]?.notes).toBe('=SUM(A1:A2)');
    expect(analysis.workouts[1]?.exercises[0]?.sets[0]?.notes).toBe('multi\nline note');
  });

  it('handles semicolon files with comma decimals and localised headers', () => {
    const analysis = analyseStrongCsv(euroCsv);
    expect(analysis.missingRequired).toEqual([]);
    expect(analysis.workouts).toHaveLength(1);
    expect(analysis.workouts[0]?.exercises[0]?.sets[0]?.weightG).toBe(toGrams(100.5, 'kg'));
    expect(analysis.workouts[0]?.exercises[0]?.sets[1]?.reps).toBe(3);
  });
});

describe('date, number and duration helpers', () => {
  it.each([
    ['2026-01-05 18:30:00', 2026, 0, 5],
    ['2026-01-05', 2026, 0, 5],
    ['05/01/2026 09:15', 2026, 0, 5],
  ])('parses %s', (input, year, month, day) => {
    const iso = parseStrongDate(input);
    expect(iso).not.toBeNull();
    const date = new Date(iso!);
    expect(date.getFullYear()).toBe(year);
    expect(date.getMonth()).toBe(month);
    expect(date.getDate()).toBe(day);
  });

  it('rejects unparseable dates', () => {
    expect(parseStrongDate('not a date')).toBeNull();
    expect(parseStrongDate('')).toBeNull();
  });

  it('parses numbers in both decimal conventions', () => {
    expect(parseNumber('100.5')).toBe(100.5);
    expect(parseNumber('100,5')).toBe(100.5);
    expect(parseNumber('1 234.5')).toBe(1234.5);
    expect(parseNumber('')).toBeUndefined();
    expect(parseNumber('abc')).toBeUndefined();
  });

  it.each([
    ['1h 5m', 3_900],
    ['45m', 2_700],
    ['1:05:00', 3_900],
    ['90', 5_400],
  ])('parses duration %s', (input, expected) => {
    expect(parseDuration(input)).toBe(expected);
  });
});

describe('findExerciseCandidates', () => {
  const closeGrip: Exercise = {
    ...library[0]!,
    id: 'seed-close-grip-bench-press',
    name: 'Close-Grip Bench Press',
  };

  it('suggests a word-order permutation of an existing name', () => {
    const candidates = findExerciseCandidates(['Bench Press - Close Grip (Barbell)'], [closeGrip]);
    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.exercise.id).toBe('seed-close-grip-bench-press');
  });

  it('does not suggest a genuinely different exercise sharing one word', () => {
    const candidates = findExerciseCandidates(['Incline Bench Press'], library);
    expect(candidates).toEqual([]);
  });

  it('does not suggest anything for a name with no close match', () => {
    const candidates = findExerciseCandidates(['Behind The Legs Deadlift'], library);
    expect(candidates).toEqual([]);
  });

  it('skips a name that already exact-matches the library', () => {
    const candidates = findExerciseCandidates(['Bench Press'], library);
    expect(candidates).toEqual([]);
  });

  it('only surfaces each distinct name once', () => {
    const candidates = findExerciseCandidates(
      ['Bench Press - Close Grip (Barbell)', 'Bench Press - Close Grip (Barbell)'],
      [closeGrip],
    );
    expect(candidates).toHaveLength(1);
  });
});

describe('buildImportBatch', () => {
  const analysis = analyseStrongCsv(standardCsv);

  it('matches known exercises and creates custom ones for the rest', () => {
    const batch = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: library,
      existingFingerprints: new Set(),
    });

    expect(batch.workouts).toHaveLength(2);
    const benchEntry = batch.workouts[0]?.exercises[0];
    expect(benchEntry?.exercise.exerciseId).toBe('seed-bench-press');
    expect(batch.newExercises.map((exercise) => exercise.name)).toEqual([
      'Overhead Press',
      'Barbell Row',
      'Pull-Up',
      'Rowing Machine',
    ]);
    expect(batch.newExercises.every((exercise) => exercise.isCustom)).toBe(true);
    expect(batch.newExercises.every((exercise) => exercise.primaryMuscleGroup === 'unmapped')).toBe(
      true,
    );
  });

  it('infers a tracking type for created exercises', () => {
    const batch = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: library,
      existingFingerprints: new Set(),
    });
    const byName = Object.fromEntries(
      batch.newExercises.map((exercise) => [exercise.name, exercise]),
    );
    expect(byName['Pull-Up']?.trackingType).toBe('reps_only');
    expect(byName['Rowing Machine']?.trackingType).toBe('distance_duration');
    expect(byName['Barbell Row']?.trackingType).toBe('weight_reps');
  });

  it('marks every imported set as completed and stamps the job', () => {
    const batch = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: library,
      existingFingerprints: new Set(),
    });
    const sets = batch.workouts.flatMap((workout) =>
      workout.exercises.flatMap((entry) => entry.sets),
    );
    expect(sets.every((set) => set.isCompleted)).toBe(true);
    expect(batch.job.setsImported).toBe(sets.length);
    expect(batch.job.fileName).toBe('strong.csv');
    expect(batch.job.status).toBe('completed');
  });

  it('skips workouts whose fingerprint is already present', () => {
    const fingerprints = new Set(analysis.workouts.map((workout) => workout.fingerprint));
    const batch = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: library,
      existingFingerprints: fingerprints,
    });
    expect(batch.workouts).toHaveLength(0);
    expect(batch.duplicatesSkipped).toBe(2);
  });

  it('imports duplicates anyway when the user overrides', () => {
    const fingerprints = new Set(analysis.workouts.map((workout) => workout.fingerprint));
    const batch = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: library,
      existingFingerprints: fingerprints,
      allowDuplicates: true,
    });
    expect(batch.workouts).toHaveLength(2);
  });

  it('honours the preview selection', () => {
    const selected = new Set([analysis.workouts[0]!.key]);
    const batch = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: library,
      existingFingerprints: new Set(),
      selectedKeys: selected,
    });
    expect(batch.workouts).toHaveLength(1);
    expect(batch.workouts[0]?.workout.name).toBe('Push A');
  });

  it('honours a confirmed "same exercise" override instead of creating a custom one', () => {
    const overridden = analyseStrongCsv(
      'Date,Exercise Name,Set Order,Weight (kg),Reps\n2026-01-01,Overhead Press,1,40,8\n',
    );
    const batch = buildImportBatch(overridden, {
      fileName: 'strong.csv',
      existingExercises: library,
      existingFingerprints: new Set(),
      nameOverrides: new Map([['overhead press', 'seed-bench-press']]),
    });
    expect(batch.newExercises).toHaveLength(0);
    expect(batch.workouts[0]?.exercises[0]?.exercise.exerciseId).toBe('seed-bench-press');
  });

  it("falls through to today's unmapped-custom behaviour when a name has no override", () => {
    const batch = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: library,
      existingFingerprints: new Set(),
      nameOverrides: new Map(),
    });
    expect(batch.newExercises.map((exercise) => exercise.name)).toEqual([
      'Overhead Press',
      'Barbell Row',
      'Pull-Up',
      'Rowing Machine',
    ]);
  });

  it('produces a stable fingerprint across re-parses and different ones per workout', () => {
    const again = analyseStrongCsv(standardCsv);
    expect(again.workouts[0]?.fingerprint).toBe(analysis.workouts[0]?.fingerprint);
    expect(analysis.workouts[0]?.fingerprint).not.toBe(analysis.workouts[1]?.fingerprint);
  });
});
