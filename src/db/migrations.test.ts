import Dexie from 'dexie';
import { beforeEach, describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA_VERSION, RepForgeDatabase } from './schema';
import { DexieRepository } from './dexieRepository';

/**
 * Migration coverage. Each case builds a database at an older schema version using the
 * historical `stores()` definition, writes representative rows, then opens the current
 * RepForgeDatabase over it and asserts the upgrade ran without losing data.
 */

let dbName = '';

beforeEach(() => {
  dbName = `repforge-migration-${Math.random().toString(36).slice(2)}`;
});

/** The v1 schema exactly as it shipped. */
function openV1(name: string): Dexie {
  const db = new Dexie(name);
  db.version(1).stores({
    exercises: 'id, name, primaryMuscleGroup, equipment, isCustom, isArchived',
    templates: 'id, name, order, isArchived',
    templateExercises: 'id, templateId, exerciseId, order',
    workouts: 'id, status, startedAt, localDate, templateId, importFingerprint',
    workoutExercises: 'id, workoutId, exerciseId, order',
    workoutSets: 'id, workoutId, workoutExerciseId, order',
    measurements: 'id, metric, recordedAt, [metric+recordedAt]',
    settings: 'id',
    barProfiles: 'id, isDefault',
    plateInventories: 'id, isDefault',
    timers: 'id',
    importJobs: 'id, startedAt',
    importIssues: 'id, jobId',
    meta: 'id',
  });
  return db;
}

describe('schema migrations', () => {
  it('upgrades a v1 database to the current version without losing rows', async () => {
    const legacy = openV1(dbName);
    await legacy.open();
    await legacy.table('workouts').put({
      id: 'w1',
      name: 'Legacy session',
      status: 'completed',
      startedAt: '2026-01-01T10:00:00.000Z',
      endedAt: '2026-01-01T11:00:00.000Z',
      localDate: '2026-01-01',
      tzOffsetMinutes: 0,
      createdAt: '2026-01-01T10:00:00.000Z',
      // pausedSeconds and updatedAt did not exist in v1
    });
    await legacy.table('workoutExercises').put({
      id: 'we1',
      workoutId: 'w1',
      exerciseId: 'ex1',
      order: 0,
      exerciseNameSnapshot: 'Bench Press',
      primaryMuscleGroupSnapshot: 'chest',
      secondaryMuscleGroupsSnapshot: ['triceps'],
      equipmentSnapshot: 'barbell',
      trackingTypeSnapshot: 'weight_reps',
      restSeconds: 120,
    });
    await legacy.table('workoutSets').put({
      id: 's1',
      workoutId: 'w1',
      workoutExerciseId: 'we1',
      order: 0,
      setType: 'working',
      weightG: 100_000,
      reps: 5,
      isCompleted: true,
    });
    legacy.close();

    const db = new RepForgeDatabase(dbName);
    await db.open();

    expect(db.verno).toBe(CURRENT_SCHEMA_VERSION);
    const workout = await db.workouts.get('w1');
    expect(workout?.name).toBe('Legacy session');
    // The v2 upgrade backfills the fields added after v1.
    expect(workout?.pausedSeconds).toBe(0);
    expect(workout?.updatedAt).toBe('2026-01-01T10:00:00.000Z');
    expect(await db.workoutSets.count()).toBe(1);

    // The index added in v2 must be queryable.
    const viaCompound = await db.workoutExercises
      .where('[exerciseId+workoutId]')
      .equals(['ex1', 'w1'])
      .toArray();
    expect(viaCompound).toHaveLength(1);
    db.close();
  });

  it('seeds a fresh database exactly once and keeps user edits on re-initialise', async () => {
    const db = new RepForgeDatabase(dbName);
    const repository = new DexieRepository(db);

    await repository.initialise();
    const seededCount = await db.exercises.count();
    expect(seededCount).toBeGreaterThan(50);
    expect(await db.barProfiles.count()).toBeGreaterThan(0);
    expect(await db.plateInventories.count()).toBeGreaterThan(0);
    expect((await db.meta.get('meta'))?.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);

    await repository.updateExercise('seed-back-squat', { name: 'Back Squat (high bar)' });
    await repository.setExerciseArchived('seed-front-squat', true);

    await repository.initialise();

    expect(await db.exercises.count()).toBe(seededCount);
    expect((await db.exercises.get('seed-back-squat'))?.name).toBe('Back Squat (high bar)');
    expect((await db.exercises.get('seed-front-squat'))?.isArchived).toBe(true);
    db.close();
  });

  it('restores an interrupted active workout after a simulated termination', async () => {
    const db = new RepForgeDatabase(dbName);
    const repository = new DexieRepository(db);
    await repository.initialise();

    const detail = await repository.startWorkout({ name: 'Interrupted' });
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

    // Simulate the browser being killed: close the connection and reopen from scratch.
    db.close();

    const reopened = new RepForgeDatabase(dbName);
    const reopenedRepository = new DexieRepository(reopened);
    await reopenedRepository.initialise();

    const active = await reopenedRepository.getActiveWorkout();
    expect(active?.workout.name).toBe('Interrupted');
    expect(active?.exercises).toHaveLength(1);
    expect(active?.exercises[0]?.sets[0]?.isCompleted).toBe(true);
    reopened.close();
  });
});
