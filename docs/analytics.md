# RepForge analytics rules

Every number in RepForge is recomputed from your stored sets when a screen opens. No
aggregate is persisted as a source of truth, so editing or deleting a workout immediately
and correctly changes everything derived from it, including personal records.

The implementations are `src/domain/oneRepMax.ts`, `src/domain/volume.ts`,
`src/domain/records.ts` and `src/features/analytics/compute.ts`.

## What counts as a set

A set is included when it is **completed**. Warm-up sets are **excluded by default**; the
toggle is in Settings → Analytics and can be overridden per view on the Analytics screen.
Drop sets and sets taken to failure always count as working sets.

## Estimated 1RM

Two formulas, selectable globally and overridable on the Analytics screen:

- **Epley** — `weight × (1 + reps / 30)`
- **Brzycki** — `weight × 36 / (37 − reps)`

Rules:

1. A set needs a positive load and at least one rep. Zero-load and bodyweight sets produce
   no estimate rather than a misleading zero.
2. At exactly one rep the load is taken at face value, not extrapolated.
3. Fractional reps are truncated.
4. Sets above **12 reps are excluded** from estimated 1RM for both formulas. Higher-rep
   work remains in volume, set and rep totals, where it is useful without pretending the
   estimate is precise.
5. Each plotted point is the **best** estimate from that session; the tooltip shows the
   set it came from and the formula used.
6. Estimates are computed in canonical grams, so kg/lb display never changes the result.

## Volume and tonnage

**Volume (tonnage) = weight × reps**, summed over eligible completed sets.

| Tracking type          | Tonnage contribution | Counted instead as             |
| ---------------------- | -------------------- | ------------------------------ |
| Weight & reps          | `weight × reps`      | —                              |
| Reps only (bodyweight) | none                 | `repsOnlySets`, total reps     |
| Duration               | none                 | `durationSeconds`              |
| Distance & time        | none                 | `distanceM`, `durationSeconds` |
| Assisted               | none                 | `assistedSets`                 |

Assisted exercises record the assistance removed from bodyweight, not the load lifted, so
including them would be actively wrong. Bodyweight and cardio work carries no external
load; RepForge reports it separately rather than inventing a number for it.

A set is counted exactly once, even when the same exercise appears twice in a session.

Aggregation is available per exercise, per workout, per ISO week (Monday start) and per
calendar month.

## Muscle-group attribution

A **different** measure from tonnage, and labelled as such everywhere it appears:

- The primary muscle of an exercise receives **1.0** of a set's volume.
- Each distinct secondary muscle receives a configurable fraction, **0.5** by default
  (Settings → Analytics, clamped to 0–1).
- A muscle listed as both primary and secondary is credited once.

Because secondary muscles add credit, attributed volume across all muscles deliberately
sums to more than the weight you actually moved. It never feeds the overall tonnage total.

Exercises without a trusted mapping appear in an explicit **Unmapped** row. Editing that
exercise in Library updates its historical workout snapshots, so the attribution becomes
useful without rewriting the workout itself.

## Records

Derived on read, for each exercise, from completed non-warm-up sets with a positive load
and at least one rep:

| Record             | Definition                                                                           |
| ------------------ | ------------------------------------------------------------------------------------ |
| Heaviest weight    | Greatest load lifted                                                                 |
| Best estimated 1RM | Highest estimate under the active formula                                            |
| Best set volume    | Greatest `weight × reps` in a single set                                             |
| Rep records        | Heaviest load lifted for **at least** N reps, for N in 1, 2, 3, 5, 8, 10, 12, 15, 20 |

The workout summary flags sets that beat everything logged before them, and earlier sets
in the same session raise the bar for later ones.

## Time ranges and comparisons

Ranges are This week, 4 weeks, 8 weeks, 12 weeks, 6 months, 1 year and all time. This week
starts on Monday; rolling ranges use exact week lengths. Where a comparison is shown, it
is against the immediately preceding window of the same length; with no prior data the app
says "no prior period" instead of showing a fake 0%.

## Charts

Every chart carries a text summary (always read by screen readers) and a data table that
can be revealed with a button, so no information exists only as pixels. Series values are
computed before rendering; nothing is calculated inside a chart component. Points use a
real time-scaled horizontal axis. All-time views aggregate by calendar month; shorter
ranges aggregate by ISO week.
