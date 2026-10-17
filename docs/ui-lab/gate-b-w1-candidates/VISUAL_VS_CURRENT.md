# Gate B W1 — Visual vs. Current Production

Per `SOURCE_RECONCILIATION.md`'s framing decision: this wave mostly **confirms** the real,
already-shipped composition rather than proposing a different one. This file states plainly,
per scenario, which parts are identical to current production and which parts genuinely differ.

## B01 — planned, ready

- **Identical to production**: composition order (`MatchIdentityCard` → `MatchPreparationWidget`
  → `MatchOpponentMemory` → facts `MetricStrip` → tactical pitch → coaching intent) matches
  `before-match-overview.tsx`'s real, shipped order (ADR-0157 §6).
- **Differs**: the real page renders `MatchTacticsPanel` (self-fetching, with its own internal
  Match Insights fetch and mutation surface) where this candidate renders `MatchInsights` directly
  plus a read-only `TouchlinePlanningPitch` + the A07 local-editor pattern. The visual result is
  close but not pixel-identical — the real `MatchTacticsPanel` also contains a formation picker,
  bench management, and absence controls this candidate does not reproduce. `CoachingIntentSelector`/
  `MatchFormatOverrideControls`/`PlannedPlayingTimePanel`/`BeforeMatchSecondaryRow` are omitted
  entirely (see `DATA_TRUTH_AND_FIXTURES.md`) — production's Overview tab is a superset of this
  candidate, not the reverse.

## B02 — planned, incomplete

- **Identical to production**: `MatchPreparationWidget`'s incomplete-state rendering,
  `MatchOpponentMemory`'s `null`-returning honest-empty behavior, and `MatchInsights`'s
  `totalCount === 0` empty state are the exact real components, unmodified.
- **Differs**: same omissions as B01 (no `MatchTacticsPanel`/secondary row).

## B03 — completed, sparse

- **Identical to production**: `MatchTimelineList` and `MatchFlowPanel` are the real, unmodified
  components; the sparse-chronology degradation behavior they exhibit here is identical to how
  they would behave in production given the same input.
- **Differs**: `after-match-overview.tsx`'s player-involvement list, final-lineup pitch,
  `PlanVsRealityPanel`, coaching-intent review, and reflection/notes rows are omitted. This
  candidate is a focused subset proving the result-vs-chronology distinction specifically, not a
  full AFTER-tab replacement.

## B04 — completed, rich

- **Identical to production**: same real components as B03, fed richer data; `MatchInsights`'s
  rendering of an `AI`-sourced, evidence-backed finding is identical to how production would
  render the same view-model shape.
- **Differs**: same omissions as B03, plus no `CompletedMatchAdvisorPanel` (see
  `CURRENT_STATE_AUDIT.md` for why).

## Baseline asset reference

No approved golden screenshot exists for any B01-B04 scenario yet (`NOT_READY` per the register).
"Current production" above means the real, already-merged source files cited in
`CURRENT_STATE_AUDIT.md`, read directly in this session — not a prior capture.
