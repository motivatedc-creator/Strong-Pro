import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DexieRepository, setRepository } from '@/db/dexieRepository';
import { RepForgeDatabase } from '@/db/schema';
import { useRestTimerStore } from './restTimer';

let db: RepForgeDatabase;
let repository: DexieRepository;

beforeEach(async () => {
  db = new RepForgeDatabase(`repforge-timer-${Math.random().toString(36).slice(2)}`);
  repository = new DexieRepository(db);
  await repository.initialise();
  setRepository(repository);
  useRestTimerStore.setState({ timer: null, announcedFor: null });
});

afterEach(() => {
  setRepository(null);
});

describe('stopForWorkout', () => {
  it('clears a running timer belonging to the finished workout', async () => {
    const workoutId = 'workout-1';
    await useRestTimerStore.getState().start(120, { workoutId, label: 'Bench Press' });
    expect(useRestTimerStore.getState().timer).not.toBeNull();

    await useRestTimerStore.getState().stopForWorkout(workoutId);

    expect(useRestTimerStore.getState().timer).toBeNull();
    expect(await repository.getTimer()).toBeUndefined();
  });

  it('leaves a timer owned by a different workout alone', async () => {
    await useRestTimerStore.getState().start(120, { workoutId: 'workout-1' });

    await useRestTimerStore.getState().stopForWorkout('workout-2');

    expect(useRestTimerStore.getState().timer?.workoutId).toBe('workout-1');
  });

  it('is a no-op when no timer is running', async () => {
    await expect(useRestTimerStore.getState().stopForWorkout('workout-1')).resolves.toBeUndefined();
    expect(useRestTimerStore.getState().timer).toBeNull();
  });
});
