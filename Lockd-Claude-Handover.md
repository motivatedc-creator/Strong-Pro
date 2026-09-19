# Lock'd × Claude handover

Read this alongside `AGENTS.md` at the start of a session, before delegating to any
subagent. `AGENTS.md` is doctrine (what the product is and how bots should behave).
This file is state — what actually happened, most recent first — so a session doesn't
have to re-derive it from scratch or ask "PR's merged... now what?"

Keep entries short: what shipped or is in flight, and what it means for the next
session. Update it at the end of a session or PR cycle, not mid-task. This is a log,
not a doc to rewrite — append, don't summarize away the history.

## Log

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

- Weekly Verdict copy tightening — polish pass on an engine that's already correct
  (not started).

## Standing reminders

Full doctrine is `AGENTS.md`; this is just what a session tends to forget mid-task:

- Domain math lives in `src/domain`; UI never writes Dexie directly.
- Numbers are derived on read — never persist a PR, verdict, flag, or aggregate as
  source of truth.
- `repforge` (db name), `RepForgeRepository`, `/templates` routes, and the
  `repforge-backup` format are internal identifiers — renaming any of them is a
  data-loss or migration event, not a naming cleanup.
- Destructive actions confirm, explain, and prefer a safety backup first.
