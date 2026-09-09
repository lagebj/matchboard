# ADR-0126: One shared planning-boundary predicate for League and Event match line-ups

## Status

Accepted

## Context

ADR-0109 §6 removed line-up "confirmation" ceremony for both League and Event: a match line-up
is authoritative and editable while planning is open, then read-only once the match's real
planning boundary closes. League match line-ups got this via
`isMatchPlanningEditable()`/`isMatchRoundPlanningEditable()` (`src/lib/selection/planning-boundary.ts`),
typed against the League `Match` model.

Event match line-ups did **not** converge (ARR-0038, `Confirmed`/`Pending`). The dead
`EventMatchLineup.status === 'CONFIRMED'` guards were removed but nothing replaced them:
`event-lineup-actions.ts`'s seven mutation functions had **no editability gate of any kind** —
an Event match line-up could be edited after kickoff, mid-live-match, or after its post-match
report was locked, with no server-side rejection. `EventMatch` is a distinct Prisma model with
its own `startsAt`, no `planningClosedAt`, and no round.

ARR-0038's own resolution guidance: *"either generalize `isMatchPlanningEditable()` to accept an
`EventMatch` ref, or extract its boundary-condition logic into a shared predicate both `Match`
and `EventMatch` adapters call"* — and explicitly *"do not build a second, Event-specific
planning-boundary implementation that duplicates `isMatchPlanningEditable()`'s logic."*

## Decision

**One pure predicate, two thin adapters.**

`isPlanningBoundaryClosed(facts: PlanningBoundaryFacts): PlanningBoundaryResult`
(`src/lib/selection/planning-boundary.ts`) is the single definition of when a pre-match planning
boundary is closed. Pure — no DB, no side effects. It decides, in order: cancelled → persisted
`planningClosedAt` marker → live session `ACTIVE` → a post-match report exists → scheduled
kickoff passed.

- **League adapter** — `isMatchPlanningEditable()` loads the `Match` and calls the predicate with
  its persisted `planningClosedAt`, then layers the existing lazy baseline-capture side effect
  (`ensureMatchPlanningBaselineCaptured`) when it observes the boundary has just closed. Behaviour
  and reason strings are unchanged; it does not pass `reportStatus` (a League report only ever
  exists after capture already closed the boundary).
- **Event adapter** — `isEventMatchLineupEditable(eventMatchId)`
  (`src/lib/events/event-planning-boundary.ts`) loads the `EventMatch` (status, `startsAt`, live
  session status, post-match report status) and calls the same predicate with
  `planningClosedAt: null` (Event has nothing to freeze — no `Selection`/`MovementLedger`/round/
  availability snapshot) and `reportStatus` set. `requireEventLineupEditable()` gates all seven
  `event-lineup-actions.ts` mutation functions; `event-match-lineup-panel.tsx` renders a
  read-only state and a "Planning closed" badge from `getEventMatchLineupEditableAction()`.

### Intentional League/Event differences, kept in the adapters

| Concern | League | Event |
|---|---|---|
| Persisted close marker | `Match.planningClosedAt` (historical baseline frozen) | none — editability is purely derived; a genuine reschedule moving `startsAt` forward re-opens editing automatically |
| Baseline capture side effect | yes (`ensureMatchPlanningBaselineCaptured`) | none — nothing to capture |
| Post-match report closes editing | implied (report only exists post-capture) | explicit `reportStatus` check |
| Round-level boundary | `isMatchRoundPlanningEditable()` | n/a — Event squads are not rounds |

### Explicitly out of scope (unchanged, ADR-0109 §7/§7a)

Whole-`Event.status` finalize and the whole-`EventSquad` set lock remain separate "this
container is done" assertions, not per-match planning ceremony. `EventMatchLineup.status`
(`DRAFT`/`CONFIRMED`/`ARCHIVED`) stays in the schema for historical rows; no code reads it for
editability and nothing writes `CONFIRMED`.

## Consequences

- ARR-0038 is resolved: Event match line-up mutations are rejected server-side once the boundary
  closes, mirroring League, with a regression test.
- Any future planning-boundary rule (e.g. a new closing condition) is added once, in
  `isPlanningBoundaryClosed`, and both containers inherit it.
- Two test fixtures that hard-coded past `startsAt` dates (`event-lineup-actions.test.ts`,
  `coaching-actions.test.ts` was handled in C1) had to move to computed future dates now that
  the Event path enforces the boundary — the same fixture-staleness the League gates surfaced.

## References

- ARR-0038 (resolved by this ADR)
- ADR-0109 §6 (line-up confirmation removed), §7/§7a (retained container assertions)
- Consolidation Programme C2 (`.matchboard-work/consolidation-programme/`)
