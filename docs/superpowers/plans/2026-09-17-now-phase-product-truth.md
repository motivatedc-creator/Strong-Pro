# Now-Phase Product Truth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the app's essential fast-logging, Routines, analytics-trust, and accessibility behavior without expanding into Next/Later features.

**Architecture:** Preserve the existing React/Vite + Dexie application and keep all persistence behind `RepForgeRepository`. Add small pure domain helpers for behavior that needs deterministic tests, then wire them into existing feature components.

**Tech Stack:** React 19, TypeScript 5.7, Vite 6, Dexie 4, Zustand 5, Recharts 2, Vitest 3, Testing Library, Playwright 1.50.

## Global Constraints

- Keep the current brand and repository architecture.
- Keep internal `Template` types, backup fields, and `/templates` routes stable.
- Do not implement any product-bible Next or Later feature.
- New behavior follows red-green-refactor test-driven development.
- All controls remain keyboard and screen-reader operable with 44px minimum targets.

---

### Task 1: Trustworthy analytics domain rules

**Files:**

- Modify: `src/domain/oneRepMax.test.ts`
- Modify: `src/domain/oneRepMax.ts`
- Create: `src/domain/time.test.ts`
- Modify: `src/domain/time.ts`
- Modify: `src/domain/units.test.ts`
- Modify: `src/domain/units.ts`
- Modify: `src/domain/volume.test.ts`
- Modify: `src/domain/volume.ts`
- Modify: `src/domain/types.ts`
- Modify: `src/domain/taxonomy.ts`
- Modify: `src/features/data-transfer/strongImport.test.ts`
- Modify: `src/features/data-transfer/strongImport.ts`

**Interfaces:**

- Produces: `MAX_E1RM_REPS = 12` and `estimateOneRepMax(...): OneRepMaxResult | null`.
- Produces: `RangeKey = 'this_week' | '4w' | '8w' | '12w' | '6m' | '1y' | 'all'`.
- Produces: `formatCompactNumber(value, maximumFractionDigits?): string`.
- Produces: `MuscleGroup` value `'unmapped'`.

- [ ] **Step 1: Write failing boundary, range, formatting, attribution, and import tests**

```ts
expect(estimateOneRepMax(100_000, 12, 'epley')).not.toBeNull();
expect(estimateOneRepMax(100_000, 13, 'epley')).toBeNull();
expect(resolveRange('this_week', new Date('2026-09-17T12:00:00')).from?.getDay()).toBe(1);
expect(formatCompactNumber(5_160_000)).toBe('5.16M');
expect(
  attributeVolumeByMuscle([
    group('weight_reps', [set({ weightG: 100_000, reps: 5 })], 'unmapped'),
  ])[0]?.muscle,
).toBe('unmapped');
expect(batch.newExercises[0]?.primaryMuscleGroup).toBe('unmapped');
```

- [ ] **Step 2: Run focused tests and verify they fail for the intended missing rules**

Run: `npm test -- src/domain/oneRepMax.test.ts src/domain/time.test.ts src/domain/units.test.ts src/domain/volume.test.ts src/features/data-transfer/strongImport.test.ts`

Expected: failures for the 13-rep estimate, missing range keys, missing compact formatter, and missing unmapped import classification.

- [ ] **Step 3: Implement the minimal domain changes**

```ts
export const MAX_E1RM_REPS = 12;
if (wholeReps > MAX_E1RM_REPS) return null;

export type RangeKey = 'this_week' | '4w' | '8w' | '12w' | '6m' | '1y' | 'all';

export function formatCompactNumber(value: number, maximumFractionDigits = 2): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(undefined, {
    notation: 'compact',
    maximumFractionDigits,
  }).format(value);
}
```

Add `'unmapped'` to `MuscleGroup` and `MUSCLE_GROUPS`, and assign it when Strong import creates an exercise that cannot be matched to the library.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm test -- src/domain/oneRepMax.test.ts src/domain/time.test.ts src/domain/units.test.ts src/domain/volume.test.ts src/features/data-transfer/strongImport.test.ts`

Expected: all focused tests pass.

### Task 2: One-tap previous-set logging

**Files:**

- Create: `src/features/workouts/setPrefill.test.ts`
- Create: `src/features/workouts/setPrefill.ts`
- Create: `src/features/workouts/SetRow.test.tsx`
- Modify: `src/features/workouts/SetRow.tsx`
- Modify: `src/features/workouts/ActiveWorkoutPage.tsx`

**Interfaces:**

- Produces: `previousSetPatch(current, previous, trackingType): Partial<WorkoutSet>`.
- `SetRow.onToggleComplete` receives the derived patch.

- [ ] **Step 1: Write failing pure and component tests**

```ts
expect(previousSetPatch(current, previous, 'weight_reps')).toEqual({
  weightG: 100_000,
  reps: 8,
});

render(<SetRow set={emptySet} previous={previousSet} {...requiredProps} />);
expect(screen.getByLabelText('Weight for set 1 in kg')).toHaveAttribute('placeholder', '100');
await user.click(screen.getByRole('button', { name: 'Complete set 1' }));
expect(onToggleComplete).toHaveBeenCalledWith({ weightG: 100_000, reps: 8 });
```

- [ ] **Step 2: Run focused tests and verify they fail**

Run: `npm test -- src/features/workouts/setPrefill.test.ts src/features/workouts/SetRow.test.tsx`

Expected: modules or behavior are missing.

- [ ] **Step 3: Implement ghost placeholders and atomic completion**

```ts
const prefill = set.isCompleted ? {} : previousSetPatch(set, previous, trackingType);
onToggleComplete(prefill);
```

`ActiveWorkoutPage` writes `{ ...prefill, isCompleted: next }` in one `repository.updateSet` call. The explicit Copy control is removed because empty fields already expose the previous values and completion accepts them.

- [ ] **Step 4: Run focused tests and verify they pass**

Run: `npm test -- src/features/workouts/setPrefill.test.ts src/features/workouts/SetRow.test.tsx`

Expected: both files pass.

### Task 3: Real-time charts and product ranges

**Files:**

- Modify: `src/components/Chart.tsx`
- Modify: `src/features/analytics/compute.ts`
- Modify: `src/features/analytics/AnalyticsPage.tsx`
- Modify: `src/features/analytics/help.ts`
- Modify: `src/features/exercises/ExerciseDetailPage.tsx`
- Modify: `src/features/measurements/MeasurementDetailPage.tsx`
- Modify: `docs/analytics.md`

**Interfaces:**

- `ChartPoint` gains `date: string`.
- `PeriodBucket` gains `date: string`.
- Chart rows expose numeric `timestamp` and display `label`.

- [ ] **Step 1: Add failing compute tests for chronological timestamps and monthly All bucketing**

Create test cases that pass entries out of order and assert `exerciseProgress(...).oneRepMax` and `bucketVolume(...)` return chronological ISO dates.

- [ ] **Step 2: Run the focused analytics tests and verify failure**

Run: `npm test -- src/features/analytics/compute.test.ts`

Expected: timestamp or ordering assertions fail before implementation.

- [ ] **Step 3: Implement numeric time axes and range controls**

```tsx
<XAxis
  dataKey="timestamp"
  type="number"
  scale="time"
  domain={['dataMin', 'dataMax']}
  tickFormatter={(value) => formatDate(new Date(value), { month: 'short', day: 'numeric' })}
/>
```

Pass `date` through every `ChartCard` series. Change range controls to the locked labels and make `range === 'all'` force monthly buckets.

- [ ] **Step 4: Run analytics tests and typecheck**

Run: `npm test -- src/features/analytics/compute.test.ts && npm run typecheck`

Expected: tests and typecheck pass.

### Task 4: Routines terminology and essential UI alignment

**Files:**

- Modify: `src/app/navigation.tsx`
- Modify: `src/features/workouts/TodayPage.tsx`
- Modify: `src/features/templates/TemplatesPage.tsx`
- Modify: `src/features/templates/TemplateEditorPage.tsx`
- Modify: `src/features/settings/SettingsPage.tsx`
- Modify: `src/features/data-transfer/DataSettings.tsx`
- Modify: `e2e/responsive.spec.ts`
- Modify: `e2e/starter-templates.spec.ts`

**Interfaces:**

- User-facing copy says `Routine` or `Routines`.
- Internal identifiers and URLs remain unchanged.

- [ ] **Step 1: Update Playwright expectations to require Routines copy**

```ts
await expect(page.getByRole('link', { name: 'Routines' })).toBeVisible();
await expect(page.getByRole('heading', { name: 'Routines' })).toBeVisible();
```

- [ ] **Step 2: Run those tests and verify they fail against Templates copy**

Run: `npx playwright test e2e/responsive.spec.ts e2e/starter-templates.spec.ts`

Expected: Routines locators fail.

- [ ] **Step 3: Replace visible copy and keep stable internal routes**

Change headings, navigation labels, buttons, empty states, toasts, data-ownership copy, and accessible names. Do not rename `Template` TypeScript types or persisted fields.

- [ ] **Step 4: Run the focused Playwright tests and verify they pass**

Run: `npx playwright test e2e/responsive.spec.ts e2e/starter-templates.spec.ts`

Expected: both specs pass.

### Task 5: Full verification and visual QA

**Files:**

- Modify only files required by verified defects.
- Delete temporary screenshots after review.

- [ ] **Step 1: Run all automated gates**

Run: `npm run verify && npm run test:e2e`

Expected: lint, typecheck, unit tests, build, and all Playwright tests pass.

- [ ] **Step 2: Capture phone and desktop screenshots**

Run the production preview and use Playwright at 375x812 and 1440x1000 for Today, Routines, active workout, and Analytics.

- [ ] **Step 3: Inspect screenshots and correct only concrete defects**

Verify no horizontal overflow, clipped controls, unreadable chart labels, missing focus names, or tap targets below 44px. Re-run the affected automated gate after every correction.

- [ ] **Step 4: Review the requirement checklist**

Confirm every Ship now item in the design spec has either an automated test or a direct browser check, and confirm every Not in this pass item remains absent.
