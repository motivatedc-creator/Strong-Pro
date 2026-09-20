import { z } from 'zod';
import { BACKUP_FORMAT_VERSION, type BackupPayload } from '@/db/repository';

/**
 * Zod schemas for the RepForge JSON backup format (see docs/data-format.md).
 *
 * Restores are validated *before* anything is written: an imported file is untrusted
 * input. Unknown extra keys are stripped rather than trusted, string lengths are bounded,
 * and every numeric field must be finite.
 */

const MAX_TEXT = 4_000;
const id = z.string().min(1).max(200);
const isoDateTime = z.string().min(4).max(40);
const text = z.string().max(MAX_TEXT);
const finiteNumber = z.number().finite();
const count = z.number().finite().nonnegative();

const muscleGroup = z.string().min(1).max(40);

const exerciseSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  primaryMuscleGroup: muscleGroup,
  secondaryMuscleGroups: z.array(muscleGroup).max(20).default([]),
  equipment: z.string().min(1).max(40),
  movementPattern: z.string().min(1).max(40),
  trackingType: z.enum([
    'weight_reps',
    'reps_only',
    'duration',
    'distance_duration',
    'assisted_weight',
  ]),
  incrementG: count.optional(),
  unilateral: z.boolean().optional(),
  isCustom: z.boolean(),
  isArchived: z.boolean(),
  notes: text.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const templateSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  notes: text.optional(),
  order: finiteNumber,
  isArchived: z.boolean(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const templateExerciseSchema = z.object({
  id,
  templateId: id,
  exerciseId: id,
  order: finiteNumber,
  targetSets: count,
  targetRepMin: count.optional(),
  targetRepMax: count.optional(),
  targetRpe: finiteNumber.optional(),
  targetRir: finiteNumber.optional(),
  restSeconds: count,
  defaultSetType: z.enum(['warmup', 'working', 'drop', 'failure']),
  includeWarmup: z.boolean(),
  notes: text.optional(),
  supersetGroup: z.string().max(100).optional(),
});

const workoutSchema = z.object({
  id,
  templateId: id.optional(),
  name: z.string().min(1).max(200),
  status: z.enum(['active', 'completed', 'discarded']),
  startedAt: isoDateTime,
  endedAt: isoDateTime.optional(),
  localDate: z.string().max(20),
  tzOffsetMinutes: finiteNumber,
  pausedSeconds: count.default(0),
  notes: text.optional(),
  importFingerprint: z.string().max(100).optional(),
  importJobId: id.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const workoutExerciseSchema = z.object({
  id,
  workoutId: id,
  exerciseId: id,
  order: finiteNumber,
  exerciseNameSnapshot: z.string().min(1).max(200),
  primaryMuscleGroupSnapshot: muscleGroup,
  secondaryMuscleGroupsSnapshot: z.array(muscleGroup).max(20).default([]),
  equipmentSnapshot: z.string().max(40),
  trackingTypeSnapshot: z.enum([
    'weight_reps',
    'reps_only',
    'duration',
    'distance_duration',
    'assisted_weight',
  ]),
  restSeconds: count,
  notes: text.optional(),
  supersetGroup: z.string().max(100).optional(),
  unilateralSnapshot: z.boolean().optional(),
});

const workoutSetSchema = z.object({
  id,
  workoutExerciseId: id,
  workoutId: id,
  order: finiteNumber,
  setType: z.enum(['warmup', 'working', 'drop', 'failure']),
  weightG: finiteNumber.optional(),
  reps: finiteNumber.optional(),
  rpe: finiteNumber.optional(),
  rir: finiteNumber.optional(),
  durationSeconds: finiteNumber.optional(),
  distanceM: finiteNumber.optional(),
  isCompleted: z.boolean(),
  completedAt: isoDateTime.optional(),
  notes: text.optional(),
  side: z.enum(['left', 'right']).optional(),
  pairId: id.optional(),
});

const measurementSchema = z.object({
  id,
  metric: z.enum([
    'bodyweight',
    'neck',
    'shoulders',
    'chest',
    'waist',
    'hips',
    'arm_left',
    'arm_right',
    'thigh_left',
    'thigh_right',
    'calf_left',
    'calf_right',
  ]),
  value: finiteNumber,
  displayUnit: z.enum(['kg', 'lb', 'cm', 'in']),
  recordedAt: isoDateTime,
  localDate: z.string().max(20),
  note: text.optional(),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
});

const barProfileSchema = z.object({
  id,
  name: z.string().min(1).max(120),
  weightG: count,
  collarWeightG: count.default(0),
  isDefault: z.boolean(),
});

const plateInventorySchema = z.object({
  id,
  name: z.string().min(1).max(120),
  unit: z.enum(['kg', 'lb']),
  plates: z
    .array(z.object({ weightG: count, count: count }))
    .max(50)
    .default([]),
  isDefault: z.boolean(),
});

export const settingsSchema = z.object({
  id: z.literal('settings').default('settings'),
  unitSystem: z.enum(['metric', 'imperial']),
  oneRepMaxFormula: z.enum(['epley', 'brzycki']),
  intensityMode: z.enum(['rpe', 'rir', 'none']),
  weekStartDay: z.enum(['saturday', 'sunday', 'monday']).optional(),
  quickIncrementG: count,
  defaultRestSeconds: count,
  restTimerAutoStart: z.boolean(),
  restTimerSound: z.boolean(),
  restTimerVibrate: z.boolean(),
  restTimerNotification: z.boolean(),
  excludeWarmupsFromAnalytics: z.boolean(),
  secondaryMuscleCredit: z.number().min(0).max(1),
  personalMuscleTargets: z
    .record(
      z.object({
        min: z.number().finite().min(0).max(100),
        max: z.number().finite().min(0).max(100),
      }),
    )
    .optional()
    .default({}),
  goalLiftIds: z.array(id).max(3).optional(),
  goalLens: z.enum(['build', 'strength', 'maintain']).optional(),
  defaultBarProfileId: id.optional(),
  defaultPlateInventoryId: id.optional(),
  themeMode: z.enum(['light', 'dark', 'system']),
  accentTheme: z.enum(['stamp', 'ember', 'glacier', 'moss', 'violet']),
  appIcon: z.enum(['default', 'ember', 'glacier', 'moss', 'violet']),
  onboardingCompletedAt: isoDateTime.optional(),
  updatedAt: isoDateTime,
});

const importJobSchema = z.object({
  id,
  source: z.enum(['strong-csv', 'repforge-json']),
  fileName: z.string().max(400),
  startedAt: isoDateTime,
  finishedAt: isoDateTime.optional(),
  status: z.enum(['pending', 'completed', 'failed', 'cancelled']),
  workoutsImported: count,
  setsImported: count,
  exercisesCreated: count,
  rowsSkipped: count,
  messages: z.array(text).max(100).default([]),
});

export const backupSchema = z.object({
  format: z.literal('repforge-backup'),
  version: z.number().int().min(1).max(BACKUP_FORMAT_VERSION),
  exportedAt: isoDateTime,
  appVersion: z.string().max(40).default('unknown'),
  data: z.object({
    exercises: z.array(exerciseSchema).default([]),
    templates: z.array(templateSchema).default([]),
    templateExercises: z.array(templateExerciseSchema).default([]),
    workouts: z.array(workoutSchema).default([]),
    workoutExercises: z.array(workoutExerciseSchema).default([]),
    workoutSets: z.array(workoutSetSchema).default([]),
    measurements: z.array(measurementSchema).default([]),
    barProfiles: z.array(barProfileSchema).default([]),
    plateInventories: z.array(plateInventorySchema).default([]),
    settings: settingsSchema.nullable().default(null),
    importJobs: z.array(importJobSchema).default([]),
  }),
});

export interface BackupValidation {
  ok: boolean;
  payload?: BackupPayload;
  errors: string[];
  summary?: {
    workouts: number;
    sets: number;
    exercises: number;
    templates: number;
    measurements: number;
    exportedAt: string;
    appVersion: string;
  };
}

/** Largest backup accepted, guarding against accidental multi-gigabyte files. */
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;

export function validateBackup(raw: unknown): BackupValidation {
  const result = backupSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      errors: result.error.issues
        .slice(0, 20)
        .map((issue) => `${issue.path.join('.') || 'root'}: ${issue.message}`),
    };
  }

  const payload = result.data as unknown as BackupPayload;
  const orphaned = findOrphans(payload);

  return {
    ok: true,
    payload,
    errors: orphaned,
    summary: {
      workouts: payload.data.workouts.length,
      sets: payload.data.workoutSets.length,
      exercises: payload.data.exercises.length,
      templates: payload.data.templates.length,
      measurements: payload.data.measurements.length,
      exportedAt: payload.exportedAt,
      appVersion: payload.appVersion,
    },
  };
}

/** Referential integrity is enforced in application logic, so a restore checks it too. */
function findOrphans(payload: BackupPayload): string[] {
  const warnings: string[] = [];
  const workoutIds = new Set(payload.data.workouts.map((workout) => workout.id));
  const workoutExerciseIds = new Set(payload.data.workoutExercises.map((row) => row.id));

  const orphanExercises = payload.data.workoutExercises.filter(
    (row) => !workoutIds.has(row.workoutId),
  );
  if (orphanExercises.length > 0) {
    warnings.push(
      `${orphanExercises.length} logged exercises reference a missing workout and will be skipped.`,
    );
  }

  const orphanSets = payload.data.workoutSets.filter(
    (row) => !workoutExerciseIds.has(row.workoutExerciseId) || !workoutIds.has(row.workoutId),
  );
  if (orphanSets.length > 0) {
    warnings.push(
      `${orphanSets.length} sets reference a missing exercise entry and will be skipped.`,
    );
  }

  return warnings;
}

/** Drops rows that failed referential checks so a restore cannot create dangling data. */
export function pruneOrphans(payload: BackupPayload): BackupPayload {
  const workoutIds = new Set(payload.data.workouts.map((workout) => workout.id));
  const workoutExercises = payload.data.workoutExercises.filter((row) =>
    workoutIds.has(row.workoutId),
  );
  const workoutExerciseIds = new Set(workoutExercises.map((row) => row.id));
  const workoutSets = payload.data.workoutSets.filter(
    (row) => workoutExerciseIds.has(row.workoutExerciseId) && workoutIds.has(row.workoutId),
  );
  const templateIds = new Set(payload.data.templates.map((template) => template.id));
  const templateExercises = payload.data.templateExercises.filter((row) =>
    templateIds.has(row.templateId),
  );

  return {
    ...payload,
    data: { ...payload.data, workoutExercises, workoutSets, templateExercises },
  };
}
