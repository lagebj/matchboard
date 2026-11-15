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

## What was actually broken, and the fix (two passes)

Before this wave, selecting a player affected by a closed match's warning could still show that match (or any other closed match) as a destination in the assignment inspector/sheet, and clicking "Assign player" on it would attempt a real mutation (`handleAssignSuggestion` lacked the `isFinalized` guard `handleMatrixToggle` already had). The first pass:

1. Filtered closed matches out of the suggestion *destination* list entirely, so they never render as an option.
2. Added the same `isFinalized` guard to `handleAssignSuggestion` as defense in depth.
3. Added a `closedNotice` message in the inspector/sheet explaining *why* nothing is assignable, when that is the case.

Independent review (P1-01, P1-03) found two things this pass missed:

- **The Resolve button itself was still unconditional.** Even with the destination-side fix, `RoundBoardRail` rendered "Resolve" for every item whenever `onResolve` existed — a historical, closed-match warning still looked clickable, even though clicking it just opened a read-only inspector. Fixed by adding `RoundBoardAttentionItem.resolvable` (computed from the real per-match boundary in the production adapter) and gating the button on it, not on `onResolve` alone.
- **Only the destination side was guarded — not the source.** A player currently *on* a closed match could still be removed from it, as a side effect of the matrix toggling a different, open match's cell for them, or (originally) of a suggestion-card move into a genuinely open destination. Fixed by moving both boundary checks into `movePlayerToMatch` itself, and — found while re-testing this exact scenario — by also making the suggestion list proactively empty (not just reject-on-attempt) whenever the *selected player's own* current match is closed, since every possible destination would touch that closed source regardless of its own state.

Selecting a player on a closed match still works exactly as before in one respect (opens the inspector, shows identity/position/attention summary) — the historical information is never hidden. What changed is that no action is ever offered when none could legitimately succeed, proactively rather than only after a rejected attempt.

## Verified test matrix (see each scenario's `page.test.tsx` for the assertions)

1. Closed round, unresolved historical warning retained and explained — C05 primary fixture.
2. Closed round, no unresolved warning — `buildC05ClosedNoWarningFixture`.
3. Mixed planning boundary — C05 primary fixture (Rød closed, Hvit open; Hvit's own unresolved player still reaches a valid action; Rød never appears as a destination).
4. Fully open round, valid Resolve action — `buildC05FullyOpenControlFixture`, and C04's own primary scenario.
5. Stale persisted status vs. live boundary — **not** scenario-specific; already covered generically by `src/components/round/__tests__/round-board.test.tsx`'s dedicated describe block ("editing is gated by the live planning boundary, not a persisted status"), which this wave did not need to duplicate.
6. Desktop and mobile read-only behavior — both the desktop lane and the compact match-first drill-in are asserted to show no remove/move/repair action on the closed match's player chips.

Every "forbidden action absent" assertion queries for the control and asserts it is not rendered (`queryByRole(...).toBeNull()`), not merely that it is visually hidden.

## Historical warning provenance (P1-02)

Item 1 above used a `SELECTED_PLAYER_UNAVAILABLE` warning in its first draft — a signal `compute-plan-integrity.ts` only ever generates for `DRAFT` selections, so it could never legitimately co-occur with a finalized/closed match in real production. Fixed by switching to `SQUAD_BELOW_MINIMUM`, which the engine evaluates for every non-cancelled match (draft or finalized selections alike) regardless of its planning boundary — a genuinely retainable historical fact. See `DATA_TRUTH_AND_FIXTURES.md` and `CURRENT_STATE_AUDIT.md` item 10.
