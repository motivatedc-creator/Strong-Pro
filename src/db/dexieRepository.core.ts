import { uuid } from '@/domain/ids';
import { nowIso } from '@/domain/time';
import type {
  AppSettings,
  BarProfile,
  Exercise,
  PlateInventory,
  UUID,
} from '@/domain/types';
import { CURRENT_SCHEMA_VERSION, getDb, type RepForgeDatabase } from './schema';
import {
  SEED_LIBRARY_VERSION,
  seedBarProfiles,
  seedExercises,
  seedPlateInventories,
} from './seedData';
import { defaultSettings } from './defaultSettings';

export const APP_VERSION = '1.0.0';
export { defaultSettings } from './defaultSettings';

/** Dexie-backed implementation of the RepForge storage boundary (core). */
export class DexieRepositoryCore {
  constructor(protected readonly db: RepForgeDatabase = getDb()) {}
  async initialise(): Promise<void> {
    const now = nowIso();
    await this.db.open();
    await this.db.transaction(
      'rw',
      [
        this.db.meta,
        this.db.exercises,
        this.db.settings,
        this.db.barProfiles,
        this.db.plateInventories,
      ],
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
          const existing = new Set(
            (await this.db.exercises.toCollection().primaryKeys()) as string[],
          );
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
    await this.db.transaction('rw', [this.db.exercises, this.db.workoutExercises], async () => {
      await this.db.exercises.put(next);

      // An imported exercise starts as Unmapped. Correcting that classification is not
      // changing performed training data, so update its analytics snapshots as well.
      if (existing.primaryMuscleGroup === 'unmapped' && next.primaryMuscleGroup !== 'unmapped') {
        await this.db.workoutExercises
          .where('exerciseId')
          .equals(id)
          .modify((row) => {
            if (row.primaryMuscleGroupSnapshot !== 'unmapped') return;
            row.primaryMuscleGroupSnapshot = next.primaryMuscleGroup;
            row.secondaryMuscleGroupsSnapshot = next.secondaryMuscleGroups;
          });
      }
    });
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

}
