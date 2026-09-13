# Hard Human Gate D — Round Board Conformance Sheet

Phase F6 (`10_IMPLEMENTATION_SEQUENCE_AND_HUMAN_GATES.md`) — the final visual gate of the Atlas
Follow-up bundle. Static-fixture UI Lab only — no production `/rounds/[matchRoundId]` route
touched. Reference decomposition:
`docs/implementation/atlas-followup/reference-decomposition/round-board.md`. Screenshots captured
at 1440×900 (desktop board + allocation) and 390×844 (mobile overview, matches, match squad,
player assignment sheet) — the full required set named explicitly in Phase F6.

## A real bug found and fixed mid-build: name collision with existing Atlas view model

`src/lib/touchline/presentation/round-board-view-model.ts` already existed (Touchline Design
Atlas, ADR-0136) — a narrower "compact summary strip" model for the pre-existing
`/dev/ui-lab/atlas/routes/round-board` fixture, explicitly scoped at the time as *"does not touch
the drag/drop/move mutation model at all."* I wrote this bundle's new, fuller view model directly
into that file with `Write`, which **overwrote** the existing content outright — a real mistake,
caught immediately by `tsc --noEmit` (the old `/dev/ui-lab/atlas/` fixtures file and its route
broke). Fixed by restoring the original content, renaming its exports
(`RoundBoardSummaryStripViewModel`/`buildRoundBoardSummaryStripViewModel`/
`RoundBoardSummaryStripViewModelInput`) so the old route keeps compiling unchanged, and adding
this bundle's fuller model under the bundle's own intended canonical names
(`RoundBoardViewModel`, etc.) alongside it in the same file. Documented here rather than silently
folded into the commit history — a genuine near-miss on "extend, don't duplicate/overwrite."

## What was built

- The renamed/merged `round-board-view-model.ts` (see above) — full `RoundBoardViewModel`
  (status, summary, per-match lanes with players, attention list) plus the separate
  `RoundBoardPlayerAssignmentContext`/`RoundBoardAssignmentSuggestion` contextual model (contract's
  own explicit "Selected-player assignment suggestions are a separate contextual view model" rule).
- Seven new components under `src/components/touchline/round-board/`: `RoundStatusStrip`,
  `RoundAttentionList`, `RoundPlayerRow`, `RoundMatchLane`, `PlayerAssignmentInspector`,
  `PlayerAssignmentSheet`, `AllocationMatrix`.
- `PlayerAssignmentSheet` composes the existing `TouchlineBottomSheet` (Touchline Finish) +
  `PlayerAssignmentInspector`'s shared content body — the desktop inspector and the mobile sheet
  render identical suggestion cards from one implementation, not two.
- `RoundPlayerRow` is `draggable` (desktop accelerator), while every interaction — row click,
  drag, allocation-matrix cell, suggestion-card "Assign" — is wired to call through to the same
  conceptual assignment command (fixture-only `handleAssign()`/`onDropPlayer` stubs in this pass;
  a production wiring would call the real `addPlayerToMatchAction`/`movePlayerWithinRoundAction`
  the existing production Round Board's drag/drop already uses, per the Phase F0 audit's own
  finding that this reuse is already safe).
- `/dev/ui-lab/atlas-followup/round-board` — static fixtures reusing the golden's own
  "Rød / Hvit / Blå" round scenario and player names, with a Board/Allocation desktop toggle and
  full mobile drill-down (Overview → Matches → one match's squad → tap a player → assignment
  sheet).

## Comparison against the golden reference (`01-round-board-approved.png`)

Matches, closely, across all six required captures: attention-forward status strip; three match
lanes with `TeamKitMark` identity, squad/target pill, state pill, progress bar, and dense
Core/Support-grouped player rows; the selected-player inspector with an attention banner and a
suggestion list where the recommended option gets the one dominant filled "Assign player" button
and alternatives stay outlined/muted; the allocation matrix's player × team-shirt-column grid with
coloured dot cells and a highlighted "Needs assignment" row; all four mobile panels (Overview,
Matches, Match squad, Player assignment sheet) reproduce the golden's exact drill-down structure,
including the assignment sheet's sticky dominant "Assign to {team}" footer button.

Deviations:

1. This is genuinely the closest match of all four gates to its golden reference — no major
   compositional deviation was found on review. The main caveat is disclosed above: all
   assignment/drop handlers are fixture-only stubs in this UI-lab pass (contract §6's "behavioural
   command reuse" is a Phase F9 production-migration concern, not something this static fixture
   can prove end-to-end).
2. The golden's fifth attention-strip tile ("Review suggestions", a static explainer card) was not
   built as a separate tile — its content is effectively covered by the attention list + inspector
   already being visually adjacent and always-visible on desktop. A disclosed simplification, not
   an oversight.
3. Suggestion "reason" text is fixture data matching the golden's own illustrative examples ("Good
   squad balance", "Needs CM depth") — a production wiring must source these from real canonical
   planning/suggestion logic, never invent them at render time (contract §5's own explicit rule,
   noted for the Phase F9 implementer).

## Verification run

- `npx tsc --noEmit` — clean (after fixing the name-collision bug above).
- `npx eslint` — clean (0 errors).
- Screenshots captured and reviewed for the full required set: desktop board, desktop allocation,
  mobile overview, mobile match list, mobile match squad, mobile player-assignment sheet.

## Gate

Per `00_AUTHORITY_AND_EXECUTION_CONTRACT.md` §6, this coding session may not self-certify golden
fidelity. No production Round Board route has been touched.

**AWAITING HUMAN VISUAL APPROVAL**

This is the fourth and final visual gate (A/B/C/D) of the Atlas Follow-up bundle. Once approved,
remaining work is production migration (Phases F7–F11) — no further UI-lab/golden-comparison work
is defined in the bundle beyond this point.
