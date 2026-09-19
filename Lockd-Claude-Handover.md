# Lock'd × Claude handover

Read this alongside `AGENTS.md` at the start of a session, before delegating to any
subagent. `AGENTS.md` is doctrine (what the product is and how bots should behave).
This file is state — what actually happened, most recent first — so a session doesn't
have to re-derive it from scratch or ask "PR's merged... now what?"

Keep entries short: what shipped or is in flight, and what it means for the next
session. Update it at the end of a session or PR cycle, not mid-task. This is a log,
not a doc to rewrite — append, don't summarize away the history.

## Log

### 2026-09-19 — Per-set rep targets in the active workout (PR #26)

Ran end to end through the subagent chain: `session-logger` implemented, `verify-gate`
signed off MERGE, no fixes needed. Exercise header shows the Routine's prescription
(`3 × 8–12`) when the workout has a `templateId` and a matching `TemplateExercise`
with both rep bounds; otherwise the slot doesn't render. Each completed set row shows
hit/under/over against the range as icon + text, never color alone. New pure helper
`src/features/workouts/targetPrescription.ts` (`resolveExerciseTarget`,
`classifySetReps`, `formatTarget`) — everything derived on read via the existing
`repo.getTemplateDetail`, no schema/migration, no input prefill, no analytics coupling.
Not verified: a real 320px screenshot pass (the new markup reuses layout already
proven at that width elsewhere on the page, but nobody looked at a live narrow
viewport) — worth a `gym-ui` pass if it ever looks off in practice.

### 2026-09-19 — Weekly Verdict copy tightening (PR #25)

Ran through the new subagent chain end to end: `product-manager` scoped it (caught a
bare "Good." violating the no-cheerleading rule), founder confirmed one judgment call
(collapse down/well_down band phrasing to match), `domain-truth` implemented,
`verify-gate` signed off. Copy-only — no logic touched, 344 tests unchanged in count
before the next PR added more.

### 2026-09-19 — Six project subagents (PR #23)

Added `product-manager`, `domain-truth`, `session-logger`, `data-portability`,
`gym-ui`, `verify-gate` to `.claude/agents/`, plus the delegation section in
`AGENTS.md`. Spec came from an external report; implemented near-verbatim after
checking every referenced path/type name against the actual tree.
Not created: `Atlas` (brand / Lock'd chrome) — already justified and lives outside
this repo; not duplicated into `gym-ui`.
This file didn't exist yet, even though the wiring notes assumed it — it's the gap
this entry closes.

### 2026-09-19 — Exercise matching, preset routines, goal lifts (PR #22)

Three tickets, sequenced by root-depth:

1. Strong CSV import matching was exact-string-only against an 84-exercise seed
   library, so most of a real import landed as `Unmapped`/`Custom`. Added a
   token-overlap candidate pass surfaced as a new "Resolve exercises" wizard step
   (never merges silently — user confirms), grew the seed library, added a Bulk
   Classify page for exercises already unmapped from past imports.
2. Preset routines were all muscle-split. Added Upper/Lower, Low-Impact Full Body,
   Athletic Conditioning, grouped by category in the sheet.
3. Weekly Verdict's "goal lifts" were silently inferred with no way to see or change
   them. Added `AppSettings.goalLiftIds`, a `GoalLiftPicker` sheet (Settings + the
   verdict card), and `resolveGoalLifts` so a pick always wins over the inferred
   guess and the card says which it's using.

### 2026-09-19 — Rest timer clears on workout end (PR #21)

Finishing or discarding a workout deleted the timer row in Dexie but never cleared
the zustand store, so the rest timer bar kept counting and chiming after the session
ended. Added `stopForWorkout(id)` to the timer store, wired into both handlers.

## Queued next

Empty — no in-flight or committed-to work. Candidates not yet decided (unilateral/
flexible fields, goal lenses, PR moments/share cards, Ask the Lab's LLM layer) are
listed for the next `product-manager` pass, not accepted tasks.

## Standing reminders

Full doctrine is `AGENTS.md`; this is just what a session tends to forget mid-task:

- Domain math lives in `src/domain`; UI never writes Dexie directly.
- Numbers are derived on read — never persist a PR, verdict, flag, or aggregate as
  source of truth.
- `repforge` (db name), `RepForgeRepository`, `/templates` routes, and the
  `repforge-backup` format are internal identifiers — renaming any of them is a
  data-loss or migration event, not a naming cleanup.
- Destructive actions confirm, explain, and prefer a safety backup first.
