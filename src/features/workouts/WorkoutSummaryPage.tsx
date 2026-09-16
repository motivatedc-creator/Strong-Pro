import { useMemo } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useRepositoryData } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { Card, Chip, PageHeader, Spinner, StatTile, buttonClasses } from '@/components/ui';
import { PR_LABEL, findNewRecords, type SetWithContext } from '@/domain/records';
import { elapsedSeconds, formatDateTime } from '@/domain/time';
import { formatDuration, formatWeight } from '@/domain/units';
import { totalsForGroups } from '@/domain/volume';
import { setTypeLabel } from '@/domain/taxonomy';

/** Post-workout summary: what was done, and which records fell. */
export function WorkoutSummaryPage() {
  const { id } = useParams<{ id: string }>();
  const { settings, weightUnit } = useSettings();

  const { data, loading } = useRepositoryData(
    async (repository) => {
      if (!id) return null;
      const [detail, allSets] = await Promise.all([
        repository.getWorkoutDetail(id),
        repository.getAllCompletedSets(),
      ]);
      return { detail, allSets };
    },
    [id],
  );

  const view = useMemo(() => {
    if (!data?.detail) return null;
    const { detail, allSets } = data;

    const totals = totalsForGroups(
      detail.exercises.map((entry) => ({ exercise: entry.exercise, sets: entry.sets })),
      { includeWarmups: !settings.excludeWarmupsFromAnalytics },
    );

    const history: SetWithContext[] = allSets
      .filter((entry) => entry.workout.id !== detail.workout.id)
      .flatMap((entry) =>
        entry.sets.map((set) => ({
          ...set,
          exerciseId: entry.exercise.exerciseId,
          performedAt: entry.workout.startedAt,
        })),
      );

    const candidates: SetWithContext[] = detail.exercises.flatMap((entry) =>
      entry.sets.map((set) => ({
        ...set,
        exerciseId: entry.exercise.exerciseId,
        performedAt: detail.workout.startedAt,
      })),
    );

    const flags = findNewRecords(history, candidates, settings.oneRepMaxFormula);
    const nameByExercise = new Map(
      detail.exercises.map((entry) => [
        entry.exercise.exerciseId,
        entry.exercise.exerciseNameSnapshot,
      ]),
    );
    const setById = new Map(candidates.map((set) => [set.id, set]));

    return { detail, totals, flags, nameByExercise, setById };
  }, [data, settings.excludeWarmupsFromAnalytics, settings.oneRepMaxFormula]);

  if (loading && !data) return <Spinner label="Building your summary" />;
  if (!loading && !view) return <Navigate to="/history" replace />;
  if (!view) return null;

  const { detail, totals, flags, nameByExercise, setById } = view;
  const duration = elapsedSeconds(
    detail.workout.startedAt,
    detail.workout.endedAt,
    detail.workout.pausedSeconds,
  );

  return (
    <>
      <PageHeader
        title="Workout complete"
        subtitle={`${detail.workout.name} · ${formatDateTime(detail.workout.startedAt)}`}
        actions={
          <Link to="/" className={buttonClasses('primary')}>
            Done
          </Link>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile label="Duration" value={formatDuration(duration)} />
        <StatTile label="Sets" value={String(totals.completedSets)} />
        <StatTile
          label="Volume"
          value={formatWeight(totals.volumeG, weightUnit, { decimals: 0 })}
          sub={weightUnit}
        />
        <StatTile label="Exercises" value={String(detail.exercises.length)} tone="accent" />
      </div>

      {flags.length > 0 && (
        <Card className="mb-4 border-accent/50">
          <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-accent">
            <span aria-hidden="true">🏅</span>
            {flags.length} new record{flags.length === 1 ? '' : 's'}
          </h2>
          <ul className="space-y-1.5">
            {flags.map((flag) => {
              const set = setById.get(flag.setId);
              return (
                <li key={flag.setId} className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-medium text-ink">
                    {nameByExercise.get(flag.exerciseId)}
                  </span>
                  <span className="text-ink-muted tabular-nums">
                    {set?.weightG !== undefined
                      ? `${formatWeight(set.weightG, weightUnit)} ${weightUnit}`
                      : ''}
                    {set?.reps ? ` × ${set.reps}` : ''}
                  </span>
                  {flag.kinds.map((kind) => (
                    <Chip key={kind} tone="accent">
                      {PR_LABEL[kind]}
                    </Chip>
                  ))}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {detail.workout.notes && (
        <Card className="mb-4">
          <h2 className="mb-1 text-sm font-semibold text-ink">Notes</h2>
          <p className="whitespace-pre-wrap text-sm text-ink-muted">{detail.workout.notes}</p>
        </Card>
      )}

      <ul className="space-y-3">
        {detail.exercises.map((entry) => (
          <li key={entry.exercise.id}>
            <Card className="p-3">
              <h2 className="mb-1 text-sm font-semibold text-ink">
                <Link to={`/exercises/${entry.exercise.exerciseId}`} className="hover:text-accent">
                  {entry.exercise.exerciseNameSnapshot}
                </Link>
              </h2>
              <ul className="space-y-0.5 text-sm text-ink-muted">
                {entry.sets.map((set, index) => (
                  <li key={set.id} className="flex items-center gap-2 tabular-nums">
                    <span className="w-5 text-xs text-ink-subtle">{index + 1}</span>
                    <span>
                      {set.weightG !== undefined
                        ? `${formatWeight(set.weightG, weightUnit)} ${weightUnit}`
                        : '—'}
                      {set.reps !== undefined ? ` × ${set.reps}` : ''}
                      {set.durationSeconds ? ` · ${formatDuration(set.durationSeconds)}` : ''}
                      {set.distanceM ? ` · ${set.distanceM} m` : ''}
                    </span>
                    {set.setType !== 'working' && <Chip>{setTypeLabel(set.setType)}</Chip>}
                    {set.rpe !== undefined && (
                      <span className="text-xs text-ink-subtle">RPE {set.rpe}</span>
                    )}
                    {set.rir !== undefined && (
                      <span className="text-xs text-ink-subtle">RIR {set.rir}</span>
                    )}
                  </li>
                ))}
              </ul>
            </Card>
          </li>
        ))}
      </ul>

      <div className="mb-8 mt-4 flex gap-2">
        <Link
          to={`/history/${detail.workout.id}`}
          className={buttonClasses('secondary', 'md', true)}
        >
          Edit this workout
        </Link>
        <Link to="/" className={buttonClasses('primary', 'md', true)}>
          Back to Today
        </Link>
      </div>
    </>
  );
}
