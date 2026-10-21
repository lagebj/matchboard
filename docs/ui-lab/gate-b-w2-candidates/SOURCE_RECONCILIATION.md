# Gate B W2 — Source Reconciliation

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
