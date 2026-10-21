# Gate B W2 — Visual vs. Current Production

Per `SOURCE_RECONCILIATION.md`'s framing decision: this wave **confirms** the real, already-shipped
composition rather than proposing a different one.

## B05 (draft) — `CONFIRMS_SHIPPED_BASELINE`

- **Identical to production**: every rendered component is the real, unmodified production
  component (`PostMatchReportPageShell`, `PostMatchReportHeader`, `PostMatchSummaryTab`,
  `PostMatchReviewTab`, `MatchTimelineList`, `PostMatchPage`/`PostMatchReportShell`,
  `PostMatchDebrief`, `GoalAttributionGapBanner`, `RecoveredTimingCallout`,
  `PostMatchUnresolvedBanner`, `FootballObservationSection`, `ObservationSection`,
  `LegacyMatchFeedbackSection`), composed exactly as `/post-match` composes them, fed a
  synthetic report in a real intermediate lifecycle moment (REPORTED, debrief SUBMITTED, two
  real unresolved items). The default tab (`players`), its URL pin, and the tab set
  (Summary/Timeline/Players/Debrief/Review) are the real `match-detail-tabs.ts` output.
- **Genuinely new, but UI-Lab-local, never a production change**: the "Continue fixture
  simulation → Complete report" control (see `INTERACTION_AND_STATE_AUDIT.md`) and the small
  "Surface state: DRAFT/COMPLETED" text indicator next to it. Both are this wave's own additive
  markup, clearly outside any real component's own rendered output, matching A07/B01's
  established fixture-simulation-control convention.
- **Design exploration finding**: none. Reading `post-match-report-page-shell.tsx` and its
  sibling components directly found no gap between the register's "finish/report actions" phrase
  and the real, already-shipped `Complete report` action and debrief-gated completion flow — this
  is a genuine confirmation, not a default assumed without checking (Gate B W1's own Phase 2
  found a real gap on its first pass; this wave's equivalent check found none to fix).

## B05-COMPLETED — `CONFIRMS_SHIPPED_BASELINE`

- **Identical to production**: same real component set, now fed the same match's locked state.
  No `Complete report` button, no add/remove/edit control on any tab, debrief renders its own
  real read-only view, `Reopen report` is genuinely present (a real, correct production
  affordance once locked — not omitted to look more final than production actually is).
  `Combinations` tab (COMPLETED-only per the real tab set) renders the real
  `MatchCombinationEvidencePanel` over this wave's own combination-evidence fixture.
- **Differs from B05 (draft) only in the ways the register asks for**: report status, one goal's
  attribution, the timing-review item, `completedBy`/`completedAt`, and therefore which tabs/
  controls the real components choose to render — see `DATA_TRUTH_AND_FIXTURES.md`.

## Deliberately excluded production-only dependencies

See `DATA_TRUTH_AND_FIXTURES.md`'s "Why one real mid-level concern is NOT reused as a Vitest
unit-test dependency" — `PostMatchPage`, `FootballObservationSection`, and `ObservationSection`
are real and unmodified in the actual rendered page; they are substituted with a stub only inside
this wave's own Vitest component tests, for an environment-level reason unrelated to this
fixture (confirmed by reproducing the failure, not assumed) and already precedented by the real
`post-match-report-page-shell.test.tsx`.

## Proposed refinements

None. Unlike Gate B W1 (which found and fixed a real `DecisionBanner` duplication and proposed
one genuine `MatchFlowPanel` refinement), this wave's audit of the real Post-Match Report
composition against B05's register language found the shipped surface already correct — see
`SOURCE_RECONCILIATION.md`'s framing decision for the owner-review question this still raises
(confirm vs. redirect toward a genuine compositional proposal).

## Baseline asset reference

No approved golden screenshot exists for B05 yet (`NOT_READY` per the register). "Current
production" above means the real, already-merged source files cited in `CURRENT_STATE_AUDIT.md`,
read directly in this session — not a prior capture.
