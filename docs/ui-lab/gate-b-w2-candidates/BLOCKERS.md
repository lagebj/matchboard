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

## Second retrospective remediation (B5/R1, B5/R3, B5/R4, B5/R5, B5/R7)

A further independent technical review found five more real findings in the FIRST remediation's
own shared shell/hook components — see `SOURCE_RECONCILIATION.md`'s own "second remediation pass"
section for the full finding-by-finding record. In brief:

- **B5/R1**: the goal-attribution-gap disclosure could silently disappear on a report that
  legally reached `LOCKED` while still unresolved (production's own completion gate never blocks
  on this). Corrected with a candidate-only visual correction (show whenever `hasGap`, not gated
  by draft state) and a two-step capture flow demonstrating both real outcomes.
- **B5/R3**: only `addGoal()` enforced the locked-state guard; the local-id counter and
  `complete()`'s timestamp were both non-deterministic. Corrected with one central validation
  dispatcher and state-scoped determinism.
- **B5/R4**: attendance totals, player involvement, and the header's own identity card could go
  stale after a real edit (score/attendance/roster change). Corrected — all three are now
  recomputed live from the current report state via the real production pure functions.
- **B5/R5**: the breadcrumb and Review tab still used fragment hrefs. Corrected with a new real
  `match-details/` page (mirroring B06's own B3-R5 precedent) and a non-interactive disclosure
  for the Review tab (no real `/review` destination exists in this bundle).
- **B5/R7**: `capture-attestation.json` is regenerated against this revision's own real CI
  capture run.

None of these changed B05's underlying fixture DATA — `fixtureVersion`/`fixtureSha256` for both
candidates correctly remain unchanged, since every fix is in shared component code, not
`report-data.ts`'s raw records.

## Third retrospective remediation (R8-1, R8-2, R8-3)

A fourth independent technical review found three more real findings — see
`SOURCE_RECONCILIATION.md`'s own "third remediation pass" section for the full record. In brief:

- **R8-1**: the B5/R1 disclosure fix reused the real `GoalAttributionGapBanner`'s own wording,
  which is wrong once `LOCKED` (instructs completing an already-complete report) and mislabels a
  missing Goal ROW as "missing scorer attribution". Corrected with a new, fully local
  `GoalDiscrepancyDisclosure` component with lifecycle-aware, dynamically-counted wording; the
  real production banner itself is untouched.
- **R8-2**: `addPlayer()` accepted any non-empty string as a player id with no eligibility check;
  `reopen()` accepted `"LOCKED"` as a target, which could produce an invalid
  `{status: LOCKED, completedBy: null, completedAt: null}` state. Both now validated at the
  reducer's own runtime layer.
- **R8-3**: the combination-evidence derivation test's source records lived only inside the test
  file, outside the fixture's own hash. Moved into a new, shared `combination-source-data.ts`
  module that both the fixture (which now COMPUTES `combinationEvidence` via the real
  `deriveCombinationsFromSegments()`) and the test import identically.

This pass DOES change B05's underlying fixture DATA (R8-3's combination-evidence correction) —
`fixtureVersion` bumped 2 -> 3 for both B05 candidates; new `fixtureSha256` for both.

## Fourth retrospective remediation (R9-1)

A fifth independent technical review found that the R8-3 pass's own new positional segment
(`combination-source-data.ts`) contradicted `report-data.ts`'s pre-existing
`b05MinutesByParticipant` — a fixture-integrity defect introduced by R8-3 itself, since that pass
never checked the segment it invented against the minute records that already existed. A fixture
defect, not a production/derivation-engine defect — `deriveCombinationsFromSegments()` itself is
untouched and was never the problem.

Corrected: established that this match's real duration is 90 minutes (`b05TimingReview`'s own
real second-half duration is 45', so 2x45'=90, not the invented 80), under which every one of the
seven existing minute values is exactly explained by one real substitution (Kasper off/Elias on
at 68') plus one early departure with no replacement (Noah off at 83'). Replaced the single
0-80' segment with three real chronological segments (0-68'/68-83'/83-90'). No minute value in
`b05MinutesByParticipant` needed to change. The displayed Noah+Sindre row's `minutesTogether`
corrected 80 -> 83 (Noah's own real departure time) as a direct, honest consequence — every other
field is unchanged, since all five canonical goal events occur before either substitution. See
`SOURCE_RECONCILIATION.md`'s own "fourth remediation pass" section for the full record.

A new `validateSegmentSequence()`/`computeMinutesByParticipant()` pair of pure helpers
(`combination-source-data.ts`) now backs a dedicated participation-consistency test suite
(structural boundary checks, exact minute-total agreement, scorer/assist on-pitch-at-event-time
checks, draft/completed sharing-the-same-source checks), including a negative test using a
deliberately contradictory single-segment sequence — the exact R9-1 defect shape — which now
fails the minute-total check, so this specific defect class cannot silently return.

`fixtureVersion` bumped 3 -> 4 for both B05 candidates (the hashed combination source records
changed); new `fixtureSha256` for both. B06 is unaffected and untouched — it is not the target of
R9-1 and its own single-segment model has no competing minute record elsewhere in its fixture to
contradict.

## Fifth retrospective remediation (R10-1)

A sixth independent technical review found that R9-1's own "90-minute match, one substitution,
one unreplaced departure" model was itself unsupported — numerically self-consistent, but
resting on assumptions nothing in the fixture or in NFF's published rules actually justified:

1. No rule or match-specific exception supports a 90-minute youth match — R9-1's own reasoning
   ("the timing-review value happens to say 45") used a VALUE THAT PASS ITSELF HAD AUTHORED as
   if it were independent evidence, which it was not.
2. The substitution (Kasper off/Elias on at 68') and Noah's departure at 83' were both INFERRED
   from `b05MinutesByParticipant`'s pre-existing aggregate values — no canonical rotation or
   withdrawal event backed either one.
3. The starting formation fielded only 6 players; the CF slot was permanently vacant.
4. The code's own comment said the team "finishes the match with 6" while the actual final
   segment array held 5 participants — a real discrepancy between comment and code.
5. The canonical goal chronology placed a 34th-minute event in period 1 (impossible for any
   reasonable half length under 34 minutes) and a final goal at the 61st minute, which (once the
   real 60-minute G11 7v7 format was established) falls outside regulation time entirely.
6. `matchSeconds` was never verified against its real production contract — confirmed directly
   this session (`src/lib/live-match/period-config.ts`'s own documented contract): it is
   PERIOD-RELATIVE (resets to 0 each period), not global elapsed time. The old fixture mixed both
   interpretations inconsistently across different events.

**Authoritative match format established first**: Slemmestad Rød's squad plays NFF Akershus G11
— 7-a-side, 2x30-minute halves, 60 minutes regulation (`report-data.ts`'s own `B05_MATCH_FORMAT`,
citing NFF's own published rules directly). No match-specific exception exists anywhere in this
fixture, so the default format applies without modification.

**Corrected, simplest coherent model**: all 7 present players start and play the entire real
60-minute match — zero substitutions, zero inferred departures, every one of the 7 real formation
slots (including CF) filled. The canonical goal chronology is rebuilt with real period-relative
`matchSeconds`, independently verified in a new test against a `globalMinuteToPeriodRelative()`
conversion helper applied to each event's own `minuteLabel` — not trusted by construction. The
final goal's global minute moved 61' -> 55' (inside regulation); every other event's global
minute is unchanged. `minutesTogether` for the displayed Noah+Sindre row corrected 83 -> 60 as a
direct, derived consequence. Elias's football observation note no longer says "after coming on."

New tests: match-format validity (age class/format/duration/period count), on-field-count/
formation-slot coverage, period/matchSeconds cross-verification against the real conversion
helper, and negative tests proving a 90-minute segment sequence, an 8-player on-field count, an
overlapping segment pair, and the original R9-1-shaped minute mismatch are all rejected.

`fixtureVersion` bumped 4 -> 5 for both B05 candidates; new `fixtureSha256` for both. B06 remains
unaffected — not the target of R10-1. See `SOURCE_RECONCILIATION.md`'s own "fifth remediation
pass" section for the full record.

## Sixth retrospective remediation (R11-1, R11-2, R11-3)

A seventh independent technical review confirmed R10-1's own G11 7v7 match model is coherent
(two 30-minute periods, 60 minutes regulation, seven players, one continuous participation
interval, no substitutions, five canonical goals, 3-2 final result, valid period-relative event
times, a 60-minute Noah/Sindre partnership) but found three remaining defects:

**R11-1 (P1) — the eighth-player negative test asserted the WRONG outcome.** The R10-1 section
above states its own negative test proved "an 8-player on-field count... rejected" — that
description was inaccurate. The test actually asserted `validateSegmentSequence(tooMany).toEqual(
[])`, i.e. that the 8-player segment PASSED validation, because `validateSegmentSequence()`'s
structural checks (duplicate occupancy, duplicate position) never enforced any on-field player
ceiling at all — an 8-player segment with 8 distinct ids and 8 distinct positions genuinely is
structurally well-formed. Corrected: two new functions in `combination-source-data.ts` —
`validateOnFieldCount(segments, format)` (the GENERAL 7v7 ceiling: at most `maxOnFieldPlayers`
players, a new field on `B05_MATCH_FORMAT`; a segment with FEWER players is not itself an error,
since a card/injury/late-withdrawal are all legitimate match situations a general rule must not
reject) and `validateExactParticipantCount(segments, expectedCount)` (B05's own SCENARIO-SPECIFIC
rule: this fixture declares no substitutions/withdrawals/disciplinary reductions, so its sole
segment must contain EXACTLY 7, never fewer). The old test's backwards assertion is replaced with
one that genuinely proves the 8-player segment is rejected by `validateOnFieldCount()`, alongside
new negative tests for duplicate player occupancy, duplicate tactical position, and an unexplained
six-player segment under B05's own no-exception rule — see
`DATA_TRUTH_AND_FIXTURES.md`/`SOURCE_RECONCILIATION.md`'s own "sixth remediation pass" sections.

**R11-2 (P2) — retained narrative contradicted the canonical chronology.** `b05Reflection.note`
and `b05DebriefAnswers.team_execution.note` both said Slemmestad went "behind twice" — the
canonical score progression (1-0, 1-1, 2-1, 2-2, 3-2) shows Slemmestad is tied twice but never
trails. `b05OpponentObservation.factualSummary` said Kongsberg sat deeper "trailing by two in the
second half" — neither team is ever two goals apart at any point. `b05DebriefAnswers.match_changes`
claimed the team "moved to a back three" — the positional record (`combination-source-data.ts`'s
single, unchanged 0-60' segment) has no formation change at all; this was a fabricated event with
no canonical backing, exactly the class of defect R11-2's own instructions prohibit inventing a
canonical event to "explain" rather than correcting the narrative. `opponent_memory.note` claimed
Kongsberg "sat deeper... harder to break down in the final 15 minutes" — directly contradicted by
Kongsberg's own second equalizer at 50' (inside that exact window). All four corrected to agree
with the record; `match_changes.option` is now the schema's own `NO_MEANINGFUL_CHANGE` (never an
invented enum value), with its `description` retained only as a clearly qualitative observation
(pressing intensity) that does not claim a positional/formation transition. Genuinely subjective
coaching observations not tied to an observable event (effort/cohesion ratings, "winning the ball
back high," "conceded twice from turnovers") are left untouched — the correction targets factual
contradictions only, not coaching opinion.

**R11-3 (P2) — two authoritative source records were excluded from the fixture hash.**
`B05_MATCH_FORMAT` and `b05RotationEvents` are both authoritative for this scenario (the format
establishes age group/squad format/period count/durations; the rotation record establishes that
no substitutions occurred) but neither participated in `rawRecordsForHash` — a future change to
either would silently not change the fixture's own provenance hash. Corrected: both are now
included under stable keys (`matchFormat`, `rotationEvents`) in both `draft/fixtures.ts` and
`completed/fixtures.ts`; new hash-sensitivity regression tests prove that changing the format
(period duration, age group), the rotation events, the positional segments, or player minutes
each independently changes the hash, and that an unchanged copy reproduces the identical hash.

`fixtureVersion` bumped 5 -> 6 for both B05 candidates (R11-1's new validators are code, not
hashed data, but R11-3's own hash-input change alone requires the bump); new `fixtureSha256` for
both. B06 is unaffected and untouched — not the target of any of R11-1/R11-2/R11-3. See
`SOURCE_RECONCILIATION.md`'s own "sixth remediation pass" section for the full record.
