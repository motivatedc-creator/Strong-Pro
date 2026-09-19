import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { DexieRepository, setRepository } from '@/db/dexieRepository';
import { RepForgeDatabase } from '@/db/schema';
import { SettingsProvider } from '@/app/SettingsProvider';
import { ImportWizardPage } from './ImportWizardPage';

let db: RepForgeDatabase;
let repository: DexieRepository;

beforeEach(async () => {
  db = new RepForgeDatabase(`repforge-wizard-${Math.random().toString(36).slice(2)}`);
  repository = new DexieRepository(db);
  await repository.initialise();
  setRepository(repository);
});

afterEach(() => {
  setRepository(null);
});

/** jsdom's File has no `.text()` — the app reads the file that way, so this fills it in. */
function csvFile(name: string, content: string): File {
  const file = new File([content], name, { type: 'text/csv' });
  Object.defineProperty(file, 'text', { value: () => Promise.resolve(content) });
  return file;
}

function renderWizard() {
  return render(
    <MemoryRouter>
      <SettingsProvider>
        <ImportWizardPage />
      </SettingsProvider>
    </MemoryRouter>,
  );
}

async function chooseFile(content: string) {
  const input = screen.getByLabelText('Choose a Strong CSV export');
  await userEvent.upload(input, csvFile('strong.csv', content));
}

const HEADER = 'Date,Exercise Name,Set Order,Weight (kg),Reps';

describe('ImportWizardPage resolve step', () => {
  it('skips straight to preview when nothing is close to an existing name', async () => {
    renderWizard();
    await chooseFile(`${HEADER}\n2026-01-01,Bench Press,1,60,8\n`);
    await screen.findByText(/workouts found/);
    expect(screen.queryByText('Resolve exercises')).not.toBeInTheDocument();
  });

  it('surfaces a close match and defaults to creating a new exercise', async () => {
    renderWizard();
    await chooseFile(`${HEADER}\n2026-01-01,Bench Press - Close Grip (Barbell),1,60,8\n`);

    await screen.findByText('Resolve exercises');
    expect(screen.getByText('Bench Press - Close Grip (Barbell)')).toBeInTheDocument();
    expect(screen.getByText(/Close-Grip Bench Press/)).toBeInTheDocument();

    // Default (no tap yet) behaves like today: continuing creates a new custom exercise.
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByText(/workouts found/);
    await userEvent.click(screen.getByRole('button', { name: /^Import \d+ workouts?$/ }));

    await waitFor(() => expect(screen.getByText('Import complete')).toBeInTheDocument());
    expect(screen.getByText(/1 exercises created as custom entries/)).toBeInTheDocument();
  });

  it('confirming "same exercise" resolves to the existing exercise and creates nothing new', async () => {
    renderWizard();
    await chooseFile(`${HEADER}\n2026-01-01,Bench Press - Close Grip (Barbell),1,60,8\n`);

    await screen.findByText('Resolve exercises');
    await userEvent.click(screen.getByRole('button', { name: 'Same exercise' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await screen.findByText(/workouts found/);
    await userEvent.click(screen.getByRole('button', { name: /^Import \d+ workouts?$/ }));

    await waitFor(() => expect(screen.getByText('Import complete')).toBeInTheDocument());
    expect(screen.getByText(/0 exercises created as custom entries/)).toBeInTheDocument();

    const exercises = await repository.listExercises();
    expect(
      exercises.some((exercise) => exercise.name === 'Bench Press - Close Grip (Barbell)'),
    ).toBe(false);
  });
});
