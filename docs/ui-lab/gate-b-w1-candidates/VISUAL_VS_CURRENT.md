# Gate B W1 — Visual vs. Current Production

Per `SOURCE_RECONCILIATION.md`'s framing decision: this wave mostly **confirms** the real,
already-shipped composition rather than proposing a different one. This file states plainly,
per scenario, which parts are identical to current production and which parts genuinely differ.

## Design-audit findings (Phase 2) — what changed after the owner asked for real exploration

The owner asked this wave to actually pursue genuine design exploration (not just confirm the
baseline), accepting that the audit might conclude current production is already good. Reading
the real component source directly (`before-match-overview.tsx`, `match-preparation-widget.tsx`,
`before-match-secondary-row.tsx`, `match-flow-panel.tsx`, `completed-match-story.ts`) against what
this wave had actually built turned up two concrete issues, not speculative redesign:

1. **B01 and B02's first revision each added an invented `DecisionBanner`** that restated
   `MatchPreparationWidget`'s own computed "Squad selected X/Y" / "Lineup set" / "Ready for match"
   output in different words — duplicate information across two widgets, and in both cases
   mislabeled `CONFIRMS_SHIPPED_BASELINE` when it had actually added new, non-baseline UI.
   **Fixed**: the banner is removed from both pages. `MatchPreparationWidget` is the single real
   readiness surface; nothing is added beside it. B01/B02 now genuinely confirm the shipped
   baseline, including this real audit of it — the composition order and widget set match
   production with no restated information.
2. **Real gap found in `MatchFlowPanel`/`buildMatchFlowChronology()`**: the real `trustworthy`
   check only covers unknown-minute goals; it never checks whether a fully-timed chronology's own
   running tally actually reconciles with the match's real final score. B03's exact scenario (one
   23' goal, final score 6-4) exposes this: the real panel would render a chronology ending at a
   silent "1-0", never disclosing that 9 other goals are unaccounted for. **This is the one
   genuine, well-grounded refinement this wave proposes** — see B03 below. The real
   `match-flow-panel.tsx` is not edited; the proposed real-component change is spelled out in
   `BLOCKERS.md` for a future production PR if the owner wants it.
3. **B04 was actually re-audited against this same question** (not just assumed) — its fixture's
   chronology already reconciles with the final score by construction, so no refinement applies.

**Fixture-injectability (owner's decision 2) — revised after the audit**: none of the above needed
`MatchTacticsPanel`/`PlanVsRealityPanel`/`CompletedMatchAdvisorPanel` to be fixture-injectable —
the banner fix needs nothing, and the Match Flow note sits beside an already prop-driven component.
Recommend deferring that work to whichever future wave (B07 is the natural one) actually needs to
manipulate one of those panels, rather than building it speculatively now.

## Phase 3 — independent technical review remediation (B1-R1 through B1-R5)

An independent review found five findings, all fixed on this branch. Full writeup in `BLOCKERS.md`;
summary here:

- **B1-R2**: B01's Edit Lineup "successful" assignment left both Sindre and Vetle occupying LCM —
  `withTacticalAssignment()` assigned the incoming player without vacating the slot's incumbent.
  Fixed: the reducer now explicitly displaces the current occupant (role updated coherently both
  ways), never mutates its input, and is self-healing against repeated calls.
- **B1-R3**: B04's "Noah and Sindre have combined for 2 goals in the last 2 matches" claimed a
  cross-match pattern with no second-match record anywhere in the fixture. Fixed with a genuine
  second match record and a rewritten, provable claim ("a goal in each of the last 2 matches").
  Also replaced B04's use of the real `MatchInsights` wrapper (which hardcodes a pre-match heading)
  with a completed-match-appropriate composition over the real `MatchInsightCard`, and added a
  genuine evidence-inspection trigger reusing Gate A's A04 `SourceInspector` grammar — the coach can
  now see the two actual recorded goal events, not just a reference count. B01's two insights were
  separately audited: the opponent "started every meeting" claim and the Tobias RCM-exposure claim
  both had unresolvable `evidenceRefs`; both are now backed by real records.
- **B1-R4**: B01 is the only scenario demonstrating same-match before/after continuity — added a
  read-only AFTER companion at `b01-planned-ready/after/`, sharing B01's exact identity.
- **B1-R5**: B03's reconciliation note exposed implementation commentary to the coach. Rewritten
  to purely factual language.

## B01 — planned, ready — `CONFIRMS_SHIPPED_BASELINE`

- **Identical to production**: composition order (`MatchIdentityCard` → `MatchPreparationWidget`
  → `MatchOpponentMemory` → facts `MetricStrip` → tactical pitch → coaching intent) matches
  `before-match-overview.tsx`'s real, shipped order (ADR-0157 §6). The single readiness signal
  (`MatchPreparationWidget`'s own "X/Y complete" output) is not duplicated anywhere else on the
  page (design-audit finding #1, fixed).
- **New (B1-R4)**: a read-only AFTER-state companion at `b01-planned-ready/after/` shares B01's
  exact match id/identity/kickoff/orientation, now `done` with a recorded 2-1 result — demonstrates
  the register-required before/after lifecycle continuity within one fixture family.
- **Differs**: the real page renders `MatchTacticsPanel` (self-fetching, with its own internal
  Match Insights fetch and mutation surface) where this candidate renders `MatchInsights` directly
  plus a read-only `TouchlinePlanningPitch` + the A07 local-editor pattern. The visual result is
  close but not pixel-identical — the real `MatchTacticsPanel` also contains a formation picker,
  bench management, and absence controls this candidate does not reproduce. `CoachingIntentSelector`/
  `MatchFormatOverrideControls`/`PlannedPlayingTimePanel`/`BeforeMatchSecondaryRow` are omitted
  entirely (see `DATA_TRUTH_AND_FIXTURES.md`) — production's Overview tab is a superset of this
  candidate, not the reverse.

## B02 — planned, incomplete — `CONFIRMS_SHIPPED_BASELINE`

- **Identical to production**: `MatchPreparationWidget`'s incomplete-state rendering,
  `MatchOpponentMemory`'s `null`-returning honest-empty behavior, and `MatchInsights`'s
  `totalCount === 0` empty state are the exact real components, unmodified, and (post-fix) not
  duplicated by any invented banner (design-audit finding #1, fixed).
- **Differs**: same omissions as B01 (no `MatchTacticsPanel`/secondary row).

## B03 — completed, sparse — `PROPOSED_REFINEMENT` (was mislabeled `CONFIRMS_SHIPPED_BASELINE`)

- **Identical to production**: `MatchTimelineList` and `MatchFlowPanel` are the real, unmodified
  components; the sparse-chronology degradation behavior they exhibit here is identical to how
  they would behave in production given the same input.
- **Genuinely differs (proposed, not shipped)**: a reconciliation note rendered immediately after
  `MatchFlowPanel` (coach-facing text: "The recorded event timeline accounts for 1-0 of the final
  6-4 result...", rewritten per B1-R5 to remove implementation commentary) — real production has
  no such disclosure today (design-audit finding #2). It is additive, UI-Lab-local markup computed
  by `chronologyReconcilesWithFinalScore()` (`src/app/dev/ui-lab/gate-b/shared/chronology-reconciliation.ts`),
  not a change to `match-flow-panel.tsx` itself. See `BLOCKERS.md` for the exact proposed real
  change if the owner wants it productionized.
- **Also differs**: `after-match-overview.tsx`'s player-involvement list, final-lineup pitch,
  `PlanVsRealityPanel`, coaching-intent review, and reflection/notes rows are omitted. This
  candidate is a focused subset proving the result-vs-chronology distinction specifically, not a
  full AFTER-tab replacement.

## B04 — completed, rich — `CONFIRMS_SHIPPED_BASELINE` (re-audited, not just assumed)

- **Identical to production**: `MatchFlowPanel`/`MatchTimelineList`/`WhatThisMatchAddedPanel` are
  the real, unmodified components. `chronologyReconcilesWithFinalScore()` is run against this
  fixture too and is `true` by construction, so B03's proposed note correctly never renders here —
  confirmed, not assumed.
- **Differs (B1-R3)**: production's before-match `MatchInsights` wrapper is NOT reused here — it
  hardcodes the pre-match heading "What's useful to know when planning this match.", wrong for a
  completed match. Instead composes the real, separately-exported `MatchInsightCard` under a
  completed-match-appropriate heading, plus a genuine evidence-inspection trigger (reusing Gate A's
  A04 `SourceInspector` grammar) that production's own "Evidence" `<details>` disclosure doesn't
  offer (it only shows a reference count). The underlying insight claim was also rewritten —
  "Noah and Sindre have combined for a goal in each of the last 2 matches" — to match what the
  fixture's two real, distinct source records actually prove.
- **Also differs**: same omissions as B03, plus no `CompletedMatchAdvisorPanel` (see
  `CURRENT_STATE_AUDIT.md` for why).

## Baseline asset reference

No approved golden screenshot exists for any B01-B04 scenario yet (`NOT_READY` per the register).
"Current production" above means the real, already-merged source files cited in
`CURRENT_STATE_AUDIT.md`, read directly in this session — not a prior capture.
