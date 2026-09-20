import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DexieRepository, setRepository } from '@/db/dexieRepository';
import { RepForgeDatabase } from '@/db/schema';
import type { MuscleBandBalance } from './muscleSets';
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
  goalLifts: [],
  goalLiftSource: 'inferred',
};

describe('WeeklyVerdictCard', () => {
  it('presents the completed week separately from the same-span current pulse', () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" />);

    expect(screen.getByRole('heading', { name: 'Last week' })).toBeInTheDocument();
    expect(screen.getByText('Sep 7–13')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /5 hard sets\. Show evidence/ })).toBeInTheDocument();
  });

  it('opens metric evidence from a tappable number with formula and baseline mean', async () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" />);

    await userEvent.click(screen.getByRole('button', { name: /12 hard sets\. Show evidence/ }));

    expect(screen.getByRole('dialog', { name: 'Hard sets evidence' })).toBeInTheDocument();
    expect(
      screen.getByText(/Completed working sets only\. Warm-up, drop and failure sets do not count/),
    ).toBeInTheDocument();
    expect(screen.getAllByText('12 hard sets').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Mean 10 hard sets')).toBeInTheDocument();
  });

  it('keeps 44px minimum targets on metric buttons', () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" />);
    const button = screen.getByRole('button', { name: /12 hard sets\. Show evidence/ });
    expect(button.className).toMatch(/min-h-11/);
    expect(button.className).toMatch(/min-w-11/);
  });
});

describe('WeeklyVerdictCard muscle balance', () => {
  const balance: MuscleBandBalance = {
    weekStartDate: '2026-09-07',
    weekEndDate: '2026-09-13',
    insights: [],
    judged: [
      {
        muscle: 'chest',
        sets: 5,
        state: 'below',
        target: { min: 10, max: 20 },
        targetSource: 'research',
        evidence: [],
      },
    ],
    below: [
      {
        muscle: 'chest',
        sets: 5,
        state: 'below',
        target: { min: 10, max: 20 },
        targetSource: 'research',
        evidence: [],
      },
    ],
    inRange: [],
    above: [],
    insufficientMapping: false,
  };

  it('surfaces a labelled balance region with stable sentence id', () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" muscleBalance={balance} />);
    const region = screen.getByRole('region', { name: 'Muscle balance' });
    expect(region).toHaveAttribute('data-balance-id', 'balance_judged');
    expect(region).toHaveTextContent('Balance: Chest below.');
  });

  it('opens muscle balance evidence including research-default disclosure', async () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" muscleBalance={balance} />);
    await userEvent.click(screen.getByRole('button', { name: /Balance: Chest below/ }));
    expect(screen.getByRole('dialog', { name: /Muscle balance evidence/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Research default limits/i })).toBeInTheDocument();
  });
});

describe('WeeklyVerdictCard goal lifts', () => {
  let db: RepForgeDatabase;
  let repository: DexieRepository;

  beforeEach(async () => {
    db = new RepForgeDatabase(`repforge-verdict-goal-lifts-${Math.random().toString(36).slice(2)}`);
    repository = new DexieRepository(db);
    await repository.initialise();
    setRepository(repository);
  });

  afterEach(() => {
    setRepository(null);
  });

  it('says nothing was chosen and offers to choose, when the source is inferred', () => {
    const inferred: WeeklyVerdict = {
      ...verdict,
      goalLiftSource: 'inferred',
      goalLifts: [{ id: 'seed-bench-press', name: 'Bench Press', sessions: 4 }],
    };
    render(<WeeklyVerdictCard verdict={inferred} weightUnit="kg" onGoalLiftIdsChange={vi.fn()} />);
    expect(screen.getByText(/Based on your top lifts: Bench Press\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Choose' })).toBeInTheDocument();
  });

  it("names the user's own picks without a hedge, when the source is chosen", () => {
    const chosen: WeeklyVerdict = {
      ...verdict,
      goalLiftSource: 'chosen',
      goalLifts: [{ id: 'seed-back-squat', name: 'Back Squat', sessions: 2 }],
    };
    render(<WeeklyVerdictCard verdict={chosen} weightUnit="kg" onGoalLiftIdsChange={vi.fn()} />);
    expect(screen.getByText(/Goal lifts: Back Squat\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
  });

  it('does not render an action when no change handler is given', () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" />);
    expect(screen.queryByRole('button', { name: 'Choose' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('opens the goal lift picker from the "Choose" action', async () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" onGoalLiftIdsChange={vi.fn()} />);
    await userEvent.click(screen.getByRole('button', { name: 'Choose' }));
    expect(await screen.findByRole('dialog', { name: 'Goal lifts' })).toBeInTheDocument();
  });
});

describe('WeeklyVerdictCard goal lens', () => {
  it('shows the active lens as visible text, defaulting to Build', () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" />);
    expect(screen.getByText('Lens: Build.')).toBeInTheDocument();
  });

  it('shows a non-default lens as visible text', () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" goalLens="strength" />);
    expect(screen.getByText('Lens: Strength.')).toBeInTheDocument();
  });

  it('does not render a Change affordance without a change handler', () => {
    render(<WeeklyVerdictCard verdict={verdict} weightUnit="kg" goalLens="maintain" />);
    expect(screen.getByText('Lens: Maintain.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument();
  });

  it('opens the goal lens picker from the labelled "Change" action', async () => {
    render(
      <WeeklyVerdictCard
        verdict={verdict}
        weightUnit="kg"
        goalLens="build"
        onGoalLensChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: 'Change' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Change' }));
    expect(await screen.findByRole('dialog', { name: 'Goal lens' })).toBeInTheDocument();
  });
});
