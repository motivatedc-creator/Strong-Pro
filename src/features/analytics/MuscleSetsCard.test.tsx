import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { PersonalMuscleTargets } from '@/domain/types';
import type { MuscleSetInsight } from './muscleSets';
import { MuscleSetsCard } from './MuscleSetsCard';

const rows: MuscleSetInsight[] = [
  {
    muscle: 'chest',
    sets: 3,
    state: 'in_range',
    target: { min: 2, max: 4 },
    targetSource: 'research',
    evidence: [
      {
        setId: 'set-1',
        workoutId: 'workout-1',
        localDate: '2026-09-15',
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        role: 'primary',
        credit: 1,
        reps: 5,
        weightG: 100_000,
      },
    ],
  },
  {
    muscle: 'triceps',
    sets: 1.5,
    state: 'below',
    target: { min: 2, max: 4 },
    targetSource: 'personal',
    evidence: [
      {
        setId: 'set-1',
        workoutId: 'workout-1',
        localDate: '2026-09-15',
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        role: 'secondary',
        credit: 0.5,
        reps: 5,
        weightG: 100_000,
      },
    ],
  },
  {
    muscle: 'unmapped',
    sets: 1,
    state: 'unmapped',
    evidence: [
      {
        setId: 'set-2',
        workoutId: 'workout-2',
        localDate: '2026-09-16',
        exerciseId: 'custom',
        exerciseName: 'Mystery Press',
        role: 'primary',
        credit: 1,
      },
    ],
  },
];

function renderCard(
  insights = rows,
  options: {
    personalTargets?: PersonalMuscleTargets;
    onPersonalTargetsChange?: (targets: PersonalMuscleTargets) => void;
  } = {},
) {
  return render(
    <MemoryRouter>
      <MuscleSetsCard
        insights={insights}
        secondaryCredit={0.5}
        weightUnit="kg"
        personalTargets={options.personalTargets}
        onPersonalTargetsChange={options.onPersonalTargetsChange}
      />
    </MemoryRouter>,
  );
}

describe('MuscleSetsCard', () => {
  it('shows target states and never hides unmapped work', () => {
    renderCard();

    expect(screen.getByRole('heading', { name: 'Your hard sets this week' })).toBeInTheDocument();
    expect(screen.getByText('In range')).toBeInTheDocument();
    expect(screen.getByText('Below')).toBeInTheDocument();
    expect(screen.getByText('3 of 2–4 credited sets')).toBeInTheDocument();
    expect(screen.getByText('Research default')).toBeInTheDocument();
    expect(screen.getByText('Personal target')).toBeInTheDocument();
    expect(screen.getAllByText('Unmapped').length).toBeGreaterThan(0);
    expect(screen.getByRole('link', { name: 'Fix in Library' })).toHaveAttribute(
      'href',
      '/exercises',
    );
  });

  it('saves and resets a personal target from the card', async () => {
    const onChange = vi.fn();
    const first = renderCard(rows, { onPersonalTargetsChange: onChange });

    await userEvent.click(screen.getByRole('button', { name: 'Edit personal targets' }));
    const minimum = screen.getByRole('spinbutton', { name: 'Minimum sets' });
    const maximum = screen.getByRole('spinbutton', { name: 'Maximum sets' });
    await userEvent.clear(minimum);
    await userEvent.type(minimum, '12');
    await userEvent.clear(maximum);
    await userEvent.type(maximum, '16');
    await userEvent.click(screen.getByRole('button', { name: 'Save personal target' }));

    expect(onChange).toHaveBeenCalledWith({ chest: { min: 12, max: 16 } });

    first.unmount();
    onChange.mockClear();
    renderCard(rows, {
      personalTargets: { chest: { min: 12, max: 16 } },
      onPersonalTargetsChange: onChange,
    });
    await userEvent.click(screen.getByRole('button', { name: 'Edit personal targets' }));
    const resetButtons = screen.getAllByRole('button', { name: 'Use research default' });
    await userEvent.click(resetButtons.at(-1)!);
    expect(onChange).toHaveBeenCalledWith({});
  });

  it('explains the formula and exact contributing sets on request', async () => {
    renderCard();

    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Show me why' }));

    expect(screen.getByText(/gives its primary muscle 1 set/i)).toBeInTheDocument();
    expect(screen.getAllByText('Bench Press').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/100 kg × 5/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/secondary · 0.5 set/i)).toBeInTheDocument();
  });

  it('keeps non-muscle totals visible without fabricating ranges', () => {
    renderCard([
      {
        muscle: 'cardio',
        sets: 3,
        state: 'not_set',
        evidence: [],
      },
    ]);

    expect(screen.getByText('Target not set')).toBeInTheDocument();
    expect(screen.getByText(/does not use a muscle target range/i)).toBeInTheDocument();
  });
});
