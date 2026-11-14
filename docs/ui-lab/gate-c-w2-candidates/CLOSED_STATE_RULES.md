# Gate C W2 — Closed-State Interaction and Permission Rules (C05)

## The authoritative boundary

`isMatchRoundPlanningEditable()` (round-level) and `isMatchPlanningEditable()` (per-match), both in `src/lib/selection/planning-boundary.ts`, are the only authoritative gates. Persisted `MatchRound.status` is deliberately never consulted (ADR-0109) — a round finalized by a pre-ADR-0109 coach action can carry a stale `"FINALIZED"` status while its matches never actually closed, and the reverse can also happen. This wave adds no second status source; every closed-state rule below is driven by the same two functions production already uses.

## Round-level vs. per-match: the mixed-boundary rule

`isMatchRoundPlanningEditable()` requires **every** non-cancelled match in the round to still be open — closing any one match closes the round-level gate. This means:

- The round-level "Planning closed" banner and the Regenerate/Clear buttons' visibility are an **all-or-nothing** signal: one closed match is enough to show the banner and hide Regenerate/Clear, even if other matches remain fully open.
- Each match's own editability (`MatchColumn.isFinalized`) is independent and per-match — drag/drop, add, remove, repair, and (as of this wave) suggestion-card assignment are all gated per match, not by the round-level flag.

The C05 primary fixture is deliberately a genuine mixed boundary (Rød closed, Hvit open) specifically to prove the second rule holds even when the first makes the round "look" closed.

## Three severities, one presentation-only addition

- `BLOCKED` / `DECISION_REQUIRED` are the existing canonical severities (`PlanIntegritySignalKind`) — unchanged, never persisted differently by this wave.
- `HISTORICAL_UNRESOLVED` is **not** a new domain severity and is not persisted anywhere. It is purely a presentation fact this wave observes: a `BLOCKED`/`DECISION_REQUIRED` signal that is still unresolved *and* whose match has since closed reads, to a coach, as "this is now history, not a thing I can go fix" — without that signal's own `kind` ever changing. No code encodes `HISTORICAL_UNRESOLVED` as a value; it describes the C05 fixture's situation in prose only.

## What was actually broken, and the fix

Before this wave, selecting a player affected by a closed match's warning could still show that match (or any other closed match) as a destination in the assignment inspector/sheet, and clicking "Assign player" on it would attempt a real mutation (`handleAssignSuggestion` lacked the `isFinalized` guard `handleMatrixToggle` already had). This wave:

1. Filters closed matches out of the suggestion list entirely, so they never render as an option (not merely a disabled one).
2. Adds the same `isFinalized` guard to `handleAssignSuggestion` as defense in depth.
3. Adds a `closedNotice` message in the inspector/sheet explaining *why* nothing is assignable, when that is the case — never a silent empty list with no explanation.

Selecting a player on a closed match still works exactly as before (opens the inspector, shows identity/position/attention summary) — only the *action* changed, not the *visibility* of historical information.

## Verified test matrix (see each scenario's `page.test.tsx` for the assertions)

1. Closed round, unresolved historical warning retained and explained — C05 primary fixture.
2. Closed round, no unresolved warning — `buildC05ClosedNoWarningFixture`.
3. Mixed planning boundary — C05 primary fixture (Rød closed, Hvit open; Hvit's own unresolved player still reaches a valid action; Rød never appears as a destination).
4. Fully open round, valid Resolve action — `buildC05FullyOpenControlFixture`, and C04's own primary scenario.
5. Stale persisted status vs. live boundary — **not** scenario-specific; already covered generically by `src/components/round/__tests__/round-board.test.tsx`'s dedicated describe block ("editing is gated by the live planning boundary, not a persisted status"), which this wave did not need to duplicate.
6. Desktop and mobile read-only behavior — both the desktop lane and the compact match-first drill-in are asserted to show no remove/move/repair action on the closed match's player chips.

Every "forbidden action absent" assertion queries for the control and asserts it is not rendered (`queryByRole(...).toBeNull()`), not merely that it is visually hidden.
