import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DexieRepository, setRepository } from '@/db/dexieRepository';
import { RepForgeDatabase } from '@/db/schema';
import { SettingsProvider } from '@/app/SettingsProvider';
import type { Exercise } from '@/domain/types';
import { ActiveWorkoutPage } from './ActiveWorkoutPage';

let db: RepForgeDatabase;
let repository: DexieRepository;

beforeEach(async () => {
  db = new RepForgeDatabase(`repforge-active-workout-${Math.random().toString(36).slice(2)}`);
  repository = new DexieRepository(db);
  await repository.initialise();
  setRepository(repository);
});

afterEach(() => {
  setRepository(null);
});

function renderPage() {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <ActiveWorkoutPage />
      </SettingsProvider>
    </MemoryRouter>,
  );
}

async function createExercise(name: string): Promise<Exercise> {
  return repository.createExercise({
    name,
    primaryMuscleGroup: 'chest',
    secondaryMuscleGroups: [],
    equipment: 'barbell',
    movementPattern: 'horizontal push',
    trackingType: 'weight_reps',
    isArchived: false,
  });
}

async function logCompletedSession(exerciseId: string, weightG: number, reps: number) {
  const detail = await repository.startWorkout({ name: 'Past session' });
  const link = await repository.addExerciseToWorkout(detail.workout.id, exerciseId);
  await repository.addSet(detail.workout.id, {
    workoutExerciseId: link.id,
    weightG,
    reps,
    isCompleted: true,
  });
  await repository.completeWorkout(detail.workout.id);
}

describe('ActiveWorkoutPage progression suggestion', () => {
  it('shows a tappable suggestion with state text and opens the receipt when there is history', async () => {
    const user = userEvent.setup();
    const exercise = await createExercise('Bench Press');
    await logCompletedSession(exercise.id, 100_000, 8);

    const active = await repository.startWorkout({ name: 'Today' });
    const link = await repository.addExerciseToWorkout(active.workout.id, exercise.id);
    await repository.addSet(active.workout.id, { workoutExerciseId: link.id });

    renderPage();

    const suggestionButton = await screen.findByRole('button', {
      name: /Progression suggestion for Bench Press/,
    });
    expect(suggestionButton.className).toMatch(/min-h-11/);
    expect(suggestionButton.textContent).toMatch(/Not enough data/);
    expect(suggestionButton.textContent).toMatch(/Next: /);

    await user.click(suggestionButton);
    expect(await screen.findByText('Receipt')).toBeInTheDocument();
  });

  it('renders no suggestion for an exercise with no completed history', async () => {
    const exercise = await createExercise('Overhead Press');
    const active = await repository.startWorkout({ name: 'Today' });
    const link = await repository.addExerciseToWorkout(active.workout.id, exercise.id);
    await repository.addSet(active.workout.id, { workoutExerciseId: link.id });

    renderPage();

    expect(await screen.findByText('Overhead Press')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Progression suggestion/ })).not.toBeInTheDocument();
  });
});
