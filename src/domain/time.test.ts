import { describe, expect, it } from 'vitest';
import { previousRange, resolveRange } from './time';

describe('analytics ranges', () => {
  const reference = new Date(2026, 8, 17, 12, 30, 0);

  it('starts This week on Monday at local midnight', () => {
    const range = resolveRange('this_week', reference);
    expect(range.from).toEqual(new Date(2026, 8, 14, 0, 0, 0, 0));
    expect(range.to).toBe(reference);
  });

  it.each([
    ['4w', 28],
    ['8w', 56],
    ['12w', 84],
  ] as const)('uses exact week multiples for %s', (key, days) => {
    const range = resolveRange(key, reference);
    const expected = new Date(reference);
    expected.setDate(expected.getDate() - days);
    expected.setHours(0, 0, 0, 0);
    expect(range.from).toEqual(expected);
  });

  it('builds the immediately preceding rolling window', () => {
    const current = resolveRange('4w', reference);
    const previous = previousRange('4w', reference);
    expect(previous?.to.getTime()).toBe((current.from?.getTime() ?? 0) - 1);
    expect(previous?.from).toEqual(new Date(2026, 6, 23, 0, 0, 0, 0));
  });

  it('does not count Monday midnight in both this week and the prior week', () => {
    const current = resolveRange('this_week', reference);
    const previous = previousRange('this_week', reference);
    expect(previous?.to.getTime()).toBe((current.from?.getTime() ?? 0) - 1);
  });

  it('has no prior window for All', () => {
    expect(previousRange('all', reference)).toBeNull();
  });
});
