import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { DexieRepository, setRepository } from '@/db/dexieRepository';
import { RepForgeDatabase } from '@/db/schema';
import { SettingsProvider } from '@/app/SettingsProvider';
import type { Exercise } from '@/domain/types';
import { ExerciseDetailPage } from './ExerciseDetailPage';

let db: RepForgeDatabase;
let repository: DexieRepository;

beforeEach(async () => {
  db = new RepForgeDatabase(`repforge-exercise-detail-${Math.random().toString(36).slice(2)}`);
  repository = new DexieRepository(db);
  await repository.initialise();
  setRepository(repository);
});

afterEach(() => {
  setRepository(null);
});

function renderPage(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/exercises/${id}`]}>
      <SettingsProvider>
        <Routes>
          <Route path="/exercises/:id" element={<ExerciseDetailPage />} />
        </Routes>
      </SettingsProvider>
    </MemoryRouter>,
  );
}

async function createExercise(): Promise<Exercise> {
  return repository.createExercise({
    name: 'Barbell Row',
    primaryMuscleGroup: 'back',
    secondaryMuscleGroups: [],
    equipment: 'barbell',
    movementPattern: 'horizontal pull',
    trackingType: 'weight_reps',
    isArchived: false,
  });
}

async function logSession(exerciseId: string, startedAt: string, weightG: number, reps: number) {
  const detail = await repository.startWorkout({ name: 'Session' });
  const link = await repository.addExerciseToWorkout(detail.workout.id, exerciseId);
  await repository.addSet(detail.workout.id, {
    workoutExerciseId: link.id,
    weightG,
    reps,
    isCompleted: true,
  });
  await repository.completeWorkout(detail.workout.id);
  await repository.updateWorkout(detail.workout.id, { startedAt });
}

describe('ExerciseDetailPage progression', () => {
  it('renders nothing when there is no logged history', async () => {
    const exercise = await createExercise();
    renderPage(exercise.id);

    expect(await screen.findByText('No sessions logged yet')).toBeInTheDocument();
    expect(screen.queryByText('What to beat next')).not.toBeInTheDocument();
  });

  it('shows the suggestion, its state as text, and opens the receipt', async () => {
    const user = userEvent.setup();
    const exercise = await createExercise();
    await logSession(exercise.id, '2026-09-01T10:00:00.000Z', 100_000, 8);

    renderPage(exercise.id);

    expect(await screen.findByText('What to beat next')).toBeInTheDocument();
    // State is rendered as a visible word, not color alone.
    expect(screen.getByText('Not enough data')).toBeInTheDocument();
    expect(screen.getByText(/^Next: /)).toBeInTheDocument();

    const openReceipt = screen.getByRole('button', { name: /Open receipt/ });
    expect(openReceipt.className).toMatch(/min-h-11/);
    await user.click(openReceipt);

    expect(await screen.findByText('Receipt')).toBeInTheDocument();
  });
});
