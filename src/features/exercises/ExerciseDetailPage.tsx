import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useRepositoryData } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { CHART_COLORS, ChartCard } from '@/components/Chart';
import { Button, Card, Chip, EmptyState, PageHeader, Sheet, Spinner, StatTile } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import { FORMULA_LABEL } from '@/domain/oneRepMax';
import { formatDate, localDateOf, parseIso } from '@/domain/time';
import { setTypeLabel, titleCase, trackingLabel } from '@/domain/taxonomy';
import { formatWeight } from '@/domain/units';
import { getClaim } from '@/domain/evidence';
import { suggestProgression, type ExerciseSession } from '@/domain/progression';
import { ExerciseEditor } from './ExerciseEditor';
import { exerciseProgress, type LoggedEntry } from '@/features/analytics/compute';
import { ClaimEvidenceSheet } from '@/features/analytics/ClaimEvidenceSheet';
import { resolveIncrementG } from '@/features/workouts/progressionSessions';
import { PROGRESSION_STATE_META, formatProgressionTarget } from '@/features/workouts/progressionCopy';

/** Per-exercise history: every previous session, records and progression charts. */
export function ExerciseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { settings, weightUnit } = useSettings();
  const [editing, setEditing] = useState(false);
  const [showProgressionReceipt, setShowProgressionReceipt] = useState(false);
  const [showProgressionClaim, setShowProgressionClaim] = useState(false);

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

    // No workout/template context on this page, so no rep range — the engine takes its honest
    // "beat last session" fallback rather than inventing a range.
    const exerciseSessions: ExerciseSession[] = sessions.map((entry) => {
      const parsed = parseIso(entry.workout.startedAt);
      return {
        localDate: parsed ? localDateOf(parsed) : entry.workout.startedAt,
        sets: entry.sets,
      };
    });
    const progression = data.exercise
      ? suggestProgression(
          exerciseSessions,
          settings.oneRepMaxFormula,
          resolveIncrementG(data.exercise, { quickIncrementG: settings.quickIncrementG }),
        )
      : null;

    return { progress, sessions, bestOneRm, bestWeight, totalVolume, progression };
  }, [
    data,
    id,
    settings.oneRepMaxFormula,
    settings.excludeWarmupsFromAnalytics,
    settings.secondaryMuscleCredit,
    settings.quickIncrementG,
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

          {view.progression && (
            <Card className="mb-4 border-accent/30">
              <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                What to beat next
              </p>
              <button
                type="button"
                className="mt-2 flex min-h-11 w-full items-center justify-between gap-3 rounded border border-line bg-surface-raised px-3 py-2 text-left transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                onClick={() => setShowProgressionReceipt(true)}
                aria-label={`Progression suggestion: ${
                  PROGRESSION_STATE_META[view.progression.state].label
                }, ${formatProgressionTarget(view.progression.target, weightUnit)}. Open receipt`}
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <Icon icon={PROGRESSION_STATE_META[view.progression.state].icon} size={14} />
                    {PROGRESSION_STATE_META[view.progression.state].label}
                  </span>
                  <span className="mt-0.5 block text-sm text-ink-muted">
                    {formatProgressionTarget(view.progression.target, weightUnit)}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-accent">Open receipt</span>
              </button>
            </Card>
          )}

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

      <Sheet
        open={showProgressionReceipt}
        onClose={() => {
          setShowProgressionReceipt(false);
          setShowProgressionClaim(false);
        }}
        title="Progression"
        description="Numbers from logged sessions. Not a prescription."
      >
        {view?.progression && (
          <div className="space-y-4 text-sm">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
              <Icon icon={PROGRESSION_STATE_META[view.progression.state].icon} size={14} />
              {PROGRESSION_STATE_META[view.progression.state].label}
            </p>
            <Card className="p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                Receipt
              </p>
              <p className="mt-1 font-medium text-ink">{view.progression.receipt}</p>
            </Card>
            {(() => {
              const claim = getClaim(view.progression.claimId);
              return claim ? (
                <button
                  type="button"
                  className="min-h-11 w-full rounded-xl border border-line bg-surface-raised px-3 py-2 text-left"
                  onClick={() => setShowProgressionClaim(true)}
                >
                  <span className="block text-sm font-semibold text-ink">{claim.statement}</span>
                  <span className="mt-1 block text-[11px] text-accent">Open claim receipt</span>
                </button>
              ) : null;
            })()}
          </div>
        )}
      </Sheet>

      {view?.progression &&
        (() => {
          const claim = getClaim(view.progression.claimId);
          return claim ? (
            <ClaimEvidenceSheet
              open={showProgressionClaim}
              onClose={() => setShowProgressionClaim(false)}
              claim={claim}
              title="Progression rule"
            />
          ) : null;
        })()}

      <div className="h-8" aria-hidden="true" />
    </>
  );
}
