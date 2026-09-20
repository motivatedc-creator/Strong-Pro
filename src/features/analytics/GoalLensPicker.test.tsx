import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GoalLensPicker } from './GoalLensPicker';

describe('GoalLensPicker', () => {
  it('renders all three lenses with one-line descriptions', () => {
    render(
      <GoalLensPicker open onClose={() => {}} goalLens="build" onGoalLensChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Build \(current\)/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Strength/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Maintain/ })).toBeInTheDocument();
  });

  it('reflects the current selection with aria-pressed and visible text', () => {
    render(
      <GoalLensPicker open onClose={() => {}} goalLens="strength" onGoalLensChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Strength \(current\)/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: /^Build/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('defaults to Build when goalLens is undefined', () => {
    render(
      <GoalLensPicker open onClose={() => {}} goalLens={undefined} onGoalLensChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: /Build \(current\)/ })).toBeInTheDocument();
  });

  it('calls onGoalLensChange with the chosen lens and closes', async () => {
    const user = userEvent.setup();
    const onGoalLensChange = vi.fn();
    const onClose = vi.fn();
    render(
      <GoalLensPicker
        open
        onClose={onClose}
        goalLens="build"
        onGoalLensChange={onGoalLensChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /^Strength/ }));
    expect(onGoalLensChange).toHaveBeenCalledWith('strength');
    expect(onClose).toHaveBeenCalled();
  });

  it('is keyboard-operable', async () => {
    const user = userEvent.setup();
    const onGoalLensChange = vi.fn();
    render(
      <GoalLensPicker open onClose={() => {}} goalLens="build" onGoalLensChange={onGoalLensChange} />,
    );
    const strengthButton = screen.getByRole('button', { name: /^Strength/ });
    strengthButton.focus();
    expect(strengthButton).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(onGoalLensChange).toHaveBeenCalledWith('strength');
  });
});
