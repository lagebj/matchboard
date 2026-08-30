# ARR-0038: Event match lineups have no real planning-boundary editability gate

## State

Confirmed

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

Pending — not resolved in the coach-workflow-simplification programme. Building a full
Event-match planning-boundary equivalent (a new concept, since `EventMatch` has no
`planningClosedAt` and Event's live-session/report timing model differs in shape from League's)
was judged out of the safely-achievable scope of that programme's line-up-confirmation cleanup;
recorded here rather than left as a silent gap.

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
