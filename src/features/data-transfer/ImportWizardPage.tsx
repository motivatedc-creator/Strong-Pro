import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRepository, useWrite } from '@/app/hooks';
import { toast } from '@/app/store';
import {
  Button,
  Card,
  Chip,
  PageHeader,
  Segmented,
  Select,
  Spinner,
  Toggle,
  cx,
} from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { formatDate } from '@/domain/time';
import { formatWeight, type WeightUnit } from '@/domain/units';
import { useSettings } from '@/app/SettingsProvider';
import { titleCase } from '@/domain/taxonomy';
import type { Exercise, UUID } from '@/domain/types';
import { ExercisePicker } from '@/features/exercises/ExercisePicker';
import {
  STRONG_FIELD_LABELS,
  analyseStrongCsv,
  buildImportBatch,
  findExerciseCandidates,
  normaliseExerciseName,
  type ColumnMapping,
  type ExerciseCandidate,
  type ImportAnalysis,
  type ParsedWorkout,
  type StrongField,
} from './strongImport';

/** Largest CSV accepted. Strong exports of years of training are a few megabytes at most. */
const MAX_CSV_BYTES = 32 * 1024 * 1024;

type Step = 'file' | 'map' | 'resolve' | 'preview' | 'done';

/**
 * Strong CSV import wizard: choose a file, fix the column mapping, preview exactly what
 * will be written, then import transactionally.
 */
export function ImportWizardPage() {
  const repository = useRepository();
  const { weightUnit } = useSettings();
  const [step, setStep] = useState<Step>('file');
  const [fileName, setFileName] = useState('');
  const [text, setText] = useState('');
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [unit, setUnit] = useState<WeightUnit>(weightUnit);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [duplicates, setDuplicates] = useState<Set<string>>(new Set());
  const [reading, setReading] = useState(false);
  const [checkingCandidates, setCheckingCandidates] = useState(false);
  const [existingExercises, setExistingExercises] = useState<Exercise[]>([]);
  const [candidates, setCandidates] = useState<ExerciseCandidate[]>([]);
  /** Confirmed "same exercise" decisions, keyed by normalised CSV name. Absence = different. */
  const [confirmedMatches, setConfirmedMatches] = useState<Map<string, UUID>>(new Map());
  const [searchingFor, setSearchingFor] = useState<string | null>(null);
  const [result, setResult] = useState<{
    workouts: number;
    sets: number;
    exercises: number;
    skipped: number;
  } | null>(null);

  const analysis: ImportAnalysis | null = useMemo(
    () => (text ? analyseStrongCsv(text, { mapping, unit }) : null),
    [text, mapping, unit],
  );

  /** Fetches the library and surfaces near-matches for the given workouts' exercise names. */
  const resolveExerciseCandidates = async (workouts: readonly ParsedWorkout[]) => {
    const existing = await repository.listExercises({ includeArchived: true });
    setExistingExercises(existing);
    const names = workouts.flatMap((workout) => workout.exercises.map((entry) => entry.name));
    const found = findExerciseCandidates(names, existing);
    setCandidates(found);
    setConfirmedMatches(new Map());
    return found;
  };

  const onFile = async (file: File) => {
    if (file.size > MAX_CSV_BYTES) {
      toast.error('That file is larger than 32 MB — it is unlikely to be a Strong export.');
      return;
    }
    setReading(true);
    try {
      const content = await file.text();
      const parsed = analyseStrongCsv(content);
      setFileName(file.name);
      setText(content);
      setMapping(parsed.mapping);
      setUnit(parsed.detectedUnit ?? weightUnit);
      setSelected(new Set(parsed.workouts.map((workout) => workout.key)));

      // Fingerprint check runs before the preview so duplicates are visible up front.
      const existing = new Set<string>();
      for (const workout of parsed.workouts) {
        if (await repository.findWorkoutByFingerprint(workout.fingerprint))
          existing.add(workout.key);
      }
      setDuplicates(existing);

      if (parsed.missingRequired.length > 0 || parsed.unmappedColumns.length > 0) {
        setStep('map');
      } else {
        const found = await resolveExerciseCandidates(parsed.workouts);
        setStep(found.length > 0 ? 'resolve' : 'preview');
      }
    } catch {
      toast.error('That file could not be read as text.');
    } finally {
      setReading(false);
    }
  };

  const goToResolveOrPreview = async () => {
    if (!analysis) return;
    setCheckingCandidates(true);
    try {
      const found = await resolveExerciseCandidates(analysis.workouts);
      setSelected(new Set(analysis.workouts.map((workout) => workout.key)));
      setStep(found.length > 0 ? 'resolve' : 'preview');
    } finally {
      setCheckingCandidates(false);
    }
  };

  const [runImport, importing] = useWrite(async () => {
    if (!analysis) return;
    const batch = buildImportBatch(analysis, {
      fileName,
      existingExercises,
      existingFingerprints: allowDuplicates
        ? new Set<string>()
        : new Set(
            analysis.workouts
              .filter((workout) => duplicates.has(workout.key))
              .map((w) => w.fingerprint),
          ),
      allowDuplicates,
      selectedKeys: selected,
      nameOverrides: confirmedMatches,
    });

    if (batch.workouts.length === 0) {
      toast.warning('Nothing selected to import.');
      return;
    }

    await repository.importBatch(batch);
    setResult({
      workouts: batch.job.workoutsImported,
      sets: batch.job.setsImported,
      exercises: batch.job.exercisesCreated,
      skipped: batch.job.rowsSkipped,
    });
    setStep('done');
  });

  const errors = analysis?.issues.filter((issue) => issue.severity === 'error') ?? [];
  const warnings = analysis?.issues.filter((issue) => issue.severity === 'warning') ?? [];
  const selectedCount =
    analysis?.workouts.filter((workout) => selected.has(workout.key)).length ?? 0;

  return (
    <>
      <PageHeader
        title="Import from Strong"
        subtitle="Reads the CSV you export from the Strong app. Nothing is uploaded anywhere."
      />

      {step === 'file' && (
        <Card>
          <h2 className="text-sm font-semibold text-ink">Choose your export</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-muted">
            <li>In the Strong app, open Settings and export your data as CSV.</li>
            <li>Save the file to this device.</li>
            <li>Select it below — Lock’d parses it locally and shows you a preview first.</li>
          </ol>
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose a Strong CSV export"
            className="mt-4 block w-full text-sm text-ink-muted file:mr-3 file:min-h-tap file:rounded file:border file:border-line file:bg-surface-raised file:px-4 file:text-sm file:font-semibold file:text-ink"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onFile(file);
            }}
          />
          {reading && <Spinner label="Reading file" />}
        </Card>
      )}

      {step === 'map' && analysis && (
        <Card>
          <h2 className="text-sm font-semibold text-ink">Map the columns</h2>
          <p className="mt-1 text-xs text-ink-muted">
            Lock’d matched what it recognised. Set anything it missed — date and exercise name are
            required.
          </p>

          <ul className="mt-3 space-y-2">
            {(Object.keys(STRONG_FIELD_LABELS) as StrongField[]).map((field) => (
              <li key={field}>
                <label className="text-xs text-ink-muted">
                  {STRONG_FIELD_LABELS[field]}
                  {(field === 'date' || field === 'exerciseName') && (
                    <span className="ml-1 text-danger" aria-label="required">
                      *
                    </span>
                  )}
                  <Select
                    className="mt-1 h-10 min-h-0 py-0"
                    value={mapping[field] ?? ''}
                    onChange={(event) => {
                      const value = event.target.value;
                      setMapping((current) => ({
                        ...current,
                        [field]: value === '' ? undefined : Number(value),
                      }));
                    }}
                  >
                    <option value="">Not in this file</option>
                    {analysis.header.map((column, index) => (
                      <option key={`${column}-${index}`} value={index}>
                        {column || `Column ${index + 1}`}
                      </option>
                    ))}
                  </Select>
                </label>
              </li>
            ))}
          </ul>

          <div className="mt-4">
            <span className="rf-label">Weight unit in this file</span>
            <Segmented
              label="Weight unit in this file"
              value={unit}
              onChange={setUnit}
              options={[
                { value: 'kg', label: 'Kilograms' },
                { value: 'lb', label: 'Pounds' },
              ]}
            />
            {analysis.detectedUnit && (
              <p className="mt-1 text-xs text-ink-subtle">
                Detected {analysis.detectedUnit === 'kg' ? 'kilograms' : 'pounds'} from the header.
              </p>
            )}
          </div>

          <div className="mt-4 flex gap-2">
            <Button block onClick={() => setStep('file')}>
              Back
            </Button>
            <Button
              block
              variant="primary"
              disabled={analysis.missingRequired.length > 0 || checkingCandidates}
              onClick={() => void goToResolveOrPreview()}
            >
              {checkingCandidates ? 'Checking your library…' : 'Preview import'}
            </Button>
          </div>
          {analysis.missingRequired.length > 0 && (
            <p className="mt-2 text-xs text-danger">
              Still missing:{' '}
              {analysis.missingRequired.map((field) => STRONG_FIELD_LABELS[field]).join(', ')}.
            </p>
          )}
        </Card>
      )}

      {step === 'resolve' && analysis && (
        <>
          <Card className="mb-3">
            <h2 className="text-sm font-semibold text-ink">Resolve exercises</h2>
            <p className="mt-1 text-xs text-ink-muted">
              These {candidates.length === 1 ? 'name looks' : 'names look'} like{' '}
              {candidates.length === 1 ? 'an exercise' : 'exercises'} already in your library, just
              written differently. Confirm the ones that match — anything you leave as
              &quot;Different exercise&quot; is created fresh, as usual.
            </p>
          </Card>

          <ul className="mb-3 space-y-2">
            {candidates.map((candidate) => {
              const key = normaliseExerciseName(candidate.name);
              const confirmedId = confirmedMatches.get(key);
              const isSame = confirmedId !== undefined;
              const matchedExercise =
                confirmedId !== undefined
                  ? (existingExercises.find((exercise) => exercise.id === confirmedId) ??
                    candidate.exercise)
                  : candidate.exercise;

              return (
                <li key={key}>
                  <Card className="p-3">
                    <p className="text-sm font-semibold text-ink">{candidate.name}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      Looks like{' '}
                      <span className="font-medium text-ink">{matchedExercise.name}</span> (
                      {titleCase(matchedExercise.primaryMuscleGroup)} ·{' '}
                      {titleCase(matchedExercise.equipment)})
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        variant={isSame ? 'primary' : undefined}
                        onClick={() =>
                          setConfirmedMatches((current) => {
                            const next = new Map(current);
                            next.set(key, candidate.exercise.id);
                            return next;
                          })
                        }
                      >
                        Same exercise
                      </Button>
                      <Button
                        size="sm"
                        variant={isSame ? undefined : 'primary'}
                        onClick={() =>
                          setConfirmedMatches((current) => {
                            const next = new Map(current);
                            next.delete(key);
                            return next;
                          })
                        }
                      >
                        Different exercise
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setSearchingFor(key)}>
                        Search instead
                      </Button>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ul>

          <div className="mb-8 flex gap-2">
            <Button block onClick={() => setStep('map')}>
              Back
            </Button>
            <Button
              block
              variant="primary"
              onClick={() => {
                setSelected(new Set(analysis.workouts.map((workout) => workout.key)));
                setStep('preview');
              }}
            >
              Continue
            </Button>
          </div>

          <ExercisePicker
            open={searchingFor !== null}
            multi={false}
            title="Find the matching exercise"
            onClose={() => setSearchingFor(null)}
            onPick={([picked]) => {
              const key = searchingFor;
              if (key && picked) {
                setConfirmedMatches((current) => {
                  const next = new Map(current);
                  next.set(key, picked.id);
                  return next;
                });
              }
              setSearchingFor(null);
            }}
          />
        </>
      )}

      {step === 'preview' && analysis && (
        <>
          <Card className="mb-3">
            <h2 className="text-sm font-semibold text-ink">{fileName}</h2>
            <p className="mt-1 text-xs text-ink-muted">
              {analysis.totalRows} rows read · {analysis.workouts.length} workouts found ·{' '}
              {analysis.skippedRows} rows skipped
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {duplicates.size > 0 && (
                <Chip tone="warning">{duplicates.size} already imported</Chip>
              )}
              {errors.length > 0 && <Chip tone="danger">{errors.length} errors</Chip>}
              {warnings.length > 0 && <Chip tone="warning">{warnings.length} warnings</Chip>}
            </div>
            <Button size="sm" className="mt-2" onClick={() => setStep('map')}>
              Change column mapping
            </Button>
          </Card>

          {(errors.length > 0 || warnings.length > 0) && (
            <Card className="mb-3">
              <h3 className="text-sm font-semibold text-ink">Rows that need attention</h3>
              <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                {[...errors, ...warnings].slice(0, 100).map((issue, index) => (
                  <li
                    key={`${issue.row}-${index}`}
                    className={cx(issue.severity === 'error' ? 'text-danger' : 'text-warning')}
                  >
                    <span aria-hidden="true" className="inline-flex">
                      {issue.severity === 'error' ? (
                        <Icon icon={Icons.close} size={14} />
                      ) : (
                        <Icon icon={Icons.warning} size={14} />
                      )}
                    </span>{' '}
                    Row {issue.row}: {issue.message}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-ink-subtle">
                Rows with errors are skipped; everything else still imports.
              </p>
            </Card>
          )}

          {duplicates.size > 0 && (
            <Card className="mb-3">
              <Toggle
                label="Import duplicates anyway"
                description="Workouts matching one already in your history are skipped by default."
                checked={allowDuplicates}
                onChange={setAllowDuplicates}
              />
            </Card>
          )}

          <Card className="mb-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-ink">
                Workouts ({selectedCount} of {analysis.workouts.length} selected)
              </h3>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  setSelected((current) =>
                    current.size === analysis.workouts.length
                      ? new Set()
                      : new Set(analysis.workouts.map((workout) => workout.key)),
                  )
                }
              >
                {selected.size === analysis.workouts.length ? 'Select none' : 'Select all'}
              </Button>
            </div>

            <ul className="max-h-96 space-y-1.5 overflow-y-auto">
              {analysis.workouts.map((workout) => {
                const isDuplicate = duplicates.has(workout.key);
                const isSelected = selected.has(workout.key);
                return (
                  <li key={workout.key}>
                    <label
                      className={cx(
                        'flex min-h-tap cursor-pointer items-center gap-3 rounded border px-3 py-2',
                        isSelected
                          ? 'border-accent/60 bg-accent/5'
                          : 'border-line bg-surface-raised',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="h-5 w-5 shrink-0"
                        checked={isSelected}
                        onChange={(event) =>
                          setSelected((current) => {
                            const next = new Set(current);
                            if (event.target.checked) next.add(workout.key);
                            else next.delete(workout.key);
                            return next;
                          })
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {workout.name}
                        </span>
                        <span className="block text-xs text-ink-subtle">
                          {formatDate(workout.startedAt)} · {workout.exercises.length} exercises ·{' '}
                          {workout.setCount} sets
                        </span>
                        <span className="block truncate text-xs text-ink-subtle">
                          {workout.exercises
                            .slice(0, 3)
                            .map(
                              (entry) =>
                                `${entry.name} (${entry.sets
                                  .slice(0, 1)
                                  .map((set) =>
                                    set.weightG
                                      ? `${formatWeight(set.weightG, weightUnit)}${weightUnit} × ${set.reps ?? 0}`
                                      : `${set.reps ?? 0} reps`,
                                  )
                                  .join('')})`,
                            )
                            .join(', ')}
                        </span>
                      </span>
                      {isDuplicate && <Chip tone="warning">Duplicate</Chip>}
                    </label>
                  </li>
                );
              })}
            </ul>
          </Card>

          <div className="mb-8 flex gap-2">
            <Button block onClick={() => setStep('file')}>
              Choose another file
            </Button>
            <Button
              block
              variant="primary"
              disabled={importing || selectedCount === 0}
              onClick={() => void runImport()}
            >
              {importing ? 'Importing…' : `Import ${selectedCount} workouts`}
            </Button>
          </div>
        </>
      )}

      {step === 'done' && result && (
        <Card>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-success">
            <Icon icon={Icons.check} size={16} />
            Import complete
          </h2>
          <ul className="mt-2 space-y-1 text-sm text-ink-muted">
            <li>{result.workouts} workouts written</li>
            <li>{result.sets} sets written</li>
            <li>{result.exercises} exercises created as custom entries</li>
            <li>{result.skipped} rows skipped</li>
          </ul>
          {result.exercises > 0 && (
            <p className="mt-2 text-xs text-ink-subtle">
              {result.exercises} newly created exercise{result.exercises === 1 ? '' : 's'} have no
              muscle group yet — Data Lab can&apos;t count them until you set one.
            </p>
          )}
          <div className="mt-4 flex gap-2">
            <Link to="/history" className="flex-1">
              <Button block variant="primary">
                See imported history
              </Button>
            </Link>
            <Link
              to={result.exercises > 0 ? '/exercises/classify' : '/exercises'}
              className="flex-1"
            >
              <Button block>
                {result.exercises > 0 ? 'Classify new exercises' : 'Review exercises'}
              </Button>
            </Link>
          </div>
        </Card>
      )}
    </>
  );
}
