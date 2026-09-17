import { useMemo } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useRepository, useRepositoryData, useWrite } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { toast } from '@/app/store';
import { Button, Card, Chip, EmptyState, PageHeader, Spinner, StatTile } from '@/components/ui';
import { ActiveWorkoutExistsError } from '@/db/dexieRepository';
import { computeExerciseRecords } from '@/domain/records';
import { elapsedSeconds, formatDate, relativeDay } from '@/domain/time';
import { formatDurationLong, formatWeight } from '@/domain/units';
import { totalsForGroups } from '@/domain/volume';

/** Home screen: resume, start, or pick a template — plus a glance at recent work. */
export function TodayPage() {
  const navigate = useNavigate();
  const { settings, weightUnit, ready } = useSettings();
  const repository = useRepository();

  const { data, loading } = useRepositoryData(async (repository) => {
    const [active, templates, recent, completed] = await Promise.all([
      repository.getActiveWorkout(),
      repository.listTemplates(),
      repository.listWorkouts({ limit: 5 }),
      repository.getAllCompletedSets(),
    ]);
    return { active, templates, recent, completed };
  }, []);

  const [start, starting] = useWrite(async (templateId?: string) => {
    try {
      const detail = await repository.startWorkout(templateId ? { templateId } : {});
      navigate('/workout');
      return detail;
    } catch (error) {
      if (error instanceof ActiveWorkoutExistsError) {
        toast.warning('You already have a workout in progress.');
        navigate('/workout');
        return undefined;
      }
      throw error;
    }
  });

  const stats = useMemo(() => {
    const groups = (data?.completed ?? []).map((entry) => ({
      exercise: entry.exercise,
      sets: entry.sets,
    }));
    const totals = totalsForGroups(groups, {
      includeWarmups: !settings.excludeWarmupsFromAnalytics,
    });

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const thisWeek = (data?.completed ?? []).filter(
      (entry) => new Date(entry.workout.startedAt) >= sevenDaysAgo,
    );
    const weekTotals = totalsForGroups(
      thisWeek.map((entry) => ({ exercise: entry.exercise, sets: entry.sets })),
      { includeWarmups: !settings.excludeWarmupsFromAnalytics },
    );
    const weekWorkouts = new Set(thisWeek.map((entry) => entry.workout.id)).size;

    const records = computeExerciseRecords(
      (data?.completed ?? []).flatMap((entry) =>
        entry.sets.map((set) => ({
          ...set,
          exerciseId: entry.exercise.exerciseId,
          performedAt: entry.workout.startedAt,
        })),
      ),
      settings.oneRepMaxFormula,
    );

    const nameByExercise = new Map(
      (data?.completed ?? []).map((entry) => [
        entry.exercise.exerciseId,
        entry.exercise.exerciseNameSnapshot,
      ]),
    );

    const topRecords = [...records.values()]
      .filter((record) => record.bestOneRmG !== undefined)
      .sort((a, b) => (b.bestOneRmG ?? 0) - (a.bestOneRmG ?? 0))
      .slice(0, 4)
      .map((record) => ({
        exerciseId: record.exerciseId,
        name: nameByExercise.get(record.exerciseId) ?? 'Exercise',
        oneRmG: record.bestOneRmG ?? 0,
        heaviestG: record.heaviestSet?.weightG ?? 0,
      }));

    const sessionStats = new Map<string, { exercises: number; sets: number; volumeG: number }>();
    for (const entry of data?.completed ?? []) {
      const current = sessionStats.get(entry.workout.id) ?? { exercises: 0, sets: 0, volumeG: 0 };
      const exerciseTotals = totalsForGroups([{ exercise: entry.exercise, sets: entry.sets }], {
        includeWarmups: !settings.excludeWarmupsFromAnalytics,
      });
      sessionStats.set(entry.workout.id, {
        exercises: current.exercises + 1,
        sets: current.sets + exerciseTotals.completedSets,
        volumeG: current.volumeG + exerciseTotals.volumeG,
      });
    }

    return { totals, weekTotals, weekWorkouts, topRecords, sessionStats };
  }, [data, settings.excludeWarmupsFromAnalytics, settings.oneRepMaxFormula]);

  if (ready && !settings.onboardingCompletedAt) return <Navigate to="/onboarding" replace />;
  if (loading && !data) return <Spinner label="Loading your training" />;

  const active = data?.active;
  const templates = data?.templates ?? [];
  const recent = data?.recent ?? [];

  return (
    <>
      <PageHeader
        title="Today"
        subtitle={new Intl.DateTimeFormat(undefined, {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
        }).format(new Date())}
      />

      {active ? (
        <Card className="mb-4 border-accent/50">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-accent">
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent"
                />
                In progress
              </p>
              <h2 className="mt-1 truncate text-lg font-bold text-ink">{active.workout.name}</h2>
              <p className="text-sm text-ink-muted">
                {formatDurationLong(
                  elapsedSeconds(active.workout.startedAt, undefined, active.workout.pausedSeconds),
                )}{' '}
                · {active.exercises.length} exercise{active.exercises.length === 1 ? '' : 's'}
              </p>
            </div>
            <Button variant="primary" size="lg" onClick={() => navigate('/workout')}>
              Resume
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <Button
            variant="primary"
            size="lg"
            block
            className="mb-4"
            aria-label="Start empty workout"
            disabled={starting}
            onClick={() => void start(undefined)}
          >
            Let&apos;s cook 🔥
          </Button>
          <p className="-mt-2 mb-5 text-center text-xs text-ink-subtle">
            Bar&apos;s loaded. Log it or it didn&apos;t happen.
          </p>
        </>
      )}

      <section className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
            Routines
          </h2>
          <Link to="/templates" className="text-sm font-medium text-accent">
            Manage
          </Link>
        </div>

        {templates.length === 0 ? (
          <EmptyState
            title="No routines on record"
            description="Build a routine once and start it in a single tap on every future session."
            icon="▤"
            action={
              <Button variant="primary" onClick={() => navigate('/templates/new')}>
                Create a routine
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {templates.slice(0, 6).map((template) => (
              <li key={template.id}>
                <div className="rf-card flex items-center justify-between gap-2 p-3">
                  <Link to={`/templates/${template.id}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink">
                      {template.name}
                    </span>
                    {template.notes && (
                      <span className="block truncate text-xs text-ink-subtle">
                        {template.notes}
                      </span>
                    )}
                  </Link>
                  <Button
                    size="sm"
                    variant="primary"
                    disabled={starting || !!active}
                    onClick={() => void start(template.id)}
                  >
                    Start
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-ink-subtle">
          This week
        </h2>
        <div className="grid grid-cols-3 gap-2">
          <StatTile label="Workouts" value={String(stats.weekWorkouts)} />
          <StatTile label="Sets" value={String(stats.weekTotals.completedSets)} />
          <StatTile
            label="Volume"
            value={formatWeight(stats.weekTotals.volumeG, weightUnit, { decimals: 0 })}
            sub={weightUnit}
          />
        </div>
      </section>

      {stats.topRecords.length > 0 && (
        <section className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
              Personal records
            </h2>
            <Link to="/analytics" className="text-sm font-medium text-accent">
              Analytics
            </Link>
          </div>
          <ul className="space-y-1.5">
            {stats.topRecords.map((record) => (
              <li key={record.exerciseId}>
                <Link
                  to={`/exercises/${record.exerciseId}`}
                  className="rf-card flex items-center justify-between gap-3 p-3"
                >
                  <span className="min-w-0 truncate text-sm font-medium text-ink">
                    {record.name}
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <Chip tone="accent">
                      e1RM {formatWeight(record.oneRmG, weightUnit, { decimals: 1 })} {weightUnit}
                    </Chip>
                    <span className="hidden text-xs text-ink-subtle sm:inline">
                      best {formatWeight(record.heaviestG, weightUnit)} {weightUnit}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-subtle">
            Recent sessions
          </h2>
          <Link to="/history" className="text-sm font-medium text-accent">
            All history
          </Link>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            title="No aura on file yet"
            description="Log set one and start building a case. Your records and analytics will follow."
            icon="⏱"
          />
        ) : (
          <ul className="space-y-1.5">
            {recent.map((workout) => (
              <li key={workout.id}>
                <Link
                  to={`/history/${workout.id}`}
                  className="rf-card flex items-center justify-between gap-3 p-3"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">
                      {workout.name}
                    </span>
                    <span className="block text-xs text-ink-subtle">
                      {relativeDay(workout.startedAt)} · {formatDate(workout.startedAt)}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-muted">
                      {stats.sessionStats.get(workout.id)?.exercises ?? 0} exercises ·{' '}
                      {stats.sessionStats.get(workout.id)?.sets ?? 0} sets ·{' '}
                      {formatWeight(stats.sessionStats.get(workout.id)?.volumeG ?? 0, weightUnit, {
                        decimals: 0,
                      })}{' '}
                      {weightUnit}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {formatDurationLong(
                      elapsedSeconds(workout.startedAt, workout.endedAt, workout.pausedSeconds),
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
