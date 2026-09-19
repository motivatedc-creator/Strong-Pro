import { useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useRepository, useRepositoryData, useWrite } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { toast } from '@/app/store';
import {
  Button,
  Card,
  ConfirmDialog,
  IconButton,
  PageHeader,
  Spinner,
  TextArea,
  TextInput,
} from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { elapsedSeconds, formatDateTime } from '@/domain/time';
import { formatDuration, formatWeight } from '@/domain/units';
import { totalsForGroups } from '@/domain/volume';
import { titleCase } from '@/domain/taxonomy';
import type { SetType, WorkoutExercise, WorkoutSet } from '@/domain/types';
import { SetRow } from './SetRow';
import { pairedSetInputs } from './setPrefill';
import { groupSetsForDisplay } from './setGrouping';

/**
 * Completed-workout detail and editor.
 *
 * Edits here are edits to the canonical record: analytics, records and volume are
 * recomputed from these sets the next time they are read, never patched separately.
 */
export function WorkoutDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const repository = useRepository();
  const { settings, weightUnit } = useSettings();
  const [picking, setPicking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const { data, loading, reload } = useRepositoryData(
    (repo) => (id ? repo.getWorkoutDetail(id) : Promise.resolve(undefined)),
    [id],
  );

  const [updateSet] = useWrite(async (setId: string, patch: Partial<WorkoutSet>) => {
    await repository.updateSet(setId, patch);
    reload();
  });

  const [deleteSet] = useWrite(async (set: WorkoutSet, partner?: WorkoutSet) => {
    await repository.deleteSet(set.id);
    if (partner) await repository.deleteSet(partner.id);
    reload();
    toast.undo('Set deleted.', () =>
      void Promise.all([
        repository.restoreSet(set),
        partner ? repository.restoreSet(partner) : Promise.resolve(),
      ]).then(reload),
    );
  });

  const [addSet] = useWrite(
    async (exercise: WorkoutExercise, sets: WorkoutSet[], template?: WorkoutSet) => {
      if (!data) return;
      if (exercise.unilateralSnapshot) {
        const lastLeft = [...sets].reverse().find((s) => s.side === 'left');
        const lastRight = [...sets].reverse().find((s) => s.side === 'right');
        await repository.addSets(
          data.workout.id,
          pairedSetInputs(exercise.id, { left: lastLeft, right: lastRight }).map((input) => ({
            ...input,
            isCompleted: true,
          })),
        );
      } else {
        await repository.addSet(data.workout.id, {
          workoutExerciseId: exercise.id,
          weightG: template?.weightG,
          reps: template?.reps,
          setType: template?.setType ?? 'working',
          isCompleted: true,
        });
      }
      reload();
    },
  );

  const [addExercises] = useWrite(async (ids: string[]) => {
    if (!data) return;
    for (const exerciseId of ids) {
      const workoutExercise = await repository.addExerciseToWorkout(data.workout.id, exerciseId);
      if (workoutExercise.unilateralSnapshot) {
        await repository.addSets(
          data.workout.id,
          pairedSetInputs(workoutExercise.id, {}).map((input) => ({
            ...input,
            isCompleted: true,
          })),
        );
      } else {
        await repository.addSet(data.workout.id, {
          workoutExerciseId: workoutExercise.id,
          isCompleted: true,
        });
      }
    }
    reload();
  });

  const [removeExercise] = useWrite(async (workoutExerciseId: string) => {
    await repository.removeWorkoutExercise(workoutExerciseId);
    reload();
  });

  const [save] = useWrite(async (patch: { name?: string; notes?: string }) => {
    if (!data) return;
    await repository.updateWorkout(data.workout.id, patch);
    reload();
  });

  const [remove] = useWrite(async () => {
    if (!data) return;
    await repository.deleteWorkout(data.workout.id);
    toast.info('Workout deleted.');
    navigate('/history', { replace: true });
  });

  if (loading && !data) return <Spinner label="Loading workout" />;
  if (!loading && !data) return <Navigate to="/history" replace />;
  if (!data) return null;

  const { workout, exercises } = data;
  const totals = totalsForGroups(
    exercises.map((entry) => ({ exercise: entry.exercise, sets: entry.sets })),
    { includeWarmups: !settings.excludeWarmupsFromAnalytics },
  );
  const duration = elapsedSeconds(workout.startedAt, workout.endedAt, workout.pausedSeconds);

  return (
    <>
      <PageHeader
        title="Workout"
        subtitle={`${formatDateTime(workout.startedAt)} · ${formatDuration(duration)} · ${
          totals.completedSets
        } sets · ${formatWeight(totals.volumeG, weightUnit, { decimals: 0 })} ${weightUnit}`}
        actions={
          <Button variant="ghost" className="text-danger" onClick={() => setConfirmDelete(true)}>
            Delete
          </Button>
        }
      />

      <div className="mb-4">
        <label className="rf-label" htmlFor="workout-name">
          Name
        </label>
        <TextInput
          id="workout-name"
          defaultValue={workout.name}
          maxLength={120}
          onBlur={(event) => {
            const name = event.target.value.trim();
            if (name && name !== workout.name) void save({ name });
          }}
        />
      </div>

      <ul className="space-y-4">
        {exercises.map((entry) => (
          <li key={entry.exercise.id}>
            <Card className="p-3">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-ink">
                    {entry.exercise.exerciseNameSnapshot}
                  </h2>
                  <p className="text-xs text-ink-subtle">
                    {titleCase(entry.exercise.primaryMuscleGroupSnapshot)} ·{' '}
                    {titleCase(entry.exercise.equipmentSnapshot)}
                  </p>
                </div>
                <IconButton
                  label={`Remove ${entry.exercise.exerciseNameSnapshot} from this workout`}
                  onClick={() => void removeExercise(entry.exercise.id)}
                >
                  <Icon icon={Icons.trash} size={16} />
                </IconButton>
              </div>

              <ul className="space-y-1.5">
                {groupSetsForDisplay(entry.sets).flatMap(({ displayNumber, rows }) =>
                  rows.map((set) => (
                    <SetRow
                      key={set.id}
                      set={set}
                      displayNumber={displayNumber}
                      side={set.side}
                      trackingType={entry.exercise.trackingTypeSnapshot}
                      weightUnit={weightUnit}
                      intensityMode={settings.intensityMode}
                      quickIncrementG={settings.quickIncrementG}
                      onChange={(patch) => void updateSet(set.id, patch)}
                      onToggleComplete={(prefill) =>
                        void updateSet(set.id, { ...prefill, isCompleted: !set.isCompleted })
                      }
                      onDelete={() =>
                        void deleteSet(
                          set,
                          set.pairId
                            ? entry.sets.find(
                                (other) => other.pairId === set.pairId && other.id !== set.id,
                              )
                            : undefined,
                        )
                      }
                      onCycleType={(setType: SetType) => void updateSet(set.id, { setType })}
                    />
                  )),
                )}
              </ul>

              <Button
                size="sm"
                className="mt-2"
                onClick={() => void addSet(entry.exercise, entry.sets, entry.sets.at(-1))}
              >
                + Add set
              </Button>
            </Card>
          </li>
        ))}
      </ul>

      <Button block className="mt-4" onClick={() => setPicking(true)}>
        + Add exercise
      </Button>

      <div className="mt-4">
        <label className="rf-label" htmlFor="detail-notes">
          Workout notes
        </label>
        <TextArea
          id="detail-notes"
          defaultValue={workout.notes ?? ''}
          maxLength={2_000}
          onBlur={(event) => void save({ notes: event.target.value.trim() || undefined })}
        />
      </div>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(picked) => void addExercises(picked.map((exercise) => exercise.id))}
      />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this workout?"
        confirmLabel="Delete workout"
        body={
          <p>
            This permanently removes {totals.completedSets} logged sets from your history. Volume,
            records and analytics will be recalculated without them. This cannot be undone.
          </p>
        }
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => {
          setConfirmDelete(false);
          void remove();
        }}
      />

      <div className="h-12" aria-hidden="true" />
    </>
  );
}
