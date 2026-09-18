import { uuid } from '@/domain/ids';
import { nowIso } from '@/domain/time';
import type {
  BodyMeasurement,
  ImportIssue,
  ImportJob,
  MeasurementMetric,
  TimerState,
  UUID,
  Workout,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/types';
import {
  BACKUP_FORMAT_VERSION,
  type BackupPayload,
  type ImportBatch,
  type MergeResult,
  type RepForgeRepository,
} from './repository';
import { APP_VERSION } from './dexieRepository.core';
import { DexieRepositoryWorkouts2 } from './dexieRepository.workouts2';

/** Dexie-backed implementation of the RepForge storage boundary. */
export class DexieRepository extends DexieRepositoryWorkouts2 implements RepForgeRepository {
  // ------------------------------------------------------------ measurements

  async listMeasurements(metric?: MeasurementMetric): Promise<BodyMeasurement[]> {
    const rows = metric
      ? await this.db.measurements.where('metric').equals(metric).toArray()
      : await this.db.measurements.toArray();
    return rows.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt));
  }

  async addMeasurement(
    input: Omit<BodyMeasurement, 'id' | 'createdAt' | 'updatedAt'> & { id?: UUID },
  ): Promise<BodyMeasurement> {
    const now = nowIso();
    const measurement: BodyMeasurement = {
      ...input,
      id: input.id ?? uuid(),
      createdAt: now,
      updatedAt: now,
    };
    await this.db.measurements.put(measurement);
    return measurement;
  }

  async updateMeasurement(id: UUID, patch: Partial<BodyMeasurement>): Promise<void> {
    await this.db.measurements.update(id, { ...patch, updatedAt: nowIso() });
  }

  async deleteMeasurement(id: UUID): Promise<void> {
    await this.db.measurements.delete(id);
  }

  // -------------------------------------------------------------- rest timer

  getTimer(): Promise<TimerState | undefined> {
    return this.db.timers.get('rest-timer');
  }

  async setTimer(state: TimerState | null): Promise<void> {
    if (!state) await this.db.timers.delete('rest-timer');
    else await this.db.timers.put({ ...state, id: 'rest-timer' });
  }

  // ------------------------------------------------------------------ import

  /**
   * All-or-nothing import write. If anything throws (or the caller cancels before this
   * point) the database is left exactly as it was — there is no partial import state.
   */
  async importBatch(batch: ImportBatch): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.exercises,
        this.db.workouts,
        this.db.workoutExercises,
        this.db.workoutSets,
        this.db.importJobs,
        this.db.importIssues,
      ],
      async () => {
        if (batch.newExercises.length > 0) await this.db.exercises.bulkPut(batch.newExercises);
        for (const detail of batch.workouts) {
          await this.db.workouts.put(detail.workout);
          await this.db.workoutExercises.bulkPut(detail.exercises.map((entry) => entry.exercise));
          const sets = detail.exercises.flatMap((entry) => entry.sets);
          if (sets.length > 0) await this.db.workoutSets.bulkPut(sets);
        }
        await this.db.importJobs.put(batch.job);
        if (batch.issues.length > 0) await this.db.importIssues.bulkPut(batch.issues);
      },
    );
  }

  listImportJobs(): Promise<ImportJob[]> {
    return this.db.importJobs
      .toArray()
      .then((rows) => rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
  }

  getImportIssues(jobId: UUID): Promise<ImportIssue[]> {
    return this.db.importIssues.where('jobId').equals(jobId).toArray();
  }

  findWorkoutByFingerprint(fingerprint: string): Promise<Workout | undefined> {
    return this.db.workouts.where('importFingerprint').equals(fingerprint).first();
  }

  // ----------------------------------------------------------- data transfer

  async exportAll(): Promise<BackupPayload> {
    const [
      exercises,
      templates,
      templateExercises,
      workouts,
      workoutExercises,
      workoutSets,
      measurements,
      barProfiles,
      plateInventories,
      settings,
      importJobs,
    ] = await Promise.all([
      this.db.exercises.toArray(),
      this.db.templates.toArray(),
      this.db.templateExercises.toArray(),
      this.db.workouts.where('status').notEqual('discarded').toArray(),
      this.db.workoutExercises.toArray(),
      this.db.workoutSets.toArray(),
      this.db.measurements.toArray(),
      this.db.barProfiles.toArray(),
      this.db.plateInventories.toArray(),
      this.getSettings(),
      this.db.importJobs.toArray(),
    ]);

    return {
      format: 'repforge-backup',
      version: BACKUP_FORMAT_VERSION,
      exportedAt: nowIso(),
      appVersion: APP_VERSION,
      data: {
        exercises,
        templates,
        templateExercises,
        workouts,
        workoutExercises,
        workoutSets,
        measurements,
        barProfiles,
        plateInventories,
        settings,
        importJobs,
      },
    };
  }

  async replaceAll(payload: BackupPayload): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await Promise.all(
        [
          this.db.exercises,
          this.db.templates,
          this.db.templateExercises,
          this.db.workouts,
          this.db.workoutExercises,
          this.db.workoutSets,
          this.db.measurements,
          this.db.barProfiles,
          this.db.plateInventories,
          this.db.importJobs,
          this.db.importIssues,
          this.db.timers,
        ].map((table) => table.clear()),
      );

      const { data } = payload;
      await this.db.exercises.bulkPut(data.exercises);
      await this.db.templates.bulkPut(data.templates);
      await this.db.templateExercises.bulkPut(data.templateExercises);
      await this.db.workouts.bulkPut(data.workouts);
      await this.db.workoutExercises.bulkPut(data.workoutExercises);
      await this.db.workoutSets.bulkPut(data.workoutSets);
      await this.db.measurements.bulkPut(data.measurements);
      if (data.barProfiles.length > 0) await this.db.barProfiles.bulkPut(data.barProfiles);
      if (data.plateInventories.length > 0)
        await this.db.plateInventories.bulkPut(data.plateInventories);
      if (data.importJobs.length > 0) await this.db.importJobs.bulkPut(data.importJobs);
      if (data.settings) await this.db.settings.put({ ...data.settings, id: 'settings' });
    });
  }

  async mergeBackup(payload: BackupPayload): Promise<MergeResult> {
    const result: MergeResult = {
      workoutsAdded: 0,
      workoutsSkipped: 0,
      exercisesAdded: 0,
      templatesAdded: 0,
      measurementsAdded: 0,
    };

    await this.db.transaction('rw', this.db.tables, async () => {
      const { data } = payload;

      const existingExercises = new Set(
        (await this.db.exercises.toCollection().primaryKeys()) as string[],
      );
      const newExercises = data.exercises.filter((exercise) => !existingExercises.has(exercise.id));
      if (newExercises.length > 0) await this.db.exercises.bulkPut(newExercises);
      result.exercisesAdded = newExercises.length;

      const existingTemplates = new Set(
        (await this.db.templates.toCollection().primaryKeys()) as string[],
      );
      const newTemplates = data.templates.filter((template) => !existingTemplates.has(template.id));
      if (newTemplates.length > 0) {
        await this.db.templates.bulkPut(newTemplates);
        const ids = new Set(newTemplates.map((template) => template.id));
        await this.db.templateExercises.bulkPut(
          data.templateExercises.filter((row) => ids.has(row.templateId)),
        );
      }
      result.templatesAdded = newTemplates.length;

      const existingWorkouts = new Set(
        (await this.db.workouts.toCollection().primaryKeys()) as string[],
      );
      const newWorkouts = data.workouts.filter((workout) => !existingWorkouts.has(workout.id));
      result.workoutsSkipped = data.workouts.length - newWorkouts.length;
      if (newWorkouts.length > 0) {
        const ids = new Set(newWorkouts.map((workout) => workout.id));
        await this.db.workouts.bulkPut(newWorkouts);
        await this.db.workoutExercises.bulkPut(
          data.workoutExercises.filter((row) => ids.has(row.workoutId)),
        );
        await this.db.workoutSets.bulkPut(data.workoutSets.filter((row) => ids.has(row.workoutId)));
      }
      result.workoutsAdded = newWorkouts.length;

      const existingMeasurements = new Set(
        (await this.db.measurements.toCollection().primaryKeys()) as string[],
      );
      const newMeasurements = data.measurements.filter((row) => !existingMeasurements.has(row.id));
      if (newMeasurements.length > 0) await this.db.measurements.bulkPut(newMeasurements);
      result.measurementsAdded = newMeasurements.length;
    });

    return result;
  }

  async clearAllUserData(): Promise<void> {
    await this.db.transaction('rw', this.db.tables, async () => {
      await Promise.all(this.db.tables.map((table) => table.clear()));
    });
    await this.initialise();
  }
}
