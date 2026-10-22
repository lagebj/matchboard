# B06 — Visual vs. current production

## Third retrospective remediation (R8-3) — Event · After only, no visual change

R8-3 changes how `combinationEvidence` is computed (via the real derivation function against
newly-extracted source records), not what is displayed — the Noah+Sindre VERTICAL partnership row
renders identically to before. See `SOURCE_RECONCILIATION.md`'s own "third remediation pass"
section.

## Second retrospective remediation (B5/R2, B5/R6) — Event · After only

Two more real findings, both in Event · After's own fixture data, surviving the first pass
below: the debrief's own `player_observations` still named the Guest Player (B5/R2, reassigned
to Theodor, matching the already-fixed `footballObservations`); the Noah+Sindre combination
row's `subtype` was `HORIZONTAL` when the real derivation returns `VERTICAL` for this CF+LCM pair
(B5/R6). Neither changes which real production components the page reuses. See
`SOURCE_RECONCILIATION.md`'s own "second remediation pass" section.

## Retrospective remediation (B3-R2/R3/R4/R6/R7)

League · After and Event · After each received fixture-content corrections (clocks, Guest
Player evidence, combination-evidence fields) and both AFTER pages plus both BEFORE pages had
their coach-facing copy stripped of filenames/function names/route syntax and their cross-match
"Continue report" link removed. None of this changes which real production components each page
reuses — see `BLOCKERS.md`/`SOURCE_RECONCILIATION.md` for the full list. The sections below
describe the pages as corrected.

## B06-LEAGUE-BEFORE — `CONFIRMS_SHIPPED_BASELINE`

- Identical to production: `MatchIdentityCard` + `MatchPreparationWidget` + real planning pitch,
  the same composition B01 already candidates and the owner has not changed.
- Genuinely new, but UI-Lab-local: the comparison-nav strip (`CompareNav`) and the "Primary
  action in production" disclosure note. Neither exists in the real Match Details page — both
  are this wave's own apparatus for making the comparison legible, not a proposed production
  change.
- No design-exploration finding on the League side — this wave's job for League is to hold it
  still as the comparison baseline.

## B06-LEAGUE-AFTER — `CONFIRMS_SHIPPED_BASELINE`

- Identical to production: `MatchIdentityCard` + `MetricStrip` + `MatchTimelineList` +
  `MatchFlowPanel`, matching B01-AFTER's already-approved composition.
- Genuinely new, UI-Lab-local: the "Continue report →" link now points at the real B05 completed
  candidate (cross-wave reuse) rather than an inert button or a dead anchor, and the explicit
  return-destination disclosure line.

## B06-EVENT-BEFORE — `DESIGN_PROPOSAL`, no production baseline

- No production route exists to confirm against. This candidate proposes what a standalone
  Event Match Details "Before" layout could look like, built only from real production pieces
  (see CURRENT_STATE_AUDIT.md's component table) — not a copy of `EventMatchesTab`'s actual
  inline card markup.
- Design-exploration finding: reusing `MatchIdentityCard` with `ownKitColor={null}` makes the
  League/Event visual distinction (real kit colour vs. neutral shirt) legible using the exact
  same component, rather than inventing a second Event-specific identity component — directly
  satisfying "do not introduce a second Event design language."
- Explicitly disclosed as a proposal, not an implementation, via the `DecisionBanner` at the top
  of the page and in `candidate_manifest.json`'s `baselineAssetRef`.

## B06-EVENT-AFTER — `CONFIRMS_SHIPPED_BASELINE` (for the shell), proposal (for the page)

- The editing shell itself (`PostMatchReportShell` + `PostMatchDebrief` +
  `FootballObservationSection` + `MatchCombinationEvidencePanel`) is identical to what
  `EventMatchReportPanel` already renders in production — this wave confirms that baseline, it
  does not redesign it.
- What is new/proposed is only the surrounding page: a standalone route presenting that same
  real shell, instead of an inline expand panel on Event Detail. Disclosed via the
  `DecisionBanner` about return-destination granularity.

## Deliberately excluded production-only dependencies

- `EventMatchLineupPanel`'s and `EventMatchReportPanel`'s own server-action self-fetching —
  replaced with static fixture data and (for the report) honest fixture-local failure handlers.
- League's `MatchInsights`/`MatchOpponentMemory` (B01's own evidence-grammar territory).
- League's dedicated `/post-match` tabbed route composition — B05 already candidates it; this
  wave links to that candidate rather than re-building it.

## Proposed refinements

None beyond the open architectural question already stated in SOURCE_RECONCILIATION.md (whether
Event warrants a dedicated Match Details route). This wave does not propose copy, layout, or
interaction changes to any existing, already-approved component.

## Baseline asset reference

No golden screenshot baseline exists for B06 yet — see `candidate_manifest.json`'s per-scenario
`baselineAssetRef` for the exact framing (`CONFIRMS_SHIPPED_BASELINE` vs. `DESIGN_PROPOSAL`) used
in place of one. CI capture (`ui-lab-visual-review.yml`) has not yet run against this PR's
revision — see BLOCKERS.md.
