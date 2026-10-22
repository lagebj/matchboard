# Gate B W2 — Source Reconciliation

## fixtureVersion 4 — fourth remediation pass (R9-1)

A fifth independent technical review found one remaining real finding, a fixture integrity defect
rather than a production/derivation-logic defect:

- **R9-1**: `shared/combination-source-data.ts`'s R8-3-era positional segment modeled one
  continuous 0-80' block with all seven present players on pitch throughout, directly
  contradicting `shared/report-data.ts`'s own pre-existing `b05MinutesByParticipant` (Kasper 68,
  Elias 22, Noah 83 — none of which fit an 80-minute uniform segment; only Aksel/Tobias/Sindre/
  Vetle's 90-each happened not to contradict it outright, since 90 > 80 at least doesn't shrink
  below it). The R8-3 derivation test used the segment as its own source of truth and never
  checked it against `b05MinutesByParticipant`, so the mismatch went unnoticed.
  **Authoritative participation model established before correcting anything**: `b05TimingReview
  ("completed")` already records the real second half as `resolvedDurationMinutes: 45` — this
  fixture's own match is a standard two-half game, so the real full match duration is 90 minutes
  (2x45'), never 80 (80 was simply an invented endpoint with no supporting record anywhere else
  in the fixture). With a 90-minute match, every one of the seven existing
  `b05MinutesByParticipant` values is exactly explained by ONE clean substitution (Kasper off at
  68', Elias on at 68' into the same CM slot, 68+22=90) plus one early departure with no
  replacement (Noah off at 83' — this squad's 7 present players are already fully accounted for
  elsewhere on the pitch at that moment, so the team finishes the final 7 minutes with 6) — **no
  minute value needed to change**. Corrected: `combination-source-data.ts` now exports three
  chronological, non-overlapping segments (0-68', 68-83', 83-90') instead of one; a new
  `validateSegmentSequence()`/`computeMinutesByParticipant()` pair of pure helpers backs a
  dedicated participation-consistency test suite (including a negative test using a deliberately
  contradictory single-segment sequence, which fails the minute-total check exactly the way the
  original defect would have). The displayed Noah+Sindre combination row's `minutesTogether`
  corrected 80 -> 83 as a direct, real consequence (Noah's own actual departure time) — every
  other field (goals/contributions/subtype/opponentDiversity/confidence) is unchanged, since all
  five canonical goal events occur before either substitution. B06 is unaffected (not the target
  of R9-1; its own single-segment model has no competing minute record anywhere else in its
  fixture to contradict).

`fixtureVersion` bumped 3 -> 4 for both B05 candidates (the hashed `combinationEvidence`/source
records changed); new `fixtureSha256` for both. B05 fixtureVersion 1's historical approval
remains preserved, unmodified, further down the `priorVersions` chain; both candidates remain
`approval: null`.

## fixtureVersion 3 — third remediation pass (R8-1, R8-2, R8-3)

A fourth independent technical review found three more real findings, this time spanning both
the second pass's own component code (R8-1, R8-2) and the underlying combination-evidence
fixture data's provenance (R8-3):

- **R8-1**: the second pass's own `GoalDiscrepancyDisclosure` fix was INCOMPLETE — it kept
  reusing the real `GoalAttributionGapBanner`'s fixed wording ("Add the missing scorer... before
  completing this report"), which is invalid once the report is `LOCKED` (nothing is left
  "before completing" at that point; the coach must reopen first), and mislabels the discrepancy
  as "missing scorer attribution" when the real `computeGoalAttributionGap()` counts report Goal
  ROWS, not scorer presence — in this fixture's own scenario the discrepancy is a genuinely
  MISSING report Goal row. Corrected: a new local `GoalDiscrepancyDisclosure` component
  (`shared/goal-discrepancy-disclosure.tsx`) renders lifecycle-aware wording — editable state
  invites adding the missing goal record; locked state instructs reopening first, never
  completing again — using "goal record(s)" terminology throughout and dynamic counts (never
  hardcoded). The real `GoalAttributionGapBanner` itself remains byte-for-byte unmodified; this
  candidate simply no longer renders it, the same pattern already used for `PostMatchReviewTab`.
  A disclosed, candidate-only proposed correction — production still shows no locked-state
  disclosure at all. See `DATA_TRUTH_AND_FIXTURES.md`.
- **R8-2**: `use-safe-report-lifecycle.ts`'s central validator (from the B5/R3 pass) had two
  real remaining gaps. `addPlayer()` accepted ANY non-empty string as a valid player id (never
  checked against an eligible-player source) and used the raw id as the displayed name. `reopen()`
  accepted the full `"DRAFT" | "REPORTED" | "LOCKED"` status union as a target, so
  `reopen("LOCKED")` could produce `{status: "LOCKED", completedBy: null, completedAt: null}` — a
  state that is neither a legitimate completed report nor a legitimate reopened one. Corrected:
  `addPlayer()` now validates against an `eligiblePlayers` source threaded in from the fixture's
  own `allPlayers` data (never a second invented roster) and resolves the real name from it;
  `reopen()` now rejects any target outside `{"DRAFT", "REPORTED"}` at the runtime-validation
  layer (the public `PostMatchReportActions.reopen` TYPE was already correctly narrow — the gap
  was the reducer's own internal `as`-cast trusting a wider type than the public contract
  promises; "TypeScript alone is not sufficient protection").
- **R8-3**: the B5/R6 combination-evidence derivation tests constructed their own synthetic
  positional segments and goal-attribution events INLINE, disconnected from the fixture's own
  `rawRecordsForHash` — the displayed `CombinationEvidenceRow` was hashed, but the records that
  actually justified it were not, an incomplete provenance chain. Corrected: a new
  `shared/combination-source-data.ts` module exports the canonical positional segment (a full,
  realistic 7-a-side lineup, not just the two players of interest) and goal-attribution events;
  `report-data.ts`'s `b05CombinationEvidence` now CALLS the real `deriveCombinationsFromSegments()`
  against those exact records and curates down to the Noah+Sindre `PARTNERSHIP` row (matching how
  the real `MatchCombinationEvidencePanel` itself already filters a larger derived set, not an
  invented narrowing) — the derivation test now imports the SAME records, never a second model.
  This also self-corrected a real latent bug: the old hand-written row's `positions` field was
  `["RCM", "LCM"]`, but the real function sorts lexicographically (`["LCM", "RCM"]`) — the
  hand-written order was simply wrong. The source records are now included in
  `rawRecordsForHash`. `fixtureVersion` bumped 2 -> 3 for both B05 candidates (the computed
  `combinationEvidence` content changed); new `fixtureSha256` for both. See
  `DATA_TRUTH_AND_FIXTURES.md`.

## fixtureVersion 2 — second remediation pass (B5/Rx findings)

A further independent technical review found five more real findings in the FIRST
remediation's own shared shell/hook components (not the fixture data, which remains correct and
unchanged — see "fixtureVersion 2 — retrospective remediation" below for that first pass's own
B2-Rx record). Verified directly against source, not assumed from the review brief:

- **B5/R1**: `GoalAttributionGapBanner` was gated `isDraft &&` — identical to real production's
  own `PostMatchReportPageShell` — so a report that reached `LOCKED` while the goal-attribution
  gap stayed open (a real, legally reachable path; `complete()` never blocks on this — see
  `DATA_TRUTH_AND_FIXTURES.md`) showed no disclosure at all, looking fully reconciled when it was
  not. Corrected: the banner now shows whenever `hasGap` is true, regardless of lock state — a
  disclosed, candidate-only proposed visual correction, not a claim that production already does
  this. The capture script's own interaction flow was also split into two real sequential states
  from one page load (confirm timing only -> complete -> still-unresolved; then reopen -> add the
  real missing goal with its real minute via the actual "Min" input -> complete again ->
  reconciled) — the earlier flow never entered a minute at all.
- **B5/R3**: only `addGoal()` checked for `LOCKED` state in `use-safe-report-lifecycle.ts`; every
  other mutation did not (reachable, since the real shared `PostMatchReportShell` renders every
  control unconditionally and only CSS/JSX visibility hid them, not the action layer itself); the
  local-id counter was a module-level `let` (not deterministic across mounts/replays); `complete()`
  stamped `new Date().toISOString()`. Corrected: one central `reduce()` validator now enforces
  lifecycle + input rules for every mutation, a rejected call leaves state byte-for-byte
  unchanged (verified directly, including a same-sequence replay-determinism test), the id
  counter lives in state, and `complete()` stamps a caller-supplied fixed timestamp.
- **B5/R4**: `attendanceSummary` only patched `presentCount`/`noShowCount` over a static snapshot
  (leaving `totalCount`/`noShowNames` stale after an edit); `playerInvolvement`'s present-
  participant list came from the static `b05PresentParticipants` constant, not the live roster;
  the header's `MatchIdentityCard` never reflected an edited Result score. Corrected: all three
  are now derived live from `state.players`/`state.ourScore`/`state.opponentScore` via the real
  production pure functions (`summarizeMatchAttendance()`, `buildPlayerInvolvement()`,
  `buildMatchPresentation()`'s own WON/DRAWN/LOST comparison) — immutable match history (kickoff,
  canonical live events, match identity beyond score) is deliberately left untouched.
- **B5/R5**: `breadcrumbHref="#matches"` and `PostMatchReviewTab reviewHref="#review"` remained
  fragment hrefs. Corrected: a new real fixture-backed `match-details/` page (the same real
  pattern B06's own B3-R5 remediation established) is the real destination for "Back to match"
  and the "Matches" breadcrumb — verified against production's actual destination
  (`breadcrumbHref={`/o/${orgSlug}/matches/${matchId}`}`, confirmed directly in
  `src/app/(app)/o/[orgSlug]/matches/[matchId]/post-match/page.tsx`). `PostMatchReviewTab` always
  renders a working-looking link with no seam to omit it, so it is no longer rendered for the
  Review tab at all — replaced with a plain, non-interactive disclosure.
- **B5/R7**: `capture-attestation.json` is regenerated against this revision's own real CI
  capture run — see that file's own `priorVersions` for the superseded run.

**fixtureVersion/fixtureSha256 for both candidates correctly remain unchanged (2, same hashes)**:
every fix above is in the shared SHELL/HOOK component code
(`use-safe-report-lifecycle.ts`/`safe-post-match-report-shell.tsx`) and capture tooling, never in
`report-data.ts`'s raw records — `rawRecordsForHash` is byte-identical before and after this pass.

## fixtureVersion 2 — retrospective remediation (Gate B W3 session)

A later session's technical review (prompted by the B06/W3 work) re-read this wave's own
fixtures and interactions against the real production functions they claim to represent, rather
than trusting fixtureVersion 1's passing CI as proof of semantic correctness. It verified six
real findings directly against source (not assumed from the task brief that raised them):

- `computeGoalAttributionGap()` (`src/lib/reports/report-mutations.ts`) counts report `Goal`
  ROWS (`db.goal.count(...)`), never filtered by scorer presence — fixtureVersion 1's
  `{liveGoalsRecorded: 3, attributedGoals: 2, hasGap: true}` did not follow from its own 3-row
  goal array (one with a null scorer); the real function would have returned `attributedGoals: 3`
  for that array, i.e. no gap. Corrected: the draft now genuinely has 2 report rows, not 3.
- `completeReport()` calls `getTimingSubmissionBlockers()` and rejects completion while a period
  needs timing review; fixtureVersion 1's "Continue fixture simulation" button swapped React
  props directly, enforcing nothing.
- `deriveCombinationsFromSegments()` (`src/lib/evidence/combination-topology.ts`) hardcodes
  `opponentDiversity: 1` and effectively caps confidence below `ESTABLISHED` for any single-match
  row (`deriveConfidence` requires `matchCount >= 3`, hardcoded to `1` on the per-match path).
  fixtureVersion 1 used `opponentDiversity: 3`/`confidence: "ESTABLISHED"` on a per-match row, and
  exposed it unconditionally in `b05AfterData()` regardless of draft/locked state, while
  `getMatchDetailAfterData()` only ever loads it for a `LOCKED` report.
- `PostMatchPage` (`src/components/assistant/post-match-page.tsx`) imports its mutation functions
  directly from the real post-match server-action module at module scope, with no prop seam to
  override them — fixtureVersion 1 rendered it directly, meaning its "Add goal"/"Complete
  report"/etc. controls were wired to real production actions against the synthetic
  `match-gate-b-05` id. Verified this is a real, reachable exposure (not already inert for some
  other reason) before treating it as a finding.
- The real `PostMatchReportPageShell` + nested `PostMatchPage` composition renders
  `PostMatchUnresolvedBanner`/`GoalAttributionGapBanner` twice (once in each component) — a real
  production duplication, confirmed directly, not merely hidden by this wave's own test mocks.
- fixtureVersion 1 used `#matches`/`#match-detail`/`#review` fragment hrefs as if they were
  working navigation, and the same kickoff timestamp as both the draft's and the completed
  state's own observation time.

**Remediation**: a new fixture-local lifecycle simulation (`shared/use-safe-report-lifecycle.ts`)
and a UI-Lab-local page shell (`shared/safe-post-match-report-shell.tsx`) that replicates
`PostMatchReportPageShell`'s real layout/composition for every tab except Players, where it
renders the shared `PostMatchReportShell` (ARR-0034's real, already-shared component) fed by the
fixture-local lifecycle instead of the real `PostMatchPage`. This is the narrowest available fix
given `PostMatchReportPageShell` offers no seam to substitute what it renders for that one tab —
seeking a narrower one (e.g. an `actions`-prop addition to `PostMatchPage` itself, mirroring the
already-precedented pattern on `LiveMatchClient`) would be a production code change, out of scope
for this PR; filed as issue #809 (see `BLOCKERS.md`). The real production banner duplication is
likewise filed separately, as issue #810, not silently fixed inside this candidate.

**Historical approval preserved, not inherited**: fixtureVersion 1's `/visual-approve
b9a95c9dbf4289a2727a15bd73375a4dc6381e2e` remains true as a historical fact about fixtureVersion
1's own content — preserved unmodified in `candidate_manifest.json`'s `priorVersions`.
fixtureVersion 2 is a new, unapproved revision; it requires its own independent technical review
and its own fresh owner approval before any `APPROVED_GOLDEN` claim can attach to it.

## Original wave (fixtureVersion 1)

`CANDIDATE` only. This wave implements the official Gate B register's **B05** (Post-match Report,
draft and completed) as a dev-only, fixture-backed UI Lab scenario under
`src/app/dev/ui-lab/gate-b/b05-post-match-report/`. No production route, component, data loader,
persistence, or AI service is changed.

## Sources recovered

- The official register's B05 row — **not independently re-read from the original CSV in this
  session**. The bundle directory
  (`.matchboard-work/Matchboard_Experience_Coding_Agent_Handoff_v0.5.5_2026-10-09/`) that Gate B
  W1's own `SOURCE_RECONCILIATION.md` read it from is not present on this machine — gitignored
  working documents, same class of "not part of the durable repository" source ADR-0152 already
  disclosed for its own implementation bundle. Reproduced instead from
  `docs/ui-lab/gate-b-w1-candidates/SCENARIO_REGISTER.md`'s own verbatim quote of the same row,
  which **is** committed and was read directly. The task's own instructions separately quoted the
  identical row text, cross-checked against the committed copy — same wording, not reconstructed
  from memory.
- `docs/ui-lab/gate-b-w1-candidates/` (B01-B04) — read in full: `candidate_manifest.json`,
  `SCENARIO_REGISTER.md`, `CURRENT_STATE_AUDIT.md`, `DATA_TRUTH_AND_FIXTURES.md`,
  `INTERACTION_AND_STATE_AUDIT.md`, `SOURCE_RECONCILIATION.md`, `VISUAL_VS_CURRENT.md`,
  `BLOCKERS.md`, `CHANGED_FILES.md` — the established Gate B wave convention (doc set, fixture
  style, capture-script scenario shape) this wave follows rather than inventing a second one.
- `docs/adr/0147-match-details-and-post-match-report-lifecycle-surfaces.md` — read in full.
  Authoritative for: the two independent lifecycle vocabularies, DRAFT's `players` default tab
  (ADR-0003, proven by `e2e/post-match-evidence-parity.spec.ts`), the URL tab-pinning fix and its
  own regression test (`post-match-report-page-shell.test.tsx`), the exact tab sets (DRAFT:
  Summary/Timeline/Players/Debrief/Review; COMPLETED: Summary/Timeline/Players/Debrief/
  Combinations — the "Review"/"Reflection" URL key naming the Decision section records, current
  tab *label* is "Debrief" per ADR-0152), and the no-assist-pairing rule for report-fallback
  timelines.
- `docs/adr/0152-coach-learning-loop.md` — read (History sections through Slice 4e in full;
  Slices skimmed beyond that, not needed for this surface). Authoritative for: the guided debrief
  (`PostMatchDebrief`, `findDebriefReviewGaps`/`isDebriefReadyToSubmit`), the real completion gate
  (`completeReport()` requires `isDebriefSubmittedForReport`), and the Debrief tab's rename from
  "Reflection" (URL key `reflection` unchanged).
- The actual production source, read directly rather than inferred: `match-detail-tabs.ts`,
  `post-match-report-page-shell.tsx`, `post-match-report-header.tsx`, `post-match-summary-tab.tsx`,
  `post-match-review-tab.tsx`, `post-match-page.tsx` (`src/components/assistant/`),
  `post-match-report-shell.tsx`, `post-match-debrief.tsx` (+ `debrief/v1.ts`),
  `post-match-report-view-model.ts`, `get-match-detail-after-data.ts` (type only — `server-only`),
  `match-detail-view-model.ts`, `goal-attribution-gap-banner.tsx`, `recovered-timing-callout.tsx`,
  `post-match-unresolved-banner.tsx`, `match-combination-evidence-panel.tsx`,
  `football-observation-section.tsx`, `observation-section.tsx`,
  `legacy-match-feedback-section.tsx`, `combination-topology.ts`, and the existing
  `post-match-report-page-shell.test.tsx` (the real regression test for the exact tab-pinning
  behavior this wave's lifecycle-transition interaction demonstrates).

## Authorization basis

Gate B W1's `BLOCKERS.md` recorded the repository owner's 2026-10-17 directive to begin Gate B at
all. This wave (B05) was picked up at the owner's explicit direction given directly in this
session ("Start Gate B B05"), after the ADR-0159 governance correction (PR #802/#804) was
reviewed and merged — not an inference from any register status. B05 remains `NOT_READY`/
`DIRECTIONAL_ONLY` in the official register's own fields (unchanged by this wave, same as every
other Gate B row); picking it up for a CANDIDATE wave is this session's own scoping decision,
exactly as Gate B W1 recorded for B01-B04.

## The framing decision

B05's register description ("Finish/report actions versus read-only knowledge") maps directly
onto the real, already-shipped `PostMatchReportPageShell`/`PostMatchReportShell`/`PostMatchDebrief`
composition — ADR-0147 and ADR-0152 already implement exactly this draft/locked distinction in
production. **Decision made in this wave, following Gate B W1's own precedent**: B05 **confirms,
via fixtures, that the real shipped composition satisfies the register row's normative
requirement**, rather than proposing a new composition. Every real component this wave's pages
compose is reused unmodified, except one real pre-existing bug fixed in
`recovered-timing-callout.tsx` (B2-R1, found by this wave's own CI capture — see `BLOCKERS.md`);
see `DATA_TRUTH_AND_FIXTURES.md` for the one disclosed
scope reduction and `VISUAL_VS_CURRENT.md` for the full identical-vs-differs breakdown.

This is the first and most consequential owner-review question for this PR, same as Gate B W1's
own framing question: confirm this is correct, or redirect toward a genuine compositional
proposal for B05 instead.

## What this PR does not decide

- B06 (League/Event parity), B07 (Assistant Coach longitudinal), B08 (information
  ownership/transitions) remain `NOT_READY`/`DIRECTIONAL_ONLY` and deferred — see
  `SCENARIO_REGISTER.md`.
- Gate C-G are not started.
- No `APPROVED_GOLDEN` status is claimed anywhere in this wave.
- Stage B of ADR-0159 (separately performed in this same session, PR #802/#804) now makes the
  `Visual Authority Gate` check a real required, merge-blocking check on this very PR — this is
  the first Gate B wave to actually be subject to it. See `REVIEW_RECORD.md`.
