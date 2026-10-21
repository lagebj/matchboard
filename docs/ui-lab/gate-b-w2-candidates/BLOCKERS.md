# Gate B W2 — Blockers and Open Items

## Authorization basis

The official register's B05 row remains `NOT_READY`/`DIRECTIONAL_ONLY` — unchanged by this wave,
same as every other Gate B row. This wave was picked up at the repository owner's explicit
direction given directly in session ("Start Gate B B05"), after the ADR-0159 governance
correction (PR #802, then the Stage B ruleset activation and its own doc PR #804) was reviewed
and merged. Not an inference from the register's own status fields.

## `25_OFFICIAL_GOLDEN_WAVE_REGISTER.csv` not independently re-read this session

The bundle directory Gate B W1 read it from
(`.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/`) is not present
on this machine — gitignored working documents. B05's row text is reproduced from
`docs/ui-lab/gate-b-w1-candidates/SCENARIO_REGISTER.md`'s own committed, already-verified
verbatim quote of the same row, cross-checked against the task's own quoted row text (identical
wording). See `SOURCE_RECONCILIATION.md`. Flagging this explicitly rather than presenting the
register row as freshly re-verified against the original CSV.

## Local capture not attempted — same disclosed limitation as every prior UI Lab wave

This sandbox's local `next dev` + browser automation cannot complete hydration (HMR WebSocket
upgrade failure, reproduces on an untouched page too — project memory
`project_devcontainer_hmr_websocket_blocks_playwright`), so no local capture was ever attempted.
Real capture evidence comes from this PR's own CI run of `ui-lab-visual-review.yml`, added once
CI is green — see `REVIEW_RECORD.md` for the plan and `candidate_manifest.json`/
`capture-attestation.json` once committed.

## Three real production components substituted with a stub inside this wave's own Vitest tests

`PostMatchPage`, `FootballObservationSection`, and `ObservationSection` each statically import
real `"use server"` action modules that transitively import `@/lib/auth/actor-context` →
`next-auth`, which fails to resolve (`Cannot find module '/workspaces/matchboard/node_modules/
next/server' imported from .../next-auth/lib/env.js`) specifically inside this project's
Vitest+jsdom **component**-test environment — reproduced directly, not assumed, before choosing
to mock them. This is the identical reason the real, pre-existing
`post-match-report-page-shell.test.tsx` already mocks `PostMatchPage` away; this wave's test
files extend the same precedent to the two additional components that share the same import
shape, rather than inventing a new isolation boundary. `PostMatchUnresolvedBanner` is mocked for
a separate, unrelated reason — it calls `indexedDB.open()` directly on mount with no defensive
guard, and this project's component-test setup (`src/test/setup-component.ts`) does not currently
configure `fake-indexeddb` (a listed dependency, but not wired into this test entrypoint).

All four components are real and fully exercised in the actual rendered page — both the live dev
server (where `next-auth`/IndexedDB resolve normally) and the CI capture script's real browser
run. Only this wave's own Vitest unit-test coverage of those specific four components' rendered
output is narrower than the rest of the page, disclosed here and in
`DATA_TRUTH_AND_FIXTURES.md`/`CURRENT_STATE_AUDIT.md` rather than silently left unexplained.
Wiring `fake-indexeddb` into `setup-component.ts` (if the owner wants
`PostMatchUnresolvedBanner` covered directly in a future wave) and/or giving the Vitest config an
alias/mock for the `next-auth` import chain (if the owner wants `PostMatchPage`/
`FootballObservationSection`/`ObservationSection` covered directly) are both small, separate,
cross-cutting test-infrastructure changes — out of scope for a UI Lab candidate PR to make on its
own initiative.

## Design exploration found no gap to fix (recorded, not silently assumed)

Unlike Gate B W1 (two real findings: an invented `DecisionBanner`, and a genuine `MatchFlowPanel`
refinement), reading the real Post-Match Report composition directly against B05's register
language found no gap — see `VISUAL_VS_CURRENT.md`. Recorded explicitly so a future reader does
not mistake the absence of a finding for the audit not having been performed.

## Known scope reduction (not a gap — a logged choice)

B05 does not exercise the Assistant Coach knowledge tier (see
`THREE_PART_EXPERIENCE_CONTRACT.md`) — Post-Match Report's Summary tab has no such surface in
real production today. B07 (deferred) is where that tier belongs for this family.
