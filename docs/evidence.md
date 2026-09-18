# Research evidence layer

Lock’d ships research-informed defaults (notably the 10–20 weekly credited-set band). Those defaults, plus related heuristics and formulas, live in `src/domain/evidence/` so Data Lab, help copy, and future Ask the Lab share one inspectable source of truth.

## Kind labels

| Kind | Meaning |
|------|---------|
| `evidence_backed_default` | Product default with partial literature support |
| `implementation_heuristic` | Product rule; not established scientific fact |
| `user_editable_personal` | User override (personal targets) |
| `pure_calculation` | Arithmetic / named formula |

## Stability note

The 10–20 research band is **kept stable** even though the literature does not cleanly underwrite a discrete upper bound of 20. Changing it would silently rewrite users’ personal training against that band. Flag discrepancies in PR text; do not silently “fix the science” by moving the default.
