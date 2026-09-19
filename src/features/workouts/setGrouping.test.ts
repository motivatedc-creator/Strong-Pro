import { describe, expect, it } from 'vitest';
import type { WorkoutSet } from '@/domain/types';
import { groupSetsForDisplay } from './setGrouping';

const workoutSet = (patch: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: patch.id ?? 'set',
  workoutId: 'workout',
  workoutExerciseId: 'exercise',
  order: 0,
  setType: 'working',
  isCompleted: false,
  ...patch,
});

describe('groupSetsForDisplay', () => {
  it('gives each bilateral set its own single-row group', () => {
    const sets = [workoutSet({ id: 's1' }), workoutSet({ id: 's2' })];
    const groups = groupSetsForDisplay(sets);

    expect(groups).toHaveLength(2);
    expect(groups[0]).toEqual({ displayNumber: 1, rows: [sets[0]] });
    expect(groups[1]).toEqual({ displayNumber: 2, rows: [sets[1]] });
  });

  it('groups a pairId-linked left/right pair into one two-row group, left before right', () => {
    const right = workoutSet({ id: 'r1', side: 'right', pairId: 'pair-1' });
    const left = workoutSet({ id: 'l1', side: 'left', pairId: 'pair-1' });
    // Right lands first in the flat array (DB order quirk) — grouping must still sort left first.
    const groups = groupSetsForDisplay([right, left]);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.rows.map((s) => s.side)).toEqual(['left', 'right']);
  });

  it('numbers groups sequentially across a mix of bilateral and unilateral sets', () => {
    const bilateral = workoutSet({ id: 'b1' });
    const left = workoutSet({ id: 'l1', side: 'left', pairId: 'pair-1' });
    const right = workoutSet({ id: 'r1', side: 'right', pairId: 'pair-1' });
    const groups = groupSetsForDisplay([bilateral, left, right]);

    expect(groups.map((g) => g.displayNumber)).toEqual([1, 2]);
    expect(groups[0]!.rows).toEqual([bilateral]);
    expect(groups[1]!.rows).toHaveLength(2);
  });

  it('returns an empty array for empty input', () => {
    expect(groupSetsForDisplay([])).toEqual([]);
  });
});
