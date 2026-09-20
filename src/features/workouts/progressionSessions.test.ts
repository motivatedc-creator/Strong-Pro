import { describe, expect, it } from 'vitest';
import type { SetWithContext } from '@/domain/records';
import { groupSetsIntoSessions, resolveIncrementG } from './progressionSessions';

const set = (patch: Partial<SetWithContext> = {}): SetWithContext => ({
  id: patch.id ?? 'set',
  workoutId: patch.workoutId ?? 'workout',
  workoutExerciseId: patch.workoutExerciseId ?? 'we',
  order: patch.order ?? 0,
  setType: patch.setType ?? 'working',
  isCompleted: patch.isCompleted ?? true,
  exerciseId: patch.exerciseId ?? 'ex',
  performedAt: patch.performedAt ?? '2026-09-01T10:00:00.000Z',
  weightG: patch.weightG,
  reps: patch.reps,
});

describe('groupSetsIntoSessions', () => {
  it('groups sets sharing a performedAt into one session', () => {
    const sets = [
      set({ id: 'a', performedAt: '2026-09-10T10:00:00.000Z', order: 0 }),
      set({ id: 'b', performedAt: '2026-09-10T10:00:00.000Z', order: 1 }),
      set({ id: 'c', performedAt: '2026-09-03T10:00:00.000Z', order: 0 }),
    ];
    const sessions = groupSetsIntoSessions(sets);
    expect(sessions).toHaveLength(2);
    expect(sessions[0]!.sets.map((s) => s.id)).toEqual(['a', 'b']);
    expect(sessions[1]!.sets.map((s) => s.id)).toEqual(['c']);
  });

  it('derives localDate from performedAt', () => {
    const sessions = groupSetsIntoSessions([set({ performedAt: '2026-09-10T23:30:00.000Z' })]);
    expect(sessions[0]!.localDate).toMatch(/^2026-09-(10|11)$/);
  });

  it('sorts sessions newest-first regardless of input order', () => {
    const sets = [
      set({ id: 'old', performedAt: '2026-08-01T09:00:00.000Z' }),
      set({ id: 'new', performedAt: '2026-09-15T09:00:00.000Z' }),
      set({ id: 'mid', performedAt: '2026-09-01T09:00:00.000Z' }),
    ];
    const sessions = groupSetsIntoSessions(sets);
    expect(sessions.map((session) => session.sets[0]!.id)).toEqual(['new', 'mid', 'old']);
  });

  it('returns an empty array for no sets', () => {
    expect(groupSetsIntoSessions([])).toEqual([]);
  });
});

describe('resolveIncrementG', () => {
  it('prefers the exercise increment when set', () => {
    expect(resolveIncrementG({ incrementG: 1_000 }, { quickIncrementG: 2_500 })).toBe(1_000);
  });

  it('falls back to the settings quick increment when unset', () => {
    expect(resolveIncrementG({ incrementG: undefined }, { quickIncrementG: 2_500 })).toBe(2_500);
  });
});
