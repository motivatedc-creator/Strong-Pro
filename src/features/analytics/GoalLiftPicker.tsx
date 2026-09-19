import { useEffect, useMemo, useState } from 'react';
import { useRepositoryData } from '@/app/hooks';
import { Button, Chip, EmptyState, Sheet, Spinner, TextInput, cx } from '@/components/ui';
import { Icon, Icons } from '@/components/icons';
import type { UUID } from '@/domain/types';
import type { TrainingBaselineWeek } from './trainingWeeks';
import { MAX_GOAL_LIFTS, rankedGoalLiftCandidates } from './weeklyVerdict';

/**
 * Lets the user name up to {@link MAX_GOAL_LIFTS} goal lifts, instead of the Weekly Verdict
 * silently inferring them. Reused from both the verdict card and Settings — pass
 * `baselineWeeks` when you have one (Data Lab) so rows show a session count; Settings has no
 * baseline computed and just lists the library alphabetically.
 */
export function GoalLiftPicker({
  open,
  onClose,
  goalLiftIds,
  onChange,
  baselineWeeks,
}: {
  open: boolean;
  onClose: () => void;
  goalLiftIds: readonly UUID[] | undefined;
  onChange: (ids: UUID[]) => void;
  baselineWeeks?: readonly TrainingBaselineWeek[];
}) {
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UUID[]>(() => [...(goalLiftIds ?? [])]);

  useEffect(() => {
    if (!open) return;
    setSelected([...(goalLiftIds ?? [])]);
    setSearch('');
    // Re-sync only when the sheet opens, not on every settings change while it's open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const { data: exercises, loading } = useRepositoryData((repo) => repo.listExercises(), [open]);

  const sessionsByLift = useMemo(
    () =>
      new Map(
        rankedGoalLiftCandidates(baselineWeeks ?? []).map((lift) => [lift.id, lift.sessions]),
      ),
    [baselineWeeks],
  );

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (exercises ?? [])
      .filter((exercise) => !exercise.isArchived)
      .filter((exercise) => (query ? exercise.name.toLowerCase().includes(query) : true))
      .map((exercise) => ({ exercise, sessions: sessionsByLift.get(exercise.id) ?? 0 }))
      .sort((a, b) => b.sessions - a.sessions || a.exercise.name.localeCompare(b.exercise.name));
  }, [exercises, search, sessionsByLift]);

  const toggle = (id: UUID) => {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((value) => value !== id);
      if (current.length >= MAX_GOAL_LIFTS) return current;
      return [...current, id];
    });
  };

  const save = () => {
    onChange(selected);
    onClose();
  };

  const useTopLifts = () => {
    onChange([]);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Goal lifts"
      description={`Pick up to ${MAX_GOAL_LIFTS}. Leave none picked and Lock’d keeps using your most-trained lifts, labelled as a guess.`}
      size="lg"
      footer={
        <div className="flex gap-2">
          <Button block onClick={useTopLifts}>
            Use my top lifts instead
          </Button>
          <Button block variant="primary" onClick={save}>
            Save
          </Button>
        </div>
      }
    >
      <div className="sticky top-0 z-10 -mx-4 -mt-4 mb-3 bg-surface px-4 pb-3 pt-4">
        <TextInput
          type="search"
          data-autofocus
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search your library"
          aria-label="Search exercises"
        />
        <p className="mt-2 text-xs text-ink-subtle" aria-live="polite">
          {selected.length} of {MAX_GOAL_LIFTS} chosen
        </p>
      </div>

      {loading && <Spinner label="Loading your library" />}

      {!loading && rows.length === 0 && (
        <EmptyState
          title="No matching exercises"
          description="Try a different search."
          icon={<Icon icon={Icons.search} size={22} />}
        />
      )}

      <ul className="space-y-1.5">
        {rows.map(({ exercise, sessions }) => {
          const isSelected = selected.includes(exercise.id);
          const atCap = !isSelected && selected.length >= MAX_GOAL_LIFTS;
          return (
            <li key={exercise.id}>
              <button
                type="button"
                aria-pressed={isSelected}
                disabled={atCap}
                onClick={() => toggle(exercise.id)}
                className={cx(
                  'flex min-h-tap w-full items-center gap-3 rounded border px-3 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-50',
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
                  {isSelected ? <Icon icon={Icons.check} size={12} strokeWidth={2.5} /> : '+'}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink">
                    {exercise.name}
                  </span>
                  {sessions > 0 && (
                    <span className="block text-xs text-ink-subtle">
                      {sessions} session{sessions === 1 ? '' : 's'} in your baseline
                    </span>
                  )}
                </span>
                {exercise.isCustom && <Chip tone="accent">Custom</Chip>}
              </button>
            </li>
          );
        })}
      </ul>
    </Sheet>
  );
}
