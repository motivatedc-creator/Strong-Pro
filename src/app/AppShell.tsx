import { useEffect, useMemo } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useRepositoryData, useTicker, useVisibilityRefresh } from './hooks';
import { BottomNav, SideNav } from './navigation';
import { Toaster } from '@/components/Toaster';
import { RestTimerBar } from '@/features/workouts/RestTimerBar';
import { useRestTimerStore } from '@/features/workouts/restTimer';
import { formatDuration } from '@/domain/units';
import { elapsedSeconds } from '@/domain/time';

/**
 * Application shell: navigation, the persistent "workout in progress" banner and the
 * rest-timer bar. Both persist across every route, which is what lets a user browse
 * history or open the plate calculator mid-session without losing their place.
 */
export function AppShell() {
  const location = useLocation();
  const hydrateTimer = useRestTimerStore((state) => state.hydrate);

  const { data: active, reload } = useRepositoryData(
    (repository) => repository.getActiveWorkout(),
    [location.pathname],
  );

  useEffect(() => {
    void hydrateTimer();
  }, [hydrateTimer]);

  // Coming back from a backgrounded tab: re-read the active workout and the timer, both
  // of which may have been changed by another tab or advanced by wall-clock time.
  useVisibilityRefresh(() => {
    reload();
    void hydrateTimer();
  });

  const onActiveWorkoutScreen = location.pathname === '/workout';
  const tick = useTicker(!!active && !onActiveWorkoutScreen, 1_000);
  // Recomputed on every tick: elapsed time comes from the stored start timestamp.
  const elapsed = useMemo(
    () =>
      active
        ? elapsedSeconds(active.workout.startedAt, undefined, active.workout.pausedSeconds)
        : 0,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, tick],
  );

  return (
    <div className="flex min-h-dvh bg-canvas">
      <SideNav />
      <div className="flex min-w-0 flex-1 flex-col">
        <main
          id="main"
          className="mx-auto w-full max-w-3xl flex-1 px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] lg:pb-8"
        >
          <Outlet />
        </main>
      </div>

      {active && !onActiveWorkoutScreen && (
        <Link
          to="/workout"
          className="fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-40 mx-auto flex max-w-lg items-center justify-between gap-3 border-t border-accent/40 bg-accent px-4 py-2 text-accent-ink lg:bottom-4 lg:left-auto lg:right-4 lg:max-w-xs lg:rounded-lg lg:border"
        >
          <span className="flex items-center gap-2 text-sm font-semibold">
            <span
              aria-hidden="true"
              className="inline-block h-2 w-2 animate-pulse rounded-full bg-accent-ink"
            />
            Workout in progress
          </span>
          <span className="tabular-nums text-sm font-bold">{formatDuration(elapsed)}</span>
        </Link>
      )}

      <RestTimerBar />
      <Toaster />
      <BottomNav />
    </div>
  );
}
