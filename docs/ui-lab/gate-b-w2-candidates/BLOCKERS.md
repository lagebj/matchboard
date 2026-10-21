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

## Real CI capture — now generated and committed (after the B2-R1 fix)

`capture-attestation.json` in this directory is real, generated from this PR's own passing CI
run of `.github/workflows/ui-lab-visual-review.yml` (run `39593337123`, branch head `1b91b7cb6` —
the commit after the B2-R1 fix; the first attempt, run `39590822709` against commit `059b857ea`,
failed on exactly that finding): **24 captures** across B05 (draft, 14 — 10 initial + 4
`completed-transition` on desktop/mobile) and B05-COMPLETED (10, all `initial`), downloaded via
`gh run download`, every SHA-256 independently recomputed from the raw PNG bytes and cross-checked
against the artifact's own self-reported `manifest.json` — zero mismatches, no missing files.
`candidate_manifest.json` remains `status: "CANDIDATE"` with `approval: null` for both entries —
a passing capture is evidence, not owner sign-off.

**Superseded by the fixtureVersion 2 remediation below.** This section describes capture evidence
for fixtureVersion 1's now-corrected content; it is preserved unmodified under
`capture-attestation.json`'s own `priorVersions[0]` for traceability of the approval record it
belongs to (see the fixtureVersion 2 section). The file's top-level content is now fixtureVersion
2's own real capture: run `39657393171` (branch head `568096efc`), still 24 captures, same
independent-verification process, zero mismatches, zero missing files.

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

## Real pre-existing bug found by this wave's own CI capture — fixed (B2-R1)

This PR's own first CI run of `ui-lab-visual-review.yml` failed: the draft scenario's real,
browser-rendered page produced 5 React console errors — "In HTML, `<div>` cannot be a descendant
of `<p>`" and "`<p>` cannot be a descendant of `<p>`" — a genuine invalid-HTML-nesting hydration
warning in **real production code**, `src/components/matches/recovered-timing-callout.tsx`.
Root cause: `DecisionBanner` renders its `description` prop inside its own `<p>`
(`decision-banner.tsx`), but `TimingReviewItemBanner`'s `description` passed a `<div>` wrapping
two `<p>` elements — invalid HTML regardless of framework, and a real React hydration mismatch.
This is a genuinely pre-existing bug (not introduced by this wave): `recovered-timing-callout.tsx`
was never previously exercised, in a real browser, with a non-empty `needsReview` item by any
prior UI Lab wave (B01-B04 never rendered this component at all) — the component's own Vitest
test (`recovered-timing-callout.test.tsx`) never asserted on console output, so it never caught
this. **Fixed on this branch**: `description`'s inner `<div>`/`<p>` elements changed to `<span>`
(valid phrasing content inside a `<p>`), preserving the exact same visual layout/copy —
`recovered-timing-callout.test.tsx`'s own existing assertions (text-content based, not tag-based)
pass unchanged, confirming no behavior change beyond the fixed nesting. This is the one real
production file this wave touches — correcting the "no production code touched" framing in the
PR description/commit message, which was accurate at the time it was written but not after this
fix.

## Design exploration found no gap to fix (recorded, not silently assumed)

Unlike Gate B W1 (two real findings: an invented `DecisionBanner`, and a genuine `MatchFlowPanel`
refinement), reading the real Post-Match Report composition directly against B05's register
language found no gap — see `VISUAL_VS_CURRENT.md`. Recorded explicitly so a future reader does
not mistake the absence of a finding for the audit not having been performed.

## Known scope reduction (not a gap — a logged choice)

B05 does not exercise the Assistant Coach knowledge tier (see
`THREE_PART_EXPERIENCE_CONTRACT.md`) — Post-Match Report's Summary tab has no such surface in
real production today. B07 (deferred) is where that tier belongs for this family.

## fixtureVersion 2 — retrospective remediation (Gate B W3 session)

See `SOURCE_RECONCILIATION.md`'s own remediation section for the six verified findings
(B2-R2 through B2-R7) and what was corrected. This section covers what's specific to this file's
own scope: new test-mocking disclosures and the two findings tracked as separate production
issues rather than fixed here.

### Real/mocked component substitutions, updated

`FootballObservationSection` is still mocked in this wave's own Vitest **component** tests, for
the exact same reason already disclosed above (the `next-auth` resolution failure). `PostMatchPage`
and `ObservationSection` no longer need to be mocked — they are no longer rendered at all by the
remediated candidate (`PostMatchPage`'s replacement, `shared/safe-post-match-report-shell.tsx`,
never imports either). `PostMatchUnresolvedBanner` is real and unmocked in the remediated page
tests (the IndexedDB-on-mount issue previously disclosed did not reproduce against the current
test setup; left as-is rather than re-disclosing a blocker that no longer blocks anything).

Both `PostMatchDebrief` and `FootballObservationSection` are rendered with `readOnly`/`isLocked`
always `true` in the remediated Players-tab-adjacent sections — neither this scenario's debrief
nor its "Additional observations" disclosure is the focus of B05's own register row (goal
attribution, timing blockers, safe completion), and both components independently wire their own
save/submit controls to real production server actions when not locked — the same class of
exposure B2-R5 closes for `PostMatchPage`. A disclosed, deliberate scope reduction, not an
oversight.

League-only secondary sections (team notes, planned squad, absences, player stats) are
presented read-only in the remediated Players tab rather than reusing their real interactive
sub-controls — see `shared/safe-post-match-report-shell.tsx`'s own `LeagueOnlyExtras` doc
comment for why.

### Two real production defects found, verified, and tracked separately (not fixed in this PR)

1. **`PostMatchPage` has no actions-injection seam.** It imports its mutation functions directly
   from the real post-match server-action module at module scope — there is no way for a caller
   to substitute fixture-local functions. A precedented fix exists elsewhere in this codebase
   (`LiveMatchClient` already accepts an `actions` prop, built by its own callers via
   `createEventActions`/`createLeagueActions`); applying the same pattern to `PostMatchPage`
   (and `EventMatchReportPanel`, which has the identical gap) would be a minimal, well-precedented
   production change — but it IS a production change, out of this PR's authorized scope. Filed
   as issue #809 rather than fixed here.
2. **`PostMatchReportPageShell` + `PostMatchPage` render the unresolved-report and
   goal-attribution-gap banners twice** (once in each component) for any DRAFT/REPORTED report on
   the Players tab. Confirmed by direct source reading, not merely by this wave's test mocks
   hiding it. Filed as issue #810 rather than fixed here, since `PostMatchReportPageShell` is
   production code this PR is not authorized to change.
