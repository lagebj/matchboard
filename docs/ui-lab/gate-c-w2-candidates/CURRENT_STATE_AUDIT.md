# Gate C W2 — Current Production State Audit

Classification per the brief: `CONFIRMS_SHIPPED_BASELINE`, `PROPOSED_REFINEMENT`, `MISSING_CAPABILITY`, `BLOCKED_BY_SOURCE_OR_AUTHORITY`.

## 1. Exception-first round summary, multiple match lanes, tap-first selection, inspector, sheet, allocation matrix, drag/drop/explicit move, suggestion reasons, contextual rail, live planning-boundary checks, plan-integrity signals, server-controlled mutations

**CONFIRMS_SHIPPED_BASELINE.** All present and working exactly as the brief describes before this wave touched anything. Verified by direct read of `src/components/round/round-board.tsx`, `src/app/(app)/o/[orgSlug]/rounds/[matchRoundId]/page.tsx`, `src/lib/selection/compute-plan-integrity.ts`, `src/lib/selection/planning-boundary.ts`. Not re-described further here; see the reference decomposition doc for the full baseline anatomy.

## 2. Eligible-player coverage denominator (C04)

**MISSING_CAPABILITY, now fixed.** `computeRoundPlanIntegrity()` already returns `coverage: {eligibleAvailablePlayerCount, assignedEligibleAvailablePlayerCount, unassignedEligibleAvailablePlayerIds}` (`compute-plan-integrity.ts:528-532`) — but `page.tsx` never read `integrity.coverage`, and `round-board.tsx` separately recomputed its own "available players" count client-side (`unassignedPlayers.length`), and that recomputed value was passed into a `RoundBoardAdapterInput.availablePlayerCount` field the adapter never actually consumed (dead parameter — confirmed by reading `buildRoundBoardViewModel`'s full body). No canonical coverage number reached the UI at all.

**Fix** (this PR): `page.tsx` now forwards `integrity.coverage` to `<RoundBoard coverage={...}>`; `round-board.tsx` passes it through to `buildRoundBoardViewModel` as a new `eligibleCoverage` field on `RoundBoardSummary`; `RoundStatusStrip` renders it as its own tile, labeled "Eligible players with an opportunity ({pct}%)", explicitly distinct from "Opportunities planned ({pct}%)" (squad placements). The dead `availablePlayerCount` parameter was removed rather than left alongside the real fix.

**Naming nuance (disclosed, not changed):** `coverage.eligibleAvailablePlayerCount`/`assignedEligibleAvailablePlayerCount` are **not** availability-filtered despite the name — they count all eligible active players (active, not removed, core team has a playable fixture this round) regardless of current availability status. Only the separate `unassignedEligibleAvailablePlayerIds` list is availability-filtered. See `OPPORTUNITY_COVERAGE_SEMANTICS.md`.

## 3. Closed-destination assignment gap (C05)

**MISSING_CAPABILITY (a real defect), now fixed.** `handleMatrixToggle` already checked `target.isFinalized` before assigning (`round-board.tsx`, pre-existing). `handleAssignSuggestion` — the suggestion-card/inspector/sheet commit path — had no equivalent check, and `buildAssignmentContext`'s caller offered every other match as a destination regardless of `isFinalized`. A closed match could render as an assignable suggestion and accept an assignment from the inspector or mobile sheet.

**Fix** (this PR): the destination list is now filtered to `!m.isFinalized` before being passed to `buildAssignmentContext`, so a closed match never appears as a suggestion at all (not merely disabled after being shown); `handleAssignSuggestion` additionally gained the same `target.isFinalized` guard as `handleMatrixToggle`, as defense in depth. A new `closedNotice` message explains why nothing is assignable when every other match has closed (not a blank "no suggestions" with no explanation).

## 4. `RoundBoardRail`'s `onResolve` button

**CONFIRMS_SHIPPED_BASELINE — no change needed.** `onResolve` only opens the inspector (selection, not a mutation); it is wired unconditionally in production, with no planning-boundary gate. This is correct as-is: a closed round's historical warning must remain selectable to show its context (brief: "Historical details may remain accessible"). The literal risk was never the button itself, but what it opened — fixed in item 3 above.

## 5. Allocation matrix is never reachable once the round-level boundary is closed

**CONFIRMS_SHIPPED_BASELINE, with a worth-noting consequence (not a defect).** The Board/Allocation toggle only renders inside `{planningBoundaryOpen && (...)}`, and round-level `planningBoundaryOpen` is only `true` when every match in the round is open (`isMatchRoundPlanningEditable`, ADR-0109). Consequently, the Allocation matrix is structurally unreachable in any round with even one closed match — there is no "reachable but per-cell-guarded" matrix state to exercise for a mixed or fully-closed round. `handleMatrixToggle`'s own `target.isFinalized` check is therefore unreachable dead code in production today (it can only matter if a future change decouples the toggle's visibility from the round-level gate). Not fixed — removing defensive code that is harmless, or changing the toggle's gating, is outside this wave's bounded scope and not required by any C04-C06 acceptance question.

## 6. Position vocabulary in Round Board (C06)

**BLOCKED_BY_SOURCE_OR_AUTHORITY.** Direct audit of `prisma/schema.prisma`, `src/domain/positions/`, and every repo-wide consumer of `CANONICAL_TACTICAL_POSITIONS`/`SOURCE_ROLES` confirms:

- `Selection` (the model Round Board mutates) has a `role: SelectionRole` field — a planning *category* (CORE/SUPPORT/BACKFILL/DEVELOPMENT/CONFIDENCE_REBUILD/...), not a position. No position field exists on `Selection` at all.
- `Player.primaryPosition`/`secondaryPosition`/`tertiaryPosition` are unconstrained free-text strings — never validated against either vocabulary.
- The 24-code `CANONICAL_TACTICAL_POSITIONS` vocabulary is genuinely owned by a *different* feature: the Lineup/Formation editor (`FormationSlot.gridX/gridY` → `canonicalPositionForCell`, `src/app/(app)/matches/[matchId]/page.tsx`, `src/components/formations/`). It is also written as live-match evidence (`ActualPositionInterval.position`, via `live-match-client.tsx`'s position-correction flow) — a different concept again (realised evidence, not a plan).
- `projectToBaseRole` (`src/domain/positions/compatibility-projection.ts`) is the real ADR-0154 projection, mapping 24-code → 12-code `ExactRole` + side. It has zero callers anywhere in the Round Board component tree, view-model, or adapter.

Round Board's assignment is, and has always been, player×match only (`AllocationMatrixRow.assignments: Record<matchId, boolean>`). There is no exact tactical-position data to "retain precision" on within this surface — fabricating one here would be exactly the "invent a new tactical placement system" the brief forbids.

**Disclosure, not fabrication** (this PR): the assignment inspector continues to show `Player.primaryPosition` exactly as production already did (free text, unchanged). A new, small, honest addition — a "View exact position in Lineup →" link from the inspector to the selected player's current match (`/matches/{matchId}`), shown only once a match assignment exists — is the "correct canonical context or navigation" the brief explicitly allows in place of fabricated precision. See `POSITION_VOCABULARY_AND_PRECISION.md`.

## 7. Command/presentation boundary for UI Lab

**MISSING_CAPABILITY, now built.** `round-board.tsx` imported five server actions directly at module scope, with no way to inject a safe stand-in for UI Lab. A new `RoundBoardCommands` optional prop (default: the same five real actions, so production — which never passes it — is byte-for-byte unchanged) lets `RoundBoardFixtureHarness` supply deterministic in-memory responses. Verified via two new component tests asserting the injected command is called instead of the real action, and that omitting `commands` falls back to the real action.
