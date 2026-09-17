import { beforeEach, describe, expect, it } from 'vitest';
import { analyseStrongCsv, buildImportBatch } from '@/features/data-transfer/strongImport';
import { pruneOrphans, validateBackup } from '@/features/data-transfer/backupSchema';
import { backupToJson } from '@/features/data-transfer/exporters';
import standardCsv from '@/test/fixtures/strong-standard.csv?raw';
import { RepForgeDatabase } from './schema';
import { ActiveWorkoutExistsError, DexieRepository } from './dexieRepository';

let db: RepForgeDatabase;
let repository: DexieRepository;

beforeEach(async () => {
  db = new RepForgeDatabase(`repforge-repo-${Math.random().toString(36).slice(2)}`);
  repository = new DexieRepository(db);
  await repository.initialise();
});

describe('active workouts', () => {
  it('refuses to start a second active workout', async () => {
    await repository.startWorkout({ name: 'First' });
    await expect(repository.startWorkout({ name: 'Second' })).rejects.toBeInstanceOf(
      ActiveWorkoutExistsError,
    );
    expect((await repository.getActiveWorkout())?.workout.name).toBe('First');
  });

  it('completing a workout twice is idempotent', async () => {
    const detail = await repository.startWorkout({ name: 'Session' });
    const workoutExercise = await repository.addExerciseToWorkout(
      detail.workout.id,
      'seed-bench-press',
    );
    await repository.addSet(detail.workout.id, {
      workoutExerciseId: workoutExercise.id,
      weightG: 80_000,
      reps: 5,
      isCompleted: true,
    });

    await repository.completeWorkout(detail.workout.id);
    const first = await repository.getWorkoutDetail(detail.workout.id);
    await repository.completeWorkout(detail.workout.id);
    const second = await repository.getWorkoutDetail(detail.workout.id);

    expect(second?.workout.endedAt).toBe(first?.workout.endedAt);
    expect(await repository.countWorkouts()).toBe(1);
  });

  it('drops unfinished sets when a workout is completed', async () => {
    const detail = await repository.startWorkout({ name: 'Session' });
    const workoutExercise = await repository.addExerciseToWorkout(
      detail.workout.id,
      'seed-bench-press',
    );
    await repository.addSet(detail.workout.id, {
      workoutExerciseId: workoutExercise.id,
      weightG: 80_000,
      reps: 5,
      isCompleted: true,
    });
    await repository.addSet(detail.workout.id, { workoutExerciseId: workoutExercise.id, reps: 5 });

    await repository.completeWorkout(detail.workout.id);
    const finished = await repository.getWorkoutDetail(detail.workout.id);
    expect(finished?.exercises[0]?.sets).toHaveLength(1);
  });

  it('keeps set ordering contiguous after inserts and deletes', async () => {
    const detail = await repository.startWorkout({ name: 'Session' });
    const workoutExercise = await repository.addExerciseToWorkout(
      detail.workout.id,
      'seed-bench-press',
    );
    const a = await repository.addSet(detail.workout.id, {
      workoutExerciseId: workoutExercise.id,
      reps: 5,
    });
    const b = await repository.addSet(detail.workout.id, {
      workoutExerciseId: workoutExercise.id,
      reps: 6,
    });
    await repository.addSet(detail.workout.id, {
      workoutExerciseId: workoutExercise.id,
      reps: 7,
      afterSetId: a.id,
    });

    let sets = (await repository.getWorkoutDetail(detail.workout.id))?.exercises[0]?.sets ?? [];
    expect(sets.map((set) => set.reps)).toEqual([5, 7, 6]);
    expect(sets.map((set) => set.order)).toEqual([0, 1, 2]);

    await repository.deleteSet(b.id);
    sets = (await repository.getWorkoutDetail(detail.workout.id))?.exercises[0]?.sets ?? [];
    expect(sets.map((set) => set.order)).toEqual([0, 1]);
  });

  it('restores a deleted set verbatim for undo', async () => {
    const detail = await repository.startWorkout({ name: 'Session' });
    const workoutExercise = await repository.addExerciseToWorkout(
      detail.workout.id,
      'seed-bench-press',
    );
    const set = await repository.addSet(detail.workout.id, {
      workoutExerciseId: workoutExercise.id,
      weightG: 100_000,
      reps: 3,
      isCompleted: true,
    });

    await repository.deleteSet(set.id);
    await repository.restoreSet(set);

    const sets = (await repository.getWorkoutDetail(detail.workout.id))?.exercises[0]?.sets ?? [];
    expect(sets).toHaveLength(1);
    expect(sets[0]).toMatchObject({ id: set.id, weightG: 100_000, reps: 3 });
  });

  it('reads previous-session values for an exercise', async () => {
    const first = await repository.startWorkout({ name: 'Week 1' });
    const firstExercise = await repository.addExerciseToWorkout(
      first.workout.id,
      'seed-bench-press',
    );
    await repository.addSet(first.workout.id, {
      workoutExerciseId: firstExercise.id,
      weightG: 80_000,
      reps: 5,
      isCompleted: true,
    });
    await repository.completeWorkout(first.workout.id);

    const second = await repository.startWorkout({ name: 'Week 2' });
    const previous = await repository.getPreviousSetsForExercise(
      'seed-bench-press',
      second.workout.id,
    );
    expect(previous).toHaveLength(1);
    expect(previous[0]?.weightG).toBe(80_000);
  });
});

describe('exercise and template safety', () => {
  it('archiving an exercise never deletes history', async () => {
    const detail = await repository.startWorkout({ name: 'Session' });
    const workoutExercise = await repository.addExerciseToWorkout(
      detail.workout.id,
      'seed-bench-press',
    );
    await repository.addSet(detail.workout.id, {
      workoutExerciseId: workoutExercise.id,
      weightG: 80_000,
      reps: 5,
      isCompleted: true,
    });
    await repository.completeWorkout(detail.workout.id);

    await repository.setExerciseArchived('seed-bench-press', true);

    const history = await repository.getSetHistoryForExercise('seed-bench-press');
    expect(history).toHaveLength(1);
    const stored = await repository.getWorkoutDetail(detail.workout.id);
    expect(stored?.exercises[0]?.exercise.exerciseNameSnapshot).toBe('Bench Press');
  });

  it('refuses to delete an exercise that history references', async () => {
    const custom = await repository.createExercise({
      name: 'Landmine Press',
      primaryMuscleGroup: 'shoulders',
      secondaryMuscleGroups: [],
      equipment: 'barbell',
      movementPattern: 'vertical push',
      trackingType: 'weight_reps',
      isArchived: false,
    });

    const detail = await repository.startWorkout({ name: 'Session' });
    await repository.addExerciseToWorkout(detail.workout.id, custom.id);
    await repository.completeWorkout(detail.workout.id);

    const result = await repository.deleteExercise(custom.id);
    expect(result.deleted).toBe(false);
    expect(result.reason).toContain('Archive it instead');
  });

  it('refuses to delete a library exercise', async () => {
    expect((await repository.deleteExercise('seed-bench-press')).deleted).toBe(false);
  });

  it('propagates an Unmapped muscle correction into historical analytics snapshots', async () => {
    const custom = await repository.createExercise({
      name: 'Imported Cable Press',
      primaryMuscleGroup: 'unmapped',
      secondaryMuscleGroups: [],
      equipment: 'cable',
      movementPattern: 'horizontal push',
      trackingType: 'weight_reps',
      isArchived: false,
    });
    const workout = await repository.startWorkout({ name: 'Imported session' });
    await repository.addExerciseToWorkout(workout.workout.id, custom.id);
    await repository.completeWorkout(workout.workout.id);

    await repository.updateExercise(custom.id, {
      primaryMuscleGroup: 'chest',
      secondaryMuscleGroups: ['triceps'],
    });

    const corrected = await repository.getWorkoutDetail(workout.workout.id);
    expect(corrected?.exercises[0]?.exercise.primaryMuscleGroupSnapshot).toBe('chest');
    expect(corrected?.exercises[0]?.exercise.secondaryMuscleGroupsSnapshot).toEqual(['triceps']);
  });

  it('deleting a template keeps the workouts started from it', async () => {
    const template = await repository.createTemplate('Push day');
    await repository.saveTemplate(template, [
      {
        id: 'te1',
        templateId: template.id,
        exerciseId: 'seed-bench-press',
        order: 0,
        targetSets: 3,
        restSeconds: 120,
        defaultSetType: 'working',
        includeWarmup: true,
      },
    ]);

    const detail = await repository.startWorkout({ templateId: template.id });
    expect(detail.exercises).toHaveLength(1);
    expect(detail.exercises[0]?.sets).toHaveLength(3);
    await repository.completeWorkout(detail.workout.id);

    await repository.deleteTemplate(template.id);
    expect(await repository.countWorkouts()).toBe(1);
  });

  it('duplicates a template with its exercises', async () => {
    const template = await repository.createTemplate('Pull day');
    await repository.saveTemplate(template, [
      {
        id: 'te1',
        templateId: template.id,
        exerciseId: 'seed-barbell-row',
        order: 0,
        targetSets: 4,
        restSeconds: 90,
        defaultSetType: 'working',
        includeWarmup: false,
      },
    ]);

    const copy = await repository.duplicateTemplate(template.id);
    expect(copy?.name).toBe('Pull day (copy)');
    const detail = await repository.getTemplateDetail(copy!.id);
    expect(detail?.exercises).toHaveLength(1);
    expect(detail?.exercises[0]?.templateExercise.targetSets).toBe(4);
  });
});

describe('import batches', () => {
  it('writes an entire Strong import in one transaction', async () => {
    const analysis = analyseStrongCsv(standardCsv);
    const batch = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: await repository.listExercises(),
      existingFingerprints: new Set(),
    });

    await repository.importBatch(batch);

    expect(await repository.countWorkouts()).toBe(2);
    const jobs = await repository.listImportJobs();
    expect(jobs[0]?.fileName).toBe('strong.csv');
    expect((await repository.getImportIssues(jobs[0]!.id)).length).toBe(batch.issues.length);
  });

  it('leaves the database untouched when a batch write fails', async () => {
    const analysis = analyseStrongCsv(standardCsv);
    const batch = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: await repository.listExercises(),
      existingFingerprints: new Set(),
    });

    // Corrupt the second workout so the transaction throws part-way through.
    const broken = structuredClone(batch);
    // @ts-expect-error deliberately invalid: primary key removed
    delete broken.workouts[1].workout.id;

    await expect(repository.importBatch(broken)).rejects.toBeTruthy();
    expect(await repository.countWorkouts()).toBe(0);
    expect(await repository.listImportJobs()).toHaveLength(0);
  });

  it('detects an already-imported workout by fingerprint', async () => {
    const analysis = analyseStrongCsv(standardCsv);
    const first = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: await repository.listExercises(),
      existingFingerprints: new Set(),
    });
    await repository.importBatch(first);

    const existing = new Set<string>();
    for (const workout of analysis.workouts) {
      if (await repository.findWorkoutByFingerprint(workout.fingerprint))
        existing.add(workout.fingerprint);
    }
    const second = buildImportBatch(analysis, {
      fileName: 'strong.csv',
      existingExercises: await repository.listExercises(),
      existingFingerprints: existing,
    });

    expect(second.workouts).toHaveLength(0);
    expect(second.duplicatesSkipped).toBe(2);
  });
});

describe('backup round trip', () => {
  async function seedHistory() {
    const detail = await repository.startWorkout({ name: 'Round trip' });
    const workoutExercise = await repository.addExerciseToWorkout(
      detail.workout.id,
      'seed-back-squat',
    );
    await repository.addSet(detail.workout.id, {
      workoutExerciseId: workoutExercise.id,
      weightG: 140_000,
      reps: 5,
      rpe: 8,
      isCompleted: true,
      notes: '=SUM(A1:A2)',
    });
    await repository.completeWorkout(detail.workout.id);
    await repository.addMeasurement({
      metric: 'bodyweight',
      value: 82_500,
      displayUnit: 'kg',
      recordedAt: '2026-03-01T08:00:00.000Z',
      localDate: '2026-03-01',
    });
    return detail.workout.id;
  }

  it('exports, validates and restores identical data', async () => {
    const workoutId = await seedHistory();
    const exported = await repository.exportAll();

    const json = backupToJson(exported);
    const validation = validateBackup(JSON.parse(json));
    expect(validation.ok).toBe(true);
    expect(validation.errors).toEqual([]);
    expect(validation.summary?.workouts).toBe(1);

    await repository.clearAllUserData();
    expect(await repository.countWorkouts()).toBe(0);

    await repository.replaceAll(validation.payload!);

    const restored = await repository.getWorkoutDetail(workoutId);
    expect(restored?.workout.name).toBe('Round trip');
    expect(restored?.exercises[0]?.sets[0]).toMatchObject({ weightG: 140_000, reps: 5, rpe: 8 });
    expect(restored?.exercises[0]?.sets[0]?.notes).toBe('=SUM(A1:A2)');
    expect(await repository.listMeasurements('bodyweight')).toHaveLength(1);
  });

  it('merges a backup without duplicating existing workouts', async () => {
    await seedHistory();
    const exported = await repository.exportAll();

    const result = await repository.mergeBackup(exported);
    expect(result.workoutsAdded).toBe(0);
    expect(result.workoutsSkipped).toBe(1);
    expect(await repository.countWorkouts()).toBe(1);
  });

  it('rejects a structurally invalid backup before writing anything', async () => {
    const validation = validateBackup({ format: 'not-repforge', version: 1 });
    expect(validation.ok).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
    expect(await repository.countWorkouts()).toBe(0);
  });

  it('prunes orphaned rows rather than restoring dangling references', async () => {
    await seedHistory();
    const exported = await repository.exportAll();
    exported.data.workoutSets.push({
      ...exported.data.workoutSets[0]!,
      id: 'orphan-set',
      workoutExerciseId: 'missing',
    });

    const validation = validateBackup(exported);
    expect(validation.errors[0]).toContain('reference a missing');

    const pruned = pruneOrphans(validation.payload!);
    expect(pruned.data.workoutSets.some((set) => set.id === 'orphan-set')).toBe(false);
  });
});
