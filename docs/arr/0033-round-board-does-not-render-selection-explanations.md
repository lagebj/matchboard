# ARR-0033: Round Board does not render selection explanations

## State

Identified

## Identified

2026-08-27

## Residue

AGENTS.md documents "Round Board uses Plan integrity, Planning notes and Why this selection" and a full Explanation model: every non-obvious selection should be explainable via structured `explanations` records (`buildExplanation()` in `src/lib/selection/explanation-generation.ts`), attached to each `SelectedPlayer.explanations` during `generateSelection()` and persisted to `Selection.explanation` (JSON) by `save-generated-draft.ts`.

The Round Board's own server page (`src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx:257-275`) does parse `Selection.explanation` JSON back out into `explanations`, `selectionReason`, and `priorityScore`, and includes them in the per-player object it builds. But `src/components/round/round-board.tsx` — the client component that actually renders player chips and match columns — defines its `PlayerInColumn` prop type (`round-board.tsx:55-68`) with **no `explanations`, `selectionReason`, or `priorityScore` field at all**. Those three fields are computed, persisted, and even re-parsed by the page, then silently dropped before reaching the component that would display them. A full-file grep of `round-board.tsx` for `explanation|reasons|whyText|selectionReason|Why` returns zero matches. `<PlayerChip>` instances are never given the component's own `tooltip` prop (`src/components/ui/player-chip.tsx:38`, "Provide a meaningful explanation"), and no click-driven detail dialog surfaces explanation content either.

This is not a wholesale data-passing failure: a sibling field from the same parsed object, `manualOverride`, *is* consumed (`round-board.tsx:158`, to show an override badge) — proving the page→component pipeline works and this omission is specific to the explanation fields.

Discovered while wiring Phase 4/7 of the evidence-driven-coaching-loop programme: combination-evidence explanation strings (`explainCombinationEvidence()`) were added to the same `explanations` array in `generate-selection.ts`, extending the correct canonical owner — but they land in exactly this dead end. The explanation data is real, computed, and persisted; it currently reaches only two other surfaces in the whole app (the admin policy workbench's diagnostics view, and `team-review-page.tsx`'s unrelated singular `.explanation` field) — neither is the coach's normal Round Board workflow.

## Intended architecture

Per AGENTS.md's Explanation model: "If the UI cannot explain a selection result, the engine must provide the explanation" — implying the engine's explanation output is meant to be coach-visible from the Round Board, the primary squad decision surface. One computed/persisted explanation model, rendered where the coach actually makes and reviews selection decisions.

## Evidence

- `src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx:257-275` — parses and computes `explanations`/`selectionReason`/`priorityScore` per player, unused downstream
- `src/components/round/round-board.tsx:55-68` — `PlayerInColumn` type omits all three fields; 1285-line component has zero references to explanation content
- `src/components/ui/player-chip.tsx:38` — `tooltip` prop exists and is documented for exactly this purpose, never passed a value from `round-board.tsx`
- `src/lib/selection/explanation-generation.ts`, `src/lib/selection/generate-selection.ts`, `src/lib/selection/save-generated-draft.ts` — compute and persist the data that never reaches this surface

## Impact

- The engine's per-selection explanations (rotation-path rationale, fairness/priority reasoning, position-match caveats, and — as of this programme — combination-evidence context) are invisible to a coach using the Round Board, the app's primary squad-decision surface.
- A coach cannot currently ask "why was this player selected?" from the Round Board itself, despite AGENTS.md documenting this as required behavior and the engine already producing the answer.
- Newly-added combination-evidence explanations (Phase 4/7 of this programme) inherit the same gap — they are real and tested at the data layer but not yet coach-visible in the primary workflow.

## Containment

- Do not build a second, competing explanation computation to work around this — the existing `explanations`/`Selection.explanation` pipeline is correct and should be the one surfaced.
- Any Round Board UI work should thread `explanations`/`selectionReason` through `PlayerInColumn` and render them via `PlayerChip`'s existing `tooltip` prop or an expandable detail affordance, not invent a new data shape.

## Related implementation

- `src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx`
- `src/components/round/round-board.tsx`
- `src/components/ui/player-chip.tsx`
- `src/lib/selection/explanation-generation.ts`
- `src/lib/selection/generate-selection.ts`
- `src/lib/selection/save-generated-draft.ts`

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-27

Record created. Identified while verifying that new combination-evidence explanations (evidence-driven-coaching-loop programme, Phase 4/7) actually reach the coach. Migration/UI fix deferred to Phase 7 evidence-surfacing follow-up work.
