import { describe, expect, it } from 'vitest';
import type { LoggedEntry } from './compute';
import {
  CHANGE_FLAGS_EMPTY,
  DELOAD_CLAIM_ID,
  deloadFlag,
  spikeFlag,
  stallFlags,
  trainingFlags,
} from './trainingFlags';
import {
  GOLDEN_OPTIONS,
  fixtureEntry,
  mondayBaseline,
} from './weeklyVerdict.fixtures.helpers';
import { weeklyVerdict } from './weeklyVerdict';

const REF = new Date('2026-09-17T12:00:00.000Z');

function deloadEntries(): LoggedEntry[] {
  return [
    ...mondayBaseline(10).flatMap((row, index) => [
      row,
      fixtureEntry(row.workout.localDate, `b-extra-${index}`, { hardSets: 1 }),
    ]),
    fixtureEntry('2026-09-08', 'last-a', { hardSets: 3 }),
    fixtureEntry('2026-09-11', 'last-b', { hardSets: 2 }),
  ];
}

function spikeEntries(): LoggedEntry[] {
  return [
    ...mondayBaseline(10),
    fixtureEntry('2026-09-08', 'last-a', { hardSets: 10 }),
    fixtureEntry('2026-09-10', 'last-b', { hardSets: 6 }),
  ];
}

/** Three goal-lift sessions in trailing 28d with flat e1RM vs prior equal window. */
function stallYesEntries(): LoggedEntry[] {
  const prior = [
    fixtureEntry('2026-07-20', 'p1', {
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      hardSets: 3,
      weightG: 100_000,
      reps: 5,
    }),
    fixtureEntry('2026-07-27', 'p2', {
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      hardSets: 3,
      weightG: 100_000,
      reps: 5,
    }),
    fixtureEntry('2026-08-03', 'p3', {
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      hardSets: 3,
      weightG: 100_000,
      reps: 5,
    }),
  ];
  const window = [
    fixtureEntry('2026-08-24', 'w1', {
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      hardSets: 3,
      weightG: 100_000,
      reps: 5,
    }),
    fixtureEntry('2026-09-01', 'w2', {
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      hardSets: 3,
      weightG: 100_000,
      reps: 5,
    }),
    fixtureEntry('2026-09-10', 'w3', {
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      hardSets: 3,
      weightG: 100_000,
      reps: 5,
    }),
  ];
  const baseline = mondayBaseline(8).map((row, index) =>
    fixtureEntry(row.workout.localDate, `base-bench-${index}`, {
      exerciseId: 'bench',
      exerciseName: 'Bench Press',
      hardSets: 8,
      weightG: 100_000,
      reps: 5,
    }),
  );
  return [...prior, ...baseline, ...window];
}

function stallNoEntries(): LoggedEntry[] {
  return stallYesEntries().map((entry) => {
    if (entry.workout.id === 'workout-w3') {
      return fixtureEntry(entry.workout.localDate, 'w3', {
        exerciseId: 'bench',
        exerciseName: 'Bench Press',
        hardSets: 3,
        weightG: 110_000,
        reps: 5,
      });
    }
    return entry;
  });
}

describe('trainingFlags', () => {
  it('deloadFlag reuses Weekly Verdict deload rule and cites the catalog claim', () => {
    const entries = deloadEntries();
    const verdict = weeklyVerdict(entries, GOLDEN_OPTIONS, 'monday', REF);
    const flag = deloadFlag(entries, GOLDEN_OPTIONS, 'monday', REF);

    expect(verdict.state).toBe('deload');
    expect(flag.status).toBe('active');
    expect(flag.claimId).toBe(DELOAD_CLAIM_ID);
    expect(flag.subjectHardSets).toBe(verdict.subject.metrics.hardSets);
    expect(flag.subjectSessions).toBe(verdict.subject.metrics.sessions);
    expect(flag.receipt.toLowerCase()).toContain('deload');
  });

  it('editing hard sets flips deloadFlag off', () => {
    const light = deloadEntries();
    expect(deloadFlag(light, GOLDEN_OPTIONS, 'monday', REF).status).toBe('active');

    const heavier = [
      ...mondayBaseline(10).flatMap((row, index) => [
        row,
        fixtureEntry(row.workout.localDate, `b-extra-${index}`, { hardSets: 1 }),
      ]),
      fixtureEntry('2026-09-08', 'last-a', { hardSets: 8 }),
      fixtureEntry('2026-09-11', 'last-b', { hardSets: 7 }),
    ];
    expect(deloadFlag(heavier, GOLDEN_OPTIONS, 'monday', REF).status).toBe('inactive');
  });

  it('spikeFlag is active when Verdict direction is big_jump', () => {
    const entries = spikeEntries();
    const verdict = weeklyVerdict(entries, GOLDEN_OPTIONS, 'monday', REF);
    const flag = spikeFlag(entries, GOLDEN_OPTIONS, 'monday', REF);

    expect(verdict.state).toBe('full');
    expect(verdict.direction?.band).toBe('big_jump');
    expect(verdict.watchout?.id).toBe('watchout_big_jump');
    expect(flag.status).toBe('active');
    expect(flag.directionBand).toBe('big_jump');
  });

  it('re-dating a spike session out of the subject week clears spikeFlag', () => {
    const spiked = spikeEntries();
    expect(spikeFlag(spiked, GOLDEN_OPTIONS, 'monday', REF).status).toBe('active');

    const moved = spiked.map((entry) => {
      if (entry.workout.id === 'workout-last-b') {
        return fixtureEntry('2026-08-20', 'last-b', { hardSets: 6 });
      }
      return entry;
    });
    expect(spikeFlag(moved, GOLDEN_OPTIONS, 'monday', REF).status).toBe('inactive');
  });

  it('stallFlag is active when ≥3 sessions in 28 days and e1RM is flat or down', () => {
    const entries = stallYesEntries();
    const stalls = stallFlags(entries, GOLDEN_OPTIONS, 'monday', REF);
    const bench = stalls.find((flag) => flag.liftId === 'bench');

    expect(bench).toBeDefined();
    expect(bench!.sessionsInWindow).toBeGreaterThanOrEqual(3);
    expect(bench!.status).toBe('active');
    expect(bench!.bestE1rmInWindowG).not.toBeNull();
    expect(bench!.comparisonBestE1rmG).not.toBeNull();
    expect(bench!.bestE1rmInWindowG!).toBeLessThanOrEqual(bench!.comparisonBestE1rmG!);
  });

  it('stallFlag is inactive when best e1RM improved in the window', () => {
    const entries = stallNoEntries();
    const stalls = stallFlags(entries, GOLDEN_OPTIONS, 'monday', REF);
    const bench = stalls.find((flag) => flag.liftId === 'bench');

    expect(bench).toBeDefined();
    expect(bench!.status).toBe('inactive');
  });

  it('stallFlag is Partial when fewer than 3 sessions in the trailing 28 days', () => {
    const entries = [
      fixtureEntry('2026-07-13', 'base-0', {
        exerciseId: 'squat',
        exerciseName: 'Squat',
        hardSets: 8,
      }),
      fixtureEntry('2026-07-20', 'base-1', {
        exerciseId: 'squat',
        exerciseName: 'Squat',
        hardSets: 8,
      }),
      fixtureEntry('2026-07-27', 'base-2', {
        exerciseId: 'squat',
        exerciseName: 'Squat',
        hardSets: 8,
      }),
      fixtureEntry('2026-08-03', 'base-3', {
        exerciseId: 'squat',
        exerciseName: 'Squat',
        hardSets: 8,
      }),
      fixtureEntry('2026-09-10', 'only', {
        exerciseId: 'squat',
        exerciseName: 'Squat',
        hardSets: 5,
      }),
    ];
    const stalls = stallFlags(entries, GOLDEN_OPTIONS, 'monday', REF);
    const squat = stalls.find((flag) => flag.liftId === 'squat');

    expect(squat).toBeDefined();
    expect(squat!.sessionsInWindow).toBeLessThan(3);
    expect(squat!.status).toBe('partial');
    expect(squat!.receipt.toLowerCase()).toContain('partial');
  });

  it('trainingFlags empty state copy stays honest when nothing is active', () => {
    const entries = [
      fixtureEntry('2026-07-13', 'b1', { hardSets: 10, weightG: 90_000 }),
      fixtureEntry('2026-07-20', 'b2', { hardSets: 10, weightG: 90_000 }),
      fixtureEntry('2026-07-27', 'b3', { hardSets: 10, weightG: 90_000 }),
      fixtureEntry('2026-08-03', 'b4', { hardSets: 10, weightG: 90_000 }),
      fixtureEntry('2026-08-24', 'w1', { hardSets: 10, weightG: 100_000 }),
      fixtureEntry('2026-09-01', 'w2', { hardSets: 10, weightG: 105_000 }),
      fixtureEntry('2026-09-08', 'last', { hardSets: 10, weightG: 110_000 }),
    ];
    const flags = trainingFlags(entries, GOLDEN_OPTIONS, 'monday', REF);
    expect(flags.deload.status).toBe('inactive');
    expect(flags.spike.status).toBe('inactive');
    expect(flags.active).toHaveLength(0);
    expect(CHANGE_FLAGS_EMPTY).toMatch(/No stall, spike, or deload flags/);
  });
});
