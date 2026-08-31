# ADR-0101: Match Lifecycle Status Supersedes Round Status as the Primary Per-Match Label

## Status

Accepted

## Context

ADR-0100 scoped Phase 6 (Lifecycle Consolidation) deliberately narrowly, having found that AGENTS.md's existing rule — *"The app uses exactly these visible status labels: Not generated, Draft, Blocked, Ready, Finalized. No alternative visible status terms for the same state may be introduced"* — directly forbade introducing DECISIONS.md's target lifecycle vocabulary (Planning open / Upcoming / Live / Played / Report incomplete / Done) as the primary status. ADR-0100 therefore only added round progress as an *additive* line, never replacing the required label.

The maintainer has since explicitly instructed: **"The intent of this programme must override and redefine what AGENTS.md or other supporting documentation states, the change introduced by this programme is intentional."** This is an explicit decision to supersede the prior rule, not an inference from DECISIONS.md's vocabulary alone — the missing authority ADR-0100 identified as the blocker.

## Decision

1. **A new primary, football-action-oriented match lifecycle status supersedes Draft/Blocked/Ready/Finalized as the label shown for a single match.** `deriveMatchLifecycleStatus()` (`src/lib/selection/planning-boundary.ts`) computes one of: `planning_open`, `planning_closed`, `live`, `played`, `report_incomplete`, `done`, `cancelled`. Rendered via `MatchLifecycleBadge` (`src/components/ui/status-badge.tsx`).

2. **Report status wins over round-finalization status.** A round can be finalized (the plan locked) long before its match is actually played — finalizing the plan and completing the report are different facts, and AGENTS.md's own pre-existing "Fixtures result display rules" already established this ("Finalized does not mean the match has been played or reported"). `deriveMatchLifecycleStatus()` checks report status and live/played state *before* falling back to round-finalization/planning-boundary state, so a finalized-but-unplayed match correctly shows "Planning closed", not "Done". The previously-shipped `deriveMatchPlanningStatus()` (ADR/Phase 1) collapses `FINALIZED` straight to a terminal `"finalized"` result regardless of whether the match has been played — that function is kept as-is (it answers a narrower, still-valid question: "is planning currently editable"), but is no longer used to answer "what should the coach see as this match's status".

3. **`RoundStatus`/`NOT_GENERATED`/`DRAFT`/`BLOCKED`/`READY`/`FINALIZED` are not removed.** They remain the correct internal vocabulary for selection-planning completeness (plan integrity signals, override requirements, `computeRoundPlanIntegrity()`, finalize/un-finalize mutations) and continue to be computed and stored exactly as before. What changes is their *display role*: no longer the primary label for a single match, though still usable as secondary/internal detail (e.g. round-level or aggregate contexts) or surfaced within `planning_open`/`planning_closed` when a decision is actually required ("Planning open — 2 decisions needed").

4. **The underlying finalize/un-finalize mechanism and database enums are unchanged.** This decision is about the *display and derivation* layer — which fact is shown to the coach as primary, and how it's computed from existing state — not a schema or mutation change. Selections still transition DRAFT→FINALIZED exactly as before; `Selection.status`, `MatchRound.status`, and every mutation in `round-finalization-transitions.ts` are untouched.

## Rollout

Applied as the primary status on:
- Today (`TodayMatch`)
- Fixtures/League page (per-match status, kept visually distinct from the separate FT-score/W-D-L result display — those remain two different facts, per the existing "Fixtures result display rules")
- Match detail page header

Round-level surfaces (Rounds list, Round Board) retain their existing Draft/Blocked/Ready/Finalized `StatusBadge` for the round as a whole, since a round aggregates multiple matches that can each be at a different lifecycle stage — `deriveRoundProgress()` (ADR-0100) remains the correct round-level aggregate, not a per-match replacement.

## Consequences

- A coach looking at any single match now sees one clear, football-action label instead of a state-machine name, matching DECISIONS.md's stated goal without waiting for a full finalize/unfinalize interaction redesign.
- `deriveMatchPlanningStatus()`'s pre-existing "finalized" bug (collapsing round-finalized to a terminal state regardless of whether the match was played) is not fixed in place — it is superseded by the new function for display purposes, and left alone for its narrower editability-check use.
- No database migration. No change to finalize/un-finalize mutations, audit logging, or historical data.

## Migration

None — pure derivation/display layer addition. `RoundStatus` type and all round/selection status transitions are unchanged.

## Supersedes

The "no alternative visible status terms" clause of AGENTS.md's prior "Status vocabulary" rule, for the single-match display case only. The underlying `RoundStatus` vocabulary itself is not superseded — it continues to exist and is used exactly as before for its original (planning-completeness) purpose.

## Extended (2026-08-30)

ADR-0109 extends this ADR's pattern to the round level: `deriveRoundProgress()` (ADR-0100) becomes
the primary round-level signal, mirroring how this ADR promoted `deriveMatchLifecycleStatus()` at
match level — the "full Phase 6... remains open" gap this ADR named is closed there. ADR-0109 also
removes the coach-operated finalize/un-finalize mechanism itself (superseding ADR-0095/ADR-0100 on
that point); this ADR's match-level derivation logic and status values are unchanged and remain in
effect.
