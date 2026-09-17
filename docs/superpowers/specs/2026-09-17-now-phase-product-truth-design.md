# Now-Phase Product Truth Design

## Goal

Turn the current `Strong-Pro` repository into the canonical application by completing the essential behavior promised in the product bible, while using the ChatGPT Sites build only as a UI and interaction reference.

The app must earn trust through fast logging, local-first reliability, legible navigation, and analytics whose rules are visible and correct.

## Scope

### Ship now

- Keep the existing React/Vite, Dexie, Zustand, PWA, and Capacitor architecture.
- Keep the current brand assets and visual tokens.
- Rename the user-facing `Templates` concept to `Routines`; retain internal `Template` types and `/templates` routes to avoid a risky storage migration.
- Make previous-session values appear as ghost values inside empty set fields.
- When an empty set has previous values, one press on the completion button must persist the previous values and complete the set in one repository write.
- Preserve per-field edits, per-set autosave, offline use, crash recovery, and the absolute-timestamp rest timer.
- Cap estimated one-rep max inputs at 12 reps.
- Replace analytics ranges with `This week`, `4W`, `8W`, `12W`, `6M`, `1Y`, and `All`.
- Plot chart points using real timestamps rather than equally spaced category labels; `All` volume automatically groups by month.
- Mark newly imported exercises with no known muscle mapping as `Unmapped`, and expose that row in muscle analytics.
- Use compact display formatting for large analytics values without changing canonical stored units.
- Maintain 44px targets, explicit accessible names, chart summaries, chart data tables, non-color status text, and reduced-motion support.

### Not in this pass

- Bodyweight tonnage or bodyweight-relative scoring.
- Weekly verdicts, targets, stall detection, deload logic, or goal lenses.
- Multi-week programs, progression engines, creator drops, lore, social features, subscriptions, health integrations, coach sharing, or APIs.
- A second storage layer, account system, or backend.
- A rename of the product or internal database model.

## Architecture

The GitHub repository remains the only production source of truth. The Sites project contributes layout and interaction lessons, not its Next.js monolith or duplicate repository layer.

Domain rules stay in `src/domain`. Analytics composition stays in `src/features/analytics`. Persistent mutations continue through `RepForgeRepository`; UI components never write directly to IndexedDB.

The visible name changes to `Routines`, but internal `Template` identifiers remain stable. Existing user data and JSON backups therefore remain compatible.

## Logging flow

`SetRow` receives the current set and its corresponding previous set. Empty inputs show previous values as placeholders, never as persisted values.

On completion, a pure helper derives a patch containing only missing fields relevant to the exercise tracking type. `ActiveWorkoutPage` combines that patch with `isCompleted: true` in one repository update, reloads the workout, and starts the rest timer if configured.

Typed values always win over previous values. Unchecking a completed set does not rewrite its data. If no previous data exists, completion behaves exactly as it does today.

## Analytics rules

- `estimateOneRepMax` returns `null` above 12 reps for every formula.
- `This week` begins Monday at local midnight; rolling week ranges use exact multiples of seven days.
- Every chart point carries an ISO timestamp. The chart sorts by time and uses a numeric time axis while keeping human-readable labels for tooltips and tables.
- Volume buckets carry their period start timestamp. `All` selects monthly buckets automatically; shorter ranges default to weekly buckets.
- Unknown imported exercise mappings use the explicit `unmapped` muscle group. Genuine `full body` movements keep their existing classification.
- Large displayed values use compact notation; storage and calculations remain integer grams and gram-reps.

## Accessibility and UI

The primary navigation is `Today`, `Routines`, `History`, `Analytics`, `Library`, and `Settings`; phone navigation may keep `More` as the space-saving gateway for secondary destinations.

Ghost values must be exposed in the input placeholder and in accessible help text. Completion buttons keep explicit set-number labels and pressed state. Charts keep a plain-language summary and a full data table.

The UI uses the existing design tokens and components. No new decorative dashboard, card grid, or marketing surface is introduced.

## Error handling

Invalid typed numbers revert or save as empty exactly as current behavior specifies. A missing or unusable previous value is ignored rather than blocking set completion.

Analytics skip invalid timestamps and never fabricate a zero estimate. Imports preserve the original exercise name and flag only the missing mapping as `Unmapped`.

## Verification

- Unit tests cover the 12-rep estimate boundary, week ranges, compact formatting, unmapped attribution, and previous-set prefill rules.
- Component tests cover ghost placeholders and the one-tap completion patch.
- Existing repository, import, data-transfer, and domain tests remain green.
- Playwright verifies Routines terminology, set logging, responsive navigation, offline behavior, and analytics controls.
- Final gates are lint, typecheck, unit tests, production build, and responsive browser screenshots at phone and desktop widths.

## Approval record

The user approved this focused Now-phase approach after the repo audit: keep the current repository, apply the best parts of the Sites UI, obey the product truth first, and defer nice-to-have features.
