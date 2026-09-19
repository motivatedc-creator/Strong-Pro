import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository, useRepositoryData, useWrite } from '@/app/hooks';
import { toast } from '@/app/store';
import { Button, Card, EmptyState, PageHeader, Select, Spinner } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { EQUIPMENT, MOVEMENT_PATTERNS, MUSCLE_GROUPS, titleCase } from '@/domain/taxonomy';
import type { Equipment, Exercise, MovementPattern, MuscleGroup } from '@/domain/types';

interface Draft {
  primaryMuscleGroup: MuscleGroup;
  equipment: Equipment;
  movementPattern: MovementPattern;
}

function toDraft(exercise: Exercise): Draft {
  return {
    primaryMuscleGroup: exercise.primaryMuscleGroup,
    equipment: exercise.equipment,
    movementPattern: exercise.movementPattern,
  };
}

function isChanged(exercise: Exercise, draft: Draft): boolean {
  return (
    draft.primaryMuscleGroup !== exercise.primaryMuscleGroup ||
    draft.equipment !== exercise.equipment ||
    draft.movementPattern !== exercise.movementPattern
  );
}

/**
 * Classifies every exercise still sitting as `unmapped` — usually a pile left by a Strong
 * import — in one sitting, instead of opening each one in the exercise editor by hand.
 * Never guesses on its own: every row starts exactly as it is today, and only rows the user
 * actually changed are written.
 */
export function BulkClassifyPage() {
  const repository = useRepository();
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});

  const { data, loading, reload } = useRepositoryData(async (repo) => {
    const all = await repo.listExercises({ includeArchived: true });
    return all.filter((exercise) => exercise.primaryMuscleGroup === 'unmapped');
  }, []);

  const exercises = data ?? [];

  const draftFor = (exercise: Exercise): Draft => drafts[exercise.id] ?? toDraft(exercise);

  const changedCount = useMemo(
    () => exercises.filter((exercise) => isChanged(exercise, draftFor(exercise))).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [exercises, drafts],
  );

  const setDraft = (exerciseId: string, patch: Partial<Draft>) => {
    setDrafts((current) => ({
      ...current,
      [exerciseId]: { ...draftFor(exercises.find((e) => e.id === exerciseId)!), ...patch },
    }));
  };

  const [saveAll, saving] = useWrite(async () => {
    const changed = exercises.filter((exercise) => isChanged(exercise, draftFor(exercise)));
    for (const exercise of changed) {
      await repository.updateExercise(exercise.id, draftFor(exercise));
    }
    toast.success(
      changed.length === 1 ? '1 exercise classified.' : `${changed.length} exercises classified.`,
    );
    setDrafts({});
    reload();
  });

  return (
    <>
      <PageHeader
        title="Classify unmapped exercises"
        subtitle={
          exercises.length > 0
            ? `${exercises.length} exercise${exercises.length === 1 ? '' : 's'} without a muscle group`
            : undefined
        }
        actions={
          <Link to="/exercises" className="text-sm font-semibold text-accent">
            Back to library
          </Link>
        }
      />

      {loading && !data && <Spinner label="Loading unmapped exercises" />}

      {!loading && exercises.length === 0 && (
        <EmptyState
          title="Nothing to classify"
          description="Every exercise in your library already has a muscle group set."
          icon={<Icon icon={Icons.check} size={22} />}
        />
      )}

      {exercises.length > 0 && (
        <>
          <p className="mb-3 text-xs text-ink-muted">
            These were created automatically, most likely by a Strong CSV import, because their name
            didn&apos;t match anything already in your library. Set a muscle group, equipment and
            movement pattern for the ones you want counted in Data Lab — leave the rest for later,
            nothing here is forced.
          </p>

          <ul className="mb-20 space-y-2">
            {exercises.map((exercise) => {
              const draft = draftFor(exercise);
              return (
                <li key={exercise.id}>
                  <Card className="p-3">
                    <h2 className="truncate text-sm font-semibold text-ink">{exercise.name}</h2>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <label className="text-xs text-ink-muted">
                        Primary muscle
                        <Select
                          className="mt-1"
                          value={draft.primaryMuscleGroup}
                          onChange={(event) =>
                            setDraft(exercise.id, {
                              primaryMuscleGroup: event.target.value as MuscleGroup,
                            })
                          }
                        >
                          {MUSCLE_GROUPS.map((muscle) => (
                            <option key={muscle} value={muscle}>
                              {muscle === 'unmapped' ? 'Not set' : titleCase(muscle)}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="text-xs text-ink-muted">
                        Equipment
                        <Select
                          className="mt-1"
                          value={draft.equipment}
                          onChange={(event) =>
                            setDraft(exercise.id, { equipment: event.target.value as Equipment })
                          }
                        >
                          {EQUIPMENT.map((equipment) => (
                            <option key={equipment} value={equipment}>
                              {titleCase(equipment)}
                            </option>
                          ))}
                        </Select>
                      </label>
                      <label className="text-xs text-ink-muted">
                        Movement pattern
                        <Select
                          className="mt-1"
                          value={draft.movementPattern}
                          onChange={(event) =>
                            setDraft(exercise.id, {
                              movementPattern: event.target.value as MovementPattern,
                            })
                          }
                        >
                          {MOVEMENT_PATTERNS.map((pattern) => (
                            <option key={pattern} value={pattern}>
                              {titleCase(pattern)}
                            </option>
                          ))}
                        </Select>
                      </label>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 p-4 backdrop-blur">
            <Button
              block
              variant="primary"
              disabled={saving || changedCount === 0}
              onClick={() => void saveAll()}
            >
              {saving
                ? 'Saving…'
                : changedCount === 0
                  ? 'Save all'
                  : `Save ${changedCount} exercise${changedCount === 1 ? '' : 's'}`}
            </Button>
          </div>
        </>
      )}
    </>
  );
}
