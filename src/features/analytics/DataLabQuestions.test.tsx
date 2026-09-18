import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { DataLabQuestions } from './DataLabQuestions';

describe('DataLabQuestions', () => {
  it('opens with five human questions and marks only unfinished engines as coming soon', async () => {
    const onSelect = vi.fn();
    render(<DataLabQuestions selected={null} onSelect={onSelect} />);

    expect(screen.getAllByRole('button')).toHaveLength(5);
    expect(screen.getByRole('button', { name: /Am I training enough?/ })).toBeInTheDocument();
    expect(screen.getAllByText('Coming soon')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: /Am I training enough?/ }));
    expect(onSelect).toHaveBeenCalledWith('enough');
  });
});
