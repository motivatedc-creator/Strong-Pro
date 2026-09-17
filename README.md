# RepForge

A free, subscription-free, local-first workout tracker for lifters. Templates, fast set
logging, rest timers, progress analytics, body measurements and plate maths — all stored
on your device, all working offline.

RepForge is an original, independent product. It has no accounts, no ads, no analytics
SDK, no telemetry and no server. It is not affiliated with any other fitness app.

## What it does

- **Log fast.** Start empty or from a template; recently used exercises appear first, previous-
  session values sit beside every set, one tap copies them, and one tap completes a set and
  starts the rest timer.
- **Templates without limits.** Target sets, rep ranges, RPE/RIR targets, rest times, set
  types and superset grouping. Duplicate, reorder, archive, delete.
- **Real analytics.** Estimated 1RM (Epley or Brzycki), heaviest set, session and weekly
  volume, muscle-group attribution and rep records — all recomputed from your stored sets.
- **Body measurements.** Body weight and eleven circumference metrics with trends,
  absolute change and average weekly delta.
- **Tools.** A plate calculator that respects your actual plate inventory, and a warm-up
  generator that only prescribes loads you can build.
- **Portable.** Versioned JSON backup, clean CSV exports, validated restore with merge or
  replace, and a defensive Strong CSV importer.
- **Installable.** A polished PWA that works in airplane mode, plus Capacitor config for
  iOS and Android packaging.

## Requirements

- Node.js 20.19+ or 22.12+ (developed on Node 22)
- npm 10+
- A Chromium browser for the end-to-end tests

## Install and run

```bash
npm install
npm run dev          # development server on http://localhost:5173
```

## Test, build and preview

```bash
npm run typecheck    # strict TypeScript, no emit
npm run lint         # ESLint, zero warnings allowed
npm run test         # Vitest unit and integration tests
npm run build        # production build into dist/
npm run preview      # serve dist/ on http://localhost:4173 (PWA preview)
npm run verify       # lint + typecheck + test + build

npm run test:e2e:install   # download the Playwright browser (first run only)
npm run test:e2e           # Playwright end-to-end suite (builds and previews first)
```

The service worker only runs in a production build, so PWA behaviour must be checked
against `npm run build && npm run preview`, not the dev server. If your machine already
has a Chromium that Playwright did not install, point the suite at it:

```bash
CHROMIUM_PATH=/path/to/chrome npm run test:e2e
```

## Architecture

```text
src/
  app/          application shell, routing, providers, transient state, hooks
  components/   design-system primitives, charts, toasts, error boundary
  db/           Dexie schema and migrations, seed library, storage boundary
  domain/       pure calculation and unit modules (no React, no persistence)
  features/
    workouts/      today, active workout, summary, history, editor, rest timer
    templates/     template list and editor
    exercises/     library, picker, editor, per-exercise history
    analytics/     aggregation and the analytics screen
    measurements/  entry, list and per-metric trend
    calculators/   plate calculator and warm-up generator
    data-transfer/ CSV, Strong import, backup schema, exporters, settings panel
    settings/      preferences, equipment, appearance, onboarding
  platform/     theme, Capacitor bridge, sound/vibration/notifications
  styles/       design tokens and global styles
  test/         test setup and fixtures
```

The layering rule: `domain/` knows nothing about React or storage, `db/` knows nothing
about React, and feature code talks to storage only through the `RepForgeRepository`
interface in `src/db/repository.ts`. That interface is the seam where a native SQLite
adapter can replace Dexie without touching feature logic.

## Local data model

Everything lives in one IndexedDB database (`repforge`), managed by Dexie with explicit,
tested migrations (`src/db/schema.ts`, currently schema version 2).

| Store                                         | Holds                                                              |
| --------------------------------------------- | ------------------------------------------------------------------ |
| `exercises`                                   | library and custom exercises, with tracking type and muscle groups |
| `templates`, `templateExercises`              | session plans and their ordered exercises                          |
| `workouts`, `workoutExercises`, `workoutSets` | logged sessions, with name/muscle snapshots                        |
| `measurements`                                | body weight and circumference entries                              |
| `settings`, `barProfiles`, `plateInventories` | preferences and equipment                                          |
| `timers`                                      | the active rest timer, as absolute timestamps                      |
| `importJobs`, `importIssues`                  | import history and row-level problems                              |
| `meta`                                        | schema version and seed bookkeeping                                |

Storage conventions:

- **Mass in grams, length in millimetres, distance in metres, duration in seconds** — all
  integers. Kilograms and pounds exist only in the display layer, so switching units never
  changes a stored number.
- **Timestamps are ISO-8601 UTC**, with a `tzOffsetMinutes` companion and a local
  `YYYY-MM-DD` date so history reads correctly after travel.
- **Snapshots on logged exercises** (name, muscles, equipment, tracking type) keep history
  meaningful after an exercise is renamed, edited or archived.
- **Personal records are derived**, never stored as the source of truth.
- Multi-record writes run in Dexie transactions; archiving never deletes history, and a
  custom exercise that history references cannot be deleted at all.

## Data privacy

Your workouts, measurements and settings stay in this browser's local database. RepForge
makes no network requests after the initial page load: there is no backend, no account, no
analytics and no telemetry. Data leaves the device only when you explicitly export it, and
the export is a file download. Deleting site data (or using Settings → Data → Delete
everything) removes it permanently, so take a backup first.

## Backup, export and restore

**Settings → Data.**

- **Download JSON backup** — a complete, versioned backup (format `repforge-backup`,
  version 1; see [docs/data-format.md](docs/data-format.md)).
- **Download CSV files** — five spreadsheet-safe files: sets, workouts, exercises,
  templates and measurements. Values that begin with `=`, `+`, `-`, `@` or a control
  character are prefixed with `'` so a note cannot execute as a spreadsheet formula.
- **Restore** — choose a JSON backup. It is validated against the schema and previewed
  before anything is written. **Merge** adds what is missing and skips workouts you already
  have; **Replace** wipes local data first and downloads a safety backup before doing so.
- **Delete all local data** — requires typing `DELETE`, then erases everything and re-seeds
  the starter exercise library.

## Strong CSV import

**Settings → Data → Open the import wizard**, or `/settings/import`.

1. Export your data as CSV from the Strong app and save it to this device.
2. Choose the file. RepForge parses it locally — nothing is uploaded.
3. Confirm the column mapping. Recognised headers are matched automatically, case- and
   accent-insensitively; anything unmatched can be mapped by hand.
4. Review the preview: workouts found, rows skipped, row-level errors and warnings, and
   which workouts are already in your history.
5. Import. The whole batch is written in one transaction, so a failure leaves nothing
   behind.

Supported mappings (aliases matched case-insensitively, punctuation and accents ignored):

| Field         | Recognised headers                                              |
| ------------- | --------------------------------------------------------------- |
| Date          | `Date`, `Workout Date`, `Start Time`, `Datum`, `Fecha`          |
| Workout name  | `Workout Name`, `Workout`, `Name`, `Training`, `Entrenamiento`  |
| Duration      | `Duration`, `Workout Duration`, `Dauer`                         |
| Exercise name | `Exercise Name`, `Exercise`, `Übung`, `Ejercicio`               |
| Set order     | `Set Order`, `Set`, `Set Number`, `Set Index`                   |
| Weight        | `Weight`, `Weight (kg)`, `Weight (lbs)`, `Gewicht`, `Peso`      |
| Reps          | `Reps`, `Repetitions`, `Wiederholungen`, `Repeticiones`         |
| Distance      | `Distance`, `Distance (m)`, `Distance (km)`, `Distance (miles)` |
| Seconds       | `Seconds`, `Time`, `Duration (seconds)`                         |
| RPE           | `RPE`                                                           |
| Notes         | `Notes`, `Set Notes`, `Note`                                    |
| Workout notes | `Workout Notes`, `Session Notes`                                |
| Set type      | `Set Type`, `Type`                                              |

Details:

- Comma and semicolon delimiters, quoted commas, embedded newlines, escaped quotes, CRLF
  and a UTF-8 BOM are all handled; `100,5` and `100.5` both parse.
- The weight unit is read from the header when it declares one, and is otherwise yours to
  choose in the wizard.
- Non-set rows (Strong writes things like `Rest Timer` into the set-order column) are
  skipped with a warning and a row number. Unreadable dates and missing exercise names are
  errors, also with row numbers.
- Unmatched exercise names become clearly marked custom exercises with a generic muscle
  group; edit them afterwards to improve muscle-group analytics.
- Re-importing the same file is detected by a content fingerprint per workout and skipped
  by default, with an explicit override.
- Files above 32 MB are refused.

## Capacitor packaging (iOS and Android)

The web build is the app. `capacitor.config.ts` is committed; the native projects are not
(they are in `.gitignore`, since they are generated).

```bash
npm install @capacitor/core @capacitor/cli
npm run build
npx cap add ios          # requires macOS and Xcode
npx cap add android      # requires Android Studio
npm run cap:sync         # copies dist/ into the native projects
npx cap open ios         # or: npx cap open android
```

For rest-timer notifications in a native build, add the local-notifications plugin and
re-sync:

```bash
npm install @capacitor/local-notifications
npm run cap:sync
```

RepForge detects the plugin at runtime. Without it, the web fallback is used and the app
says so rather than pretending a background notification was scheduled.

### iOS alternate app icons

iOS can switch the home-screen icon at runtime through `UIApplication.setAlternateIconName`.
To enable it:

1. Add your icon sets to the iOS asset catalogue as `AppIcon-ember`, `AppIcon-glacier`,
   `AppIcon-moss` and `AppIcon-violet` (the base icon stays `AppIcon`). The source art is
   in `public/icons/`.
2. In `Info.plist`, declare them under `CFBundleIcons` → `CFBundleAlternateIcons`, with
   `UIPrerenderedIcon` set as you prefer.
3. Install a Capacitor plugin that exposes `AlternateIcon.change({ name })` (any plugin
   wrapping `setAlternateIconName` works — RepForge probes for it at runtime).
4. Rebuild. Settings → Appearance → App icon then switches the icon immediately.

Signing is yours to configure: a Capacitor iOS build needs an Apple Developer account, a
team ID and a provisioning profile. Nothing in this repository can supply those, and the
iOS build cannot be produced or verified without them.

## Known platform limitations

Stated honestly, because each one is a platform constraint rather than missing work:

- **PWA home-screen icons are fixed by the manifest.** Choosing an alternate icon in
  Settings is remembered and applied in-app, but an installed PWA keeps the icon the
  platform captured at install time; changing it requires reinstalling. Runtime switching
  works only in a Capacitor iOS build with the plugin above. The app tells you which case
  applies rather than claiming success.
- **There is no reliable background timer on the web.** The rest timer stores an absolute
  end timestamp and recomputes from it, so it is always correct when you come back — but a
  browser cannot wake a suspended tab to fire a notification. Native builds schedule a real
  local notification; on the web the notification only fires while RepForge is open.
- **Vibration is unavailable in iOS Safari.** The setting exists and is honoured wherever
  the Vibration API is implemented.
- **Storage can be evicted.** IndexedDB in a browser is subject to eviction under storage
  pressure, and private browsing may block it entirely. RepForge shows an explained,
  recoverable screen instead of a blank page if the database cannot be opened. Keep
  backups.
- **CSV import depends on your export.** RepForge reads the file you export yourself. If a
  future export changes its columns, the wizard's manual mapping step covers it.
- **Analytics need weighted sets.** Bodyweight, duration and distance work carries no
  external load, so it contributes no tonnage by design. See
  [docs/analytics.md](docs/analytics.md).

## Documentation

- [docs/data-format.md](docs/data-format.md) — JSON backup format and version history.
- [docs/analytics.md](docs/analytics.md) — every calculation rule, in full.

## Licence

Released for personal use. The RepForge name, interface and icon artwork are original to
this project.
