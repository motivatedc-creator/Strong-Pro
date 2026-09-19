import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DexieRepository, setRepository } from '@/db/dexieRepository';
import { RepForgeDatabase } from '@/db/schema';
import { GoalLiftPicker } from './GoalLiftPicker';

let db: RepForgeDatabase;
let repository: DexieRepository;

beforeEach(async () => {
  db = new RepForgeDatabase(`repforge-goal-lift-picker-${Math.random().toString(36).slice(2)}`);
  repository = new DexieRepository(db);
  await repository.initialise();
  setRepository(repository);
});

afterEach(() => {
  setRepository(null);
});

describe('GoalLiftPicker', () => {
  it('starts from the current selection and reports the count', async () => {
    render(
      <GoalLiftPicker
        open
        onClose={() => {}}
        goalLiftIds={['seed-bench-press']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('1 of 3 chosen')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Bench Press' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('stops adding a new pick once 3 are selected', async () => {
    const user = userEvent.setup();
    render(
      <GoalLiftPicker
        open
        onClose={() => {}}
        goalLiftIds={['seed-bench-press', 'seed-back-squat', 'seed-conventional-deadlift']}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('3 of 3 chosen')).toBeInTheDocument();
    const unpicked = await screen.findByRole('button', { name: 'Overhead Press' });
    expect(unpicked).toBeDisabled();
    await user.click(unpicked);
    expect(screen.getByText('3 of 3 chosen')).toBeInTheDocument();
  });

  it('saves the current selection on Save', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<GoalLiftPicker open onClose={() => {}} goalLiftIds={[]} onChange={onChange} />);
    await user.click(await screen.findByRole('button', { name: 'Bench Press' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(onChange).toHaveBeenCalledWith(['seed-bench-press']);
  });

  it('"Use my top lifts instead" clears the selection', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <GoalLiftPicker
        open
        onClose={() => {}}
        goalLiftIds={['seed-bench-press']}
        onChange={onChange}
      />,
    );
    await screen.findByText('1 of 3 chosen');
    await user.click(screen.getByRole('button', { name: 'Use my top lifts instead' }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});
