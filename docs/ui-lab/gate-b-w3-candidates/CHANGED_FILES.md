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

## CI capture attestation

Not included in this commit — `capture-attestation.json` will be added once
`ui-lab-visual-review.yml` produces a real run against this PR's revision, matching the
established two-commit pattern (see BLOCKERS.md).
