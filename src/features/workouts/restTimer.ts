import { create } from 'zustand';
import { getRepository } from '@/db/dexieRepository';
import type { TimerState, UUID } from '@/domain/types';
import { nowIso } from '@/domain/time';
import { cancelRestNotification, scheduleRestNotification } from '@/platform/capacitor';
import { playChime, showWebNotification, vibrate } from '@/platform/feedback';

/**
 * Rest timer.
 *
 * The timer is a pair of absolute timestamps in IndexedDB, not a counter. Remaining time
 * is always `endsAt - now`, recomputed on every tick and on every return to the
 * foreground, so a reload, a backgrounded tab, or the browser being killed outright all
 * resume correctly. Nothing about logging depends on this loop still running.
 */

interface RestTimerState {
  timer: TimerState | null;
  /** Timestamp of the last completion we announced, so the chime fires exactly once. */
  announcedFor: string | null;
  hydrate: () => Promise<void>;
  start: (
    durationSeconds: number,
    context: { workoutId?: UUID; setId?: UUID; label?: string },
  ) => Promise<void>;
  adjust: (deltaSeconds: number) => Promise<void>;
  stop: () => Promise<void>;
  announce: (options: { sound: boolean; vibration: boolean; notification: boolean }) => void;
}

function remainingMs(timer: TimerState | null, at = Date.now()): number {
  if (!timer) return 0;
  return new Date(timer.endsAt).getTime() - at;
}

export function remainingSeconds(timer: TimerState | null, at = Date.now()): number {
  return Math.max(0, Math.ceil(remainingMs(timer, at) / 1000));
}

export function isExpired(timer: TimerState | null, at = Date.now()): boolean {
  return !!timer && remainingMs(timer, at) <= 0;
}

export const useRestTimerStore = create<RestTimerState>((set, get) => ({
  timer: null,
  announcedFor: null,

  hydrate: async () => {
    const stored = await getRepository().getTimer();
    set({ timer: stored ?? null });
  },

  start: async (durationSeconds, context) => {
    const startedAt = new Date();
    const endsAt = new Date(startedAt.getTime() + Math.max(1, durationSeconds) * 1000);
    const timer: TimerState = {
      id: 'rest-timer',
      workoutId: context.workoutId,
      setId: context.setId,
      startedAt: startedAt.toISOString(),
      endsAt: endsAt.toISOString(),
      durationSeconds: Math.max(1, Math.round(durationSeconds)),
      isRunning: true,
      label: context.label,
    };
    set({ timer, announcedFor: null });
    await getRepository().setTimer(timer);
    // Native builds get a real scheduled notification; the web silently no-ops.
    void scheduleRestNotification(
      endsAt,
      context.label ? `${context.label} — time to lift.` : 'Time to lift.',
    );
  },

  adjust: async (deltaSeconds) => {
    const current = get().timer;
    if (!current) return;
    const base = Math.max(Date.now(), new Date(current.endsAt).getTime());
    const endsAt = new Date(base + deltaSeconds * 1000);
    if (endsAt.getTime() <= Date.now()) {
      await get().stop();
      return;
    }
    const timer: TimerState = {
      ...current,
      endsAt: endsAt.toISOString(),
      durationSeconds: Math.max(1, current.durationSeconds + deltaSeconds),
      isRunning: true,
    };
    set({ timer, announcedFor: null });
    await getRepository().setTimer(timer);
    void scheduleRestNotification(
      endsAt,
      timer.label ? `${timer.label} — time to lift.` : 'Time to lift.',
    );
  },

  stop: async () => {
    set({ timer: null, announcedFor: null });
    await getRepository().setTimer(null);
    void cancelRestNotification();
  },

  announce: ({ sound, vibration, notification }) => {
    const timer = get().timer;
    if (!timer || get().announcedFor === timer.endsAt) return;
    set({ announcedFor: timer.endsAt });
    if (sound) playChime();
    if (vibration) vibrate();
    if (notification) {
      showWebNotification(
        'Rest complete',
        timer.label ? `${timer.label} — time to lift.` : 'Time to lift.',
      );
    }
  },
}));

/** Suggested rest presets, in seconds. */
export const REST_PRESETS = [60, 90, 120, 180, 240, 300];

export function timerProgress(timer: TimerState | null, at = Date.now()): number {
  if (!timer) return 0;
  const total = timer.durationSeconds * 1000;
  if (total <= 0) return 1;
  const elapsed = at - new Date(timer.startedAt).getTime();
  return Math.min(1, Math.max(0, elapsed / total));
}

export function describeTimer(timer: TimerState | null): string {
  if (!timer) return 'No rest timer running';
  const seconds = remainingSeconds(timer);
  if (seconds <= 0) return `Rest complete${timer.label ? ` for ${timer.label}` : ''}`;
  return `${seconds} seconds of rest remaining${timer.label ? ` before ${timer.label}` : ''}`;
}

export function nowLabel(): string {
  return nowIso();
}
