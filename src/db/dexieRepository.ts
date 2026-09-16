import { uuid } from '@/domain/ids';
import { localDateOf, nowIso, tzOffsetMinutes } from '@/domain/time';
import { defaultQuickIncrementG } from '@/domain/units';
import type {
  AppSettings,
  BarProfile,
  BodyMeasurement,
  Exercise,
  ImportIssue,
  ImportJob,
  MeasurementMetric,
  PlateInventory,
  Template,
  TemplateExercise,
  TimerState,
  UUID,
  Workout,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/types';
import type { SetWithContext } from '@/domain/records';
import { CURRENT_SCHEMA_VERSION, getDb, type RepForgeDatabase } from './schema';
import {
  SEED_LIBRARY_VERSION,
  seedBarProfiles,
  seedExercises,
  seedPlateInventories,
} from './seedData';
import {
  BACKUP_FORMAT_VERSION,
  type BackupPayload,
  type ImportBatch,
  type MergeResult,
  type NewSetInput,
  type RepForgeRepository,
  type StartWorkoutInput,
  type TemplateDetail,
  type WorkoutQuery,
} from './repository';

export const APP_VERSION = '1.0.0';

export function defaultSettings(now: string): AppSettings {
  return {
    id: 'settings',
    unitSystem: 'metric',
    oneRepMaxFormula: 'epley',
    intensityMode: 'rpe',
    quickIncrementG: defaultQuickIncrementG('metric'),
    defaultRestSeconds: 120,
    restTimerAutoStart: true,
    restTimerSound: true,
    restTimerVibrate: true,
    restTimerNotification: false,
    excludeWarmupsFromAnalytics: true,
    secondaryMuscleCredit: 0.5,
    defaultBarProfileId: 'seed-bar-olympic-kg',
    defaultPlateInventoryId: 'seed-plates-kg',
    themeMode: 'system',
    accentTheme: 'ember',
    appIcon: 'default',
    updatedAt: now,
  };
}

/** Dexie-backed implementation of the RepForge storage boundary. */
export class DexieRepository implements RepForgeRepository {
  constructor(private readonly db: RepForgeDatabase = getDb()) {}

  async initialise(): Promise<void> {
    const now = nowIso();
    await this.db.open();
    await this.db.transaction(
      'rw',
      [this.db.meta, this.db.exercises, this.db.settings, this.db.barProfiles, this.db.plateInventories],
      async () => {
        const meta = await this.db.meta.get('meta');
        if (!meta) {
          await this.db.meta.put({
            id: 'meta',
            schemaVersion: CURRENT_SCHEMA_VERSION,
            createdAt: now,
            updatedAt: now,
            seededLibraryVersion: 0,
          });
        }

        const settings = await this.db.settings.get('settings');
        if (!settings) await this.db.settings.put(defaultSettings(now));

        const current = await this.db.meta.get('meta');
        if ((current?.seededLibraryVersion ?? 0) < SEED_LIBRARY_VERSION) {
          // Seeding is additive: a user who edited or archived a seeded exercise keeps
          // their version, and custom exercises are never touched.
          const existing = new Set((await this.db.exercises.toCollection().primaryKeys()) as string[]);
          const missing = seedExercises(now).filter((exercise) => !existing.has(exercise.id));
          if (missing.length > 0) await this.db.exercises.bulkPut(missing);
          await this.db.meta.update('meta', {
            seededLibraryVersion: SEED_LIBRARY_VERSION,
            schemaVersion: CURRENT_SCHEMA_VERSION,
            updatedAt: now,
          });
        }

        if ((await this.db.barProfiles.count()) === 0) {
          await this.db.barProfiles.bulkPut(seedBarProfiles());
        }
        if ((await this.db.plateInventories.count()) === 0) {
          await this.db.plateInventories.bulkPut(seedPlateInventories());
        }
      },
    );
  }

  // ---------------------------------------------------------------- settings

  async getSettings(): Promise<AppSettings> {
    const settings = await this.db.settings.get('settings');
    if (settings) return settings;
    const created = defaultSettings(nowIso());
    await this.db.settings.put(created);
    return created;
  }

  async updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const next: AppSettings = { ...current, ...patch, id: 'settings', updatedAt: nowIso() };
    await this.db.settings.put(next);
    return next;
  }

  listBarProfiles(): Promise<BarProfile[]> {
    return this.db.barProfiles.toArray().then((rows) => rows.sort((a, b) => a.weightG - b.weightG));
  }

  async saveBarProfile(profile: BarProfile): Promise<void> {
    await this.db.transaction('rw', this.db.barProfiles, async () => {
      if (profile.isDefault) {
        await this.db.barProfiles.toCollection().modify((row) => {
          row.isDefault = false;
        });
      }
      await this.db.barProfiles.put(profile);
    });
  }

  async deleteBarProfile(id: UUID): Promise<void> {
    await this.db.barProfiles.delete(id);
  }

  listPlateInventories(): Promise<PlateInventory[]> {
    return this.db.plateInventories.toArray();
  }

  async savePlateInventory(inventory: PlateInventory): Promise<void> {
    await this.db.transaction('rw', this.db.plateInventories, async () => {
      if (inventory.isDefault) {
        await this.db.plateInventories.toCollection().modify((row) => {
          row.isDefault = false;
        });
      }
      await this.db.plateInventories.put(inventory);
    });
  }

  async deletePlateInventory(id: UUID): Promise<void> {
    await this.db.plateInventories.delete(id);
  }

  // --------------------------------------------------------------- exercises

  async listExercises(options: { includeArchived?: boolean } = {}): Promise<Exercise[]> {
    const all = await this.db.exercises.toArray();
    const filtered = options.includeArchived ? all : all.filter((exercise) => !exercise.isArchived);
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }

  getExercise(id: UUID): Promise<Exercise | undefined> {
    return this.db.exercises.get(id);
  }

  async createExercise(
    input: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt' | 'isCustom'> & { id?: UUID },
  ): Promise<Exercise> {
    const now = nowIso();
    const exercise: Exercise = {
      ...input,
      id: input.id ?? uuid(),
      isCustom: true,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.exercises.put(exercise);
    return exercise;
  }

  async updateExercise(id: UUID, patch: Partial<Exercise>): Promise<Exercise> {
    const existing = await this.db.exercises.get(id);
    if (!existing) throw new Error(`Exercise ${id} not found`);
    const next: Exercise = { ...existing, ...patch, id, updatedAt: nowIso() };
    await this.db.exercises.put(next);
    return next;
  }

  async setExerciseArchived(id: UUID, archived: boolean): Promise<void> {
    // Archiving never touches history — snapshots on workout exercises keep it readable.
    await this.db.exercises.update(id, { isArchived: archived, updatedAt: nowIso() });
  }

  async deleteExercise(id: UUID): Promise<{ deleted: boolean; reason?: string }> {
    const exercise = await this.db.exercises.get(id);
    if (!exercise) return { deleted: false, reason: 'Exercise not found.' };
    if (!exercise.isCustom) {
      return { deleted: false, reason: 'Library exercises can be archived but not deleted.' };
    }
    const usedInHistory = await this.db.workoutExercises.where('exerciseId').equals(id).count();
    if (usedInHistory > 0) {
      return {
        deleted: false,
        reason: `Used by ${usedInHistory} logged exercise${usedInHistory === 1 ? '' : 's'}. Archive it instead to keep your history intact.`,
      };
    }
    await this.db.transaction('rw', [this.db.exercises, this.db.templateExercises], async () => {
      await this.db.templateExercises.where('exerciseId').equals(id).delete();
      await this.db.exercises.delete(id);
    });
    return { deleted: true };
  }

  // --------------------------------------------------------------- templates

  async listTemplates(options: { includeArchived?: boolean } = {}): Promise<Template[]> {
    const all = await this.db.templates.toArray();
    const filtered = options.includeArchived ? all : all.filter((template) => !template.isArchived);
    return filtered.sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
  }

  async getTemplateDetail(id: UUID): Promise<TemplateDetail | undefined> {
    const template = await this.db.templates.get(id);
    if (!template) return undefined;
    const templateExercises = (await this.db.templateExercises.where('templateId').equals(id).toArray()).sort(
      (a, b) => a.order - b.order,
    );
    const exercises = await this.db.exercises.bulkGet(templateExercises.map((t) => t.exerciseId));
    return {
      template,
      exercises: templateExercises.map((templateExercise, index) => ({
        templateExercise,
        exercise: exercises[index] ?? undefined,
      })),
    };
  }

  async createTemplate(name: string, notes?: string): Promise<Template> {
    const now = nowIso();
    const count = await this.db.templates.count();
    const template: Template = {
      id: uuid(),
      name,
      notes,
      order: count,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await this.db.templates.put(template);
    return template;
  }

  async saveTemplate(template: Template, exercises: TemplateExercise[]): Promise<void> {
    await this.db.transaction('rw', [this.db.templates, this.db.templateExercises], async () => {
      await this.db.templates.put({ ...template, updatedAt: nowIso() });
      await this.db.templateExercises.where('templateId').equals(template.id).delete();
      if (exercises.length > 0) {
        await this.db.templateExercises.bulkPut(
          exercises.map((exercise, index) => ({ ...exercise, templateId: template.id, order: index })),
        );
      }
    });
  }

  async duplicateTemplate(id: UUID): Promise<Template | undefined> {
    const detail = await this.getTemplateDetail(id);
    if (!detail) return undefined;
    const now = nowIso();
    const count = await this.db.templates.count();
    const copy: Template = {
      ...detail.template,
      id: uuid(),
      name: `${detail.template.name} (copy)`,
      order: count,
      createdAt: now,
      updatedAt: now,
    };
    await this.saveTemplate(
      copy,
      detail.exercises.map(({ templateExercise }) => ({
        ...templateExercise,
        id: uuid(),
        templateId: copy.id,
      })),
    );
    return copy;
  }

  async setTemplateArchived(id: UUID, archived: boolean): Promise<void> {
    await this.db.templates.update(id, { isArchived: archived, updatedAt: nowIso() });
  }

  async deleteTemplate(id: UUID): Promise<void> {
    // Completed workouts keep their templateId as a historical reference; deleting the
    // template never deletes the workouts that came from it.
    await this.db.transaction('rw', [this.db.templates, this.db.templateExercises], async () => {
      await this.db.templateExercises.where('templateId').equals(id).delete();
      await this.db.templates.delete(id);
    });
  }

  async reorderTemplates(orderedIds: UUID[]): Promise<void> {
    await this.db.transaction('rw', this.db.templates, async () => {
      await Promise.all(
        orderedIds.map((id, index) => this.db.templates.update(id, { order: index, updatedAt: nowIso() })),
      );
    });
  }

  // ---------------------------------------------------------------- workouts

  async getActiveWorkout(): Promise<WorkoutDetail | undefined> {
    const active = await this.db.workouts.where('status').equals('active').first();
    if (!active) return undefined;
    return this.getWorkoutDetail(active.id);
  }

  async startWorkout(input: StartWorkoutInput): Promise<WorkoutDetail> {
    const now = nowIso();
    const date = new Date();
    const workoutId = uuid();

    await this.db.transaction(
      'rw',
      [
        this.db.workouts,
        this.db.workoutExercises,
        this.db.workoutSets,
        this.db.templates,
        this.db.templateExercises,
        this.db.exercises,
      ],
      async () => {
        // Guard against a double tap creating two active sessions.
        const existing = await this.db.workouts.where('status').equals('active').first();
        if (existing) throw new ActiveWorkoutExistsError(existing.id);

        let name = input.name?.trim() || defaultWorkoutName(date);
        const template = input.templateId ? await this.db.templates.get(input.templateId) : undefined;
        if (template && !input.name) name = template.name;

        const workout: Workout = {
          id: workoutId,
          templateId: template?.id,
          name,
          status: 'active',
          startedAt: now,
          localDate: localDateOf(date),
          tzOffsetMinutes: tzOffsetMinutes(date),
          pausedSeconds: 0,
          notes: template?.notes,
          createdAt: now,
          updatedAt: now,
        };
        await this.db.workouts.put(workout);

        if (template) {
          const templateExercises = (
            await this.db.templateExercises.where('templateId').equals(template.id).toArray()
          ).sort((a, b) => a.order - b.order);
          const exercises = await this.db.exercises.bulkGet(templateExercises.map((t) => t.exerciseId));

          const workoutExercises: WorkoutExercise[] = [];
          const sets: WorkoutSet[] = [];

          templateExercises.forEach((templateExercise, index) => {
            const exercise = exercises[index];
            if (!exercise) return;
            const workoutExercise = snapshotExercise(workoutId, exercise, workoutExercises.length, {
              restSeconds: templateExercise.restSeconds,
              notes: templateExercise.notes,
              supersetGroup: templateExercise.supersetGroup,
            });
            workoutExercises.push(workoutExercise);
            for (let i = 0; i < Math.max(1, templateExercise.targetSets); i += 1) {
              sets.push({
                id: uuid(),
                workoutId,
                workoutExerciseId: workoutExercise.id,
                order: i,
                setType: templateExercise.defaultSetType ?? 'working',
                reps: templateExercise.targetRepMin,
                rpe: templateExercise.targetRpe,
                rir: templateExercise.targetRir,
                isCompleted: false,
              });
            }
          });

          if (workoutExercises.length > 0) await this.db.workoutExercises.bulkPut(workoutExercises);
          if (sets.length > 0) await this.db.workoutSets.bulkPut(sets);
        }
      },
    );

    const detail = await this.getWorkoutDetail(workoutId);
    if (!detail) throw new Error('Failed to create workout');
    return detail;
  }

  async getWorkoutDetail(id: UUID): Promise<WorkoutDetail | undefined> {
    const workout = await this.db.workouts.get(id);
    if (!workout) return undefined;
    const exercises = (await this.db.workoutExercises.where('workoutId').equals(id).toArray()).sort(
      (a, b) => a.order - b.order,
    );
    const sets = await this.db.workoutSets.where('workoutId').equals(id).toArray();
    return {
      workout,
      exercises: exercises.map((exercise) => ({
        exercise,
        sets: sets
          .filter((set) => set.workoutExerciseId === exercise.id)
          .sort((a, b) => a.order - b.order),
      })),
    };
  }

  async listWorkouts(query: WorkoutQuery = {}): Promise<Workout[]> {
    const rows = await this.queryWorkouts(query);
    const offset = query.offset ?? 0;
    const limit = query.limit ?? rows.length;
    return rows.slice(offset, offset + limit);
  }

  async countWorkouts(query: WorkoutQuery = {}): Promise<number> {
    return (await this.queryWorkouts(query)).length;
  }

  private async queryWorkouts(query: WorkoutQuery): Promise<Workout[]> {
    let rows = await this.db.workouts.where('status').equals('completed').toArray();

    if (query.from) rows = rows.filter((workout) => workout.startedAt >= query.from!);
    if (query.to) rows = rows.filter((workout) => workout.startedAt <= query.to!);

    if (query.exerciseId) {
      const matching = new Set(
        (await this.db.workoutExercises.where('exerciseId').equals(query.exerciseId).toArray()).map(
          (row) => row.workoutId,
        ),
      );
      rows = rows.filter((workout) => matching.has(workout.id));
    }

    const search = query.search?.trim().toLowerCase();
    if (search) {
      const exerciseMatches = await this.db.workoutExercises.toArray();
      const workoutIds = new Set(
        exerciseMatches
          .filter((row) => row.exerciseNameSnapshot.toLowerCase().includes(search))
          .map((row) => row.workoutId),
      );
      rows = rows.filter(
        (workout) =>
          workout.name.toLowerCase().includes(search) ||
          (workout.notes ?? '').toLowerCase().includes(search) ||
          workoutIds.has(workout.id),
      );
    }

    return rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }

  async updateWorkout(id: UUID, patch: Partial<Workout>): Promise<void> {
    await this.db.workouts.update(id, { ...patch, updatedAt: nowIso() });
  }

  async completeWorkout(id: UUID): Promise<void> {
    const now = nowIso();
    await this.db.transaction('rw', [this.db.workouts, this.db.workoutSets, this.db.timers], async () => {
      const workout = await this.db.workouts.get(id);
      // Idempotent: a duplicate tap on "Finish" must not produce a second completion.
      if (!workout || workout.status === 'completed') return;
      // Incomplete sets are dropped rather than silently counted as performed work.
      const sets = await this.db.workoutSets.where('workoutId').equals(id).toArray();
      const incomplete = sets.filter((set) => !set.isCompleted).map((set) => set.id);
      if (incomplete.length > 0) await this.db.workoutSets.bulkDelete(incomplete);
      await this.db.workouts.update(id, { status: 'completed', endedAt: now, updatedAt: now });
      await this.db.timers.delete('rest-timer');
    });
  }

  async discardWorkout(id: UUID): Promise<void> {
    await this.deleteWorkout(id);
    await this.db.timers.delete('rest-timer');
  }

  async deleteWorkout(id: UUID): Promise<void> {
    await this.db.transaction(
      'rw',
      [this.db.workouts, this.db.workoutExercises, this.db.workoutSets],
      async () => {
        await this.db.workoutSets.where('workoutId').equals(id).delete();
        await this.db.workoutExercises.where('workoutId').equals(id).delete();
        await this.db.workouts.delete(id);
      },
    );
  }

  async addExerciseToWorkout(
    workoutId: UUID,
    exerciseId: UUID,
    options: { supersetGroup?: string } = {},
  ): Promise<WorkoutExercise> {
    const exercise = await this.db.exercises.get(exerciseId);
    if (!exercise) throw new Error(`Exercise ${exerciseId} not found`);
    const settings = await this.getSettings();
    const count = await this.db.workoutExercises.where('workoutId').equals(workoutId).count();
    const workoutExercise = snapshotExercise(workoutId, exercise, count, {
      restSeconds: settings.defaultRestSeconds,
      supersetGroup: options.supersetGroup,
    });
    await this.db.workoutExercises.put(workoutExercise);
    await this.updateWorkout(workoutId, {});
    return workoutExercise;
  }

  async removeWorkoutExercise(workoutExerciseId: UUID): Promise<void> {
    await this.db.transaction('rw', [this.db.workoutExercises, this.db.workoutSets], async () => {
      const row = await this.db.workoutExercises.get(workoutExerciseId);
      if (!row) return;
      await this.db.workoutSets.where('workoutExerciseId').equals(workoutExerciseId).delete();
      await this.db.workoutExercises.delete(workoutExerciseId);
      const remaining = (await this.db.workoutExercises.where('workoutId').equals(row.workoutId).toArray()).sort(
        (a, b) => a.order - b.order,
      );
      await Promise.all(
        remaining.map((exercise, index) => this.db.workoutExercises.update(exercise.id, { order: index })),
      );
    });
  }

  async replaceWorkoutExercise(workoutExerciseId: UUID, newExerciseId: UUID): Promise<void> {
    const [row, exercise] = await Promise.all([
      this.db.workoutExercises.get(workoutExerciseId),
      this.db.exercises.get(newExerciseId),
    ]);
    if (!row || !exercise) return;
    await this.db.workoutExercises.update(workoutExerciseId, {
      exerciseId: exercise.id,
      exerciseNameSnapshot: exercise.name,
      primaryMuscleGroupSnapshot: exercise.primaryMuscleGroup,
      secondaryMuscleGroupsSnapshot: exercise.secondaryMuscleGroups,
      equipmentSnapshot: exercise.equipment,
      trackingTypeSnapshot: exercise.trackingType,
    });
  }

  async reorderWorkoutExercises(workoutId: UUID, orderedIds: UUID[]): Promise<void> {
    await this.db.transaction('rw', this.db.workoutExercises, async () => {
      await Promise.all(
        orderedIds.map((id, index) => this.db.workoutExercises.update(id, { order: index })),
      );
    });
    await this.updateWorkout(workoutId, {});
  }

  async updateWorkoutExercise(id: UUID, patch: Partial<WorkoutExercise>): Promise<void> {
    await this.db.workoutExercises.update(id, patch);
  }

  async addSet(workoutId: UUID, input: NewSetInput): Promise<WorkoutSet> {
    const [set] = await this.addSets(workoutId, [input]);
    if (!set) throw new Error('Failed to add set');
    return set;
  }

  async addSets(workoutId: UUID, inputs: NewSetInput[]): Promise<WorkoutSet[]> {
    const created: WorkoutSet[] = [];
    await this.db.transaction('rw', [this.db.workoutSets, this.db.workouts], async () => {
      for (const input of inputs) {
        const siblings = (
          await this.db.workoutSets.where('workoutExerciseId').equals(input.workoutExerciseId).toArray()
        ).sort((a, b) => a.order - b.order);

        const insertIndex = input.afterSetId
          ? siblings.findIndex((set) => set.id === input.afterSetId) + 1
          : siblings.length;

        const set: WorkoutSet = {
          id: uuid(),
          workoutId,
          workoutExerciseId: input.workoutExerciseId,
          order: insertIndex,
          setType: input.setType ?? 'working',
          weightG: input.weightG,
          reps: input.reps,
          rpe: input.rpe,
          rir: input.rir,
          durationSeconds: input.durationSeconds,
          distanceM: input.distanceM,
          isCompleted: input.isCompleted ?? false,
          completedAt: input.isCompleted ? nowIso() : undefined,
          notes: input.notes,
        };

        const shifted = siblings.slice(insertIndex);
        await Promise.all(
          shifted.map((sibling, index) =>
            this.db.workoutSets.update(sibling.id, { order: insertIndex + index + 1 }),
          ),
        );
        await this.db.workoutSets.put(set);
        created.push(set);
      }
      await this.db.workouts.update(workoutId, { updatedAt: nowIso() });
    });
    return created;
  }

  async updateSet(id: UUID, patch: Partial<WorkoutSet>): Promise<void> {
    const next: Partial<WorkoutSet> = { ...patch };
    if (patch.isCompleted === true && !patch.completedAt) next.completedAt = nowIso();
    if (patch.isCompleted === false) next.completedAt = undefined;
    await this.db.workoutSets.update(id, next);
  }

  async deleteSet(id: UUID): Promise<void> {
    await this.db.transaction('rw', this.db.workoutSets, async () => {
      const set = await this.db.workoutSets.get(id);
      if (!set) return;
      await this.db.workoutSets.delete(id);
      const siblings = (
        await this.db.workoutSets.where('workoutExerciseId').equals(set.workoutExerciseId).toArray()
      ).sort((a, b) => a.order - b.order);
      await Promise.all(
        siblings.map((sibling, index) => this.db.workoutSets.update(sibling.id, { order: index })),
      );
    });
  }

  /** Re-inserts a deleted set verbatim — the undo path for an accidental delete. */
  async restoreSet(set: WorkoutSet): Promise<void> {
    await this.db.workoutSets.put(set);
  }

  async getPreviousSetsForExercise(exerciseId: UUID, beforeWorkoutId?: UUID): Promise<WorkoutSet[]> {
    const links = await this.db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
    if (links.length === 0) return [];
    const workouts = await this.db.workouts.bulkGet(links.map((link) => link.workoutId));

    const candidates = links
      .map((link, index) => ({ link, workout: workouts[index] }))
      .filter(
        (entry): entry is { link: WorkoutExercise; workout: Workout } =>
          !!entry.workout && entry.workout.status === 'completed' && entry.workout.id !== beforeWorkoutId,
      )
      .sort((a, b) => b.workout.startedAt.localeCompare(a.workout.startedAt));

    for (const candidate of candidates) {
      const sets = (
        await this.db.workoutSets.where('workoutExerciseId').equals(candidate.link.id).toArray()
      )
        .filter((set) => set.isCompleted)
        .sort((a, b) => a.order - b.order);
      if (sets.length > 0) return sets;
    }
    return [];
  }

  async getSetHistoryForExercise(exerciseId: UUID): Promise<SetWithContext[]> {
    const links = await this.db.workoutExercises.where('exerciseId').equals(exerciseId).toArray();
    if (links.length === 0) return [];
    const workouts = await this.db.workouts.bulkGet(links.map((link) => link.workoutId));
    const byLink = new Map<string, Workout>();
    links.forEach((link, index) => {
      const workout = workouts[index];
      if (workout && workout.status === 'completed') byLink.set(link.id, workout);
    });

    const sets = await this.db.workoutSets
      .where('workoutExerciseId')
      .anyOf([...byLink.keys()])
      .toArray();

    return sets
      .filter((set) => set.isCompleted)
      .map((set) => {
        const workout = byLink.get(set.workoutExerciseId)!;
        return { ...set, exerciseId, performedAt: workout.startedAt };
      })
      .sort((a, b) => b.performedAt.localeCompare(a.performedAt) || a.order - b.order);
  }

  async getAllCompletedSets(): Promise<
    Array<{ exercise: WorkoutExercise; sets: WorkoutSet[]; workout: Workout }>
  > {
    const workouts = await this.db.workouts.where('status').equals('completed').toArray();
    if (workouts.length === 0) return [];
    const byId = new Map(workouts.map((workout) => [workout.id, workout]));
    const exercises = await this.db.workoutExercises
      .where('workoutId')
      .anyOf(workouts.map((workout) => workout.id))
      .toArray();
    const sets = await this.db.workoutSets
      .where('workoutId')
      .anyOf(workouts.map((workout) => workout.id))
      .toArray();

    const setsByExercise = new Map<string, WorkoutSet[]>();
    for (const set of sets) {
      if (!set.isCompleted) continue;
      const bucket = setsByExercise.get(set.workoutExerciseId);
      if (bucket) bucket.push(set);
      else setsByExercise.set(set.workoutExerciseId, [set]);
    }

    return exercises
      .map((exercise) => ({
        exercise,
        sets: (setsByExercise.get(exercise.id) ?? []).sort((a, b) => a.order - b.order),
        workout: byId.get(exercise.workoutId)!,
      }))
      .filter((entry) => !!entry.workout);
  }

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
    return this.db.importJobs.toArray().then((rows) => rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt)));
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
      if (data.plateInventories.length > 0) await this.db.plateInventories.bulkPut(data.plateInventories);
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

      const existingTemplates = new Set((await this.db.templates.toCollection().primaryKeys()) as string[]);
      const newTemplates = data.templates.filter((template) => !existingTemplates.has(template.id));
      if (newTemplates.length > 0) {
        await this.db.templates.bulkPut(newTemplates);
        const ids = new Set(newTemplates.map((template) => template.id));
        await this.db.templateExercises.bulkPut(
          data.templateExercises.filter((row) => ids.has(row.templateId)),
        );
      }
      result.templatesAdded = newTemplates.length;

      const existingWorkouts = new Set((await this.db.workouts.toCollection().primaryKeys()) as string[]);
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

export class ActiveWorkoutExistsError extends Error {
  constructor(public readonly workoutId: UUID) {
    super('A workout is already in progress.');
    this.name = 'ActiveWorkoutExistsError';
  }
}

export function snapshotExercise(
  workoutId: UUID,
  exercise: Exercise,
  order: number,
  options: { restSeconds?: number; notes?: string; supersetGroup?: string } = {},
): WorkoutExercise {
  return {
    id: uuid(),
    workoutId,
    exerciseId: exercise.id,
    order,
    exerciseNameSnapshot: exercise.name,
    primaryMuscleGroupSnapshot: exercise.primaryMuscleGroup,
    secondaryMuscleGroupsSnapshot: exercise.secondaryMuscleGroups,
    equipmentSnapshot: exercise.equipment,
    trackingTypeSnapshot: exercise.trackingType,
    restSeconds: options.restSeconds ?? 120,
    notes: options.notes,
    supersetGroup: options.supersetGroup,
  };
}

export function defaultWorkoutName(date: Date): string {
  const hour = date.getHours();
  if (hour < 11) return 'Morning workout';
  if (hour < 16) return 'Afternoon workout';
  if (hour < 21) return 'Evening workout';
  return 'Night workout';
}

let repository: RepForgeRepository | null = null;

export function getRepository(): RepForgeRepository {
  if (!repository) repository = new DexieRepository();
  return repository;
}

/** Test hook: swap the repository implementation (e.g. a fake or a SQLite adapter). */
export function setRepository(next: RepForgeRepository | null): void {
  repository = next;
}
