import { useMemo, useState } from 'react';
import { useRepositoryData } from '@/app/hooks';
import { Button, Chip, EmptyState, Select, Sheet, Spinner, TextInput, cx } from '@/components/ui';
import { EQUIPMENT, MUSCLE_GROUPS, titleCase, trackingLabel } from '@/domain/taxonomy';
import type { Equipment, Exercise, MuscleGroup } from '@/domain/types';
import { ExerciseEditor } from './ExerciseEditor';

/**
 * Exercise picker used by the template editor and the active workout.
 * Supports multi-select so a superset can be built in one pass.
 */
export function ExercisePicker({
  open,
  onClose,
  onPick,
  title = 'Add exercise',
  multi = true,
  excludeIds = [],
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercises: Exercise[]) => void | Promise<void>;
  title?: string;
  multi?: boolean;
  excludeIds?: string[];
}) {
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [selected, setSelected] = useState<Exercise[]>([]);
  const [creating, setCreating] = useState(false);

  const { data: exercises, loading } = useRepositoryData(
    (repository) => repository.listExercises(),
    [],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (exercises ?? [])
      .filter((exercise) => !excludeIds.includes(exercise.id))
      .filter((exercise) => (muscle === 'all' ? true : exercise.primaryMuscleGroup === muscle))
      .filter((exercise) => (equipment === 'all' ? true : exercise.equipment === equipment))
      .filter((exercise) =>
        query
          ? exercise.name.toLowerCase().includes(query) ||
            exercise.primaryMuscleGroup.includes(query) ||
            exercise.equipment.includes(query)
          : true,
      );
  }, [exercises, search, muscle, equipment, excludeIds]);

  const toggle = (exercise: Exercise) => {
    if (!multi) {
      void onPick([exercise]);
      reset();
      return;
    }
    setSelected((current) =>
      current.some((entry) => entry.id === exercise.id)
        ? current.filter((entry) => entry.id !== exercise.id)
        : [...current, exercise],
    );
  };

  const reset = () => {
    setSelected([]);
    setSearch('');
    onClose();
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={reset}
        title={title}
        size="lg"
        footer={
          multi ? (
            <div className="flex items-center gap-2">
              <Button block onClick={() => setCreating(true)}>
                New exercise
              </Button>
              <Button
                block
                variant="primary"
                disabled={selected.length === 0}
                onClick={() => {
                  void onPick(selected);
                  reset();
                }}
              >
                Add {selected.length > 0 ? `${selected.length}` : ''}
              </Button>
            </div>
          ) : (
            <Button block onClick={() => setCreating(true)}>
              New exercise
            </Button>
          )
        }
      >
        <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 bg-surface px-4 pb-3 pt-4">
          <TextInput
            type="search"
            data-autofocus
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search exercises"
            aria-label="Search exercises"
          />
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Select
              aria-label="Filter by muscle group"
              value={muscle}
              onChange={(event) => setMuscle(event.target.value as MuscleGroup | 'all')}
            >
              <option value="all">All muscles</option>
              {MUSCLE_GROUPS.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filter by equipment"
              value={equipment}
              onChange={(event) => setEquipment(event.target.value as Equipment | 'all')}
            >
              <option value="all">All equipment</option>
              {EQUIPMENT.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loading && <Spinner label="Loading exercises" />}

        {!loading && filtered.length === 0 && (
          <EmptyState
            title="No matching exercises"
            description="Try a different filter, or create a custom exercise for this movement."
            icon="🔍"
            action={
              <Button variant="primary" onClick={() => setCreating(true)}>
                Create &quot;{search.trim() || 'new exercise'}&quot;
              </Button>
            }
          />
        )}

        <ul className="space-y-1.5">
          {filtered.map((exercise) => {
            const isSelected = selected.some((entry) => entry.id === exercise.id);
            return (
              <li key={exercise.id}>
                <button
                  type="button"
                  aria-pressed={multi ? isSelected : undefined}
                  onClick={() => toggle(exercise)}
                  className={cx(
                    'flex min-h-tap w-full items-center gap-3 rounded border px-3 py-2 text-left transition',
                    isSelected
                      ? 'border-accent bg-accent/10'
                      : 'border-line bg-surface-raised hover:border-accent/60',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cx(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold',
                      isSelected
                        ? 'border-accent bg-accent text-accent-ink'
                        : 'border-line text-ink-subtle',
                    )}
                  >
                    {isSelected ? '✓' : '+'}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink">
                      {exercise.name}
                    </span>
                    <span className="block truncate text-xs text-ink-subtle">
                      {titleCase(exercise.primaryMuscleGroup)} · {titleCase(exercise.equipment)} ·{' '}
                      {trackingLabel(exercise.trackingType)}
                    </span>
                  </span>
                  {exercise.isCustom && <Chip tone="accent">Custom</Chip>}
                </button>
              </li>
            );
          })}
        </ul>
      </Sheet>

      <ExerciseEditor
        open={creating}
        initialName={search.trim()}
        onClose={() => setCreating(false)}
        onSaved={(exercise) => {
          if (multi) setSelected((current) => [...current, exercise]);
          else {
            void onPick([exercise]);
            reset();
          }
        }}
      />
    </>
  );
}
