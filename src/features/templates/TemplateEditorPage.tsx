import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRepository, useRepositoryData, useWrite } from '@/app/hooks';
import { toast } from '@/app/store';
import {
  Button,
  Card,
  Chip,
  EmptyState,
  Field,
  IconButton,
  NumberInput,
  PageHeader,
  Segmented,
  Select,
  Spinner,
  TextArea,
  TextInput,
} from '@/components/ui';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import { uuid } from '@/domain/ids';
import { SET_TYPES, titleCase } from '@/domain/taxonomy';
import type { Exercise, SetType, Template, TemplateExercise } from '@/domain/types';

interface Row extends TemplateExercise {
  exerciseName: string;
  muscle: string;
}

/** Full template editor: exercises, targets, rest, set types and superset grouping. */
export function TemplateEditorPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id || id === 'new';
  const navigate = useNavigate();
  const repository = useRepository();

  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [template, setTemplate] = useState<Template | null>(null);
  const [picking, setPicking] = useState(false);
  const [error, setError] = useState('');

  const { data, loading } = useRepositoryData(
    (repo) => (isNew ? Promise.resolve(undefined) : repo.getTemplateDetail(id!)),
    [id, isNew],
  );

  useEffect(() => {
    if (!data) return;
    setTemplate(data.template);
    setName(data.template.name);
    setNotes(data.template.notes ?? '');
    setRows(
      data.exercises.map(({ templateExercise, exercise }) => ({
        ...templateExercise,
        exerciseName: exercise?.name ?? 'Removed exercise',
        muscle: exercise?.primaryMuscleGroup ?? '',
      })),
    );
  }, [data]);

  const addExercises = (exercises: Exercise[]) => {
    setRows((current) => [
      ...current,
      ...exercises.map((exercise, index) => ({
        id: uuid(),
        templateId: template?.id ?? 'pending',
        exerciseId: exercise.id,
        order: current.length + index,
        targetSets: 3,
        targetRepMin: 5,
        targetRepMax: 8,
        restSeconds: 120,
        defaultSetType: 'working' as SetType,
        includeWarmup: exercise.equipment === 'barbell',
        exerciseName: exercise.name,
        muscle: exercise.primaryMuscleGroup,
      })),
    ]);
  };

  const patchRow = (rowId: string, patch: Partial<Row>) => {
    setRows((current) => current.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  };

  const moveRow = (rowId: string, direction: -1 | 1) => {
    setRows((current) => {
      const index = current.findIndex((row) => row.id === rowId);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next.map((row, order) => ({ ...row, order }));
    });
  };

  const [save, saving] = useWrite(async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give this template a name.');
      return;
    }
    setError('');

    const target =
      template ?? (await repository.createTemplate(trimmed, notes.trim() || undefined));

    await repository.saveTemplate(
      { ...target, name: trimmed, notes: notes.trim() || undefined },
      rows.map(({ exerciseName: _name, muscle: _muscle, ...row }, order) => ({
        ...row,
        templateId: target.id,
        order,
      })),
    );

    toast.success(isNew ? 'Template created.' : 'Template saved.');
    navigate('/templates');
  });

  if (!isNew && loading && !data) return <Spinner label="Loading template" />;

  return (
    <>
      <PageHeader
        title={isNew ? 'New template' : 'Edit template'}
        subtitle={`${rows.length} exercise${rows.length === 1 ? '' : 's'}`}
        actions={
          <Button variant="primary" disabled={saving} onClick={() => void save()}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        }
      />

      <Field label="Template name" error={error}>
        {({ id: fieldId, describedBy }) => (
          <TextInput
            id={fieldId}
            aria-describedby={describedBy}
            value={name}
            maxLength={120}
            placeholder="e.g. Upper A"
            onChange={(event) => setName(event.target.value)}
          />
        )}
      </Field>

      <Field label="Notes">
        {({ id: fieldId }) => (
          <TextArea
            id={fieldId}
            value={notes}
            maxLength={1_000}
            placeholder="Focus, progression scheme, anything you want in front of you at the gym."
            onChange={(event) => setNotes(event.target.value)}
          />
        )}
      </Field>

      {rows.length === 0 ? (
        <EmptyState
          title="No exercises yet"
          description="Add the movements you want in this session. You can reorder them and set targets per exercise."
          icon="➕"
          action={
            <Button variant="primary" onClick={() => setPicking(true)}>
              Add exercises
            </Button>
          }
        />
      ) : (
        <ul className="space-y-3">
          {rows.map((row, index) => (
            <li key={row.id}>
              <Card className="p-3">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-ink">{row.exerciseName}</h2>
                    <p className="text-xs text-ink-subtle">
                      {titleCase(row.muscle)}
                      {row.supersetGroup ? ' · ' : ''}
                      {row.supersetGroup && <Chip tone="accent">Superset {row.supersetGroup}</Chip>}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <IconButton
                      label={`Move ${row.exerciseName} up`}
                      disabled={index === 0}
                      onClick={() => moveRow(row.id, -1)}
                    >
                      <span aria-hidden="true">↑</span>
                    </IconButton>
                    <IconButton
                      label={`Move ${row.exerciseName} down`}
                      disabled={index === rows.length - 1}
                      onClick={() => moveRow(row.id, 1)}
                    >
                      <span aria-hidden="true">↓</span>
                    </IconButton>
                    <IconButton
                      label={`Remove ${row.exerciseName}`}
                      onClick={() =>
                        setRows((current) => current.filter((entry) => entry.id !== row.id))
                      }
                    >
                      <span aria-hidden="true">🗑</span>
                    </IconButton>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <label className="text-xs text-ink-muted">
                    Sets
                    <NumberInput
                      className="mt-1 h-10 min-h-0"
                      value={row.targetSets}
                      min={1}
                      max={20}
                      inputMode="numeric"
                      onChange={(event) =>
                        patchRow(row.id, {
                          targetSets: Math.max(1, Number.parseInt(event.target.value, 10) || 1),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-ink-muted">
                    Reps (min)
                    <NumberInput
                      className="mt-1 h-10 min-h-0"
                      value={row.targetRepMin ?? ''}
                      min={0}
                      inputMode="numeric"
                      onChange={(event) =>
                        patchRow(row.id, {
                          targetRepMin:
                            event.target.value === ''
                              ? undefined
                              : Number.parseInt(event.target.value, 10),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-ink-muted">
                    Reps (max)
                    <NumberInput
                      className="mt-1 h-10 min-h-0"
                      value={row.targetRepMax ?? ''}
                      min={0}
                      inputMode="numeric"
                      onChange={(event) =>
                        patchRow(row.id, {
                          targetRepMax:
                            event.target.value === ''
                              ? undefined
                              : Number.parseInt(event.target.value, 10),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-ink-muted">
                    Rest (s)
                    <NumberInput
                      className="mt-1 h-10 min-h-0"
                      value={row.restSeconds}
                      min={0}
                      step={15}
                      inputMode="numeric"
                      onChange={(event) =>
                        patchRow(row.id, {
                          restSeconds: Math.max(0, Number.parseInt(event.target.value, 10) || 0),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-ink-muted">
                    Target RPE
                    <NumberInput
                      className="mt-1 h-10 min-h-0"
                      value={row.targetRpe ?? ''}
                      min={1}
                      max={10}
                      step="0.5"
                      onChange={(event) =>
                        patchRow(row.id, {
                          targetRpe:
                            event.target.value === ''
                              ? undefined
                              : Number.parseFloat(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-ink-muted">
                    Target RIR
                    <NumberInput
                      className="mt-1 h-10 min-h-0"
                      value={row.targetRir ?? ''}
                      min={0}
                      max={10}
                      onChange={(event) =>
                        patchRow(row.id, {
                          targetRir:
                            event.target.value === ''
                              ? undefined
                              : Number.parseFloat(event.target.value),
                        })
                      }
                    />
                  </label>
                  <label className="text-xs text-ink-muted">
                    Set type
                    <Select
                      className="mt-1 h-10 min-h-0 py-0"
                      value={row.defaultSetType}
                      onChange={(event) =>
                        patchRow(row.id, { defaultSetType: event.target.value as SetType })
                      }
                    >
                      {SET_TYPES.map((entry) => (
                        <option key={entry.value} value={entry.value}>
                          {entry.label}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="text-xs text-ink-muted">
                    Superset
                    <Select
                      className="mt-1 h-10 min-h-0 py-0"
                      value={row.supersetGroup ?? ''}
                      onChange={(event) =>
                        patchRow(row.id, { supersetGroup: event.target.value || undefined })
                      }
                    >
                      <option value="">None</option>
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </Select>
                  </label>
                </div>

                <div className="mt-2">
                  <span className="rf-label">Warm-up sets</span>
                  <Segmented
                    size="sm"
                    label={`Warm-up preference for ${row.exerciseName}`}
                    value={row.includeWarmup ? 'yes' : 'no'}
                    onChange={(value) => patchRow(row.id, { includeWarmup: value === 'yes' })}
                    options={[
                      { value: 'yes', label: 'Suggest warm-ups' },
                      { value: 'no', label: 'Straight to work' },
                    ]}
                  />
                </div>

                <TextArea
                  className="mt-2 min-h-[3rem]"
                  aria-label={`Notes for ${row.exerciseName}`}
                  placeholder="Cues, setup, tempo…"
                  value={row.notes ?? ''}
                  maxLength={500}
                  onChange={(event) => patchRow(row.id, { notes: event.target.value || undefined })}
                />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {rows.length > 0 && (
        <Button block className="mt-3" onClick={() => setPicking(true)}>
          + Add exercises
        </Button>
      )}

      <div className="mb-10 mt-4 flex gap-2">
        <Button block onClick={() => navigate('/templates')}>
          Cancel
        </Button>
        <Button block variant="primary" disabled={saving} onClick={() => void save()}>
          {saving ? 'Saving…' : 'Save template'}
        </Button>
      </div>

      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={addExercises} />
    </>
  );
}
