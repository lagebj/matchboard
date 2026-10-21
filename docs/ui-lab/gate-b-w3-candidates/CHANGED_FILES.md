# B06 — Changed files

## Gate B candidate routes and fixtures (all new)

- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/league/before/page.tsx`, `fixtures.ts`, `__tests__/*`
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/league/after/page.tsx`, `fixtures.ts`, `__tests__/*`
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/event/before/page.tsx`, `fixtures.ts`, `__tests__/*`
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/event/after/page.tsx`, `fixtures.ts`, `__tests__/*`

## B06-local shared component (new)

- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/shared/compare-nav.tsx` — the
  cross-candidate comparison nav strip (UI-Lab-local only, not production).

## Shared Gate B fixture module (additive extension only)

- `src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` — appended a new "B06" section
  (League and Event match identities, squad/participant fixtures, the real
  `buildPlanningPitchAssignments` projection helper for Event). No existing B01-B05 export
  modified.

## Gate B index (additive)

- `src/app/dev/ui-lab/gate-b/page.tsx` — appended four `SCENARIOS` entries and updated the
  deferred-scope blurb from "B06 ... deferred" to "B06 (W3) ... implemented."

## Documentation (this directory, all new)

- `docs/ui-lab/gate-b-w3-candidates/{BLOCKERS,CHANGED_FILES,CURRENT_STATE_AUDIT,
  DATA_TRUTH_AND_FIXTURES,INTERACTION_AND_STATE_AUDIT,REVIEW_RECORD,SCENARIO_REGISTER,
  SOURCE_RECONCILIATION,THREE_PART_EXPERIENCE_CONTRACT,VISUAL_VS_CURRENT}.md`,
  `candidate_manifest.json`.

## Repository hygiene (unrelated, pre-existing)

- Removed a stray, untracked, empty local directory (`docs/development/gate-a-w1-review`) that
  predated this branch and was not tracked by git — confirmed via `git stash` against `main`'s
  own HEAD before touching it. No tracked content was removed. Not a code or doc change; recorded
  here only because it changed `npm run docs:check`'s local output.

## Phase 2 fixes (CI capture findings — this wave's own code, not production)

- `scripts/ui-lab-visual-review.mjs` — registered the four B06 scenarios (the capture script's
  scenario list is explicit, not auto-discovered); the first capture run silently produced zero
  B06 captures without this.
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/event/after/page.tsx` — added the missing
  `"use client"` directive (RSC serialization violation, crashed the second capture run on this
  exact page). See BLOCKERS.md for both.

## CI capture attestation (new, added after both fixes)

- `docs/ui-lab/gate-b-w3-candidates/capture-attestation.json` — real run
  https://github.com/lagebj/matchboard/actions/runs/39637600700, 40 captures, every SHA-256
  independently re-verified against the downloaded artifact's raw bytes.
- `docs/ui-lab/gate-b-w3-candidates/candidate_manifest.json` — updated the top-level `note` with
  the real run/head-sha/capture-count reference (`approval` stays `null` on every scenario —
  owner review has not happened yet).
