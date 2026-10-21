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

## Real CI capture — not yet generated

This commit does not include `capture-attestation.json`. Once this PR is pushed and
`ui-lab-visual-review.yml` produces a real run, a follow-up commit will add
`capture-attestation.json` with the real run id, artifact id, and independently re-verified
SHA-256 hashes for every capture, and will fill in `candidate_manifest.json`'s
`baselineAssetRef` with the real artifact reference where applicable — the same two-commit
pattern B01-B05 already established (feature PR, then a capture/approval-recording follow-up).

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
