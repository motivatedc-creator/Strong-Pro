import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRepositoryData } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { CHART_COLORS, ChartCard } from '@/components/Chart';
import { Button, Card, Chip, EmptyState, PageHeader, Spinner, StatTile } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { FORMULA_LABEL } from '@/domain/oneRepMax';
import { formatDate } from '@/domain/time';
import { setTypeLabel, titleCase, trackingLabel } from '@/domain/taxonomy';
import { formatWeight } from '@/domain/units';
import { ExerciseEditor } from './ExerciseEditor';
import { exerciseProgress, type LoggedEntry } from '@/features/analytics/compute';

/** Per-exercise history: every previous session, records and progression charts. */
export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { settings, weightUnit } = useSettings();
  const [editing, setEditing] = useState(false);

  const { data, loading } = useRepositoryData(
    async (repository) => {
      if (!id) return null;
      const [exercise, entries] = await Promise.all([
        repository.getExercise(id),
        repository.getAllCompletedSets(),
      ]);
      return { exercise, entries: entries as LoggedEntry[] };
    },
    [id],
  );

  const view = useMemo(() => {
    if (!data || !id) return null;
    const relevant = data.entries.filter((entry) => entry.exercise.exerciseId === id);
    const options = {
      formula: settings.oneRepMaxFormula,
      includeWarmups: !settings.excludeWarmupsFromAnalytics,
      secondaryCredit: settings.secondaryMuscleCredit,
    };
    const progress = exerciseProgress(relevant, id, options);
    const sessions = [...relevant].sort((a, b) =>
      b.workout.startedAt.localeCompare(a.workout.startedAt),
    );
    const bestOneRm = progress.oneRepMax.reduce((max, point) => Math.max(max, point.value), 0);
    const bestWeight = progress.bestWeight.reduce((max, point) => Math.max(max, point.value), 0);
    const totalVolume = progress.volume.reduce((sum, point) => sum + point.value, 0);
    return { progress, sessions, bestOneRm, bestWeight, totalVolume };
  }, [
    data,
    id,
    settings.oneRepMaxFormula,
    settings.excludeWarmupsFromAnalytics,
    settings.secondaryMuscleCredit,
  ]);

  if (loading && !data) return <Spinner label="Loading exercise" />;
  if (!data?.exercise) {
    return (
      <EmptyState
        title="Exercise not found"
        description="It may have been deleted. Your logged history still shows the name it was performed under."
        icon={<Icon icon={Icons.search} size={22} />}
        action={
          <Link to="/exercises" className="text-sm font-semibold text-accent">
            Back to the library
          </Link>
        }
      />
    );
  }

  const exercise = data.exercise;

  return (
    <>
      <PageHeader
        title={exercise.name}
        subtitle={`${titleCase(exercise.primaryMuscleGroup)} · ${titleCase(exercise.equipment)} · ${trackingLabel(
          exercise.trackingType,
        )}`}
        actions={<Button onClick={() => setEditing(true)}>Edit</Button>}
      />

      <div className="mb-3 flex flex-wrap gap-2">
        {exercise.isCustom && <Chip tone="accent">Custom</Chip>}
        {exercise.isArchived && <Chip tone="warning">Archived</Chip>}
        {exercise.secondaryMuscleGroups.map((muscle) => (
          <Chip key={muscle}>{titleCase(muscle)}</Chip>
        ))}
      </div>

      {exercise.notes && <Card className="mb-4 text-sm text-ink-muted">{exercise.notes}</Card>}

      {!view || view.sessions.length === 0 ? (
        <EmptyState
          title="No sessions logged yet"
          description="Once you log this exercise, its progression charts, records and previous sets appear here."
          icon={<Icon icon={Icons.chart} size={22} />}
        />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-3 gap-2">
            <StatTile
              label={`Best e1RM (${FORMULA_LABEL[settings.oneRepMaxFormula]})`}
              value={formatWeight(view.bestOneRm, weightUnit, { decimals: 1 })}
              sub={weightUnit}
              tone="accent"
            />
            <StatTile
              label="Heaviest set"
              value={formatWeight(view.bestWeight, weightUnit)}
              sub={weightUnit}
            />
            <StatTile label="Sessions" value={String(view.sessions.length)} />
          </div>

          <div className="mb-4 space-y-4">
            <ChartCard
              title="Estimated 1RM"
              summary={`${view.progress.oneRepMax.length} sessions with a weighted set. Best ${formatWeight(
                view.bestOneRm,
                weightUnit,
              )} ${weightUnit}.`}
              valueLabel={`e1RM (${weightUnit})`}
              formatValue={(grams) => formatWeight(grams, weightUnit, { decimals: 0 })}
              series={[
                {
                  id: 'e1rm',
                  name: `Estimated 1RM (${weightUnit})`,
                  color: CHART_COLORS[0]!,
                  points: view.progress.oneRepMax.map((point) => ({
                    date: point.date,
                    label: point.label,
                    value: point.value,
                  })),
                },
              ]}
            />
            <ChartCard
              title="Session volume"
              summary={`${formatWeight(view.totalVolume, weightUnit, { decimals: 0 })} ${weightUnit} lifted across ${
                view.progress.volume.length
              } sessions.`}
              valueLabel={`Volume (${weightUnit})`}
              kind="bar"
              formatValue={(grams) => formatWeight(grams, weightUnit, { decimals: 0 })}
              series={[
                {
                  id: 'volume',
                  name: `Volume (${weightUnit})`,
                  color: CHART_COLORS[2]!,
                  points: view.progress.volume.map((point) => ({
                    date: point.date,
                    label: point.label,
                    value: point.value,
                  })),
                },
              ]}
            />
          </div>

          {view.progress.repMaxes.length > 0 && (
            <Card className="mb-4">
              <h2 className="mb-2 text-sm font-semibold text-ink">Rep records</h2>
              <ul className="grid grid-cols-3 gap-2">
                {view.progress.repMaxes.map((record) => (
                  <li
                    key={record.reps}
                    className="rounded border border-line bg-surface-raised px-2 py-2"
                  >
                    <p className="text-xs uppercase tracking-wide text-ink-subtle">
                      {record.reps}+ reps
                    </p>
                    <p className="text-sm font-bold tabular-nums text-ink">
                      {formatWeight(record.weightG, weightUnit)} {weightUnit}
                    </p>
                    <p className="text-[11px] text-ink-subtle">{formatDate(record.date)}</p>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-subtle">
            Previous sessions
          </h2>
          <ul className="space-y-2">
            {view.sessions.slice(0, 30).map((entry) => (
              <li key={`${entry.workout.id}-${entry.exercise.id}`}>
                <Card className="p-3">
                  <div className="mb-1 flex items-center justify-between">
                    <Link
                      to={`/history/${entry.workout.id}`}
                      className="text-sm font-medium text-ink hover:text-accent"
                    >
                      {entry.workout.name}
                    </Link>
                    <span className="text-xs text-ink-subtle">
                      {formatDate(entry.workout.startedAt)}
                    </span>
                  </div>
                  <ul className="space-y-0.5 text-sm text-ink-muted">
                    {entry.sets.map((set, index) => (
                      <li key={set.id} className="flex items-center gap-2 tabular-nums">
                        <span className="w-4 text-xs text-ink-subtle">{index + 1}</span>
                        <span>
                          {set.weightG !== undefined
                            ? `${formatWeight(set.weightG, weightUnit)} ${weightUnit}`
                            : '—'}
                          {set.reps !== undefined ? ` × ${set.reps}` : ''}
                        </span>
                        {set.setType !== 'working' && <Chip>{setTypeLabel(set.setType)}</Chip>}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}

      <ExerciseEditor open={editing} exercise={exercise} onClose={() => setEditing(false)} />
      <div className="h-8" aria-hidden="true" />
    </>
  );
}
