# ARR-0038: Event match lineups have no real planning-boundary editability gate

## State

Resolved — ADR-0126 (Consolidation Programme C2), 2026-09-09. See "Resolution" below.

## Identified

2026-08-30

## Residue

`EventMatchLineup.status` uses the shared `MatchLineupStatus` enum (`DRAFT`/`CONFIRMED`/`ARCHIVED`),
and `event-lineup-actions.ts` previously guarded six mutation functions
(`assignPlayerToLineupSlot`, `removePlayerFromLineupSlot`, `clearEventMatchLineup`,
`deleteEventMatchLineup`, `changeEventMatchLineupFormation`, `autoFillEventMatchLineup`) with
`if (lineup.status === 'CONFIRMED') throw ...`. No write path anywhere in the codebase ever sets
`EventMatchLineup.status` to `'CONFIRMED'` — `createEventMatchLineup` always creates it as
`'DRAFT'`, and no other function updates that field. The only function that referenced
`'CONFIRMED'` as a write target (`saveEventMatchLineup`, which set status back to `'DRAFT'`) had
zero callers. The UI (`event-match-lineup-panel.tsx`) independently checked
`lineup.status === 'CONFIRMED'` to gate slot-click and the pitch view's `readOnly` prop.

In effect, an Event match lineup has **no editability gate at all** — not the (dead) CONFIRMED
check, and not the real-world planning-boundary check League match lineups now use
(`isMatchPlanningEditable()`, ADR-0109 §6). This is pre-existing: the CONFIRMED check was already
unreachable before this programme touched it, so its removal here (part of the coach-workflow-
simplification programme's line-up-confirmation cleanup) changes nothing observable — it deletes
dead code, it does not remove a gate that was actually enforcing anything.

## Intended architecture

Per ADR-0109 §6 and PRINCIPLES.md #13 ("shared domain meaning across League and Events"), League
and Event match line-up editability should share the same real-world planning-boundary concept:
editable while planning is open, read-only once the match's own kickoff has passed or its live
reporting has started. League now gets this via `isMatchPlanningEditable()`
(`src/lib/selection/planning-boundary.ts`), which is typed against the League `Match` model.
Event has no equivalent boundary function — `EventMatch` is a distinct Prisma model with its own
`startsAt` and no `planningClosedAt` field, and `EventMatchLineup`/`EventMatchLineupAssignment`
mutations have no boundary check calling into anything analogous.

## Evidence

- `src/app/(app)/events/[eventId]/event-lineup-actions.ts` — six mutation functions with no
  editability gate of any kind after the dead CONFIRMED checks were removed (commit in the
  coach-workflow-simplification branch, `feat(events)`/`refactor(lineups)` series).
- `src/app/(app)/events/[eventId]/event-match-lineup-panel.tsx` — `handleSlotClick`/`readOnly`
  prop no longer reference lineup status; nothing replaces it.
- `prisma/schema.prisma` — `EventMatch` has no `planningClosedAt` field; `EventMatchLineup.status`
  keeps the shared `MatchLineupStatus` enum for schema-level compatibility only.
- `src/lib/selection/planning-boundary.ts` — `isMatchPlanningEditable()`/
  `isMatchRoundPlanningEditable()` are typed against `db.match`/`db.matchRound` (League-only).

## Impact

- A coach can edit an Event match's lineup at any time, including after the match has actually
  been played or is live-in-progress, with no server-side rejection. This was already true before
  this programme (the CONFIRMED check never fired), so it is not a regression introduced here —
  but it is a real, verified gap in write-time protection for Event match lineup data, distinct
  from League's now-real boundary.
- Historical Event match lineup edits after actual play are not currently prevented or flagged
  anywhere in the Event post-match/evidence pipeline; whether that pipeline tolerates a
  post-hoc-edited lineup has not been separately audited as part of this finding.

## Containment

- Do not reintroduce `EventMatchLineup.status === 'CONFIRMED'` (or any other status-based check)
  as a substitute editability gate — it repeats the same dead-end pattern this ARR documents.
- Do not build a second, Event-specific planning-boundary implementation that duplicates
  `isMatchPlanningEditable()`'s logic; when this is resolved, either generalize that function to
  accept an `EventMatch` ref or extract its boundary-condition logic into a shared predicate both
  `Match` and `EventMatch` adapters call.

## Resolution criteria

- `EventMatch` (or a resolvable per-match Event timing concept) has a real editability boundary
  reachable from `event-lineup-actions.ts`'s six mutation functions, consistent with the League
  definition (kickoff passed, or live reporting started, closes editing).
- A regression test proves an Event match lineup mutation is rejected once its match's boundary
  has closed, mirroring the League `lineup-actions.ts` test coverage.
- `event-match-lineup-panel.tsx` reflects the same boundary in its read-only UI state.

## Disposition

Resolved (ADR-0126, Consolidation Programme C2).

## Resolution

The shared-predicate option from "Containment" above was taken. `isPlanningBoundaryClosed()`
(`src/lib/selection/planning-boundary.ts`) is now the one pure definition of a closed pre-match
planning boundary. `isMatchPlanningEditable()` (League) is a thin `Match`-loading adapter over it
with its lazy baseline-capture side effect unchanged; `isEventMatchLineupEditable()`
(`src/lib/events/event-planning-boundary.ts`) is the `EventMatch` adapter, passing
`planningClosedAt: null` (Event has nothing to freeze) and an explicit `reportStatus` check.

- `event-lineup-actions.ts`'s seven mutation functions (`createEventMatchLineup`,
  `assignPlayerToLineupSlot`, `removePlayerFromLineupSlot`, `clearEventMatchLineup`,
  `deleteEventMatchLineup`, `changeEventMatchLineupFormation`, `autoFillEventMatchLineup`) call
  `requireEventLineupEditable()` — an Event match line-up mutation is rejected once kickoff has
  passed, live reporting has started, or a post-match report exists.
- `event-match-lineup-panel.tsx` fetches `getEventMatchLineupEditableAction()` on load, renders
  its controls read-only and shows a "Planning closed" badge when the boundary has closed.
- Regression tests: `src/lib/events/__tests__/event-planning-boundary.test.ts` (shared predicate
  + Event adapter, incl. a League/Event parity assertion);
  `src/app/(app)/events/[eventId]/__tests__/event-lineup-actions.test.ts` fixture dates moved to
  the future now that the boundary is enforced.

`EventMatchLineup.status` (`DRAFT`/`CONFIRMED`/`ARCHIVED`) is retained in the schema for
historical rows only — no code reads it for editability, nothing writes `CONFIRMED` (contract
residue, not this ARR's concern).

## Related decisions

ADR-0109 (Derived Coach Workflow Lifecycle and Manual-Intent Precedence), §6.

## Related implementation

coach-workflow-simplification branch: removal of the six dead `CONFIRMED` guards and the unused
`saveEventMatchLineup()` function in `event-lineup-actions.ts`.

## Supersedes

None.

## Superseded by

None.

## History

- 2026-08-30: Identified and confirmed while implementing ADR-0109 §6 (line-up confirmation
  removal) for League match lineups; Event's equivalent state was audited as part of the same
  workstream and found to already have no real gate.
