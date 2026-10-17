# Gate B W1 — Blockers and Open Items

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

## Event Match Details has no non-live route (relevant to deferred B06)

`src/app/(app)/o/[orgSlug]/events/[eventId]/matches/[eventMatchId]/` has only `/live` and
`/live/follow` — no plain before/after details page analogous to League's. Whoever picks up B06
(League/Event parity) should confirm whether that gap needs a new production route before
attempting parity, or whether Event matches are intentionally live-only today. Not investigated
further here — B06 is out of scope for this wave.

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
cards. This wave avoids it entirely by using `MatchInsights`/`MatchInsightCard` for B04's "earned
finding with source drilldown" requirement instead. B07 (Assistant Coach longitudinal match
context, deferred) is this panel's real territory and should make it fixture-injectable there,
following the same adoption pattern Gate A W4 already proposed for `AssistantCoachHypothesisPanel`
(W4-BLK-10).

## Known scope reductions (not gaps — logged choices)

See `DATA_TRUTH_AND_FIXTURES.md` for the full list of real mid-level components deliberately not
reused (`MatchTacticsPanel`, `PlanVsRealityPanel`, `PlannedPlayingTimePanel`,
`CoachingIntentSelector`, `MatchFormatOverrideControls`) and why. None of these omissions make any
B01-B04 register requirement untrue; they narrow what this candidate wave visually proves relative
to the full real Overview tab.
