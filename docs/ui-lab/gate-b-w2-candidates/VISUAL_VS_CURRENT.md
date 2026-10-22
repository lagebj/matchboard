# Gate B W2 — Visual vs. Current Production

## Fourth remediation pass (R9-1) — one number corrected on the Combinations tab

The completed candidate's Combinations tab shows "83 min this match" for the Noah+Sindre row,
not the old "80 min this match" — the only rendered-text change from R9-1's participation-model
correction (every other displayed field on that row is unchanged). See
`SOURCE_RECONCILIATION.md`'s own "fourth remediation pass" section.

## Third remediation pass (R8-1) — visual-correction summary

R8-1 corrects the B5/R1 disclosure's own wording: the locked-state message now reads "This
completed report is missing N goal(s) recorded during Live Reporting. Reopen the report to add
the missing goal(s)." instead of reusing the editable-state message's "Add the missing scorer...
before completing this report" (invalid once locked). Still a candidate-only proposed correction
— the real production `GoalAttributionGapBanner` is unmodified and still shows no locked-state
disclosure at all. R8-2 and R8-3 change no visual output. See `SOURCE_RECONCILIATION.md`.

## Second remediation pass (B5/R1, B5/R4, B5/R5) — visual-correction summary

Three of the five B5/Rx findings changed what the candidate visually shows, beyond the first
pass below: (1) the goal-attribution-gap banner now stays visible on a LOCKED-but-unresolved
report — a candidate-only proposed correction, since real production's `PostMatchReportPageShell`
still hides it the same way (B5/R1); (2) the header's `MatchIdentityCard` now tracks an edited
Result score live instead of showing the original fixture score (B5/R4); (3) "Back to match"/the
"Matches" breadcrumb now point at a new real `match-details/` page instead of a fragment, and the
Review tab shows a plain disclosure instead of a working-looking link to nowhere (B5/R5). See
`SOURCE_RECONCILIATION.md` for the full finding-by-finding record.

## fixtureVersion 2 — what the remediation changes here

`PARTIALLY_CORRECTED_REFERENCE` as of fixtureVersion 2 (not `CONFIRMS_SHIPPED_BASELINE` for the
Players tab specifically) — see `candidate_manifest.json`. The shared `PostMatchReportShell`
core (Result/Goals/Assists/Attendance/Complete/Reopen) is still the exact real, unmodified
production component. What is **no longer** identical to the currently-shipped page: the real
`PostMatchPage` wrapper around it is not rendered at all (replaced by
`shared/safe-post-match-report-shell.tsx` + `shared/use-safe-report-lifecycle.ts`), because it
offers no seam to prevent real production mutations from this candidate's synthetic match id
(B2-R5 — see `BLOCKERS.md` for the tracked production-issue follow-up). League-only secondary
sections (team notes, planned squad, absences, player stats) are now read-only summaries rather
than reusing their real interactive sub-controls — a disclosed, deliberate narrowing, not a
claim that production itself is read-only there. The real production banner duplication
(`PostMatchUnresolvedBanner`/`GoalAttributionGapBanner` rendered twice) is **not** reproduced by
this corrected candidate — this is a disclosed divergence from the current shipped page, not a
claim that production has already been fixed to match.

## Original wave (fixtureVersion 1) — superseded where noted above

Per `SOURCE_RECONCILIATION.md`'s framing decision: this wave **confirms** the real, already-shipped
composition rather than proposing a different one.

## B05 (draft) — `CONFIRMS_SHIPPED_BASELINE`

- **Identical to production**: every rendered component is the real production component
  (`PostMatchReportPageShell`, `PostMatchReportHeader`, `PostMatchSummaryTab`,
  `PostMatchReviewTab`, `MatchTimelineList`, `PostMatchPage`/`PostMatchReportShell`,
  `PostMatchDebrief`, `GoalAttributionGapBanner`, `PostMatchUnresolvedBanner`,
  `FootballObservationSection`, `ObservationSection`, `LegacyMatchFeedbackSection`), composed
  exactly as `/post-match` composes them, fed a synthetic report in a real intermediate
  lifecycle moment (REPORTED, debrief SUBMITTED, two real unresolved items). The default tab
  (`players`), its URL pin, and the tab set (Summary/Timeline/Players/Debrief/Review) are the
  real `match-detail-tabs.ts` output. **One exception**: `RecoveredTimingCallout` got a real,
  narrow bug fix (B2-R1 — see `BLOCKERS.md`) after this wave's own CI capture found a genuine
  pre-existing invalid-HTML-nesting defect in it; the fix changes markup tags only, not copy or
  behavior.
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
