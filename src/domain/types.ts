/**
 * RepForge domain types.
 *
 * Canonical storage rules (applied everywhere below the UI layer):
 *  - Mass is stored in **grams** (integer). Never store kg/lb floats; convert at the edges.
 *  - Length is stored in **millimetres** (integer).
 *  - Distance is stored in **metres** (integer).
 *  - Duration is stored in **seconds** (integer).
 *  - Timestamps are ISO-8601 strings in UTC; a `tzOffsetMinutes` companion records the
 *    local offset at the time of recording so history reads correctly after travel.
 *  - Identity is a UUID v4 string.
 */

export type UUID = string;
export type ISODateTime = string;
/** `YYYY-MM-DD` in the user's local calendar at the time of recording. */
export type ISODate = string;

export type UnitSystem = 'metric' | 'imperial';
export type WeekStartDay = 'saturday' | 'sunday' | 'monday';

export type MuscleGroup =
  | 'unmapped'
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'quads'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'core'
  | 'traps'
  | 'lats'
  | 'adductors'
  | 'abductors'
  | 'neck'
  | 'full body'
  | 'cardio';

export interface MuscleTargetBand {
  min: number;
  max: number;
}

export type PersonalMuscleTargets = Partial<Record<MuscleGroup, MuscleTargetBand>>;

export type Equipment =
  | 'barbell'
  | 'dumbbell'
  | 'machine'
  | 'cable'
  | 'bodyweight'
  | 'kettlebell'
  | 'band'
  | 'smith machine'
  | 'plate'
  | 'other';

export type MovementPattern =
  | 'squat'
  | 'hinge'
  | 'horizontal push'
  | 'vertical push'
  | 'horizontal pull'
  | 'vertical pull'
  | 'lunge'
  | 'carry'
  | 'isolation'
  | 'core'
  | 'conditioning';

/** How a set for this exercise is entered and how analytics treat it. */
export type TrackingType =
  | 'weight_reps'
  | 'reps_only'
  | 'duration'
  | 'distance_duration'
  | 'assisted_weight';

export interface Exercise {
  id: UUID;
  name: string;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups: MuscleGroup[];
  equipment: Equipment;
  movementPattern: MovementPattern;
  trackingType: TrackingType;
  /** Rounding increment used by the warm-up generator for non-barbell work, in grams. */
  incrementG?: number;
  /** Single-arm/single-leg exercise. Logged as independent left/right `WorkoutSet` rows. */
  unilateral?: boolean;
  isCustom: boolean;
  isArchived: boolean;
  notes?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type SetType = 'warmup' | 'working' | 'drop' | 'failure';

export interface TemplateExercise {
  id: UUID;
  templateId: UUID;
  exerciseId: UUID;
  order: number;
  targetSets: number;
  targetRepMin?: number;
  targetRepMax?: number;
  targetRpe?: number;
  targetRir?: number;
  restSeconds: number;
  defaultSetType: SetType;
  includeWarmup: boolean;
  notes?: string;
  /** Exercises sharing a non-null group id are performed as a superset/circuit. */
  supersetGroup?: string;
}

export interface Template {
  id: UUID;
  name: string;
  notes?: string;
  order: number;
  isArchived: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface WorkoutSet {
  id: UUID;
  workoutExerciseId: UUID;
  workoutId: UUID;
  order: number;
  setType: SetType;
  /** Load in grams. For `assisted_weight` this is the assistance removed from bodyweight. */
  weightG?: number;
  reps?: number;
  rpe?: number;
  rir?: number;
  durationSeconds?: number;
  distanceM?: number;
  isCompleted: boolean;
  completedAt?: ISODateTime;
  notes?: string;
  /** Undefined = bilateral row (unchanged meaning). Set for unilateral exercises. */
  side?: 'left' | 'right';
  /** UI-lookup-only grouping key linking the left+right row of one set-number. Never indexed. */
  pairId?: string;
}

export interface WorkoutExercise {
  id: UUID;
  workoutId: UUID;
  exerciseId: UUID;
  order: number;
  /** Snapshots keep history readable after the exercise is renamed, edited or archived. */
  exerciseNameSnapshot: string;
  primaryMuscleGroupSnapshot: MuscleGroup;
  secondaryMuscleGroupsSnapshot: MuscleGroup[];
  equipmentSnapshot: Equipment;
  trackingTypeSnapshot: TrackingType;
  /** Snapshotted at add-to-workout time so a mid-workout exercise edit can't change behavior. */
  unilateralSnapshot?: boolean;
  restSeconds: number;
  notes?: string;
  supersetGroup?: string;
}

export type WorkoutStatus = 'active' | 'completed' | 'discarded';

export interface Workout {
  id: UUID;
  templateId?: UUID;
  name: string;
  status: WorkoutStatus;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  localDate: ISODate;
  tzOffsetMinutes: number;
  /** Accumulated paused time in seconds, subtracted from wall-clock elapsed. */
  pausedSeconds: number;
  notes?: string;
  /** Stable fingerprint of the source row set when imported, used for deduplication. */
  importFingerprint?: string;
  importJobId?: UUID;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type MeasurementMetric =
  | 'bodyweight'
  | 'neck'
  | 'shoulders'
  | 'chest'
  | 'waist'
  | 'hips'
  | 'arm_left'
  | 'arm_right'
  | 'thigh_left'
  | 'thigh_right'
  | 'calf_left'
  | 'calf_right';

export interface BodyMeasurement {
  id: UUID;
  metric: MeasurementMetric;
  /** grams for `bodyweight`, millimetres for every circumference metric. */
  value: number;
  /** The unit the value was entered in, so the entry screen can echo it back. */
  displayUnit: 'kg' | 'lb' | 'cm' | 'in';
  recordedAt: ISODateTime;
  localDate: ISODate;
  note?: string;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface PlateDenomination {
  /** Mass of a single plate in grams. */
  weightG: number;
  /** Total number of physical plates owned — not pairs. */
  count: number;
}

export interface PlateInventory {
  id: UUID;
  name: string;
  unit: 'kg' | 'lb';
  plates: PlateDenomination[];
  isDefault: boolean;
}

export interface BarProfile {
  id: UUID;
  name: string;
  weightG: number;
  /** Per-collar mass in grams; applied to both sides when enabled. */
  collarWeightG: number;
  isDefault: boolean;
}

export type OneRepMaxFormula = 'epley' | 'brzycki';
export type IntensityMode = 'rpe' | 'rir' | 'none';
export type ThemeMode = 'light' | 'dark' | 'system';
export type AccentTheme = 'stamp' | 'ember' | 'glacier' | 'moss' | 'violet';
export type AppIcon = 'default' | 'ember' | 'glacier' | 'moss' | 'violet';

export interface AppSettings {
  id: 'settings';
  unitSystem: UnitSystem;
  oneRepMaxFormula: OneRepMaxFormula;
  intensityMode: IntensityMode;
  /** Start day for weekly analytics. Missing on older installs/backups means Monday. */
  weekStartDay?: WeekStartDay;
  /** Quick-adjust step shown beside weight inputs, in grams (default 2.5 kg / 5 lb). */
  quickIncrementG: number;
  defaultRestSeconds: number;
  restTimerAutoStart: boolean;
  restTimerSound: boolean;
  restTimerVibrate: boolean;
  restTimerNotification: boolean;
  excludeWarmupsFromAnalytics: boolean;
  /** Fractional volume credit assigned to secondary muscle groups (0–1). */
  secondaryMuscleCredit: number;
  /** Optional per-muscle overrides; missing entries use the research default. */
  personalMuscleTargets?: PersonalMuscleTargets;
  /**
   * Up to 3 exercise ids Weekly Verdict and stall flags should track. Missing or empty means
   * "infer from training" — the most-trained lifts in the baseline window, labelled as such.
   */
  goalLiftIds?: UUID[];
  defaultBarProfileId?: UUID;
  defaultPlateInventoryId?: UUID;
  themeMode: ThemeMode;
  accentTheme: AccentTheme;
  appIcon: AppIcon;
  onboardingCompletedAt?: ISODateTime;
  updatedAt: ISODateTime;
}

/** Persisted rest-timer state. Absolute timestamps only — never a decrementing counter. */
export interface TimerState {
  id: 'rest-timer';
  workoutId?: UUID;
  setId?: UUID;
  /** When the timer was started, ISO. */
  startedAt: ISODateTime;
  /** Absolute instant the timer fires, ISO — survives reload and process death. */
  endsAt: ISODateTime;
  durationSeconds: number;
  isRunning: boolean;
  label?: string;
}

export type ImportJobStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface ImportJob {
  id: UUID;
  source: 'strong-csv' | 'repforge-json';
  fileName: string;
  startedAt: ISODateTime;
  finishedAt?: ISODateTime;
  status: ImportJobStatus;
  workoutsImported: number;
  setsImported: number;
  exercisesCreated: number;
  rowsSkipped: number;
  /** Non-sensitive, human-readable summary lines. */
  messages: string[];
}

export interface ImportIssue {
  id: UUID;
  jobId: UUID;
  row: number;
  severity: 'warning' | 'error';
  message: string;
}

export interface DbMeta {
  id: 'meta';
  schemaVersion: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
  seededLibraryVersion: number;
}

/** A workout with its exercises and sets loaded — the shape feature code works with. */
export interface WorkoutDetail {
  workout: Workout;
  exercises: Array<{
    exercise: WorkoutExercise;
    sets: WorkoutSet[];
  }>;
}
