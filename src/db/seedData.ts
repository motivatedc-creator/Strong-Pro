import { toGrams } from '@/domain/units';
import type {
  BarProfile,
  Equipment,
  Exercise,
  MovementPattern,
  MuscleGroup,
  PlateDenomination,
  PlateInventory,
  TrackingType,
} from '@/domain/types';

/**
 * The RepForge starter library — original content written for this app.
 *
 * Seeded exercises get deterministic ids (`seed-<slug>`) so that a JSON backup taken on one
 * device restores onto another without duplicating the library, and so imports can map
 * names to stable rows.
 */

export const SEED_LIBRARY_VERSION = 2;

/**
 * Names of seed exercises that must carry `unilateral: true`. Bumping SEED_LIBRARY_VERSION
 * to 2 backfills these onto installs that seeded before the flag existed (see PR #29) —
 * insert-time seeding never updates rows that already exist, so pre-existing installs would
 * otherwise be stuck without the left/right split logging behaviour indefinitely.
 */
export const UNILATERAL_BACKFILL_EXERCISE_NAMES = [
  'One-Arm Dumbbell Row',
  'Single-Arm Dumbbell Shoulder Press',
  'Bulgarian Split Squat',
  'Dumbbell Walking Lunge',
] as const;

type SeedTuple = [
  name: string,
  primary: MuscleGroup,
  secondary: MuscleGroup[],
  equipment: Equipment,
  pattern: MovementPattern,
  tracking?: TrackingType,
  unilateral?: boolean,
];

const SEED: SeedTuple[] = [
  // --- Barbell ---
  ['Back Squat', 'quads', ['glutes', 'hamstrings', 'core'], 'barbell', 'squat'],
  ['Front Squat', 'quads', ['glutes', 'core'], 'barbell', 'squat'],
  ['Box Squat', 'quads', ['glutes', 'hamstrings'], 'barbell', 'squat'],
  [
    'Conventional Deadlift',
    'hamstrings',
    ['glutes', 'back', 'traps', 'forearms'],
    'barbell',
    'hinge',
  ],
  ['Sumo Deadlift', 'glutes', ['quads', 'hamstrings', 'back'], 'barbell', 'hinge'],
  ['Romanian Deadlift', 'hamstrings', ['glutes', 'back'], 'barbell', 'hinge'],
  ['Rack Pull', 'back', ['traps', 'glutes', 'forearms'], 'barbell', 'hinge'],
  ['Barbell Hip Thrust', 'glutes', ['hamstrings', 'core'], 'barbell', 'hinge'],
  ['Bench Press', 'chest', ['triceps', 'shoulders'], 'barbell', 'horizontal push'],
  ['Incline Bench Press', 'chest', ['shoulders', 'triceps'], 'barbell', 'horizontal push'],
  ['Close-Grip Bench Press', 'triceps', ['chest', 'shoulders'], 'barbell', 'horizontal push'],
  ['Overhead Press', 'shoulders', ['triceps', 'core'], 'barbell', 'vertical push'],
  ['Push Press', 'shoulders', ['triceps', 'quads'], 'barbell', 'vertical push'],
  ['Barbell Row', 'back', ['lats', 'biceps', 'traps'], 'barbell', 'horizontal pull'],
  ['Pendlay Row', 'back', ['lats', 'biceps'], 'barbell', 'horizontal pull'],
  ['Wide-Grip Bench Press', 'chest', ['shoulders', 'triceps'], 'barbell', 'horizontal push'],
  ['Behind-the-Neck Press', 'shoulders', ['triceps'], 'barbell', 'vertical push'],
  ['Wide-Grip Barbell Row', 'back', ['lats', 'traps'], 'barbell', 'horizontal pull'],
  ['Barbell Curl', 'biceps', ['forearms'], 'barbell', 'isolation'],
  ['Barbell Shrug', 'traps', ['forearms'], 'barbell', 'isolation'],
  ['Barbell Lunge', 'quads', ['glutes', 'hamstrings'], 'barbell', 'lunge'],
  ['Good Morning', 'hamstrings', ['glutes', 'back'], 'barbell', 'hinge'],
  ['Power Clean', 'full body', ['traps', 'quads', 'glutes'], 'barbell', 'hinge'],

  // --- Dumbbell ---
  ['Dumbbell Bench Press', 'chest', ['triceps', 'shoulders'], 'dumbbell', 'horizontal push'],
  ['Incline Dumbbell Press', 'chest', ['shoulders', 'triceps'], 'dumbbell', 'horizontal push'],
  ['Dumbbell Shoulder Press', 'shoulders', ['triceps'], 'dumbbell', 'vertical push'],
  ['Arnold Press', 'shoulders', ['triceps'], 'dumbbell', 'vertical push'],
  ['Dumbbell Row', 'back', ['lats', 'biceps'], 'dumbbell', 'horizontal pull'],
  ['One-Arm Dumbbell Row', 'back', ['lats', 'biceps'], 'dumbbell', 'horizontal pull', undefined, true],
  [
    'Single-Arm Dumbbell Shoulder Press',
    'shoulders',
    ['triceps', 'core'],
    'dumbbell',
    'vertical push',
    undefined,
    true,
  ],
  ['Dumbbell Fly', 'chest', ['shoulders'], 'dumbbell', 'isolation'],
  ['Lateral Raise', 'shoulders', [], 'dumbbell', 'isolation'],
  ['Rear Delt Fly', 'shoulders', ['back'], 'dumbbell', 'isolation'],
  ['Dumbbell Curl', 'biceps', ['forearms'], 'dumbbell', 'isolation'],
  ['Hammer Curl', 'biceps', ['forearms'], 'dumbbell', 'isolation'],
  ['Incline Dumbbell Curl', 'biceps', ['forearms'], 'dumbbell', 'isolation'],
  ['Dumbbell Skullcrusher', 'triceps', [], 'dumbbell', 'isolation'],
  ['Dumbbell Romanian Deadlift', 'hamstrings', ['glutes', 'back'], 'dumbbell', 'hinge'],
  ['Bulgarian Split Squat', 'quads', ['glutes', 'hamstrings'], 'dumbbell', 'lunge', undefined, true],
  ['Goblet Squat', 'quads', ['glutes', 'core'], 'dumbbell', 'squat'],
  ['Dumbbell Walking Lunge', 'quads', ['glutes', 'hamstrings'], 'dumbbell', 'lunge', undefined, true],
  ['Dumbbell Shrug', 'traps', ['forearms'], 'dumbbell', 'isolation'],
  ["Farmer's Carry", 'forearms', ['traps', 'core'], 'dumbbell', 'carry', 'distance_duration'],

  // --- Machine & cable ---
  ['Leg Press', 'quads', ['glutes', 'hamstrings'], 'machine', 'squat'],
  ['Hack Squat', 'quads', ['glutes'], 'machine', 'squat'],
  ['Leg Extension', 'quads', [], 'machine', 'isolation'],
  ['Lying Leg Curl', 'hamstrings', ['calves'], 'machine', 'isolation'],
  ['Seated Leg Curl', 'hamstrings', [], 'machine', 'isolation'],
  ['Standing Calf Raise', 'calves', [], 'machine', 'isolation'],
  ['Seated Calf Raise', 'calves', [], 'machine', 'isolation'],
  ['Hip Abduction', 'abductors', ['glutes'], 'machine', 'isolation'],
  ['Hip Adduction', 'adductors', [], 'machine', 'isolation'],
  ['Chest Press Machine', 'chest', ['triceps', 'shoulders'], 'machine', 'horizontal push'],
  ['Pec Deck', 'chest', ['shoulders'], 'machine', 'isolation'],
  ['Lat Pulldown', 'lats', ['biceps', 'back'], 'cable', 'vertical pull'],
  ['Wide-Grip Lat Pulldown', 'lats', ['biceps', 'back'], 'cable', 'vertical pull'],
  ['Close-Grip Lat Pulldown', 'lats', ['biceps'], 'cable', 'vertical pull'],
  ['Straight-Arm Pulldown', 'lats', ['triceps'], 'cable', 'isolation'],
  ['Seated Cable Row', 'back', ['lats', 'biceps'], 'cable', 'horizontal pull'],
  ['Face Pull', 'shoulders', ['traps', 'back'], 'cable', 'horizontal pull'],
  ['Cable Triceps Pushdown', 'triceps', [], 'cable', 'isolation'],
  ['Cable Overhead Triceps Extension', 'triceps', [], 'cable', 'isolation'],
  ['Cable Curl', 'biceps', ['forearms'], 'cable', 'isolation'],
  ['Cable Lateral Raise', 'shoulders', [], 'cable', 'isolation'],
  ['Cable Crunch', 'core', [], 'cable', 'core'],
  ['Smith Machine Squat', 'quads', ['glutes', 'hamstrings'], 'smith machine', 'squat'],
  [
    'Smith Machine Bench Press',
    'chest',
    ['triceps', 'shoulders'],
    'smith machine',
    'horizontal push',
  ],
  ['Smith Machine Overhead Press', 'shoulders', ['triceps'], 'smith machine', 'vertical push'],
  ['Smith Machine Row', 'back', ['lats', 'biceps'], 'smith machine', 'horizontal pull'],

  // --- Bodyweight ---
  ['Pull-Up', 'lats', ['biceps', 'back'], 'bodyweight', 'vertical pull', 'reps_only'],
  ['Neutral-Grip Pull-Up', 'lats', ['biceps', 'back'], 'bodyweight', 'vertical pull', 'reps_only'],
  ['Chin-Up', 'lats', ['biceps'], 'bodyweight', 'vertical pull', 'reps_only'],
  ['Assisted Pull-Up', 'lats', ['biceps', 'back'], 'machine', 'vertical pull', 'assisted_weight'],
  ['Dip', 'chest', ['triceps', 'shoulders'], 'bodyweight', 'horizontal push', 'reps_only'],
  ['Assisted Dip', 'chest', ['triceps'], 'machine', 'horizontal push', 'assisted_weight'],
  ['Push-Up', 'chest', ['triceps', 'shoulders'], 'bodyweight', 'horizontal push', 'reps_only'],
  ['Inverted Row', 'back', ['lats', 'biceps'], 'bodyweight', 'horizontal pull', 'reps_only'],
  ['Hanging Leg Raise', 'core', ['forearms'], 'bodyweight', 'core', 'reps_only'],
  ['Plank', 'core', ['shoulders'], 'bodyweight', 'core', 'duration'],
  ['Side Plank', 'core', [], 'bodyweight', 'core', 'duration'],
  ['Back Extension', 'hamstrings', ['glutes', 'back'], 'bodyweight', 'hinge', 'reps_only'],
  ['Glute Bridge', 'glutes', ['hamstrings'], 'bodyweight', 'hinge', 'reps_only'],
  ['Nordic Curl', 'hamstrings', ['glutes'], 'bodyweight', 'hinge', 'reps_only'],

  // --- Kettlebell, band & conditioning ---
  ['Kettlebell Swing', 'glutes', ['hamstrings', 'back', 'core'], 'kettlebell', 'hinge'],
  ['Kettlebell Goblet Squat', 'quads', ['glutes', 'core'], 'kettlebell', 'squat'],
  ['Turkish Get-Up', 'full body', ['shoulders', 'core'], 'kettlebell', 'carry'],
  ['Band Pull-Apart', 'shoulders', ['back', 'traps'], 'band', 'horizontal pull', 'reps_only'],
  ['Band Face Pull', 'shoulders', ['traps'], 'band', 'horizontal pull', 'reps_only'],
  ['Neck Curl', 'neck', [], 'plate', 'isolation'],
  ['Rowing Machine', 'cardio', ['back', 'quads'], 'machine', 'conditioning', 'distance_duration'],
  ['Treadmill Run', 'cardio', ['quads', 'calves'], 'machine', 'conditioning', 'distance_duration'],
  ['Stationary Bike', 'cardio', ['quads'], 'machine', 'conditioning', 'distance_duration'],
  ['Jump Rope', 'cardio', ['calves'], 'other', 'conditioning', 'duration'],
];

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

/** Deterministic seed ids for {@link UNILATERAL_BACKFILL_EXERCISE_NAMES}. */
export const UNILATERAL_BACKFILL_EXERCISE_IDS = UNILATERAL_BACKFILL_EXERCISE_NAMES.map(
  (name) => `seed-${slugify(name)}`,
);

export function seedExercises(now: string): Exercise[] {
  return SEED.map(([name, primary, secondary, equipment, pattern, tracking, unilateral]) => ({
    id: `seed-${slugify(name)}`,
    name,
    primaryMuscleGroup: primary,
    secondaryMuscleGroups: secondary,
    equipment,
    movementPattern: pattern,
    trackingType: tracking ?? 'weight_reps',
    incrementG: equipment === 'dumbbell' ? toGrams(2.5, 'kg') : undefined,
    unilateral,
    isCustom: false,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  }));
}

const KG_PLATES: Array<[kg: number, count: number]> = [
  [25, 4],
  [20, 4],
  [15, 2],
  [10, 4],
  [5, 4],
  [2.5, 4],
  [1.25, 4],
  [0.5, 2],
];

const LB_PLATES: Array<[lb: number, count: number]> = [
  [45, 4],
  [35, 2],
  [25, 4],
  [10, 4],
  [5, 4],
  [2.5, 4],
];

function plates(source: Array<[number, number]>, unit: 'kg' | 'lb'): PlateDenomination[] {
  return source.map(([value, count]) => ({ weightG: toGrams(value, unit), count }));
}

export function seedPlateInventories(): PlateInventory[] {
  return [
    {
      id: 'seed-plates-kg',
      name: 'Standard kg gym',
      unit: 'kg',
      plates: plates(KG_PLATES, 'kg'),
      isDefault: true,
    },
    {
      id: 'seed-plates-lb',
      name: 'Standard lb gym',
      unit: 'lb',
      plates: plates(LB_PLATES, 'lb'),
      isDefault: false,
    },
  ];
}

export function seedBarProfiles(): BarProfile[] {
  return [
    {
      id: 'seed-bar-olympic-kg',
      name: 'Olympic bar (20 kg)',
      weightG: toGrams(20, 'kg'),
      collarWeightG: 0,
      isDefault: true,
    },
    {
      id: 'seed-bar-olympic-lb',
      name: 'Olympic bar (45 lb)',
      weightG: toGrams(45, 'lb'),
      collarWeightG: 0,
      isDefault: false,
    },
    {
      id: 'seed-bar-womens',
      name: "Women's bar (15 kg)",
      weightG: toGrams(15, 'kg'),
      collarWeightG: 0,
      isDefault: false,
    },
    {
      id: 'seed-bar-ez',
      name: 'EZ curl bar (10 kg)',
      weightG: toGrams(10, 'kg'),
      collarWeightG: 0,
      isDefault: false,
    },
    {
      id: 'seed-bar-trap',
      name: 'Trap bar (25 kg)',
      weightG: toGrams(25, 'kg'),
      collarWeightG: 0,
      isDefault: false,
    },
    {
      id: 'seed-bar-safety',
      name: 'Safety squat bar (32 kg)',
      weightG: toGrams(32, 'kg'),
      collarWeightG: 0,
      isDefault: false,
    },
  ];
}
