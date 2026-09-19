PROJECT
This project is a free, local-first strength-training logger for people who lift for years. It records what happened, keeps history honest, and shows whether training is actually moving. It is not a wellness app, social network, coaching marketplace, hype brand, or an AI chat with a logger attached.

Current user-facing identity: Lock’d (spoken), LOCKD (wordmark), Lockd (app chrome / PWA / title), lockd (code). Tagline: Keep the receipt. Meaning: the session is on this device and the record does not get rewritten.
Internal / legacy names (RepForge, Strong-Pro, Certified) may appear in repos, files, or old prompts. Do not put them in new UI copy. Do not imply affiliation with Strong. Strong exists only as a local CSV import source.

Code home: GitHub repo motivatedc-creator/Strong-Pro is the production source of truth. Mock UIs and Sites builds are interaction reference only.

NON-NEGOTIABLES
- No accounts, ads, subscriptions, feature gates, backend, cloud sync, telemetry, analytics SDK, or public API.
- After first load, core flows work offline.
- Workout and body data leave the device only when the user exports a file.
- Fast in the gym: one-handed, 44px targets, previous-session ghosts in empty fields, one tap completes a set (typed values win) and can start the rest timer.
- Numbers are derived on read. Do not persist PRs or aggregates as source of truth.
- Canonical storage: mass in grams, length in mm, distance in metres, duration in seconds — integers. Units are display-only.
- Domain math lives in domain modules. UI does not write the database directly. Feature code talks to a repository interface.
- User-facing word is Routine. Internal types, routes, and backup fields may stay Template. Do not migrate storage to rename a noun.
- Accessibility is product: labels, chart text + tables, non-color status, reduced motion.
- Destructive data actions confirm, explain, and prefer a safety backup.

WHAT THE PRODUCT IS (NOW)
Today / active workout, Routines, History, Analytics, Library, Measurements, plate calculator, warm-up generator, Settings, JSON backup, formula-safe CSV export, validated restore (merge/replace), Strong CSV import (local, preview, transactional, fingerprint skip).
Analytics must stay honest: completed working sets; warm-ups excluded by default; e1RM Epley or Brzycki, null above 12 reps or with no load; tonnage = weight × reps for loaded sets only; bodyweight / assisted / duration / distance reported separately; muscle attribution is not tonnage; unmapped imports are Unmapped, not silently “full body.”
Nav: Today, Routines, History, Analytics, Library, Settings.

NEXT vs LATER
Next may include a deterministic, offline weekly verdict with inspectable evidence. No model call. No network.
Later / not this product: programs-as-a-platform, social, coaches, creator drops, fake bodyweight tonnage, second storage layer, accounts.

HOW THIS PROJECT RUNS
The founder talks to the Product Manager first for anything product: features, cuts, priorities, “should we.”
PM job: turn chaos into a queue. Restate the ask. Split problem vs solution. Bucket Now / Next / Later / No. Write the smallest spec that can be built. Protect the core loop and number honesty.
Other bots exist only when they own a repeating job with a clear output. Nobody adds a bot because it sounds like a company. PM may recommend a specialist only with: role, job, why not the founder/PM, what good looks like, what it must not do, now/later/never.

HOW EVERY BOT SHOULD BEHAVE
- Read this file before inventing process or product.
- Decision first, then why, then next step. No cheerleading. No fake users or metrics.
- Do not expand scope in a brand or polish pass.
- Do not copy another app’s source, artwork, wording, or trade dress.
- Prefer existing architecture (React / Vite / Dexie / repository seam / PWA / Capacitor) over a rewrite.
- If two interpretations exist, pick the one that keeps logging faster or numbers more honest.
- If a request would ship cloud, accounts, or dishonest stats, refuse and offer the closest in-doctrine alternative.

SUCCESS
A lifter can finish a set without thinking about the app. History stays on the device. Every number can be explained. Every extra bot on the team is earning its place.

## Claude Code subagents

Delegate. Do not impersonate them in the main thread.

- product-manager — any "should we", feature, cut, rename
- domain-truth — any number in Data Lab / verdict / flags / Ask the Lab
- session-logger — anything between sets
- data-portability — schema, backup, import, restore, delete
- gym-ui — layout, a11y, chrome density (Atlas still owns brand marks and voice)
- verify-gate — after the patch, before you call it done