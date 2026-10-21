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
