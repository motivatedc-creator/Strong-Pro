import { useState } from 'react';
import { useRepository, useWrite } from '@/app/hooks';
import { toast } from '@/app/store';
import { Button, Field, Select, Sheet, TextArea, TextInput, Toggle } from '@/components/ui';
import {
  EQUIPMENT,
  MOVEMENT_PATTERNS,
  MUSCLE_GROUPS,
  TRACKING_TYPES,
  titleCase,
} from '@/domain/taxonomy';
import type {
  Equipment,
  Exercise,
  MovementPattern,
  MuscleGroup,
  TrackingType,
} from '@/domain/types';

interface Draft {
  name: string;
  primaryMuscleGroup: MuscleGroup;
  secondaryMuscleGroups: MuscleGroup[];
  equipment: Equipment;
  movementPattern: MovementPattern;
  trackingType: TrackingType;
  notes: string;
  isArchived: boolean;
}

function toDraft(exercise?: Exercise): Draft {
  return {
    name: exercise?.name ?? '',
    primaryMuscleGroup: exercise?.primaryMuscleGroup ?? 'chest',
    secondaryMuscleGroups: exercise?.secondaryMuscleGroups ?? [],
    equipment: exercise?.equipment ?? 'barbell',
    movementPattern: exercise?.movementPattern ?? 'horizontal push',
    trackingType: exercise?.trackingType ?? 'weight_reps',
    notes: exercise?.notes ?? '',
    isArchived: exercise?.isArchived ?? false,
  };
}

/** Create or edit an exercise. Editing never rewrites history: workouts keep snapshots. */
export function ExerciseEditor({
  open,
  exercise,
  initialName,
  onClose,
  onSaved,
}: {
  open: boolean;
  exercise?: Exercise;
  initialName?: string;
  onClose: () => void;
  onSaved?: (exercise: Exercise) => void;
}) {
  const repository = useRepository();
  const [draft, setDraft] = useState<Draft>(() => ({
    ...toDraft(exercise),
    name: exercise?.name ?? initialName ?? '',
  }));
  const [error, setError] = useState('');

  const [save, saving] = useWrite(async () => {
    const name = draft.name.trim();
    if (!name) {
      setError('Give the exercise a name.');
      return undefined;
    }
    setError('');

    const payload = {
      name,
      primaryMuscleGroup: draft.primaryMuscleGroup,
      secondaryMuscleGroups: draft.secondaryMuscleGroups.filter(
        (m) => m !== draft.primaryMuscleGroup,
      ),
      equipment: draft.equipment,
      movementPattern: draft.movementPattern,
      trackingType: draft.trackingType,
      notes: draft.notes.trim() || undefined,
      isArchived: draft.isArchived,
    };

    const saved = exercise
      ? await repository.updateExercise(exercise.id, payload)
      : await repository.createExercise(payload);

    toast.success(exercise ? 'Exercise updated.' : `${saved.name} added to your library.`);
    onSaved?.(saved);
    onClose();
    return saved;
  });

  const toggleSecondary = (muscle: MuscleGroup) => {
    setDraft((current) => ({
      ...current,
      secondaryMuscleGroups: current.secondaryMuscleGroups.includes(muscle)
        ? current.secondaryMuscleGroups.filter((value) => value !== muscle)
        : [...current.secondaryMuscleGroups, muscle],
    }));
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={exercise ? `Edit ${exercise.name}` : 'New exercise'}
      description={
        exercise && !exercise.isCustom
          ? 'This is a library exercise. Your changes stay on this device.'
          : undefined
      }
      footer={
        <div className="flex gap-2">
          <Button block onClick={onClose}>
            Cancel
          </Button>
          <Button block variant="primary" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save exercise'}
          </Button>
        </div>
      }
    >
      <Field label="Name" error={error}>
        {({ id, describedBy }) => (
          <TextInput
            id={id}
            aria-describedby={describedBy}
            data-autofocus
            value={draft.name}
            maxLength={120}
            onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            placeholder="e.g. Landmine Press"
          />
        )}
      </Field>

      <Field label="Primary muscle">
        {({ id }) => (
          <Select
            id={id}
            value={draft.primaryMuscleGroup}
            onChange={(event) =>
              setDraft({ ...draft, primaryMuscleGroup: event.target.value as MuscleGroup })
            }
          >
            {MUSCLE_GROUPS.map((muscle) => (
              <option key={muscle} value={muscle}>
                {titleCase(muscle)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <fieldset className="mb-4">
        <legend className="rf-label">Secondary muscles</legend>
        <p className="mb-2 text-xs text-ink-subtle">
          Each secondary muscle receives a fraction of this exercise&apos;s volume in the
          muscle-group breakdown (default 50%, configurable in Settings).
        </p>
        <div className="flex flex-wrap gap-2">
          {MUSCLE_GROUPS.filter((muscle) => muscle !== draft.primaryMuscleGroup).map((muscle) => {
            const selected = draft.secondaryMuscleGroups.includes(muscle);
            return (
              <button
                key={muscle}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleSecondary(muscle)}
                className={
                  selected
                    ? 'min-h-[2.25rem] rounded-full border border-accent bg-accent/15 px-3 text-xs font-semibold text-accent'
                    : 'min-h-[2.25rem] rounded-full border border-line bg-surface-raised px-3 text-xs font-medium text-ink-muted'
                }
              >
                {selected ? '✓ ' : ''}
                {titleCase(muscle)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <Field label="Equipment">
        {({ id }) => (
          <Select
            id={id}
            value={draft.equipment}
            onChange={(event) => setDraft({ ...draft, equipment: event.target.value as Equipment })}
          >
            {EQUIPMENT.map((equipment) => (
              <option key={equipment} value={equipment}>
                {titleCase(equipment)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Movement pattern">
        {({ id }) => (
          <Select
            id={id}
            value={draft.movementPattern}
            onChange={(event) =>
              setDraft({ ...draft, movementPattern: event.target.value as MovementPattern })
            }
          >
            {MOVEMENT_PATTERNS.map((pattern) => (
              <option key={pattern} value={pattern}>
                {titleCase(pattern)}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field
        label="Tracking"
        hint={TRACKING_TYPES.find((entry) => entry.value === draft.trackingType)?.hint}
      >
        {({ id, describedBy }) => (
          <Select
            id={id}
            aria-describedby={describedBy}
            value={draft.trackingType}
            onChange={(event) =>
              setDraft({ ...draft, trackingType: event.target.value as TrackingType })
            }
          >
            {TRACKING_TYPES.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </Select>
        )}
      </Field>

      <Field label="Notes">
        {({ id }) => (
          <TextArea
            id={id}
            value={draft.notes}
            maxLength={1_000}
            onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
            placeholder="Setup cues, seat height, grip width…"
          />
        )}
      </Field>

      {exercise && (
        <Toggle
          label="Archived"
          description="Hidden from pickers. Your logged history is always kept."
          checked={draft.isArchived}
          onChange={(isArchived) => setDraft({ ...draft, isArchived })}
        />
      )}
    </Sheet>
  );
}
