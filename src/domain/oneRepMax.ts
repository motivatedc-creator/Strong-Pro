import type { OneRepMaxFormula, WorkoutSet } from './types';

/**
 * Estimated one-rep-max.
 *
 * Inclusion rules (mirrored in the in-app help text, see features/analytics/help.ts):
 *  - Only completed sets count.
 *  - Warm-up sets are excluded unless the caller explicitly opts in.
 *  - A set needs a positive load and at least 1 rep; zero-load and bodyweight-only
 *    sets produce no estimate rather than a misleading 0.
 *  - Brzycki is undefined at 37 reps and negative beyond it, so it is only applied at
 *    <= 36 reps; above that RepForge falls back to Epley and says so in the UI.
 *  - Both formulas return the estimate in the same canonical unit as the input (grams).
 */

export const BRZYCKI_MAX_REPS = 36;

/** Epley: weight * (1 + reps / 30). Exact at 1 rep. */
export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** Brzycki: weight * 36 / (37 - reps). Undefined at reps >= 37. */
export function brzycki(weight: number, reps: number): number {
  return (weight * 36) / (37 - reps);
}

export interface OneRepMaxResult {
  /** Estimated 1RM in the same unit as the input weight (grams), rounded to a whole gram. */
  value: number;
  formulaUsed: OneRepMaxFormula;
  /** True when the requested formula could not be applied and Epley was substituted. */
  fellBack: boolean;
}

/**
 * Estimate a 1RM, returning `null` when the set cannot produce a meaningful estimate.
 */
export function estimateOneRepMax(
  weight: number,
  reps: number,
  formula: OneRepMaxFormula,
): OneRepMaxResult | null {
  if (!Number.isFinite(weight) || !Number.isFinite(reps)) return null;
  if (weight <= 0 || reps <= 0) return null;
  const wholeReps = Math.floor(reps);
  if (wholeReps < 1) return null;
  if (wholeReps === 1) return { value: Math.round(weight), formulaUsed: formula, fellBack: false };

  if (formula === 'brzycki') {
    if (wholeReps <= BRZYCKI_MAX_REPS) {
      return { value: Math.round(brzycki(weight, wholeReps)), formulaUsed: 'brzycki', fellBack: false };
    }
    return { value: Math.round(epley(weight, wholeReps)), formulaUsed: 'epley', fellBack: true };
  }

  return { value: Math.round(epley(weight, wholeReps)), formulaUsed: 'epley', fellBack: false };
}

export interface BestOneRepMax extends OneRepMaxResult {
  set: WorkoutSet;
}

/**
 * Best estimated 1RM across a group of sets, carrying the source set so the chart can
 * show "84 kg — from 100 kg x 5 (Epley)" behind a plotted point.
 */
export function bestOneRepMax(
  sets: readonly WorkoutSet[],
  formula: OneRepMaxFormula,
  options: { includeWarmups?: boolean } = {},
): BestOneRepMax | null {
  let best: BestOneRepMax | null = null;
  for (const set of sets) {
    if (!set.isCompleted) continue;
    if (!options.includeWarmups && set.setType === 'warmup') continue;
    const estimate = estimateOneRepMax(set.weightG ?? 0, set.reps ?? 0, formula);
    if (!estimate) continue;
    if (!best || estimate.value > best.value) best = { ...estimate, set };
  }
  return best;
}

export const FORMULA_LABEL: Record<OneRepMaxFormula, string> = {
  epley: 'Epley',
  brzycki: 'Brzycki',
};

export const FORMULA_EXPRESSION: Record<OneRepMaxFormula, string> = {
  epley: 'weight x (1 + reps / 30)',
  brzycki: 'weight x 36 / (37 - reps)',
};
