import { fingerprint, uuid } from '@/domain/ids';
import { localDateOf, nowIso, tzOffsetMinutes } from '@/domain/time';
import { toGrams, type WeightUnit } from '@/domain/units';
import type {
  Exercise,
  ImportIssue,
  ImportJob,
  UUID,
  Workout,
  WorkoutDetail,
  WorkoutExercise,
  WorkoutSet,
} from '@/domain/types';
import type { ImportBatch } from '@/db/repository';
import { normaliseHeader, parseCsv } from './csv';

/**
 * Strong CSV import.
 *
 * This reads the CSV file a user exports from the Strong app themselves — no proprietary
 * API, no reverse engineering, no bundled data. Column names have changed across Strong
 * versions and locales, so headers are matched case-insensitively against a list of known
 * aliases and anything unmatched can be mapped by the user before the import runs.
 *
 * The parse step is pure: it never writes. `buildImportBatch` produces a complete batch
 * that the repository writes in a single transaction, so cancelling or failing midway
 * cannot leave a partial database.
 */

export type StrongField =
  | 'date'
  | 'workoutName'
  | 'duration'
  | 'exerciseName'
  | 'setOrder'
  | 'weight'
  | 'reps'
  | 'distance'
  | 'seconds'
  | 'rpe'
  | 'notes'
  | 'workoutNotes'
  | 'setType';

export const STRONG_FIELD_LABELS: Record<StrongField, string> = {
  date: 'Date',
  workoutName: 'Workout name',
  duration: 'Workout duration',
  exerciseName: 'Exercise name',
  setOrder: 'Set order',
  weight: 'Weight',
  reps: 'Reps',
  distance: 'Distance',
  seconds: 'Seconds',
  rpe: 'RPE',
  notes: 'Set notes',
  workoutNotes: 'Workout notes',
  setType: 'Set type',
};

export const REQUIRED_FIELDS: StrongField[] = ['date', 'exerciseName'];

/** Known header spellings, normalised (lowercase, punctuation stripped). */
const ALIASES: Record<StrongField, string[]> = {
  date: ['date', 'workout_date', 'start_time', 'datum', 'fecha'],
  workoutName: ['workout_name', 'workout', 'name', 'training', 'entrenamiento'],
  duration: ['duration', 'workout_duration', 'dauer'],
  exerciseName: ['exercise_name', 'exercise', 'ubung', 'ejercicio'],
  setOrder: ['set_order', 'set', 'set_number', 'set_index'],
  weight: ['weight', 'weight_kg', 'weight_lbs', 'weight_lb', 'gewicht', 'peso'],
  reps: ['reps', 'repetitions', 'wiederholungen', 'repeticiones'],
  distance: ['distance', 'distance_m', 'distance_km', 'distance_miles'],
  seconds: ['seconds', 'time', 'duration_seconds'],
  rpe: ['rpe', 'rate_of_perceived_exertion'],
  notes: ['notes', 'set_notes', 'note'],
  workoutNotes: ['workout_notes', 'session_notes'],
  setType: ['set_type', 'type'],
};

export type ColumnMapping = Partial<Record<StrongField, number>>;

export interface ParsedSetRow {
  rowNumber: number;
  exerciseName: string;
  setOrder: number;
  weightG?: number;
  reps?: number;
  distanceM?: number;
  durationSeconds?: number;
  rpe?: number;
  notes?: string;
  isWarmup: boolean;
}

export interface ParsedWorkout {
  key: string;
  fingerprint: string;
  name: string;
  startedAt: string;
  durationSeconds?: number;
  notes?: string;
  exercises: Array<{ name: string; sets: ParsedSetRow[] }>;
  setCount: number;
}

export interface ImportAnalysis {
  header: string[];
  mapping: ColumnMapping;
  unmappedColumns: Array<{ index: number; name: string }>;
  missingRequired: StrongField[];
  workouts: ParsedWorkout[];
  issues: Array<Omit<ImportIssue, 'id' | 'jobId'>>;
  totalRows: number;
  skippedRows: number;
  /** Weight unit inferred from the header, if it declared one. */
  detectedUnit?: WeightUnit;
}

export function autoMap(header: readonly string[]): ColumnMapping {
  const mapping: ColumnMapping = {};
  header.forEach((raw, index) => {
    const key = normaliseHeader(raw);
    for (const [field, aliases] of Object.entries(ALIASES) as Array<[StrongField, string[]]>) {
      if (mapping[field] !== undefined) continue;
      if (aliases.includes(key)) {
        mapping[field] = index;
        return;
      }
    }
  });
  return mapping;
}

export function detectUnitFromHeader(header: readonly string[]): WeightUnit | undefined {
  const joined = header.join(' ').toLowerCase();
  if (/weight\s*\(?\s*(lbs?|pounds?)/.test(joined)) return 'lb';
  if (/weight\s*\(?\s*(kgs?|kilograms?)/.test(joined)) return 'kg';
  return undefined;
}

export interface AnalyseOptions {
  /** User-supplied mapping overrides, applied on top of the auto-mapping. */
  mapping?: ColumnMapping;
  /** Weight unit to assume when the header does not declare one. */
  unit?: WeightUnit;
  /** Distance unit of the source file. */
  distanceUnit?: 'm' | 'km' | 'mi';
}

const MAX_ROWS = 250_000;

export function analyseStrongCsv(text: string, options: AnalyseOptions = {}): ImportAnalysis {
  const { header, rows } = parseCsv(text);
  const detectedUnit = detectUnitFromHeader(header);
  const unit: WeightUnit = options.unit ?? detectedUnit ?? 'kg';
  const mapping: ColumnMapping = { ...autoMap(header), ...(options.mapping ?? {}) };

  const issues: Array<Omit<ImportIssue, 'id' | 'jobId'>> = [];
  const missingRequired = REQUIRED_FIELDS.filter((field) => mapping[field] === undefined);

  const unmappedColumns = header
    .map((name, index) => ({ index, name }))
    .filter(({ index }) => !Object.values(mapping).includes(index));

  const grouped = new Map<string, ParsedWorkout>();
  let skippedRows = 0;

  if (missingRequired.length === 0) {
    const limit = Math.min(rows.length, MAX_ROWS);
    if (rows.length > MAX_ROWS) {
      issues.push({
        row: MAX_ROWS,
        severity: 'warning',
        message: `File contains ${rows.length} rows; only the first ${MAX_ROWS} were read.`,
      });
    }

    for (let i = 0; i < limit; i += 1) {
      const row = rows[i]!;
      const rowNumber = i + 2; // +1 for the header, +1 for 1-based numbering

      const rawDate = cell(row, mapping.date);
      const exerciseName = cell(row, mapping.exerciseName).trim();
      const startedAt = parseStrongDate(rawDate);

      if (!startedAt) {
        skippedRows += 1;
        issues.push({ row: rowNumber, severity: 'error', message: `Unreadable date "${rawDate}".` });
        continue;
      }
      if (!exerciseName) {
        skippedRows += 1;
        issues.push({ row: rowNumber, severity: 'error', message: 'Missing exercise name.' });
        continue;
      }

      const setOrderRaw = cell(row, mapping.setOrder).trim();
      const setOrder = Number.parseInt(setOrderRaw, 10);
      // Strong writes non-set rows (e.g. "Rest Timer") into the set-order column.
      if (setOrderRaw && Number.isNaN(setOrder)) {
        skippedRows += 1;
        issues.push({
          row: rowNumber,
          severity: 'warning',
          message: `Skipped non-set row "${setOrderRaw}".`,
        });
        continue;
      }

      const weight = parseNumber(cell(row, mapping.weight));
      const reps = parseNumber(cell(row, mapping.reps));
      const distance = parseNumber(cell(row, mapping.distance));
      const seconds = parseNumber(cell(row, mapping.seconds));
      const rpe = parseNumber(cell(row, mapping.rpe));

      if (weight !== undefined && weight < 0) {
        issues.push({ row: rowNumber, severity: 'warning', message: 'Negative weight set to 0.' });
      }

      const workoutName = cell(row, mapping.workoutName).trim() || 'Imported workout';
      const key = `${startedAt}::${workoutName}`;
      const workout =
        grouped.get(key) ??
        ({
          key,
          fingerprint: '',
          name: workoutName,
          startedAt,
          durationSeconds: parseDuration(cell(row, mapping.duration)),
          notes: cell(row, mapping.workoutNotes).trim() || undefined,
          exercises: [],
          setCount: 0,
        } satisfies ParsedWorkout);
      grouped.set(key, workout);

      const setTypeRaw = cell(row, mapping.setType).trim().toLowerCase();
      const parsedSet: ParsedSetRow = {
        rowNumber,
        exerciseName,
        setOrder: Number.isNaN(setOrder) ? workout.setCount : setOrder,
        weightG: weight === undefined ? undefined : toGrams(Math.max(0, weight), unit),
        reps: reps === undefined ? undefined : Math.max(0, Math.round(reps)),
        distanceM: distance === undefined ? undefined : toDistanceMetres(distance, options.distanceUnit, header),
        durationSeconds: seconds === undefined ? undefined : Math.max(0, Math.round(seconds)),
        rpe: rpe !== undefined && rpe >= 1 && rpe <= 10 ? rpe : undefined,
        notes: cell(row, mapping.notes).trim() || undefined,
        isWarmup: setTypeRaw.includes('warm') || setOrderRaw.toLowerCase().startsWith('w'),
      };

      const bucket = workout.exercises.find((entry) => entry.name === exerciseName);
      if (bucket) bucket.sets.push(parsedSet);
      else workout.exercises.push({ name: exerciseName, sets: [parsedSet] });
      workout.setCount += 1;
    }
  }

  const workouts = [...grouped.values()]
    .map((workout) => ({
      ...workout,
      exercises: workout.exercises.map((entry) => ({
        ...entry,
        sets: [...entry.sets].sort((a, b) => a.setOrder - b.setOrder || a.rowNumber - b.rowNumber),
      })),
      fingerprint: fingerprintWorkout(workout),
    }))
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt));

  return {
    header,
    mapping,
    unmappedColumns,
    missingRequired,
    workouts,
    issues,
    totalRows: rows.length,
    skippedRows,
    detectedUnit,
  };
}

/**
 * Stable fingerprint of a workout's content, used to detect a file being imported twice.
 * Built from the start time, name and every set value, so re-exporting the same session
 * produces the same fingerprint while genuinely different sessions do not collide.
 */
export function fingerprintWorkout(workout: ParsedWorkout): string {
  const parts = [workout.startedAt, workout.name];
  for (const entry of workout.exercises) {
    parts.push(entry.name);
    for (const set of entry.sets) {
      parts.push(`${set.setOrder}|${set.weightG ?? ''}|${set.reps ?? ''}|${set.durationSeconds ?? ''}|${set.distanceM ?? ''}`);
    }
  }
  return fingerprint(parts.join('~'));
}

export interface BuildBatchOptions {
  fileName: string;
  /** Existing library, used to match names before creating custom exercises. */
  existingExercises: readonly Exercise[];
  /** Fingerprints already present locally — those workouts are skipped. */
  existingFingerprints: ReadonlySet<string>;
  /** Import even when the fingerprint already exists. */
  allowDuplicates?: boolean;
  /** Only import these workout keys (the preview's selection). */
  selectedKeys?: ReadonlySet<string>;
}

export interface BuiltBatch extends ImportBatch {
  duplicatesSkipped: number;
}

export function buildImportBatch(analysis: ImportAnalysis, options: BuildBatchOptions): BuiltBatch {
  const now = nowIso();
  const jobId = uuid();
  const byName = new Map<string, Exercise>();
  for (const exercise of options.existingExercises) {
    byName.set(normaliseExerciseName(exercise.name), exercise);
  }

  const newExercises: Exercise[] = [];
  const workouts: WorkoutDetail[] = [];
  const issues: ImportIssue[] = [];
  let duplicatesSkipped = 0;
  let setsImported = 0;

  for (const parsed of analysis.workouts) {
    if (options.selectedKeys && !options.selectedKeys.has(parsed.key)) continue;
    if (!options.allowDuplicates && options.existingFingerprints.has(parsed.fingerprint)) {
      duplicatesSkipped += 1;
      continue;
    }

    const workoutId = uuid();
    const started = new Date(parsed.startedAt);
    const workout: Workout = {
      id: workoutId,
      name: parsed.name,
      status: 'completed',
      startedAt: parsed.startedAt,
      endedAt: parsed.durationSeconds
        ? new Date(started.getTime() + parsed.durationSeconds * 1000).toISOString()
        : parsed.startedAt,
      localDate: localDateOf(started),
      tzOffsetMinutes: tzOffsetMinutes(started),
      pausedSeconds: 0,
      notes: parsed.notes,
      importFingerprint: parsed.fingerprint,
      importJobId: jobId,
      createdAt: now,
      updatedAt: now,
    };

    const detail: WorkoutDetail = { workout, exercises: [] };

    parsed.exercises.forEach((entry, index) => {
      const key = normaliseExerciseName(entry.name);
      let exercise = byName.get(key);
      if (!exercise) {
        exercise = {
          id: uuid(),
          // Imported names are kept verbatim so history reads the way the user wrote it.
          name: entry.name,
          primaryMuscleGroup: 'full body',
          secondaryMuscleGroups: [],
          equipment: 'other',
          movementPattern: 'isolation',
          trackingType: inferTrackingType(entry.sets),
          isCustom: true,
          isArchived: false,
          notes: 'Created automatically by a Strong CSV import — edit its muscle group and equipment to improve analytics.',
          createdAt: now,
          updatedAt: now,
        };
        byName.set(key, exercise);
        newExercises.push(exercise);
      }

      const workoutExercise: WorkoutExercise = {
        id: uuid(),
        workoutId,
        exerciseId: exercise.id,
        order: index,
        exerciseNameSnapshot: exercise.name,
        primaryMuscleGroupSnapshot: exercise.primaryMuscleGroup,
        secondaryMuscleGroupsSnapshot: exercise.secondaryMuscleGroups,
        equipmentSnapshot: exercise.equipment,
        trackingTypeSnapshot: exercise.trackingType,
        restSeconds: 120,
      };

      const sets: WorkoutSet[] = entry.sets.map((set, setIndex) => ({
        id: uuid(),
        workoutId,
        workoutExerciseId: workoutExercise.id,
        order: setIndex,
        setType: set.isWarmup ? 'warmup' : 'working',
        weightG: set.weightG,
        reps: set.reps,
        rpe: set.rpe,
        durationSeconds: set.durationSeconds,
        distanceM: set.distanceM,
        isCompleted: true,
        completedAt: parsed.startedAt,
        notes: set.notes,
      }));

      setsImported += sets.length;
      detail.exercises.push({ exercise: workoutExercise, sets });
    });

    workouts.push(detail);
  }

  for (const issue of analysis.issues) {
    issues.push({ id: uuid(), jobId, ...issue });
  }

  const job: ImportJob = {
    id: jobId,
    source: 'strong-csv',
    fileName: options.fileName,
    startedAt: now,
    finishedAt: now,
    status: 'completed',
    workoutsImported: workouts.length,
    setsImported,
    exercisesCreated: newExercises.length,
    rowsSkipped: analysis.skippedRows + duplicatesSkipped,
    messages: [
      `${workouts.length} workouts imported from ${options.fileName}.`,
      `${setsImported} sets written, ${newExercises.length} exercises created.`,
      duplicatesSkipped > 0 ? `${duplicatesSkipped} duplicate workouts skipped.` : '',
    ].filter(Boolean),
  };

  return { job, newExercises, workouts, issues, duplicatesSkipped };
}

// --------------------------------------------------------------------- helpers

function cell(row: readonly string[], index: number | undefined): string {
  if (index === undefined) return '';
  return row[index] ?? '';
}

export function normaliseExerciseName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Parses the date formats Strong has used: `2024-01-15 09:30:00`, `2024-01-15`,
 * ISO-8601 with an offset, and `15/01/2024 09:30` (day-first locales).
 */
export function parseStrongDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) return null;

  const isoLike = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (isoLike) {
    const [, y, m, d, hh, mm, ss] = isoLike;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh), Number(mm), Number(ss ?? 0));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, y, m, d] = dateOnly;
    const date = new Date(Number(y), Number(m) - 1, Number(d), 12, 0, 0);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const dayFirst = /^(\d{1,2})[/.](\d{1,2})[/.](\d{4})(?:[ ,]+(\d{1,2}):(\d{2}))?/.exec(value);
  if (dayFirst) {
    const [, d, m, y, hh, mm] = dayFirst;
    const date = new Date(Number(y), Number(m) - 1, Number(d), Number(hh ?? 12), Number(mm ?? 0));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Accepts `1,5` (comma decimal), `1.5`, `1 234.5` and blank. */
export function parseNumber(raw: string): number | undefined {
  const value = raw.trim();
  if (!value) return undefined;
  const cleaned = value.replace(/\s/g, '').replace(/,(\d{1,3})$/, '.$1').replace(/,/g, '');
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/** Parses `1h 5m`, `45m`, `1:05:00`, `90` (minutes) into seconds. */
export function parseDuration(raw: string): number | undefined {
  const value = raw.trim().toLowerCase();
  if (!value) return undefined;

  const clock = /^(\d+):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (clock) {
    const [, a, b, c] = clock;
    return c
      ? Number(a) * 3600 + Number(b) * 60 + Number(c)
      : Number(a) * 3600 + Number(b) * 60;
  }

  let seconds = 0;
  let matched = false;
  const hours = /(\d+(?:[.,]\d+)?)\s*h/.exec(value);
  if (hours?.[1]) {
    seconds += Number(hours[1].replace(',', '.')) * 3600;
    matched = true;
  }
  const minutes = /(\d+(?:[.,]\d+)?)\s*m(?!s)/.exec(value);
  if (minutes?.[1]) {
    seconds += Number(minutes[1].replace(',', '.')) * 60;
    matched = true;
  }
  const secs = /(\d+(?:[.,]\d+)?)\s*s/.exec(value);
  if (secs?.[1]) {
    seconds += Number(secs[1].replace(',', '.'));
    matched = true;
  }
  if (matched) return Math.round(seconds);

  const bare = parseNumber(value);
  return bare === undefined ? undefined : Math.round(bare * 60);
}

function toDistanceMetres(
  value: number,
  unit: 'm' | 'km' | 'mi' | undefined,
  header: readonly string[],
): number {
  const joined = header.join(' ').toLowerCase();
  const resolved = unit ?? (/(km)/.test(joined) ? 'km' : /(mile|mi\b)/.test(joined) ? 'mi' : 'm');
  if (resolved === 'km') return Math.round(value * 1000);
  if (resolved === 'mi') return Math.round(value * 1609.344);
  return Math.round(value);
}

function inferTrackingType(sets: readonly ParsedSetRow[]): Exercise['trackingType'] {
  const hasWeight = sets.some((set) => (set.weightG ?? 0) > 0);
  const hasReps = sets.some((set) => (set.reps ?? 0) > 0);
  const hasDistance = sets.some((set) => (set.distanceM ?? 0) > 0);
  const hasDuration = sets.some((set) => (set.durationSeconds ?? 0) > 0);
  if (hasWeight) return 'weight_reps';
  if (hasDistance) return 'distance_duration';
  if (hasDuration && !hasReps) return 'duration';
  return 'reps_only';
}

export type { UUID };
