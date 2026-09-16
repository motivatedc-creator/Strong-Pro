# RepForge JSON backup format

A backup is a single UTF-8 JSON file. It contains everything RepForge stores about you and
nothing else: no identifiers beyond the app's own UUIDs, no device information, no
telemetry.

## Envelope

```json
{
  "format": "repforge-backup",
  "version": 1,
  "exportedAt": "2026-09-16T18:22:41.503Z",
  "appVersion": "1.0.0",
  "data": {}
}
```

| Field        | Meaning                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------ |
| `format`     | Always `repforge-backup`. A file without it is rejected.                                                     |
| `version`    | Backup format version (currently `1`). A newer version than the app knows is rejected rather than half-read. |
| `exportedAt` | ISO-8601 UTC timestamp of the export.                                                                        |
| `appVersion` | RepForge version that produced the file.                                                                     |
| `data`       | The payload described below.                                                                                 |

## Payload

`data` holds one array per store, plus the settings object:

| Key                                             | Contents                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------- |
| `exercises`                                     | Every exercise, seeded and custom, including archived ones.       |
| `templates` / `templateExercises`               | Templates and their ordered exercises.                            |
| `workouts` / `workoutExercises` / `workoutSets` | Logged sessions. Discarded workouts are not exported.             |
| `measurements`                                  | Body measurements.                                                |
| `barProfiles` / `plateInventories`              | Equipment definitions.                                            |
| `settings`                                      | The single settings object, or `null`.                            |
| `importJobs`                                    | Import history (file name, timestamps, counts). No file contents. |

### Units inside a backup

Values are stored canonically, exactly as in the database:

| Quantity   | Unit                | Field examples                                                       |
| ---------- | ------------------- | -------------------------------------------------------------------- |
| Mass       | integer grams       | `weightG`, `barWeightG`, `quickIncrementG`, `value` for `bodyweight` |
| Length     | integer millimetres | `value` for every circumference metric                               |
| Distance   | integer metres      | `distanceM`                                                          |
| Duration   | integer seconds     | `durationSeconds`, `restSeconds`, `pausedSeconds`                    |
| Time       | ISO-8601 UTC string | `startedAt`, `endedAt`, `recordedAt`, `createdAt`, `updatedAt`       |
| Local date | `YYYY-MM-DD`        | `localDate`                                                          |

A backup taken with the app set to pounds is byte-identical to one taken in kilograms: the
unit is a display preference, not a storage format.

### Referential rules

- `workoutExercises.workoutId` → `workouts.id`
- `workoutSets.workoutExerciseId` → `workoutExercises.id`, and `workoutSets.workoutId` → `workouts.id`
- `templateExercises.templateId` → `templates.id`
- `workoutExercises.exerciseId` and `templateExercises.exerciseId` → `exercises.id`

On restore, RepForge validates the whole file with Zod first, reports any rows whose
parents are missing, and prunes those rows rather than writing dangling references.

## Restore semantics

| Mode        | Behaviour                                                                                                                                                          |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Merge**   | Adds exercises, templates, workouts and measurements whose ids are not already present. Nothing is deleted, and workouts you already have are skipped and counted. |
| **Replace** | Clears every user store, then writes the backup. A safety backup of the current data is downloaded first.                                                          |

Both modes run inside a single transaction.

## Validation and limits

- Files larger than 64 MB are refused.
- Every string field is length-bounded and every numeric field must be finite.
- Unknown extra keys are stripped rather than trusted.
- Imported content is never executed or evaluated; it is only ever read as data.

## Version history

| Version | Change                      |
| ------- | --------------------------- |
| 1       | Initial format (app 1.0.0). |

## Database schema versions

The backup format and the IndexedDB schema version are independent.

| Schema | Change                                                                                                                                                                        |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1      | Initial schema.                                                                                                                                                               |
| 2      | Adds the `[exerciseId+workoutId]` index on `workoutExercises` and an `updatedAt` index on `workouts`; backfills `pausedSeconds` and `updatedAt` on workouts created under v1. |
