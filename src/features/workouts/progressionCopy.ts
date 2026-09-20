import type { ProgressionState, ProgressionTarget } from '@/domain/progression';
import { formatWeight, type WeightUnit } from '@/domain/units';
import { Icons } from '@/components/icons';

/**
 * Text-first state labels for `ProgressionState`. Paired with an icon at the call site, never
 * shown as color alone — same rule as the hit/under/over set badges and L/R side chips.
 */
export const PROGRESSION_STATE_META: Record<
  ProgressionState,
  { label: string; icon: (typeof Icons)[keyof typeof Icons] }
> = {
  progressing: { label: 'Progressing', icon: Icons.arrowUp },
  stalled: { label: 'Stalled', icon: Icons.arrowDown },
  insufficient_data: { label: 'Not enough data', icon: Icons.info },
};

/** Short target line for the active workout row, e.g. "Next: 102.5 kg × 5". */
export function formatProgressionTarget(target: ProgressionTarget, weightUnit: WeightUnit): string {
  return `Next: ${formatWeight(target.targetWeightG, weightUnit)} ${weightUnit} × ${target.targetReps}`;
}
