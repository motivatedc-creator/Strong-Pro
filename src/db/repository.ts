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

/**
 * Storage boundary.
 *
 * Feature code only ever talks to this interface, never to Dexie directly, so a native
 * SQLite adapter (Capacitor) can be dropped in later without touching feature logic.
 * All multi-record writes are transactional in the implementation.
 */

export interface TemplateDetail {
  template: Template;
  exercises: Array<{ templateExercise: TemplateExercise; exercise: Exercise | undefined }>;
}

export interface WorkoutQuery {
  search?: string;
  from?: string;
  to?: string;
  exerciseId?: UUID;
  limit?: number;
  offset?: number;
}

export interface NewSetInput {
  workoutExerciseId: UUID;
  setType?: WorkoutSet['setType'];
  weightG?: number;
  reps?: number;
  rpe?: number;
  rir?: number;
  durationSeconds?: number;
  distanceM?: number;
  isCompleted?: boolean;
  notes?: string;
  /** Insert after this set instead of appending. */
  afterSetId?: UUID;
  /** Undefined = bilateral row. Set for unilateral exercises. */
  side?: 'left' | 'right';
  /** UI-lookup-only grouping key linking the left+right row of one set-number. */
  pairId?: string;
}

export interface StartWorkoutInput {
  templateId?: UUID;
  name?: string;
}

export interface RepForgeRepository {
  // --- lifecycle ---
  initialise(): Promise<void>;

  // --- settings & equipment ---
  getSettings(): Promise<AppSettings>;
  updateSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  listBarProfiles(): Promise<BarProfile[]>;
  saveBarProfile(profile: BarProfile): Promise<void>;
  deleteBarProfile(id: UUID): Promise<void>;
  listPlateInventories(): Promise<PlateInventory[]>;
  savePlateInventory(inventory: PlateInventory): Promise<void>;
  deletePlateInventory(id: UUID): Promise<void>;

  // --- exercises ---
  listExercises(options?: { includeArchived?: boolean }): Promise<Exercise[]>;
  getExercise(id: UUID): Promise<Exercise | undefined>;
  createExercise(
    input: Omit<Exercise, 'id' | 'createdAt' | 'updatedAt' | 'isCustom'> & { id?: UUID },
  ): Promise<Exercise>;
  updateExercise(id: UUID, patch: Partial<Exercise>): Promise<Exercise>;
  setExerciseArchived(id: UUID, archived: boolean): Promise<void>;
  /** Permanently removes a custom exercise. Refuses when workout history references it. */
  deleteExercise(id: UUID): Promise<{ deleted: boolean; reason?: string }>;

  // --- templates ---
  listTemplates(options?: { includeArchived?: boolean }): Promise<Template[]>;
  getTemplateDetail(id: UUID): Promise<TemplateDetail | undefined>;
  createTemplate(name: string, notes?: string): Promise<Template>;
  saveTemplate(template: Template, exercises: TemplateExercise[]): Promise<void>;
  duplicateTemplate(id: UUID): Promise<Template | undefined>;
  setTemplateArchived(id: UUID, archived: boolean): Promise<void>;
  deleteTemplate(id: UUID): Promise<void>;
  reorderTemplates(orderedIds: UUID[]): Promise<void>;

  // --- workouts ---
  getActiveWorkout(): Promise<WorkoutDetail | undefined>;
  startWorkout(input: StartWorkoutInput): Promise<WorkoutDetail>;
  getWorkoutDetail(id: UUID): Promise<WorkoutDetail | undefined>;
  listWorkouts(query?: WorkoutQuery): Promise<Workout[]>;
  countWorkouts(query?: WorkoutQuery): Promise<number>;
  updateWorkout(id: UUID, patch: Partial<Workout>): Promise<void>;
  completeWorkout(id: UUID): Promise<void>;
  discardWorkout(id: UUID): Promise<void>;
  deleteWorkout(id: UUID): Promise<void>;

  addExerciseToWorkout(
    workoutId: UUID,
    exerciseId: UUID,
    options?: { supersetGroup?: string },
  ): Promise<WorkoutExercise>;
  removeWorkoutExercise(workoutExerciseId: UUID): Promise<void>;
  replaceWorkoutExercise(workoutExerciseId: UUID, newExerciseId: UUID): Promise<void>;
  reorderWorkoutExercises(workoutId: UUID, orderedIds: UUID[]): Promise<void>;
  updateWorkoutExercise(id: UUID, patch: Partial<WorkoutExercise>): Promise<void>;

  addSet(workoutId: UUID, input: NewSetInput): Promise<WorkoutSet>;
  addSets(workoutId: UUID, inputs: NewSetInput[]): Promise<WorkoutSet[]>;
  updateSet(id: UUID, patch: Partial<WorkoutSet>): Promise<void>;
  deleteSet(id: UUID): Promise<void>;
  restoreSet(set: WorkoutSet): Promise<void>;

  /** Sets from the most recent completed workout that contained this exercise. */
  getPreviousSetsForExercise(exerciseId: UUID, beforeWorkoutId?: UUID): Promise<WorkoutSet[]>;
  /** All completed, contextualised sets for an exercise, newest first. */
  getSetHistoryForExercise(exerciseId: UUID): Promise<SetWithContext[]>;
  /** All completed sets across history, for analytics. */
  getAllCompletedSets(): Promise<
    Array<{ exercise: WorkoutExercise; sets: WorkoutSet[]; workout: Workout }>
  >;

  // --- measurements ---
  listMeasurements(metric?: MeasurementMetric): Promise<BodyMeasurement[]>;
  addMeasurement(
    input: Omit<BodyMeasurement, 'id' | 'createdAt' | 'updatedAt'> & { id?: UUID },
  ): Promise<BodyMeasurement>;
  updateMeasurement(id: UUID, patch: Partial<BodyMeasurement>): Promise<void>;
  deleteMeasurement(id: UUID): Promise<void>;

  // --- rest timer ---
  getTimer(): Promise<TimerState | undefined>;
  setTimer(state: TimerState | null): Promise<void>;

  // --- import bookkeeping ---
  /** Writes a whole parsed import in one transaction: all-or-nothing. */
  importBatch(batch: ImportBatch): Promise<void>;
  listImportJobs(): Promise<ImportJob[]>;
  getImportIssues(jobId: UUID): Promise<ImportIssue[]>;
  findWorkoutByFingerprint(fingerprint: string): Promise<Workout | undefined>;

  // --- bulk data transfer ---
  exportAll(): Promise<BackupPayload>;
  replaceAll(payload: BackupPayload): Promise<void>;
  mergeBackup(payload: BackupPayload): Promise<MergeResult>;
  clearAllUserData(): Promise<void>;
}

export interface ImportBatch {
  job: ImportJob;
  /** Exercises that did not exist locally and must be created as custom entries. */
  newExercises: Exercise[];
  workouts: WorkoutDetail[];
  issues: ImportIssue[];
}

export interface BackupPayload {
  format: 'repforge-backup';
  version: number;
  exportedAt: string;
  appVersion: string;
  data: {
    exercises: Exercise[];
    templates: Template[];
    templateExercises: TemplateExercise[];
    workouts: Workout[];
    workoutExercises: WorkoutExercise[];
    workoutSets: WorkoutSet[];
    measurements: BodyMeasurement[];
    barProfiles: BarProfile[];
    plateInventories: PlateInventory[];
    settings: AppSettings | null;
    importJobs: ImportJob[];
  };
}

export interface MergeResult {
  workoutsAdded: number;
  workoutsSkipped: number;
  exercisesAdded: number;
  templatesAdded: number;
  measurementsAdded: number;
}

export const BACKUP_FORMAT_VERSION = 1;
