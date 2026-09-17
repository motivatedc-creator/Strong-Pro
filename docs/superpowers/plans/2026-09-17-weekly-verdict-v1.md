# Weekly Verdict v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the merged partial-week/full-week verdict with the deterministic Weekly Verdict v1 specified on 2026-09-17: last completed week + same-span current-week pulse, configurable week starts, hard-set-led direction, traceable evidence, and honest special states.

**Architecture:** Keep the feature fully local and deterministic. Add date-only training-week helpers that use each workout's stored `localDate`, then build a pure verdict engine over `LoggedEntry[]`; presentation copy is generated from rule IDs and structured evidence so the UI can make every displayed number tappable. Existing Analytics charts remain independent.

**Tech Stack:** React 19, TypeScript, Dexie/IndexedDB, Vitest, existing analytics/domain helpers.

**Spec:** User-provided `Weekly Verdict — v1 Spec (1).pdf`, pages 1–11. Data Lab / Ask the Lab on pages 12–19 is explicitly out of scope for this plan.

## Global Constraints

- Weekly Verdict remains deterministic, offline, and $0 marginal cost: no LLM/model/network calls.
- Full verdict is for the most recent completed training week; current week gets only a same-elapsed-span pulse from day 2 onward.
- Week start is user-selectable: Saturday, Sunday, or Monday. Existing installs default to Monday to preserve prior behavior.
- Session week membership is based on `Workout.localDate`, so DST/travel/current-device-timezone changes cannot move a historical session to a different local day.
- Baseline is the mean of the 4 most recent non-empty training weeks inside the 8 completed weeks before the subject week; 3 weeks is sufficient and must be labelled as such.
- Direction is driven by completed `working` sets only. Warm-up, drop, and failure sets do not count as hard sets.
- Tonnage excludes warm-ups and is used only for standout logic, never direction.
- e1RM uses the existing capped estimator (sets of 12 reps or fewer).
- If goal lifts are not user-set, use the three exercises with the most distinct sessions in the baseline window.
- Accessibility is part of done: labelled region, real heading, tappable numbers, 44px targets, readable text equivalent, VoiceOver/TalkBack-compatible controls.
- No telemetry/backend/account changes in this ticket.

---

### Task 1: User-configurable training week boundaries

**Files:**
- Modify: `src/domain/types.ts`
- Modify: `src/db/dexieRepository.ts`
- Modify: `src/domain/time.ts`
- Modify: `src/features/settings/SettingsPage.tsx`
- Test: `src/domain/time.test.ts`

**Interfaces:**
- Produces: `type WeekStartDay = 'saturday' | 'sunday' | 'monday'`
- Produces: `AppSettings.weekStartDay: WeekStartDay`
- Produces: `startOfTrainingWeek(reference: Date, weekStart: WeekStartDay): Date`
- Produces: `resolveRange(key, reference, weekStart?)` and `previousRange(key, reference, weekStart?)`

- [ ] **Step 1: Write failing boundary tests**

```ts
it.each([
  ['monday', '2026-09-14'],
  ['sunday', '2026-09-13'],
  ['saturday', '2026-09-12'],
] as const)('starts %s weeks correctly', (weekStart, expected) => {
  const start = startOfTrainingWeek(new Date('2026-09-17T12:00:00'), weekStart);
  expect(localDateOf(start)).toBe(expected);
});
```

- [ ] **Step 2: Run `npm test -- src/domain/time.test.ts` and verify RED**
- [ ] **Step 3: Add `WeekStartDay`, default `monday`, settings control, and week-aware time helpers**

```ts
export type WeekStartDay = 'saturday' | 'sunday' | 'monday';

export function startOfTrainingWeek(reference: Date, weekStart: WeekStartDay): Date {
  const target = weekStart === 'saturday' ? 6 : weekStart === 'sunday' ? 0 : 1;
  const start = new Date(reference);
  const delta = (start.getDay() - target + 7) % 7;
  start.setDate(start.getDate() - delta);
  start.setHours(0, 0, 0, 0);
  return start;
}
```

- [ ] **Step 4: Run time tests and typecheck**
- [ ] **Step 5: Commit `feat: add configurable training week start`**

### Task 2: Date-only weekly windows and trustworthy baselines

**Files:**
- Create: `src/features/analytics/trainingWeeks.ts`
- Test: `src/features/analytics/trainingWeeks.test.ts`

**Interfaces:**
- Consumes: `WeekStartDay`, `Workout.localDate`
- Produces: `TrainingWeekWindow`, `getCompletedWeekWindows`, `entriesInWeek`, `selectTrainingBaseline`, `sameElapsedSpan`

- [ ] **Step 1: Write failing tests for Sat/Sun/Mon windows, 23:50 local sessions, empty-week skipping, 3-week eligibility, and same-span pulse windows**

```ts
const baseline = selectTrainingBaseline(entries, subjectStart, 'saturday');
expect(baseline.weeks).toHaveLength(3);
expect(baseline.weeks.map((week) => week.sessionCount)).toEqual([1, 1, 1]);
```

- [ ] **Step 2: Verify tests fail because the helpers do not exist**
- [ ] **Step 3: Implement date-only arithmetic using UTC internally and `Workout.localDate` for membership**

```ts
export function localDateToOrdinal(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return Math.floor(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}
```

- [ ] **Step 4: Verify window tests pass**
- [ ] **Step 5: Commit `feat: add trustworthy training week windows`**

### Task 3: Replace the verdict engine with spec rule IDs and evidence

**Files:**
- Replace: `src/features/analytics/weeklyVerdict.ts`
- Replace: `src/features/analytics/weeklyVerdict.test.ts`

**Interfaces:**
- Produces: `buildWeeklyVerdict(entries, options, weekStartDay, reference?)`
- Produces: `WeeklyVerdictV1` containing `lastWeek`, `pulse`, `state`, `directionBand`, `sentenceIds`, `sentences`, and `evidence`
- Evidence sources carry metric name, subject value, baseline values, baseline week ranges, and formula text.

- [ ] **Step 1: Write failing tests for hard-set counting and direction boundaries**

```ts
expect(verdict.lastWeek?.hardSets).toBe(12);
expect(verdict.directionBand).toBe('up');
expect(verdict.sentenceIds.direction).toBe('direction.up');
```

- [ ] **Step 2: Add failing tests for special states: insufficient history, welcome back, deload-shaped, bodyweight-only, warm-ups-only**
- [ ] **Step 3: Add failing tests for top-3 lift fallback, new e1RM best, +2.5% lift improvement, absent-lift skip, 2-week slip, session-drop watch-out, and fallback copy**
- [ ] **Step 4: Implement minimal pure engine**

```ts
function hardSets(entries: readonly LoggedEntry[]): number {
  return entries.reduce(
    (sum, entry) => sum + entry.sets.filter((set) => set.isCompleted && set.setType === 'working').length,
    0,
  );
}
```

- [ ] **Step 5: Implement pulse using current elapsed local days against the identical day-count slice of each selected prior training week; hide on day 1**
- [ ] **Step 6: Run `npm test -- src/features/analytics/weeklyVerdict.test.ts`**
- [ ] **Step 7: Commit `fix: rebuild weekly verdict against completed weeks`**

### Task 4: Golden fixture coverage

**Files:**
- Create: `src/features/analytics/weeklyVerdict.fixtures.ts`
- Create: `src/features/analytics/weeklyVerdict.golden.test.ts`

**Interfaces:**
- Produces: 60 deterministic fixtures grouped exactly as the spec: eligibility 8, windows 10, pulse 8, direction bands 10, standout/watch-out 10, special states 8, data changes 6.

- [ ] **Step 1: Create typed fixture helper and group arrays**

```ts
export interface VerdictFixture {
  name: string;
  weekStart: WeekStartDay;
  reference: string;
  entries: LoggedEntry[];
  expected: { state: string; directionBand?: string; sentenceIds: string[] };
}
```

- [ ] **Step 2: Populate all 60 cases, including exact +10/+50/-10/-30 boundaries, Sat/Sun/Mon week starts, 23:50 local sessions, gaps, imports/edits, and kg/lb display independence**
- [ ] **Step 3: Run the golden suite and require `60/60`**
- [ ] **Step 4: Commit `test: add Weekly Verdict golden fixtures`**

### Task 5: Traceable Analytics card and evidence sheet

**Files:**
- Modify: `src/features/analytics/AnalyticsPage.tsx`
- Create: `src/features/analytics/WeeklyVerdictCard.tsx`
- Create: `src/features/analytics/VerdictEvidenceSheet.tsx`
- Test: `src/features/analytics/WeeklyVerdictCard.test.tsx` if the repo's test setup supports component rendering; otherwise keep presentation logic pure and test it in `weeklyVerdict.test.ts`.

**Interfaces:**
- Consumes: `WeeklyVerdictV1`
- Produces: top-of-Analytics `Last week` card, muted current-week pulse, metric-number buttons, evidence sheet.

- [ ] **Step 1: Write failing presentation test asserting the card shows last completed week rather than current partial week**
- [ ] **Step 2: Add card above the range selector with exactly three sentence slots for a full verdict and honest special-state copy otherwise**
- [ ] **Step 3: Render each numeric `SentencePart` as a button with a minimum 44px hit target**
- [ ] **Step 4: Evidence sheet shows formula, subject-week value, each baseline week/date range/value, and baseline mean**
- [ ] **Step 5: Pass `settings.weekStartDay` into both Weekly Verdict and normal `This week` Analytics ranges**
- [ ] **Step 6: Run typecheck/tests and manually inspect accessible labels in markup**
- [ ] **Step 7: Commit `feat: make Weekly Verdict traceable in Analytics`**

### Task 6: Final verification

**Files:**
- No new production files unless verification finds a defect.

- [ ] **Step 1: Run `npm test -- src/domain/time.test.ts src/features/analytics/trainingWeeks.test.ts src/features/analytics/weeklyVerdict.test.ts src/features/analytics/weeklyVerdict.golden.test.ts`**
- [ ] **Step 2: Run `npm run typecheck` (or the repository's equivalent script if named differently)**
- [ ] **Step 3: Run the full test suite**
- [ ] **Step 4: Confirm no current partial week is ever compared to full baseline weeks and all displayed numbers have evidence records**
- [ ] **Step 5: Open PR with the PDF spec summarized in the body and explicitly state any runtime verification limitation**
