import type { WorkoutSet } from '@/domain/types';

const SIDE_ORDER: Record<'left' | 'right', number> = { left: 0, right: 1 };

/**
 * Groups a flat list of sets for rendering: a bilateral set is its own group of one, a
 * unilateral left/right pair (linked by `pairId`) groups into one entry of two. The
 * underlying flat `sets` array is never restructured — this is purely a display grouping,
 * mirroring the existing `supersetGroup` grouping pattern in `ActiveWorkoutPage`.
 */
export function groupSetsForDisplay(
  sets: WorkoutSet[],
): Array<{ displayNumber: number; rows: WorkoutSet[] }> {
  const order: string[] = [];
  const groups = new Map<string, WorkoutSet[]>();

  for (const set of sets) {
    const key = set.pairId ?? set.id;
    const existing = groups.get(key);
    if (existing) {
      existing.push(set);
    } else {
      groups.set(key, [set]);
      order.push(key);
    }
  }

  return order.map((key, index) => {
    const rows = groups.get(key)!.slice();
    rows.sort((a, b) => (SIDE_ORDER[a.side ?? 'left'] ?? 0) - (SIDE_ORDER[b.side ?? 'left'] ?? 0));
    return { displayNumber: index + 1, rows };
  });
}
