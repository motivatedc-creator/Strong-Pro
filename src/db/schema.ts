import Dexie, { type Table } from 'dexie';
import type {
  AppSettings,
  BarProfile,
  BodyMeasurement,
  DbMeta,
  Exercise,
  ImportIssue,
  ImportJob,
  PlateInventory,
  Template,
  TemplateExercise,
  TimerState,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/types';

/**
 * RepForge local database (IndexedDB via Dexie).
 *
 * Versioning policy: every schema change adds a new `version(n).stores({...}).upgrade(...)`
 * block below and bumps CURRENT_SCHEMA_VERSION. Upgrades are never destructive — they
 * backfill fields and leave historical rows intact. Migrations are covered by
 * src/db/migrations.test.ts.
 *
 * Index choices are driven by the hot queries:
 *  - workouts by status (resume an active session), by localDate/startedAt (history, analytics)
 *  - workoutExercises by workoutId and by exerciseId (exercise history)
 *  - workoutSets by workoutExerciseId and by workoutId
 *  - measurements by [metric+recordedAt] (per-metric trend charts)
 */

export const CURRENT_SCHEMA_VERSION = 2;

export class RepForgeDatabase extends Dexie {
  exercises!: Table<Exercise, string>;
  templates!: Table<Template, string>;
  templateExercises!: Table<TemplateExercise, string>;
  workouts!: Table<Workout, string>;
  workoutExercises!: Table<WorkoutExercise, string>;
  workoutSets!: Table<WorkoutSet, string>;
  measurements!: Table<BodyMeasurement, string>;
  settings!: Table<AppSettings, string>;
  barProfiles!: Table<BarProfile, string>;
  plateInventories!: Table<PlateInventory, string>;
  timers!: Table<TimerState, string>;
  importJobs!: Table<ImportJob, string>;
  importIssues!: Table<ImportIssue, string>;
  meta!: Table<DbMeta, string>;

  constructor(name = 'repforge') {
    super(name);

    // v1 — initial schema.
    this.version(1).stores({
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

    // v2 — adds the compound [exerciseId+workoutId] index used by exercise history and
    // analytics, plus backfills `pausedSeconds` on workouts created before pause support.
    this.version(2)
      .stores({
        workoutExercises: 'id, workoutId, exerciseId, order, [exerciseId+workoutId]',
        workouts: 'id, status, startedAt, localDate, templateId, importFingerprint, updatedAt',
      })
      .upgrade(async (tx) => {
        await tx
          .table<Workout, string>('workouts')
          .toCollection()
          .modify((workout) => {
            if (typeof workout.pausedSeconds !== 'number') workout.pausedSeconds = 0;
            if (!workout.updatedAt) workout.updatedAt = workout.startedAt;
          });
      });
  }
}

let instance: RepForgeDatabase | null = null;

export function getDb(): RepForgeDatabase {
  if (!instance) instance = new RepForgeDatabase();
  return instance;
}

/** Test/preview hook: point the app at a dedicated database instance. */
export function setDb(db: RepForgeDatabase | null): void {
  instance = db;
}
