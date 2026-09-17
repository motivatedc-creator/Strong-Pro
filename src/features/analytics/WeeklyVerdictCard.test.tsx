import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { WeeklyVerdict } from './weeklyVerdict';
import { WeeklyVerdictCard } from './WeeklyVerdictCard';

const verdict: WeeklyVerdict = {
  state: 'full',
  subject: {
    startDate: '2026-09-07',
    endDate: '2026-09-13',
    metrics: { hardSets: 12, sessions: 3, tonnageG: 48_000_000 },
  },
  baseline: {
    metrics: { hardSets: 10, sessions: 3, tonnageG: 45_000_000 },
    weeks: [
      {
        startDate: '2026-08-10',
        endDate: '2026-08-16',
        entries: [],
        sessionCount: 3,
      },
      {
        startDate: '2026-08-17',
        endDate: '2026-08-23',
        entries: [],
        sessionCount: 3,
      },
      {
        startDate: '2026-08-24',
        endDate: '2026-08-30',
        entries: [],
        sessionCount: 3,
      },
      {
        startDate: '2026-08-31',
        endDate: '2026-09-06',
        entries: [],
        sessionCount: 3,
      },
    ],
  },
  direction: { id: 'direction_up', band: 'up', changePercent: 20 },
  standout: { id: 'standout_metric_mover', text: 'Hard sets|20' },
  watchout: { id: 'watchout_none' },
  pulse: {
    currentHardSets: 5,
    baselineHardSetsAverage: 4,
    baselineWeeks: 4,
    changePercent: 25,
  },
};

describe('WeeklyVerdictCard', () => {
  it('presents the completed week separately from the same-span current pulse', () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" />);

    expect(screen.getByRole('heading', { name: 'Last week' })).toBeInTheDocument();
    expect(screen.getByText('Sep 7–13')).toBeInTheDocument();
    expect(screen.getByText(/This week so far: 5 hard sets/)).toBeInTheDocument();
  });

  it('opens traceable evidence from a verdict sentence', async () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" />);

    await userEvent.click(screen.getByRole('button', { name: /Training went up/ }));

    expect(screen.getByRole('dialog', { name: 'Weekly Verdict evidence' })).toBeInTheDocument();
    expect(screen.getByText('Completed working sets only')).toBeInTheDocument();
    expect(screen.getByText('12 hard sets')).toBeInTheDocument();
    expect(screen.getByText('4-week mean')).toBeInTheDocument();
    expect(screen.getByText('Same-span comparison')).toBeInTheDocument();
    expect(screen.getByText('5 vs 4 hard sets')).toBeInTheDocument();
  });
});
