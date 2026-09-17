import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { BarProfile } from '@/domain/types';
import {
  BarPicker,
  BarbellDiagram,
  BeginnerPlateGuide,
  UnknownBarHelper,
  describeBar,
} from './PlateCalculatorVisuals';

const bars: BarProfile[] = [
  {
    id: 'olympic-20',
    name: 'Olympic bar',
    weightG: 20_000,
    collarWeightG: 0,
    isDefault: true,
  },
  {
    id: 'olympic-15',
    name: '15 kg bar',
    weightG: 15_000,
    collarWeightG: 0,
    isDefault: false,
  },
];

describe('Plate Calculator visuals', () => {
  it('describes common and specialty bars without pretending every bar is standard', () => {
    expect(describeBar(bars[0]!, 'kg')).toContain('Full-size Olympic bar');
    expect(describeBar({ ...bars[0]!, name: 'EZ curl bar', weightG: 10_000 }, 'kg')).toContain(
      'weight varies',
    );
  });

  it('uses an illustrated, accessible bar picker', async () => {
    const onChange = vi.fn();
    render(<BarPicker bars={bars} value="olympic-20" weightUnit="kg" onChange={onChange} />);

    expect(screen.getByRole('group', { name: 'Choose your bar' })).toBeInTheDocument();
    const selected = screen
      .getAllByRole('button')
      .find((button) => button.getAttribute('aria-pressed') === 'true');
    expect(selected).toHaveTextContent('Olympic bar');
    await userEvent.click(screen.getByRole('button', { name: /^15 kg bar/ }));
    expect(onChange).toHaveBeenCalledWith('olympic-15');
  });

  it('shows a mirrored barbell and a beginner example', () => {
    render(
      <>
        <BarbellDiagram
          perSide={[
            { weightG: 25_000, countPerSide: 1 },
            { weightG: 15_000, countPerSide: 1 },
          ]}
          barWeightG={20_000}
          achievedTotalG={100_000}
          weightUnit="kg"
        />
        <BeginnerPlateGuide weightUnit="kg" />
      </>,
    );

    expect(screen.getByRole('img', { name: /100 kg barbell/ })).toBeInTheDocument();
    expect(screen.getAllByText('40 kg per side')).toHaveLength(2);
    expect(screen.getAllByText('100 kg total')).toHaveLength(2);
  });

  it('gives cautious identification help and lets the user choose a configured bar', async () => {
    const onChoose = vi.fn();
    render(
      <UnknownBarHelper open bars={bars} weightUnit="kg" onChoose={onChoose} onClose={vi.fn()} />,
    );

    expect(screen.getByRole('dialog', { name: 'Which bar am I using?' })).toBeInTheDocument();
    expect(screen.getByText(/ask the gym staff/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Choose Olympic bar/ }));
    expect(onChoose).toHaveBeenCalledWith('olympic-20');
  });
});
