import { slugify } from './seedData';
import { uuid } from '@/domain/ids';
import type { SetType, Template, TemplateExercise } from '@/domain/types';

/**
 * Starter routine presets.
 *
 * Shown to a user with no templates yet, so the app never hands them a blank list and
 * nothing else. Each preset references the seeded exercise library by its deterministic
 * `seed-<slug>` id, so it only ever needs one tap to materialise into a real, editable
 * template — the same one a user would build by hand.
 */

interface StarterExercise {
  exerciseName: string;
  targetSets: number;
  targetRepMin?: number;
  targetRepMax?: number;
  restSeconds: number;
  defaultSetType?: SetType;
  includeWarmup?: boolean;
}

export interface StarterTemplate {
  id: string;
  name: string;
  description: string;
  exercises: StarterExercise[];
}

function ex(
  exerciseName: string,
  targetSets: number,
  targetRepMin: number,
  targetRepMax: number,
  restSeconds: number,
  includeWarmup = false,
): StarterExercise {
  return { exerciseName, targetSets, targetRepMin, targetRepMax, restSeconds, includeWarmup };
}

export const STARTER_TEMPLATES: StarterTemplate[] = [
  {
    id: 'starter-full-body',
    name: 'Full Body Strength',
    description: 'A balanced 3x/week session: one squat, one push, one pull, one hinge.',
    exercises: [
      ex('Back Squat', 3, 5, 8, 150, true),
      ex('Bench Press', 3, 5, 8, 120, true),
      ex('Barbell Row', 3, 8, 10, 90),
      ex('Romanian Deadlift', 3, 8, 10, 120),
      ex('Plank', 3, 30, 60, 60),
    ],
  },
  {
    id: 'starter-push',
    name: 'Push Day',
    description: 'Chest, shoulders and triceps — pairs with Pull Day and Leg Day.',
    exercises: [
      ex('Bench Press', 4, 5, 8, 120, true),
      ex('Overhead Press', 3, 6, 10, 90),
      ex('Incline Dumbbell Press', 3, 8, 12, 90),
      ex('Lateral Raise', 3, 12, 15, 60),
      ex('Cable Triceps Pushdown', 3, 10, 15, 60),
    ],
  },
  {
    id: 'starter-pull',
    name: 'Pull Day',
    description: 'Back and biceps — pairs with Push Day and Leg Day.',
    exercises: [
      ex('Conventional Deadlift', 3, 4, 6, 180, true),
      ex('Lat Pulldown', 3, 8, 12, 90),
      ex('Seated Cable Row', 3, 8, 12, 90),
      ex('Face Pull', 3, 12, 15, 60),
      ex('Barbell Curl', 3, 8, 12, 60),
    ],
  },
  {
    id: 'starter-legs',
    name: 'Leg Day',
    description: 'Quads, hamstrings, glutes and calves — pairs with Push Day and Pull Day.',
    exercises: [
      ex('Back Squat', 4, 5, 8, 150, true),
      ex('Romanian Deadlift', 3, 8, 10, 120),
      ex('Leg Press', 3, 10, 15, 90),
      ex('Leg Extension', 3, 12, 15, 60),
      ex('Standing Calf Raise', 4, 10, 15, 60),
    ],
  },
];

export function starterExerciseId(name: string): string {
  return `seed-${slugify(name)}`;
}

/** Builds the Template + TemplateExercise rows a preset would create, ready to save. */
export function buildStarterTemplate(
  preset: StarterTemplate,
  order: number,
): { template: Template; exercises: TemplateExercise[] } {
  const now = new Date().toISOString();
  const templateId = uuid();
  const template: Template = {
    id: templateId,
    name: preset.name,
    notes: preset.description,
    order,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };
  const exercises: TemplateExercise[] = preset.exercises.map((entry, index) => ({
    id: uuid(),
    templateId,
    exerciseId: starterExerciseId(entry.exerciseName),
    order: index,
    targetSets: entry.targetSets,
    targetRepMin: entry.targetRepMin,
    targetRepMax: entry.targetRepMax,
    restSeconds: entry.restSeconds,
    defaultSetType: entry.defaultSetType ?? 'working',
    includeWarmup: entry.includeWarmup ?? false,
  }));
  return { template, exercises };
}
