import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DexieRepository, setRepository } from '@/db/dexieRepository';
import { RepForgeDatabase } from '@/db/schema';
import { BulkClassifyPage } from './BulkClassifyPage';

let db: RepForgeDatabase;
let repository: DexieRepository;

beforeEach(async () => {
  db = new RepForgeDatabase(`repforge-classify-${Math.random().toString(36).slice(2)}`);
  repository = new DexieRepository(db);
  await repository.initialise();
  setRepository(repository);
});

afterEach(() => {
  setRepository(null);
});

async function seedUnmapped(name: string) {
  return repository.createExercise({
    name,
    primaryMuscleGroup: 'unmapped',
    secondaryMuscleGroups: [],
    equipment: 'other',
    movementPattern: 'isolation',
    trackingType: 'weight_reps',
    isArchived: false,
  });
}

describe('BulkClassifyPage', () => {
  it('shows nothing to classify when the library has no unmapped exercises', async () => {
    render(
      <MemoryRouter>
        <BulkClassifyPage />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Nothing to classify')).toBeInTheDocument();
  });

  it('renders one row per unmapped exercise and only saves the rows that changed', async () => {
    const user = userEvent.setup();
    await seedUnmapped('Bench - Close Grip (Dumbbell)');
    const untouched = await seedUnmapped('Behind Legs Shrug (Smith Machine)');

    render(
      <MemoryRouter>
        <BulkClassifyPage />
      </MemoryRouter>,
    );

    const rows = await screen.findAllByRole('heading', { level: 2 });
    expect(rows.map((row) => row.textContent).sort()).toEqual(
      ['Bench - Close Grip (Dumbbell)', 'Behind Legs Shrug (Smith Machine)'].sort(),
    );

    const card = screen.getByText('Bench - Close Grip (Dumbbell)').closest('li')!;
    await user.selectOptions(within(card).getByLabelText('Primary muscle'), 'chest');

    const saveButton = screen.getByRole('button', { name: 'Save 1 exercise' });
    await user.click(saveButton);

    // Only the changed row was saved and drops off the unmapped list; the untouched row stays.
    await screen.findByRole('button', { name: 'Save all' });
    expect(screen.queryByText('Bench - Close Grip (Dumbbell)')).not.toBeInTheDocument();
    expect(screen.getByText('Behind Legs Shrug (Smith Machine)')).toBeInTheDocument();

    const exercises = await repository.listExercises({ includeArchived: true });
    const classified = exercises.find(
      (exercise) => exercise.name === 'Bench - Close Grip (Dumbbell)',
    );
    const stillUnmapped = exercises.find((exercise) => exercise.id === untouched.id);
    expect(classified?.primaryMuscleGroup).toBe('chest');
    expect(stillUnmapped?.primaryMuscleGroup).toBe('unmapped');
  });
});
