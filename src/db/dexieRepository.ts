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
    personalMuscleTargets: {},
    defaultBarProfileId: 'seed-bar-olympic-kg',
    defaultPlateInventoryId: 'seed-plates-kg',
    themeMode: 'system',
    accentTheme: 'stamp',
    appIcon: 'default',
    updatedAt: now,
  };
}
