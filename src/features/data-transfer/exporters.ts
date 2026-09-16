import { formatWeight, fromMillimetres, weightUnitFor, type WeightUnit } from '@/domain/units';
import type {
  AppSettings,
  BodyMeasurement,
  Exercise,
  Template,
  TemplateExercise,
} from '@/domain/types';
import type { BackupPayload } from '@/db/repository';
import { toCsv } from './csv';

/**
 * Export builders. Every value passes through `escapeCsvValue` (inside `toCsv`), which
 * neutralises spreadsheet formula prefixes — a workout note of `=cmd|...` exports as text.
 */

export function backupToJson(payload: BackupPayload): string {
  return JSON.stringify(payload, null, 2);
}

export interface CsvBundle {
  fileName: string;
  content: string;
}

export function buildCsvBundle(payload: BackupPayload, settings: AppSettings): CsvBundle[] {
  const unit = weightUnitFor(settings.unitSystem);
  return [
    { fileName: 'repforge-sets.csv', content: setsCsv(payload, unit) },
    { fileName: 'repforge-workouts.csv', content: workoutsCsv(payload) },
    { fileName: 'repforge-exercises.csv', content: exercisesCsv(payload.data.exercises) },
    {
      fileName: 'repforge-templates.csv',
      content: templatesCsv(
        payload.data.templates,
        payload.data.templateExercises,
        payload.data.exercises,
      ),
    },
    {
      fileName: 'repforge-measurements.csv',
      content: measurementsCsv(payload.data.measurements, unit),
    },
  ];
}

/** One row per set — the shape most users want for a spreadsheet or another tracker. */
export function setsCsv(payload: BackupPayload, unit: WeightUnit): string {
  const workouts = new Map(payload.data.workouts.map((workout) => [workout.id, workout]));
  const exercises = new Map(payload.data.workoutExercises.map((row) => [row.id, row]));

  const rows = payload.data.workoutSets
    .map((set) => {
      const exercise = exercises.get(set.workoutExerciseId);
      const workout = workouts.get(set.workoutId);
      if (!exercise || !workout) return null;
      return {
        set,
        exercise,
        workout,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort(
      (a, b) =>
        a.workout.startedAt.localeCompare(b.workout.startedAt) ||
        a.exercise.order - b.exercise.order ||
        a.set.order - b.set.order,
    )
    .map(({ set, exercise, workout }) => [
      workout.startedAt,
      workout.localDate,
      workout.name,
      exercise.exerciseNameSnapshot,
      exercise.primaryMuscleGroupSnapshot,
      set.order + 1,
      set.setType,
      set.weightG === undefined ? '' : formatWeight(set.weightG, unit),
      unit,
      set.reps ?? '',
      set.rpe ?? '',
      set.rir ?? '',
      set.durationSeconds ?? '',
      set.distanceM ?? '',
      set.isCompleted ? 'yes' : 'no',
      set.notes ?? '',
      workout.notes ?? '',
    ]);

  return toCsv(
    [
      'Started at',
      'Date',
      'Workout',
      'Exercise',
      'Primary muscle',
      'Set',
      'Set type',
      'Weight',
      'Unit',
      'Reps',
      'RPE',
      'RIR',
      'Seconds',
      'Distance (m)',
      'Completed',
      'Set notes',
      'Workout notes',
    ],
    rows,
  );
}

export function workoutsCsv(payload: BackupPayload): string {
  const setsByWorkout = new Map<string, number>();
  for (const set of payload.data.workoutSets) {
    if (!set.isCompleted) continue;
    setsByWorkout.set(set.workoutId, (setsByWorkout.get(set.workoutId) ?? 0) + 1);
  }

  const rows = [...payload.data.workouts]
    .sort((a, b) => a.startedAt.localeCompare(b.startedAt))
    .map((workout) => [
      workout.id,
      workout.name,
      workout.startedAt,
      workout.endedAt ?? '',
      workout.localDate,
      workout.status,
      setsByWorkout.get(workout.id) ?? 0,
      workout.notes ?? '',
    ]);

  return toCsv(
    ['Workout id', 'Name', 'Started at', 'Ended at', 'Date', 'Status', 'Completed sets', 'Notes'],
    rows,
  );
}

export function exercisesCsv(exercises: readonly Exercise[]): string {
  const rows = [...exercises]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((exercise) => [
      exercise.id,
      exercise.name,
      exercise.primaryMuscleGroup,
      exercise.secondaryMuscleGroups.join('; '),
      exercise.equipment,
      exercise.movementPattern,
      exercise.trackingType,
      exercise.isCustom ? 'custom' : 'library',
      exercise.isArchived ? 'archived' : 'active',
      exercise.notes ?? '',
    ]);

  return toCsv(
    [
      'Exercise id',
      'Name',
      'Primary muscle',
      'Secondary muscles',
      'Equipment',
      'Movement pattern',
      'Tracking',
      'Source',
      'State',
      'Notes',
    ],
    rows,
  );
}

export function templatesCsv(
  templates: readonly Template[],
  templateExercises: readonly TemplateExercise[],
  exercises: readonly Exercise[],
): string {
  const exerciseNames = new Map(exercises.map((exercise) => [exercise.id, exercise.name]));
  const rows = [...templates]
    .sort((a, b) => a.order - b.order)
    .flatMap((template) =>
      templateExercises
        .filter((row) => row.templateId === template.id)
        .sort((a, b) => a.order - b.order)
        .map((row) => [
          template.name,
          template.isArchived ? 'archived' : 'active',
          row.order + 1,
          exerciseNames.get(row.exerciseId) ?? row.exerciseId,
          row.targetSets,
          row.targetRepMin ?? '',
          row.targetRepMax ?? '',
          row.targetRpe ?? '',
          row.targetRir ?? '',
          row.restSeconds,
          row.supersetGroup ?? '',
          row.notes ?? '',
        ]),
    );

  return toCsv(
    [
      'Template',
      'State',
      'Position',
      'Exercise',
      'Target sets',
      'Rep min',
      'Rep max',
      'Target RPE',
      'Target RIR',
      'Rest (s)',
      'Superset group',
      'Notes',
    ],
    rows,
  );
}

export function measurementsCsv(
  measurements: readonly BodyMeasurement[],
  unit: WeightUnit,
): string {
  const rows = [...measurements]
    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
    .map((measurement) => {
      const isWeight = measurement.metric === 'bodyweight';
      const value = isWeight
        ? formatWeight(measurement.value, unit)
        : String(Math.round(fromMillimetres(measurement.value, 'cm') * 10) / 10);
      return [
        measurement.recordedAt,
        measurement.localDate,
        measurement.metric,
        value,
        isWeight ? unit : 'cm',
        measurement.note ?? '',
      ];
    });

  return toCsv(['Recorded at', 'Date', 'Metric', 'Value', 'Unit', 'Note'], rows);
}

/** Triggers a browser download without touching the network. */
export function downloadFile(fileName: string, content: string, mimeType: string): void {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Revoke on the next tick so Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

export function backupFileName(date = new Date()): string {
  const stamp = date.toISOString().slice(0, 19).replace(/[:T]/g, '-');
  return `repforge-backup-${stamp}.json`;
}
