# B06 — Blockers and disclosures

## Authorization basis

Picked up directly from the Gate B W3 coding-agent mission brief (B06, League/Event match
parity), which names the scenario, the required-read ADR set, and explicitly forbids starting
production migration, B07, B08, or Gate C in this PR.

## Register CSV not independently re-read this session

The original `.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/
programme_v054/25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` is not present in this checkout. The B06
row is recovered verbatim from `docs/ui-lab/gate-b-w1-candidates/SCENARIO_REGISTER.md`'s own
extract instead — see SOURCE_RECONCILIATION.md.

## Local capture not attempted

`next dev` + Playwright cannot hydrate in this sandbox (HMR WebSocket upgrade fails/retries
forever) — a pre-existing, environment-specific limitation that reproduces on untouched,
already-approved W1 pages too, not something introduced by this wave. Real visual capture comes
from CI's `ui-lab-visual-review.yml` job once this PR is opened, matching every prior Gate A/B
wave.

## Real CI capture — now generated and committed

`capture-attestation.json` is committed, in a follow-up commit after the candidate code — the
same two-commit pattern B01-B05 already established. Real run:
https://github.com/lagebj/matchboard/actions/runs/39637600700, `reviewedBranchHeadSha`
`1c185cc01f8a6ee46f958792e0b04e8105f86b05`, 40 captures across the four scenarios (desktop/
mobile/narrow/gb-360/gb-430 × dark/light each), every SHA-256 independently recomputed from the
downloaded artifact's raw PNG bytes — zero mismatches against the artifact's own manifest.json.

**Superseded by the B06 remediation (B3-R1 through B3-R7) below.** That run's 40 captures
reflected the pre-remediation fixture content; they are preserved unmodified under
`capture-attestation.json`'s own `priorVersions[0]` for traceability (never approved, so nothing
is inherited from them). The file's top-level content is now the remediated revision's own real
capture: run https://github.com/lagebj/matchboard/actions/runs/39657393171,
`reviewedBranchHeadSha` `568096efc0f2d89b85eaaa90ad4b2fedf0b16612`, still 40 captures across the
same four scenarios, same independent re-verification process, zero mismatches, zero missing
files. This run also exercises B3-R1's new coverage-completeness check
(`scripts/ui-lab-visual-review.mjs`'s `completedAllScenarios` guard) — all registered Gate A and
Gate B scenarios (53 total) produced at least one capture.

## Two real bugs found by this wave's own CI capture — fixed

- **Capture script never registered B06** (`scripts/ui-lab-visual-review.mjs`): the script's
  scenario list is explicit, not auto-discovered from `gate-b/page.tsx`'s `SCENARIOS` array. The
  first capture run (39621025751, commit 539baf7e4) completed successfully but produced zero B06
  captures, silently. Fixed by registering the four B06 routes (commit 38e18abc5), reusing the
  existing `gbExtraSmokeViewports` set.
- **Event · After was missing `"use client"`**: it is a Server Component passing real functions
  (`PostMatchReportShell`'s `actions` object, `onChanged`) to a Client Component — an RSC
  serialization violation, invisible to Vitest+RTL component tests (which render React trees
  directly with no RSC boundary enforcement) but fatal against a real Next.js server. The second
  capture attempt (39635328177, commit 38e18abc5) crashed on this exact page after successfully
  capturing League Before/After and Event Before, timing out the whole job. Fixed (commit
  1c185cc01) by adding the directive, matching B05's own analogous `completed/page.tsx`.

## Unrelated GitHub platform incident during this PR's CI

Around 2026-10-21T15:00-16:30Z, githubstatus.com reported degraded Webhooks/Pull Requests/
Actions. One push (38e18abc5, the capture-script registration) never triggered CI and never
updated this PR's `head.sha` for roughly an hour, independently confirmed via the GitHub status
API and via `repos/{owner}/{repo}/actions/runs?head_sha=...` returning zero runs for that commit
despite the branch ref itself being correctly updated (`git ls-remote`). Resolved by closing and
reopening the PR (no code or workflow change) to force GitHub to resync the stale PR object.

## Real/mocked component substitutions inside this wave's own Vitest tests

`FootballObservationSection` is mocked to `() => null` in `event/after/__tests__/page.test.tsx`
— it statically imports a real `"use server"` action module that transitively pulls in
next-auth, which fails to resolve in this project's Vitest+jsdom component-test environment. This
is the exact same, already-disclosed blocker `b05-post-match-report/draft/__tests__/page.test.tsx`
works around identically. Real coverage of this component comes from the CI capture run against
the real dev server, where next-auth resolves normally. Everything else in both page tests is
real: `PostMatchReportShell`, `PostMatchDebrief` (its own action imports are dynamic, never
triggered by a read-only fixture), `MatchCombinationEvidencePanel`, `MatchIdentityCard`,
`TouchlinePlanningPitch`, `MatchTimelineList`, `MatchFlowPanel`, `MatchPreparationWidget`.

## Design exploration found no gap requiring a production code fix

Unlike ARR-0034's own browser-verification pass (which found and fixed three real pre-existing
bugs), this wave's audit did not surface a comparable bug in the production code it read. It did
surface one open architectural question (whether Event warrants a dedicated Match Details route)
and one observed, undecided fact (`EventMatchReportPanel`'s `ReportData.teamReflection`/
`opponentObservation`/`notes` fields exist in the type but are not currently rendered by its
`extraSections`) — both recorded in CURRENT_STATE_AUDIT.md / SOURCE_RECONCILIATION.md as
disclosed observations, not filed as GitHub issues or ARRs, since neither is confirmed to be a
defect rather than an intentional, simply undocumented, prior decision.

## Known scope reduction (not a gap — a logged choice)

B06's four candidates present Before/After only, not all six lifecycle stages as separate pages
— Live Reporting is identical shared production code for both origins and is disclosed as a
fact rather than reproduced; the editable-vs-locked distinction is B05's territory and is not
re-demonstrated. See SCENARIO_REGISTER.md's "Scope note" and DATA_TRUTH_AND_FIXTURES.md's "Why
editable-vs-locked is out of scope."

## Retrospective remediation (B3-R1 through B3-R7)

A follow-up technical review (same session that also retrospectively corrected B05/W2) found
and fixed seven further issues in this wave's own candidates:

- **B3-R1**: the capture script's scenario list is now covered by a hard coverage-completeness
  check (`scripts/ui-lab-visual-review.mjs`'s `finally` block) — any registered scenario that
  produces zero captures now fails the whole run, the same class of silent gap that let the
  original B06 capture attempt go green with zero B06 screenshots.
- **B3-R2**: League · After's "Continue report" no longer links to the B05 candidate — B05 is a
  different match (`match-gate-b-05`), and a working link to it would silently swap this match's
  own identity for an unrelated one. Replaced with a non-interactive disclosure.
- **B3-R3**: the one football-development observation in Event · After was reassigned from
  William (the Guest Player) to Theodor (a real `PLAYER`-type participant) — production
  `createFootballObservations()` requires an active canonical `Player`; `PlayerDevelopmentObservation.
  playerId` has no `GuestPlayer` counterpart at all, a boundary ADR-0106 independently verifies.
  William's real, valid lineup/report participation is unchanged.
- **B3-R4**: both AFTER candidates' own reference times were corrected — League · After now uses
  a time after the final whistle (not kickoff); Event · After now uses a time after the real
  completion timestamp (not the Before page's own pre-kickoff "now").
- **B3-R5**: two new fixture-backed navigation pages (`league/match-details`, `event/
  event-detail`) demonstrate the real origin/return context for each origin, separately from
  `CompareNav`'s own reviewer-navigation strip — every Before/After page now links to and from
  its own origin's real context page, not just a generic index.
- **B3-R6**: removed internal filenames, function names, and documentation-file references from
  every coach-facing page's rendered copy (DecisionBanner descriptions, inline notes). The
  underlying citations remain in this doc set and in code comments, never in rendered text.
- **B3-R7**: Event · After's combination evidence corrected to the same real per-match rules as
  B05's own B2-R4 fix (`opponentDiversity: 1`, confidence capped below `ESTABLISHED`,
  `createdAt` after real completion, not before kickoff).

No production code was touched for any of these — all seven are UI-Lab-local fixture/page
corrections. See `SOURCE_RECONCILIATION.md` for the verification detail behind B3-R3/R7 and
`CHANGED_FILES.md` for the exact file list.

## Second retrospective remediation (B5/R2, B5/R6, B5/R7)

A further independent technical review found two more real findings — both in Event · After's
own fixture, surviving the first B3-Rx pass above — plus one real capture-coverage gap:

- **B5/R2**: the B3-R3 reassignment was incomplete. `footballObservations` had been moved off
  William, but `debriefAnswers.player_observations` — a SECOND real path into the identical
  `createFootballObservations()` call — still named him. Corrected (reassigned to Theodor,
  matching `footballObservations`). See `SOURCE_RECONCILIATION.md`.
- **B5/R6**: the Noah+Sindre combination row's `subtype` was `HORIZONTAL`; the real
  `derivePartnershipSubtype()` returns `VERTICAL` for a CF (line `ATT`) + LCM (line `MID`) pair
  (different lines). Corrected and verified against the real derivation function directly. See
  `SOURCE_RECONCILIATION.md`.
- **B5/R7 (real capture-coverage gap found and fixed)**: B3-R5's two new navigation pages
  (`league/match-details`, `event/event-detail`) were never registered in
  `scripts/ui-lab-visual-review.mjs`'s scenario list — they had zero real CI capture evidence
  despite being linked from every Before/After page, and the B3-R1 coverage-completeness check
  only catches a REGISTERED scenario producing zero captures, not a page that was never
  registered at all. Fixed in this same pass: both pages (plus B05's own new `match-details/`
  page) are now registered and captured.

Both B5/R2 and B5/R6 changed Event · After's own fixture DATA — `fixtureVersion` bumped 2 -> 3,
new `fixtureSha256`. The other three B06 candidates are unaffected and keep their own existing
version.

## Third retrospective remediation (R8-3) — Event · After only

A fourth independent technical review found the B5/R6 combination-evidence derivation test's
source records (positional segment, goal-attribution events) lived only inside the test file,
outside this fixture's own hash. Corrected: a new `event/after/combination-source-data.ts` module
— reusing `b06EventParticipants` (`shared/match-b-fixture.ts`) directly, never a second roster —
is the single canonical source both `combinationEvidence` (now COMPUTED via the real
`deriveCombinationsFromSegments()`) and its derivation test import. William (the Guest Player) is
excluded from the positional segment entirely, so he cannot acquire partnership evidence this way
either. See `SOURCE_RECONCILIATION.md`.

`fixtureVersion` bumped 3 -> 4 for Event · After only; new `fixtureSha256`. The other three B06
candidates are unaffected.
