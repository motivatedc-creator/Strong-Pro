import { FORMULA_EXPRESSION, FORMULA_LABEL } from '@/domain/oneRepMax';
import type { OneRepMaxFormula } from '@/domain/types';

/**
 * User-facing explanations of the calculation rules. These mirror the code comments in
 * domain/oneRepMax.ts and domain/volume.ts — if one changes, change both.
 */

export function oneRepMaxHelp(formula: OneRepMaxFormula): string[] {
  return [
    `${FORMULA_LABEL[formula]}: ${FORMULA_EXPRESSION[formula]}.`,
    'Only completed sets with a positive load and at least one rep are estimated.',
    'A single rep is taken at face value rather than extrapolated.',
    'Brzycki is undefined at 37 reps and negative beyond it, so above 36 reps RepForge falls back to Epley and labels the point.',
    'Warm-up sets are excluded unless you turn them on.',
    'Each point is the best estimate from that session; the tooltip shows the set behind it.',
  ];
}

export const VOLUME_HELP = [
  'Volume (tonnage) is weight × reps, summed over completed sets.',
  'Bodyweight, duration and distance work carries no external load, so it contributes 0 tonnage and is counted separately.',
  'Assisted exercises record the assistance rather than the load lifted, so they are excluded from tonnage.',
  'Warm-ups are excluded unless you turn them on.',
  'A set is only ever counted once, even when an exercise appears twice in a session.',
];

export const MUSCLE_HELP = [
  'Attributed volume gives the primary muscle full credit for a set and each secondary muscle a configurable fraction (50% by default).',
  'It is deliberately not a tonnage total: the attributed numbers add up to more than the weight you actually moved.',
  'Change the secondary credit in Settings → Analytics.',
];

export const RECORDS_HELP = [
  'Records are derived from your stored sets every time this screen opens — they are never a separate saved number.',
  'Editing or deleting a workout immediately changes the records it contributed to.',
  'Rep records show the heaviest load lifted for at least that many reps.',
];
