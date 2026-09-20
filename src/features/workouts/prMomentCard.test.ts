import { describe, expect, it } from 'vitest';
import { DEFAULT_PR_CARD_PALETTE, prCardFields, prCardFileName } from './prMomentCard';
import type { PrCardInput } from './prMomentCard';

const input = (patch: Partial<PrCardInput> = {}): PrCardInput => ({
  kinds: ['weight'],
  exerciseName: 'Back Squat',
  weightG: 140_000,
  reps: 5,
  performedAt: '2026-03-08T09:30:00.000Z',
  weightUnit: 'kg',
  ...patch,
});

describe('prCardFields', () => {
  it('renders the record kind, exercise, load and date', () => {
    const fields = prCardFields(input());
    expect(fields.headline).toBe('HEAVIEST WEIGHT');
    expect(fields.exercise).toBe('Back Squat');
    expect(fields.load).toBe('140 kg × 5');
    expect(fields.date).toContain('2026');
  });

  it('joins up to two kinds and counts the rest', () => {
    expect(prCardFields(input({ kinds: ['weight', 'volume'] })).headline).toBe(
      'HEAVIEST WEIGHT · BEST SET VOLUME',
    );
    expect(prCardFields(input({ kinds: ['weight', 'volume', 'oneRm'] })).headline).toBe(
      'HEAVIEST WEIGHT · BEST SET VOLUME +1 MORE',
    );
  });

  it('converts the load to the display unit without touching stored grams', () => {
    expect(prCardFields(input({ weightUnit: 'lb' })).load).toBe('308.65 lb × 5');
  });

  it('degrades honestly when the set has no load or no reps', () => {
    expect(prCardFields(input({ weightG: undefined })).load).toBe('5 reps');
    expect(prCardFields(input({ weightG: undefined, reps: 1 })).load).toBe('1 rep');
    expect(prCardFields(input({ reps: undefined })).load).toBe('140 kg');
    expect(prCardFields(input({ weightG: undefined, reps: undefined })).load).toBe('—');
  });

  it('falls back to a generic headline when no kinds are supplied', () => {
    expect(prCardFields(input({ kinds: [] })).headline).toBe('NEW RECORD');
  });
});

describe('prCardFileName', () => {
  it('slugs the exercise and stamps the date', () => {
    const fields = prCardFields(input({ exerciseName: 'Barbell Bench Press (Close Grip)' }));
    expect(prCardFileName(fields, new Date('2026-03-08T09:30:00.000Z'))).toBe(
      'lockd-pr-barbell-bench-press-close-grip-2026-03-08.png',
    );
  });

  it('never produces an empty slug', () => {
    const fields = prCardFields(input({ exerciseName: '***' }));
    expect(prCardFileName(fields, new Date('2026-03-08T09:30:00.000Z'))).toBe(
      'lockd-pr-record-2026-03-08.png',
    );
  });
});

describe('DEFAULT_PR_CARD_PALETTE', () => {
  it('holds drawable colors for every slot', () => {
    for (const value of Object.values(DEFAULT_PR_CARD_PALETTE)) {
      expect(value).toMatch(/^rgb\(/);
    }
  });
});
