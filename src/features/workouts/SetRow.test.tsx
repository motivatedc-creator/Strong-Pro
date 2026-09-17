import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WorkoutSet } from '@/domain/types';
import { SetRow } from './SetRow';

const workoutSet = (patch: Partial<WorkoutSet> = {}): WorkoutSet => ({
  id: patch.id ?? 'set',
  workoutId: 'workout',
  workoutExerciseId: 'exercise',
  order: 0,
  setType: 'working',
  isCompleted: false,
  ...patch,
});

describe('SetRow previous values', () => {
  it('shows ghost values and sends them with one-tap completion', async () => {
    const onToggleComplete = vi.fn();
    const previous = workoutSet({ id: 'previous', weightG: 100_000, reps: 8 });

    render(
      <SetRow
        set={workoutSet()}
        index={0}
        trackingType="weight_reps"
        weightUnit="kg"
        intensityMode="none"
        quickIncrementG={2_500}
        previous={previous}
        onChange={vi.fn()}
        onToggleComplete={onToggleComplete}
        onDelete={vi.fn()}
        onCycleType={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Weight for set 1 in kg')).toHaveAttribute('placeholder', '100');
    expect(screen.getByLabelText('Reps for set 1')).toHaveAttribute('placeholder', '8');

    const weightInput = screen.getByLabelText('Weight for set 1 in kg');
    const repsInput = screen.getByLabelText('Reps for set 1');
    const completeButton = screen.getByRole('button', { name: 'Complete set 1' });
    await userEvent.click(weightInput);
    await userEvent.keyboard('{Enter}');
    expect(repsInput).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    expect(completeButton).toHaveFocus();

    await userEvent.click(completeButton);

    expect(onToggleComplete).toHaveBeenCalledWith({ weightG: 100_000, reps: 8 });
  });

  it('prefers a typed draft when completion immediately follows the edit', async () => {
    const user = userEvent.setup();
    const onToggleComplete = vi.fn();
    const previous = workoutSet({ id: 'previous', weightG: 100_000, reps: 8 });

    render(
      <SetRow
        set={workoutSet()}
        index={0}
        trackingType="weight_reps"
        weightUnit="kg"
        intensityMode="none"
        quickIncrementG={2_500}
        previous={previous}
        onChange={vi.fn()}
        onToggleComplete={onToggleComplete}
        onDelete={vi.fn()}
        onCycleType={vi.fn()}
      />,
    );

    await user.type(screen.getByLabelText('Weight for set 1 in kg'), '90');
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }));

    expect(onToggleComplete).toHaveBeenCalledWith({ weightG: 90_000, reps: 8 });
  });
});
