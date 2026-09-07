# ADR-0122: Event Finalization Is Not Blocked by Squad-Composition Quality

## Status

Accepted

## Context

`finalizeEventAction()` (`src/app/(app)/events/event-finalization-actions.ts`) flips
`Event.status` DRAFT → FINALIZED. Per ADR-0109 §7 this is a deliberately retained,
whole-container "this event is over" assertion — coarser than, and unrelated to, the
per-round/per-match planning ceremony that ADR-0109 removed. A coach finalizes an event
**after its matches have been played and reported**.

`validateEventForFinalization()` (`src/lib/events/event-finalization-validation.ts`) gated that
transition. It treated the following as **blocking** (`valid: false`, finalization refused):

- `no_squads` — event has zero `EventSquad` rows
- `empty_squad` — a squad with no players assigned
- `squad_below_minimum` — a squad below its `minSize`
- `unavailable_player_in_squad` — a pool player marked `UNAVAILABLE` still sitting in a squad
- `no_goalkeeper_coverage` — a squad with no player whose `goalkeeperAbility` is `YES`/`EMERGENCY`
  and no player with `primaryPosition = GK`

Every one of these describes **how the event was planned**, not **whether it is finished**. The
maintainer reported the concrete failure: an event whose matches had all been played could not be
finalized because no squad member was flagged as a goalkeeper — even though a real player kept
goal on the day and that fact is already recorded in the post-match report. The error surfaced
was `"Cannot finalize event: blocking issues found."` with, at the time, no detail (a separate UI
defect, fixed alongside this — the action already returned a structured `issues[]` the
`event-detail.tsx` finalize handler was discarding).

A pre-match planning gate for the same checks already exists and is the correct place for them:
`confirmEventSquadsAction()` and its inline squad-set lock validation in
`event-squad-commit-actions.ts`
(the whole-Event squad-set DRAFT → LOCKED assertion, explicitly retained by ADR-0109 §5 / "Event
squad draft/commit lifecycle"). That flow is unchanged.

## Decision

**Squad-composition quality must never block event finalization.** `validateEventForFinalization()`
now blocks only on genuine data-integrity impossibilities:

- `event_not_found` — blocking (the target does not exist)
- `event_already_finalized` — blocking (wrong state)
- `duplicate_player_across_squads` — blocking. Kept as defense-in-depth corruption detection
  only: `EventSquadPlayer` is `@@unique([eventId, playerId])`, so this is effectively
  unreachable via Prisma. It is data corruption, not a planning preference.

Everything else is downgraded to non-blocking and still returned in `issues[]` so the coach
sees it:

| Code | Old severity | New severity |
|------|-------------|-------------|
| `no_squads` | blocking (early return) | `warning` (no early return) |
| `empty_squad` | blocking | `warning` |
| `squad_below_minimum` | blocking | `warning` |
| `unavailable_player_in_squad` | blocking | `warning` |
| `no_goalkeeper_coverage` | blocking | `warning` |
| `no_primary_goalkeeper` | `warning` | `warning` (unchanged) |
| `squad_below_target` | `info` | `info` (unchanged) |
| `cancelled_match` | `info` | `info` (unchanged) |
| `incomplete_report` | `warning` | `warning` (unchanged) |

`validation.valid` is still `!issues.some(i => i.severity === "blocking")`, so with composition
checks downgraded a normal played event finalizes cleanly, with any shortfalls reported as
non-blocking context.

The `no_squads` early `return` was removed; the function now falls through and iterates an empty
`squads` array harmlessly.

## Consequences

- A coach can finalize an event that has been played regardless of how its squads were flagged.
  Whoever actually played in goal is a real-world fact in the post-match report, not something
  this validator second-guesses.
- The `event-detail.tsx` finalize handler now renders the returned `issues[]` (blocked / warning
  / note banners) instead of only `alert(result.error)`. Warnings on a **successful** finalize
  are cleared from the banner (the event is done); the banner still serves the rare
  `event_not_found` / `duplicate_player_across_squads` blocking cases.
- **Unchanged:** `validateEventForUnfinalization()`, the pre-match squad-set lock validation in
  `event-squad-commit-actions.ts` (still blocks on composition — it is a planning gate),
  `Event.status` semantics, exports gating, and `LeagueSeason.status` finalization.

## Rejected alternatives

- **Only downgrade `no_goalkeeper_coverage`, keep the rest blocking.** Rejected — the maintainer's
  stated principle ("finalization happens after the match is played … not something that can
  block a finalization") applies equally to squad size and stale availability flags. All are
  planning-time descriptions, not completion facts.
- **Also downgrade `duplicate_player_across_squads`.** Rejected — that one is data corruption, not
  a planning choice; keeping it blocking costs nothing (DB-unique makes it unreachable) and keeps
  "only integrity impossibilities block" true.
- **Remove `finalizeEventAction` entirely (as ADR-0109 did for round/match finalize).** Out of
  scope — ADR-0109 §7 explicitly keeps whole-`Event.status` finalization as a genuine
  container-closing assertion with no real-world temporal boundary to derive from. This ADR only
  corrects what that action's validation refuses.
