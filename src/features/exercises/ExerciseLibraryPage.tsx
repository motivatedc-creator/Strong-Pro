import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository, useRepositoryData, useWrite } from '@/app/hooks';
import { toast } from '@/app/store';
import {
  Button,
  Card,
  Chip,
  ConfirmDialog,
  EmptyState,
  PageHeader,
  Select,
  Spinner,
  TextInput,
  Toggle,
} from '@/components/ui';
import { EQUIPMENT, MUSCLE_GROUPS, titleCase, trackingLabel } from '@/domain/taxonomy';
import type { Equipment, Exercise, MuscleGroup } from '@/domain/types';
import { ExerciseEditor } from './ExerciseEditor';

/** The exercise library: browse, filter, create, edit, archive and delete. */
export function ExerciseLibraryPage() {
  const repository = useRepository();
  const [search, setSearch] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Exercise | null>(null);

  const { data, loading, reload } = useRepositoryData(
    (repo) => repo.listExercises({ includeArchived: true }),
    [],
  );

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (data ?? [])
      .filter((exercise) => (showArchived ? true : !exercise.isArchived))
      .filter((exercise) => (muscle === 'all' ? true : exercise.primaryMuscleGroup === muscle))
      .filter((exercise) => (equipment === 'all' ? true : exercise.equipment === equipment))
      .filter((exercise) => (query ? exercise.name.toLowerCase().includes(query) : true));
  }, [data, search, muscle, equipment, showArchived]);

  const [setArchived] = useWrite(async (exerciseId: string, archived: boolean) => {
    await repository.setExerciseArchived(exerciseId, archived);
    reload();
  });

  const [remove] = useWrite(async (exercise: Exercise) => {
    const result = await repository.deleteExercise(exercise.id);
    if (!result.deleted) toast.warning(result.reason ?? 'Could not delete this exercise.');
    else toast.success(`${exercise.name} deleted.`);
    reload();
  });

  const customCount = (data ?? []).filter((exercise) => exercise.isCustom).length;

  return (
    <>
      <PageHeader
        title="Exercises"
        subtitle={`${data?.length ?? 0} in your library · ${customCount} custom`}
        actions={
          <Button variant="primary" onClick={() => setCreating(true)}>
            New
          </Button>
        }
      />

      <div className="mb-4 space-y-2">
        <TextInput
          type="search"
          value={search}
          aria-label="Search exercises"
          placeholder="Search exercises"
          onChange={(event) => setSearch(event.target.value)}
        />
        <div className="grid grid-cols-2 gap-2">
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
        <Toggle
          label="Show archived"
          description="Archived exercises stay out of pickers but keep all their history."
          checked={showArchived}
          onChange={setShowArchived}
        />
      </div>

      {loading && !data && <Spinner label="Loading library" />}

      {!loading && filtered.length === 0 && (
        <EmptyState
          title="No exercises match"
          description="Adjust the filters, or add a custom exercise for the movement you need."
          icon="🔍"
          action={
            <Button variant="primary" onClick={() => setCreating(true)}>
              New exercise
            </Button>
          }
        />
      )}

      <ul className="space-y-2">
        {filtered.map((exercise) => (
          <li key={exercise.id}>
            <Card className="p-3">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/exercises/${exercise.id}`} className="min-w-0 flex-1">
                  <h2 className="truncate text-sm font-semibold text-ink">{exercise.name}</h2>
                  <p className="truncate text-xs text-ink-subtle">
                    {titleCase(exercise.primaryMuscleGroup)} · {titleCase(exercise.equipment)} ·{' '}
                    {trackingLabel(exercise.trackingType)}
                  </p>
                </Link>
                <div className="flex shrink-0 gap-1">
                  {exercise.isCustom && <Chip tone="accent">Custom</Chip>}
                  {exercise.isArchived && <Chip tone="warning">Archived</Chip>}
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                <Button size="sm" variant="ghost" onClick={() => setEditing(exercise)}>
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void setArchived(exercise.id, !exercise.isArchived)}
                >
                  {exercise.isArchived ? 'Restore' : 'Archive'}
                </Button>
                {exercise.isCustom && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-danger"
                    onClick={() => setConfirmDelete(exercise)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <ExerciseEditor open={creating} onClose={() => setCreating(false)} onSaved={() => reload()} />
      <ExerciseEditor
        open={!!editing}
        exercise={editing ?? undefined}
        onClose={() => setEditing(null)}
        onSaved={() => reload()}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title={`Delete "${confirmDelete?.name ?? ''}"?`}
        confirmLabel="Delete exercise"
        body={
          <p>
            Custom exercises can only be deleted when no logged workout uses them. If any history
            references this exercise, RepForge will refuse and suggest archiving instead — your
            history is never rewritten.
          </p>
        }
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          const target = confirmDelete;
          setConfirmDelete(null);
          if (target) void remove(target);
        }}
      />
    </>
  );
}
