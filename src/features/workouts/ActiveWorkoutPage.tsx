import { useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useRepository, useRepositoryData, useTicker, useWrite } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { toast } from '@/app/store';
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  IconButton,
  NumberInput,
  Segmented,
  Sheet,
  Spinner,
  TextArea,
  TextInput,
  cx,
} from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { PlateCalculatorPanel } from '@/features/calculators/PlateCalculatorPanel';
import { WarmupPanel } from '@/features/calculators/WarmupPanel';
import { elapsedSeconds } from '@/domain/time';
import { formatDuration, formatWeight } from '@/domain/units';
import { totalsForGroups } from '@/domain/volume';
import { titleCase, usesWeight } from '@/domain/taxonomy';
import type { SetType, TemplateExercise, WorkoutExercise, WorkoutSet } from '@/domain/types';
import { SetRow } from './SetRow';
import { pairedSetInputs, previousForRow } from './setPrefill';
import { groupSetsForDisplay } from './setGrouping';
import { useRestTimerStore } from './restTimer';
import { formatTarget, resolveExerciseTarget } from './targetPrescription';

/**
 * Active workout screen.
 *
 * Every edit is written to IndexedDB as it happens — there is no in-memory session that
 * can be lost. Leaving the screen, reloading, or the browser being killed all resume from
 * the stored workout, and the rest timer resumes from its absolute end timestamp.
 */
export function ActiveWorkoutPage() {
  const navigate = useNavigate();
  const repository = useRepository();
  const { settings, weightUnit } = useSettings();
  const startTimer = useRestTimerStore((state) => state.start);
  const stopTimerForWorkout = useRestTimerStore((state) => state.stopForWorkout);

  const { data, loading, reload } = useRepositoryData((repo) => repo.getActiveWorkout(), []);
  const { data: previousByExercise } = useRepositoryData(
    async (repo) => {
      const active = await repo.getActiveWorkout();
      if (!active) return {};
      const entries = await Promise.all(
        active.exercises.map(
          async (entry) =>
            [
              entry.exercise.exerciseId,
              await repo.getPreviousSetsForExercise(entry.exercise.exerciseId, active.workout.id),
            ] as const,
        ),
      );
      return Object.fromEntries(entries) as Record<string, WorkoutSet[]>;
    },
    [data?.workout.id, data?.exercises.length],
  );

  const { data: templateExercises } = useRepositoryData<TemplateExercise[] | undefined>(
    async (repo) => {
      if (!data?.workout.templateId) return undefined;
      const detail = await repo.getTemplateDetail(data.workout.templateId);
      return detail?.exercises.map((item) => item.templateExercise);
    },
    [data?.workout.templateId],
  );

  const [picking, setPicking] = useState(false);
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [plateFor, setPlateFor] = useState<{ setId: string; weightG?: number } | null>(null);
  const [warmupFor, setWarmupFor] = useState<string | null>(null);
  const [replacing, setReplacing] = useState<string | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  const tick = useTicker(!!data, 1_000);
  const elapsed = useMemo(
    () =>
      data ? elapsedSeconds(data.workout.startedAt, undefined, data.workout.pausedSeconds) : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data, tick],
  );

  useEffect(() => {
    if (data) setNameDraft(data.workout.name);
  }, [data]);

  const totals = useMemo(() => {
    if (!data) return null;
    return totalsForGroups(
      data.exercises.map((entry) => ({ exercise: entry.exercise, sets: entry.sets })),
      { includeWarmups: !settings.excludeWarmupsFromAnalytics },
    );
  }, [data, settings.excludeWarmupsFromAnalytics]);

  const [addExercises] = useWrite(async (ids: string[], supersetGroup?: string) => {
    if (!data) return;
    for (const id of ids) {
      const workoutExercise = await repository.addExerciseToWorkout(data.workout.id, id, {
        supersetGroup,
      });
      if (workoutExercise.unilateralSnapshot) {
        await repository.addSets(
          data.workout.id,
          pairedSetInputs(workoutExercise.id, {}),
        );
      } else {
        await repository.addSet(data.workout.id, { workoutExerciseId: workoutExercise.id });
      }
    }
    reload();
  });

  const [updateSet] = useWrite(async (id: string, patch: Partial<WorkoutSet>) => {
    await repository.updateSet(id, patch);
    reload();
  });

  const [completeSet] = useWrite(
    async (set: WorkoutSet, prefill: Partial<WorkoutSet>, restSeconds: number, label: string) => {
      const next = !set.isCompleted;
      await repository.updateSet(set.id, { ...(next ? prefill : {}), isCompleted: next });
      reload();
      // Confirmed, intended behavior: completing left then right just restarts the timer
      // against whichever side finished most recently — the timer store is a last-write-wins
      // singleton, so no special-casing for unilateral pairs is needed here.
      if (next && settings.restTimerAutoStart && restSeconds > 0) {
        await startTimer(restSeconds, { workoutId: set.workoutId, setId: set.id, label });
      }
    },
  );

  const [deleteSet] = useWrite(async (set: WorkoutSet, partner?: WorkoutSet) => {
    await repository.deleteSet(set.id);
    if (partner) await repository.deleteSet(partner.id);
    reload();
    toast.undo('Set deleted.', () => {
      void Promise.all([
        repository.restoreSet(set),
        partner ? repository.restoreSet(partner) : Promise.resolve(),
      ]).then(reload);
    });
  });

  const [addSet] = useWrite(
    async (
      exercise: WorkoutExercise,
      sets: WorkoutSet[],
      template?: WorkoutSet,
    ) => {
      if (!data) return;
      if (exercise.unilateralSnapshot) {
        const lastLeft = [...sets].reverse().find((s) => s.side === 'left');
        const lastRight = [...sets].reverse().find((s) => s.side === 'right');
        await repository.addSets(
          data.workout.id,
          pairedSetInputs(exercise.id, { left: lastLeft, right: lastRight }),
        );
      } else {
        await repository.addSet(data.workout.id, {
          workoutExerciseId: exercise.id,
          weightG: template?.weightG,
          reps: template?.reps,
          setType: template?.setType ?? 'working',
        });
      }
      reload();
    },
  );

  const [removeExercise] = useWrite(async (workoutExerciseId: string) => {
    await repository.removeWorkoutExercise(workoutExerciseId);
    setMenuFor(null);
    reload();
  });

  const [moveExercise] = useWrite(async (workoutExerciseId: string, direction: -1 | 1) => {
    if (!data) return;
    const ids = data.exercises.map((entry) => entry.exercise.id);
    const index = ids.indexOf(workoutExerciseId);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target]!, ids[index]!];
    await repository.reorderWorkoutExercises(data.workout.id, ids);
    reload();
  });

  const [finish] = useWrite(async () => {
    if (!data) return;
    const id = data.workout.id;
    await repository.completeWorkout(id);
    await stopTimerForWorkout(id);
    navigate(`/workout/${id}/summary`, { replace: true });
  });

  const [discard] = useWrite(async () => {
    if (!data) return;
    await repository.discardWorkout(data.workout.id);
    await stopTimerForWorkout(data.workout.id);
    toast.info('Workout discarded.');
    navigate('/', { replace: true });
  });

  const [saveWorkout] = useWrite(async (patch: { name?: string; notes?: string }) => {
    if (!data) return;
    await repository.updateWorkout(data.workout.id, patch);
    reload();
  });

  if (loading && !data) return <Spinner label="Loading your workout" />;
  if (!loading && !data) return <Navigate to="/" replace />;
  if (!data) return null;

  const { workout, exercises } = data;
  const menuEntry = exercises.find((entry) => entry.exercise.id === menuFor);
  const warmupEntry = exercises.find((entry) => entry.exercise.id === warmupFor);

  return (
    <>
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-line bg-canvas/95 px-4 py-3 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            {editingName ? (
              <TextInput
                autoFocus
                value={nameDraft}
                aria-label="Workout name"
                maxLength={120}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => {
                  setEditingName(false);
                  const name = nameDraft.trim();
                  if (name && name !== workout.name) void saveWorkout({ name });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') event.currentTarget.blur();
                }}
              />
            ) : (
              <button
                type="button"
                className="block max-w-full truncate text-left text-lg font-bold text-ink"
                onClick={() => setEditingName(true)}
                aria-label={`Workout name: ${workout.name}. Tap to rename`}
              >
                {workout.name}
                <span aria-hidden="true" className="ml-1.5 inline-flex text-ink-subtle">
                  <Icon icon={Icons.pencil} size={12} />
                </span>
              </button>
            )}
            <p className="flex items-center gap-2 text-xs text-ink-muted">
              <span className="tabular-nums font-semibold text-accent">
                {formatDuration(elapsed)}
              </span>
              <span>· {totals?.completedSets ?? 0} sets</span>
              <span>
                · {formatWeight(totals?.volumeG ?? 0, weightUnit, { decimals: 0 })} {weightUnit}{' '}
                volume
              </span>
            </p>
          </div>
          <Button variant="primary" onClick={() => setConfirmFinish(true)}>
            Finish
          </Button>
        </div>
      </header>

      {exercises.length === 0 && (
        <EmptyState
          title="Empty workout"
          description="Add your first exercise. Everything you log is saved on this device as you go."
          icon={<Icon icon={Icons.plus} size={22} />}
          action={
            <Button variant="primary" onClick={() => setPicking(true)}>
              Add exercise
            </Button>
          }
        />
      )}

      <ul className="space-y-4">
        {exercises.map((entry, exerciseIndex) => {
          const previous = previousByExercise?.[entry.exercise.exerciseId] ?? [];
          const target = resolveExerciseTarget(workout, entry.exercise, templateExercises);
          const supersetPartners = entry.exercise.supersetGroup
            ? exercises.filter(
                (other) =>
                  other.exercise.supersetGroup === entry.exercise.supersetGroup &&
                  other.exercise.id !== entry.exercise.id,
              )
            : [];

          return (
            <li key={entry.exercise.id}>
              <Card className="p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-semibold text-ink">
                      {entry.exercise.exerciseNameSnapshot}
                    </h2>
                    <p className="flex flex-wrap items-center gap-1.5 text-xs text-ink-subtle">
                      <span>{titleCase(entry.exercise.primaryMuscleGroupSnapshot)}</span>
                      <span>· {titleCase(entry.exercise.equipmentSnapshot)}</span>
                      <span>· rest {formatDuration(entry.exercise.restSeconds)}</span>
                      {target && <span>· {formatTarget(target)}</span>}
                      {supersetPartners.length > 0 && (
                        <Chip tone="accent">Superset {entry.exercise.supersetGroup}</Chip>
                      )}
                    </p>
                  </div>
                  <IconButton
                    label={`Options for ${entry.exercise.exerciseNameSnapshot}`}
                    onClick={() => setMenuFor(entry.exercise.id)}
                  >
                    <Icon icon={Icons.more} size={18} />
                  </IconButton>
                </div>

                {entry.exercise.notes && (
                  <p className="mb-2 rounded bg-surface-raised px-2 py-1 text-xs text-ink-muted">
                    {entry.exercise.notes}
                  </p>
                )}

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
                        previous={previousForRow(previous, entry.sets, set)}
                        targetRepMin={target?.repMin}
                        targetRepMax={target?.repMax}
                        onChange={(patch) => void updateSet(set.id, patch)}
                        onToggleComplete={(prefill) =>
                          void completeSet(
                            set,
                            prefill,
                            entry.exercise.restSeconds,
                            entry.exercise.exerciseNameSnapshot,
                          )
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

                <div className="mt-2 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={() => void addSet(entry.exercise, entry.sets, entry.sets.at(-1))}
                    icon={<Icon icon={Icons.plus} size={14} />}
                  >
                    Add set
                  </Button>
                  {usesWeight(entry.exercise.trackingTypeSnapshot) && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setWarmupFor(entry.exercise.id)}
                      >
                        Warm-up
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setPlateFor({
                            setId:
                              entry.sets.find((set) => !set.isCompleted)?.id ??
                              entry.sets[0]?.id ??
                              '',
                            weightG: entry.sets.find((set) => !set.isCompleted)?.weightG,
                          })
                        }
                      >
                        Plates
                      </Button>
                    </>
                  )}
                  {exerciseIndex > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void moveExercise(entry.exercise.id, -1)}
                      icon={<Icon icon={Icons.chevronUp} size={14} />}
                    >
                      Move up
                    </Button>
                  )}
                  {exerciseIndex < exercises.length - 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => void moveExercise(entry.exercise.id, 1)}
                      icon={<Icon icon={Icons.chevronDown} size={14} />}
                    >
                      Move down
                    </Button>
                  )}
                </div>
              </Card>
            </li>
          );
        })}
      </ul>

      {exercises.length > 0 && (
        <Button
          block
          className="mt-4"
          onClick={() => setPicking(true)}
          icon={<Icon icon={Icons.plus} size={16} />}
        >
          Add exercise
        </Button>
      )}

      <div className="mt-4">
        <label className="rf-label" htmlFor="workout-notes">
          Workout notes
        </label>
        <TextArea
          id="workout-notes"
          defaultValue={workout.notes ?? ''}
          maxLength={2_000}
          placeholder="How did it feel? Anything to change next time?"
          onBlur={(event) => void saveWorkout({ notes: event.target.value.trim() || undefined })}
        />
      </div>

      <Button
        variant="ghost"
        block
        className="mb-8 mt-2 text-danger"
        onClick={() => setConfirmDiscard(true)}
      >
        Discard workout
      </Button>

      <ExercisePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(picked) => void addExercises(picked.map((exercise) => exercise.id))}
      />

      <ExercisePicker
        open={!!replacing}
        multi={false}
        title="Replace exercise"
        onClose={() => setReplacing(null)}
        onPick={async (picked) => {
          const target = replacing;
          const replacement = picked[0];
          if (!target || !replacement) return;
          await repository.replaceWorkoutExercise(target, replacement.id);
          setReplacing(null);
          setMenuFor(null);
          reload();
        }}
      />

      <Sheet
        open={!!menuEntry}
        onClose={() => setMenuFor(null)}
        title={menuEntry?.exercise.exerciseNameSnapshot ?? 'Exercise'}
      >
        {menuEntry && (
          <div className="space-y-4">
            <div>
              <label className="rf-label" htmlFor="exercise-rest">
                Rest between sets (seconds)
              </label>
              <NumberInput
                id="exercise-rest"
                defaultValue={menuEntry.exercise.restSeconds}
                min={0}
                step={15}
                inputMode="numeric"
                onBlur={(event) => {
                  const value = Math.max(0, Number.parseInt(event.target.value, 10) || 0);
                  void repository
                    .updateWorkoutExercise(menuEntry.exercise.id, { restSeconds: value })
                    .then(reload);
                }}
              />
            </div>

            <div>
              <label className="rf-label" htmlFor="exercise-notes">
                Exercise notes
              </label>
              <TextArea
                id="exercise-notes"
                defaultValue={menuEntry.exercise.notes ?? ''}
                maxLength={1_000}
                onBlur={(event) => {
                  void repository
                    .updateWorkoutExercise(menuEntry.exercise.id, {
                      notes: event.target.value.trim() || undefined,
                    })
                    .then(reload);
                }}
              />
            </div>

            <div>
              <span className="rf-label">Superset group</span>
              <Segmented
                label="Superset group"
                value={menuEntry.exercise.supersetGroup ?? 'none'}
                onChange={(value) => {
                  void repository
                    .updateWorkoutExercise(menuEntry.exercise.id, {
                      supersetGroup: value === 'none' ? undefined : value,
                    })
                    .then(reload);
                }}
                options={[
                  { value: 'none', label: 'None' },
                  { value: 'A', label: 'A' },
                  { value: 'B', label: 'B' },
                  { value: 'C', label: 'C' },
                ]}
              />
              <p className="mt-1 text-xs text-ink-subtle">
                Exercises sharing a group are performed back to back as a superset or circuit.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button block onClick={() => setReplacing(menuEntry.exercise.id)}>
                Replace exercise
              </Button>
              <Button
                block
                variant="danger"
                onClick={() => void removeExercise(menuEntry.exercise.id)}
              >
                Remove from workout
              </Button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet open={!!plateFor} onClose={() => setPlateFor(null)} title="Plate calculator">
        <PlateCalculatorPanel
          initialTargetG={plateFor?.weightG}
          applyLabel="Put this weight in the set"
          onApply={(weightG) => {
            if (plateFor?.setId) void updateSet(plateFor.setId, { weightG });
            setPlateFor(null);
          }}
        />
      </Sheet>

      <Sheet
        open={!!warmupEntry}
        onClose={() => setWarmupFor(null)}
        title="Warm-up generator"
        size="lg"
      >
        {warmupEntry && (
          <WarmupPanel
            workingWeightG={
              warmupEntry.sets.find((set) => set.setType === 'working' && set.weightG)?.weightG ??
              warmupEntry.sets[0]?.weightG
            }
            equipment={warmupEntry.exercise.equipmentSnapshot}
            insertLabel="Insert before working sets"
            onInsert={async (steps) => {
              // Deliberately bilateral even for a unilateral exercise: the warm-up ramp is
              // one weight regardless of side, and the generator has no per-side concept.
              // Only working sets (add/complete/delete) split into left/right rows.
              await repository.addSets(
                workout.id,
                steps.map((step) => ({
                  workoutExerciseId: warmupEntry.exercise.id,
                  weightG: step.weightG,
                  reps: step.reps,
                  setType: 'warmup' as const,
                })),
              );
              // Warm-ups belong before the working sets, so re-order the whole exercise.
              const detail = await repository.getWorkoutDetail(workout.id);
              const target = detail?.exercises.find(
                (item) => item.exercise.id === warmupEntry.exercise.id,
              );
              if (target) {
                const ordered = [
                  ...target.sets.filter((set) => set.setType === 'warmup'),
                  ...target.sets.filter((set) => set.setType !== 'warmup'),
                ];
                await Promise.all(
                  ordered.map((set, order) => repository.updateSet(set.id, { order })),
                );
              }
              setWarmupFor(null);
              reload();
              toast.success(`${steps.length} warm-up sets added.`);
            }}
          />
        )}
      </Sheet>

      <ConfirmDialog
        open={confirmFinish}
        title="Finish this workout?"
        tone="primary"
        confirmLabel="Finish workout"
        body={
          <>
            <p>
              Completed sets are saved to your history and feed your analytics and records. Any set
              you have not ticked off will be removed.
            </p>
            <p className="mt-2 text-ink">
              {totals?.completedSets ?? 0} completed sets ·{' '}
              {formatWeight(totals?.volumeG ?? 0, weightUnit, { decimals: 0 })} {weightUnit} volume
              · {formatDuration(elapsed)}
            </p>
          </>
        }
        onCancel={() => setConfirmFinish(false)}
        onConfirm={() => {
          setConfirmFinish(false);
          void finish();
        }}
      />

      <ConfirmDialog
        open={confirmDiscard}
        title="Discard this workout?"
        confirmLabel="Discard"
        body={
          <p>
            This deletes the session and every set logged in it. It cannot be undone, and nothing
            will appear in your history or analytics.
          </p>
        }
        onCancel={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          void discard();
        }}
      />

      <div className={cx('h-16')} aria-hidden="true" />
    </>
  );
}
