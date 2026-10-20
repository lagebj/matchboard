# Gate B W1 — Blockers and Open Items

## Independent technical review remediation (B1-R1 through B1-R5) — resolved

An independent technical review of this PR found five findings, all now fixed on this branch:

- **B1-R1** (P1) — CI screenshot capture failed for every Gate B scenario: the `<h1>` fix (already
  landed) plus extending the `data-ui-lab-ready`/console-error gates to `gate-b/` routes (matching
  the exact A04/W3/W4 pattern).
- **B1-R2** (P1) — B01's successful lineup assignment created duplicate tactical occupancy
  (Vetle assigned to LCM without removing Sindre, who already occupied it). `withTacticalAssignment()`
  now explicitly displaces the slot's current occupant; see `shared/__tests__/match-b-fixture.test.ts`.
- **B1-R3** (P1) — B04's insight claimed an unsupported cross-match pattern, and evidence
  inspection only showed a reference count. Fixed with a genuine second-match source record and a
  real evidence-inspection composition reusing Gate A's A04 grammar (see `VISUAL_VS_CURRENT.md`).
  B01's two insights were also audited and reclassified/re-backed with resolvable evidence.
- **B1-R4** (P2) — B01 didn't demonstrate same-match before/after lifecycle continuity. Added a
  read-only AFTER-state companion at `b01-planned-ready/after/` sharing B01's exact match identity.
- **B1-R5** (P2) — B03's reconciliation note exposed implementation commentary
  ("MatchFlowPanel", "BLOCKERS.md", "production") to the coach. Rewritten to purely factual,
  coach-facing language; the engineering explanation now lives only in the doc-comment and here.

## Gate B authorization basis

The programme bundle states twice (`00_START_HERE.md`, `07_GOLDEN_AUTHORITY_STORAGE_AND_RELEASE.md`)
that `HANDOFF_READY ≠ GATE_B_AUTHORIZED` and that starting Gate B is a distinct owner decision the
bundle itself does not make. **This PR's authorization is the repository owner's own directive,
given 2026-10-17, to begin Gate B** — not an inference from any `HANDOFF_READY` status in the
recovered documents. Recorded here so a future reader does not mistake the bundle's own
`NOT_READY`/`DIRECTIONAL_ONLY` CSV statuses for "Gate B was never authorized."

## No pre-existing CI capture — attestation not generated in this session

Same disclosed limitation Gate A's W1 recorded: this sandbox's local `next dev` + browser
automation cannot complete hydration here (HMR WebSocket upgrade failure — reproduces on an
untouched page too, see project memory `project_devcontainer_hmr_websocket_blocks_playwright`).
No `capture-attestation.json` is committed in this PR; it must be generated from this PR's own CI
run of `.github/workflows/ui-lab-visual-review.yml` (triggers automatically — see
`REVIEW_RECORD.md`) and added once that run completes. `candidate_manifest.json` in this directory
is deliberately `status: "CANDIDATE"` with no `approval` block, for the same reason.

## Event Match Details has no non-live route (relevant to deferred B06) — resolved to a real gap, not an intentional boundary

`src/app/(app)/o/[orgSlug]/events/[eventId]/matches/[eventMatchId]/` has only `/live` and
`/live/follow` — no plain before/after details page analogous to League's. Checked the documented
product intent rather than guessing: `docs/agents/event-and-league-behavior.md` states "Event
planning has parity with league planning" as a stated product principle, and ADR-0011 already
defines `EventPostMatchReport`/`EventPostMatchPlayer`/`EventGoalEvent` mirroring the league report
structure specifically so event matches get post-match results. **This is a real implementation
gap relative to documented intent, not an intentional live-only design.** When B06 is picked up,
reusing the same real components (`MatchIdentityCard`, `before/after-match-overview` building
blocks) against `EventMatch` data is the cheaper path precisely because the schema already
anticipates it — parity doesn't need to be chased beyond that. B06 itself stays deferred; this
note just removes the ambiguity for whoever picks it up.

## `getRotationVsActual()` `plannedMinutes: 0` — re-verify before reusing `PlanVsRealityPanel`

ADR-0157 flagged a defect in `getRotationVsActual()` (`plannedMinutes` reporting `0` incorrectly)
that needed fixing before any "plan vs reality" section could be trusted. This wave does not
reuse `PlanVsRealityPanel` at all (see `DATA_TRUTH_AND_FIXTURES.md`), so the defect's current
status was not independently re-verified in this session. Whoever makes `PlanVsRealityPanel`
fixture-injectable for a future Gate B wave should confirm this was actually fixed as part of C6,
not assume it from this document.

## CompletedMatchAdvisorPanel not reused — B07's real territory

`CompletedMatchAdvisorPanel` requires `useOrgSlug()` (a React context not present in the dev-only
UI Lab layout) and wires real mutating server actions for its clarification/development-suggestion
cards. This wave avoids it entirely by using the real, separately-exported `MatchInsightCard`
(not the `MatchInsights` wrapper, which hardcodes a pre-match heading — see B1-R3 below) for B04's
"earned finding with source drilldown" requirement instead. B07 (Assistant Coach longitudinal match
context, deferred) is this panel's real territory and should make it fixture-injectable there,
following the same adoption pattern Gate A W4 already proposed for `AssistantCoachHypothesisPanel`
(W4-BLK-10).

## Proposed real-component change: `MatchFlowPanel` final-score reconciliation (design-audit finding #2, not implemented here, not rendered in the UI per B1-R5)

`buildMatchFlowChronology()`'s `trustworthy` flag (`src/lib/matches/completed-match-story.ts`)
only checks whether every goal event has a known minute — it never checks whether the resulting
cumulative tally actually reconciles with the match's real final score. A fully trustworthy but
sparse chronology (B03's exact case: one 23' goal, final score 6-4) renders a `MatchFlowPanel`
ending at a silent "1-0" with no indication that 9 other goals are unaccounted for.

If the owner wants this productionized, the proposed shape is additive and backward-compatible:
give `MatchFlowPanel` an optional `finalScore: { own: number; opponent: number } | null` prop
(defaulting to `null`, current behavior unchanged). When provided and the chronology is
`trustworthy`, compare the last point's `ownGoals`/`opponentGoals` to `finalScore` and render a
short disclosure line when they differ — exactly what this wave's B03 candidate demonstrates via
`src/app/dev/ui-lab/gate-b/shared/chronology-reconciliation.ts` (UI-Lab-local only; not wired into
the real component in this PR). This would be a separate, small production PR, not part of this
Gate B UI Lab wave.

## Known scope reductions (not gaps — logged choices)

See `DATA_TRUTH_AND_FIXTURES.md` for the full list of real mid-level components deliberately not
reused (`MatchTacticsPanel`, `PlanVsRealityPanel`, `PlannedPlayingTimePanel`,
`CoachingIntentSelector`, `MatchFormatOverrideControls`) and why. None of these omissions make any
B01-B04 register requirement untrue; they narrow what this candidate wave visually proves relative
to the full real Overview tab.
