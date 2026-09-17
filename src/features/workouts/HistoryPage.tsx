import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useDebouncedValue, useRepositoryData } from '@/app/hooks';
import { useSettings } from '@/app/SettingsProvider';
import { Button, EmptyState, PageHeader, Segmented, Spinner, TextInput } from '@/components/ui';
import {
  elapsedSeconds,
  formatDate,
  relativeDay,
  resolveRange,
  type RangeKey,
} from '@/domain/time';
import { formatDurationLong, formatWeight } from '@/domain/units';
import { totalsForGroups } from '@/domain/volume';

const PAGE_SIZE = 20;

/** Browsable, searchable workout history. Pages in batches so a long history stays fast. */
export function HistoryPage() {
  const { weightUnit, settings } = useSettings();
  const [search, setSearch] = useState('');
  const [range, setRange] = useState<RangeKey>('all');
  const [limit, setLimit] = useState(PAGE_SIZE);
  const debouncedSearch = useDebouncedValue(search, 250);

  const { data, loading } = useRepositoryData(
    async (repository) => {
      const { from } = resolveRange(range);
      const query = {
        search: debouncedSearch || undefined,
        from: from ? from.toISOString() : undefined,
        limit,
      };
      const [workouts, total, allSets] = await Promise.all([
        repository.listWorkouts(query),
        repository.countWorkouts({ search: query.search, from: query.from }),
        repository.getAllCompletedSets(),
      ]);

      const byWorkout = new Map<string, { volumeG: number; sets: number }>();
      for (const entry of allSets) {
        const totals = totalsForGroups([{ exercise: entry.exercise, sets: entry.sets }], {
          includeWarmups: !settings.excludeWarmupsFromAnalytics,
        });
        const current = byWorkout.get(entry.workout.id) ?? { volumeG: 0, sets: 0 };
        byWorkout.set(entry.workout.id, {
          volumeG: current.volumeG + totals.volumeG,
          sets: current.sets + totals.completedSets,
        });
      }

      return { workouts, total, byWorkout };
    },
    [debouncedSearch, range, limit, settings.excludeWarmupsFromAnalytics],
  );

  const workouts = data?.workouts ?? [];
  const total = data?.total ?? 0;

  return (
    <>
      <PageHeader
        title="History"
        subtitle={`${total} completed workout${total === 1 ? '' : 's'}`}
      />

      <div className="mb-4 space-y-2">
        <TextInput
          type="search"
          value={search}
          aria-label="Search workouts and exercises"
          placeholder="Search workouts, notes or exercises"
          onChange={(event) => {
            setSearch(event.target.value);
            setLimit(PAGE_SIZE);
          }}
        />
        <Segmented
          label="Date range"
          size="sm"
          value={range}
          onChange={(value) => {
            setRange(value);
            setLimit(PAGE_SIZE);
          }}
          options={[
            { value: 'this_week', label: 'This week' },
            { value: '4w', label: '4W' },
            { value: '8w', label: '8W' },
            { value: '12w', label: '12W' },
            { value: '6m', label: '6M' },
            { value: '1y', label: '1Y' },
            { value: 'all', label: 'All' },
          ]}
        />
      </div>

      {loading && !data && <Spinner label="Loading history" />}

      {!loading && workouts.length === 0 && (
        <EmptyState
          title={search ? 'No workouts match that search' : 'No workouts yet'}
          description={
            search
              ? 'Try a different exercise name, workout name or note.'
              : 'Finish a session and it will appear here with its sets, volume and records.'
          }
          icon="⏱"
        />
      )}

      <ul className="space-y-2">
        {workouts.map((workout) => {
          const stats = data?.byWorkout.get(workout.id);
          return (
            <li key={workout.id}>
              <Link
                to={`/history/${workout.id}`}
                className="rf-card block p-3 hover:border-accent/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-ink">{workout.name}</h2>
                    <p className="text-xs text-ink-subtle">
                      {relativeDay(workout.startedAt)} · {formatDate(workout.startedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-muted">
                    {formatDurationLong(
                      elapsedSeconds(workout.startedAt, workout.endedAt, workout.pausedSeconds),
                    )}
                  </span>
                </div>
                <p className="mt-1 flex gap-3 text-xs text-ink-muted tabular-nums">
                  <span>{stats?.sets ?? 0} sets</span>
                  <span>
                    {formatWeight(stats?.volumeG ?? 0, weightUnit, { decimals: 0 })} {weightUnit}
                  </span>
                  {workout.importFingerprint && <span className="text-ink-subtle">imported</span>}
                </p>
                {workout.notes && (
                  <p className="mt-1 truncate text-xs text-ink-subtle">{workout.notes}</p>
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      {workouts.length < total && (
        <Button block className="mt-3" onClick={() => setLimit((value) => value + PAGE_SIZE)}>
          Load more ({total - workouts.length} remaining)
        </Button>
      )}
    </>
  );
}
