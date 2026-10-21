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

## CI capture attestation (committed after the two fixes above — now historical, see below)

- `docs/ui-lab/gate-b-w3-candidates/capture-attestation.json` — real run
  https://github.com/lagebj/matchboard/actions/runs/39637600700, 40 captures, every SHA-256
  independently re-verified against the downloaded artifact's raw bytes. Superseded as current
  evidence by the retrospective remediation below (League/Event · After's fixture content
  changed); preserved as the historical record of that run.

## Retrospective remediation (B3-R1 through B3-R7)

- `scripts/ui-lab-visual-review.mjs` — added a coverage-completeness check (B3-R1): the capture
  run now fails if any registered scenario produces zero captures, instead of silently
  succeeding the way the original B06 capture attempt did.
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/league/after/{page.tsx,fixtures.ts}` —
  removed the link to the B05 candidate (B3-R2, different match); corrected reference time
  (B3-R4, `B06_LEAGUE_AFTER_REFERENCE_AT`); removed filenames/function names/route syntax from
  rendered copy (B3-R6); added a real link to the new League Match Details page (B3-R5).
  `fixtureVersion` bumped to 2 in `candidate_manifest.json` (hash unchanged — only `identity`'s
  own clock field changed, which is outside `rawRecordsForHash`'s scope).
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/event/after/{page.tsx,fixtures.ts}` —
  reassigned the football observation off the Guest Player (B3-R3); corrected reference time
  (B3-R4, `B06_EVENT_AFTER_REFERENCE_AT`); corrected combination evidence to the real per-match
  derivation rules (B3-R7, `opponentDiversity: 1`); removed filenames/function names/literal
  code/route syntax from rendered copy, including the `revalidatePath()` mischaracterization
  (B3-R6); added a real link to the new Event Detail page (B3-R5). `fixtureVersion` bumped to 2;
  new `fixtureSha256` (the fixture content genuinely changed).
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/league/before/page.tsx`,
  `event/before/page.tsx` — removed filenames/function names/route syntax from rendered copy
  (B3-R6); added real links to the new navigation pages (B3-R5). No fixture data changed.
- `src/app/dev/ui-lab/gate-b/shared/match-b-fixture.ts` — added
  `B06_LEAGUE_AFTER_REFERENCE_AT`, `B06_EVENT_AFTER_REFERENCE_AT`. No existing export's value
  changed.
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/league/match-details/{page.tsx,__tests__/page.test.tsx}`
  (new, B3-R5) — a real, fixture-backed stand-in for League Match Details: this match's own real
  origin/return point, separate from `CompareNav`.
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/event/event-detail/{page.tsx,__tests__/page.test.tsx}`
  (new, B3-R5) — the same for Event Detail's Matches tab.
- `src/app/dev/ui-lab/gate-b/page.tsx` — registered the two new navigation pages, labelled
  explicitly as "navigation origin, not a comparison candidate."
- `docs/ui-lab/gate-b-w3-candidates/{BLOCKERS,SOURCE_RECONCILIATION,CURRENT_STATE_AUDIT,
  candidate_manifest}.*` — remediation sections added; the `revalidatePath()`-as-navigation
  documentation error corrected to the real mechanism (`LiveMatchClient`'s `reportUrl` callback +
  `window.location.href`).
- `docs/ui-lab/gate-b-w2-candidates/` — B05's own retrospective remediation; see that
  directory's own `CHANGED_FILES.md`.

## CI capture attestation — fixtureVersion 2 (regenerated after this remediation commit)

- `capture-attestation.json` — rewritten: top-level content is now the real CI run
  `39657393171` (branch head `568096efc`), 40 captures, every SHA-256 independently re-verified.
  The pre-remediation run (`39637600700`) is preserved unmodified under this file's own
  `priorVersions[0]` for traceability only (never approved, nothing inherited from it).

## Second retrospective remediation (B5/R2, B5/R6, B5/R7)

- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/event/after/fixtures.ts` —
  `debriefAnswers.player_observations` reassigned off William (the Guest Player) to Theodor,
  matching `footballObservations` (B5/R2 — the B3-R3 reassignment covered only one of the two
  real evidence paths into `createFootballObservations()`); combination row `subtype` corrected
  from `HORIZONTAL` to `VERTICAL` (B5/R6 — Noah/CF and Sindre/LCM are different lines).
  `fixtureVersion` bumped 2 -> 3; new `fixtureSha256` (the fixture content genuinely changed).
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/event/after/__tests__/fixtures.test.ts` —
  extended: both evidence paths now asserted eligible-participant-only (B5/R2); the `VERTICAL`
  subtype directly asserted (B5/R6).
- `src/app/dev/ui-lab/gate-b/b06-league-event-parity/event/after/__tests__/combination-evidence.test.ts`
  (new) — verifies the fixture's combination row against the real, unmodified
  `deriveCombinationsFromSegments()` with constructed segments/goal events for this exact match.
- `scripts/ui-lab-visual-review.mjs` — registered `league/match-details` and `event/event-detail`
  (B5/R7 — a real capture-coverage gap: both pages existed since B3-R5 but were never registered,
  so they had zero real capture evidence despite being linked from every Before/After page);
  also registered B05's own new `match-details` page (see
  `docs/ui-lab/gate-b-w2-candidates/CHANGED_FILES.md`).
- `docs/ui-lab/gate-b-w3-candidates/{BLOCKERS,SOURCE_RECONCILIATION,candidate_manifest}.*` —
  B5/Rx remediation sections added.

No production code is touched by this second pass.
