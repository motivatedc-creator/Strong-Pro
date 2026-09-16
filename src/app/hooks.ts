import { useCallback, useEffect, useRef, useState } from 'react';
import { getRepository } from '@/db/dexieRepository';
import type { RepForgeRepository } from '@/db/repository';
import { bumpData, useAppStore } from './store';

export function useRepository(): RepForgeRepository {
  return getRepository();
}

export interface AsyncState<T> {
  data: T | undefined;
  error: Error | null;
  loading: boolean;
  reload: () => void;
}

/**
 * Reads from the repository and refetches whenever `dataVersion` changes or a dependency
 * moves. Results are delivered only if the component is still mounted and the request is
 * the newest one, so a fast sequence of writes cannot render a stale result.
 */
export function useRepositoryData<T>(
  read: (repository: RepForgeRepository) => Promise<T>,
  deps: readonly unknown[] = [],
): AsyncState<T> {
  const repository = useRepository();
  const dataVersion = useAppStore((state) => state.dataVersion);
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [localVersion, setLocalVersion] = useState(0);
  const requestId = useRef(0);

  // `read` is intentionally not a dependency: callers pass inline closures, and the
  // explicit `deps` array is what decides when a refetch is needed.
  const readRef = useRef(read);
  readRef.current = read;

  useEffect(() => {
    let cancelled = false;
    const id = (requestId.current += 1);
    setLoading(true);
    readRef
      .current(repository)
      .then((result) => {
        if (cancelled || id !== requestId.current) return;
        setData(result);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cancelled || id !== requestId.current) return;
        setError(cause instanceof Error ? cause : new Error(String(cause)));
      })
      .finally(() => {
        if (cancelled || id !== requestId.current) return;
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repository, dataVersion, localVersion, ...deps]);

  const reload = useCallback(() => setLocalVersion((value) => value + 1), []);
  return { data, error, loading, reload };
}

/**
 * Wraps a write so that concurrent invocations (double taps on a phone) collapse into one.
 * Returns a stable callback plus a `pending` flag for disabling the control.
 */
export function useWrite<TArgs extends unknown[], TResult>(
  write: (...args: TArgs) => Promise<TResult>,
): [(...args: TArgs) => Promise<TResult | undefined>, boolean] {
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const writeRef = useRef(write);
  writeRef.current = write;

  const run = useCallback(async (...args: TArgs): Promise<TResult | undefined> => {
    if (inFlight.current) return undefined;
    inFlight.current = true;
    setPending(true);
    try {
      const result = await writeRef.current(...args);
      bumpData();
      return result;
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }, []);

  return [run, pending];
}

/** Ticks every `intervalMs` while `active`, used by the workout clock and rest timer. */
export function useTicker(active: boolean, intervalMs = 1_000): number {
  const [tick, setTick] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setTick(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [active, intervalMs]);
  return tick;
}

/** Re-reads state when the tab returns to the foreground (timers, active workout). */
export function useVisibilityRefresh(onVisible: () => void): void {
  const callback = useRef(onVisible);
  callback.current = onVisible;
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') callback.current();
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('focus', handler);
    };
  }, []);
}

export function useDebouncedValue<T>(value: T, delayMs = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}
