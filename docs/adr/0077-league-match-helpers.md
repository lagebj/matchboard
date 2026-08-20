# ADR-0077: League Match helpers (temporary match-level participation, independent of round finalisation)

## Status

Accepted

## Date

2026-08-20

## Context

A real match-day case Matchboard cannot currently handle live: a player assigned to Team 1 for a
League Round must also help Team 2's match because a Team 2 player becomes unavailable at short
notice — including after the round has been finalised, and including after the helping player has
already played their own Team 1 match in the same round. Matchboard's only existing mechanism for
this is retrospective: adding a player to the after-match report once the match is already over
(`addActualPlayerToReport`/`addActualPlayer`, `src/lib/reports/report-mutations.ts`). That is too
late for live match reporting (rotation/position tracking, goal scorer selection, assist
selection) — the player must be in the roster the live-reporting UI builds *before* the match
starts, not just in the after-the-fact report.

Matchboard already solves an equivalent problem for Event squads:
`EventMatchSupportAssignment` (`prisma/schema.prisma`) lets a player from one Event squad help
another squad's match, without changing their squad membership.
`getEligibleEventMatchPlayers()`/`assertEligibleEventMatchPlayer()`
(`src/lib/events/event-match-eligibility.ts`) compute the match's effective roster as
`squad players ∪ helper assignments`, and every Event live-reporting/lineup surface consumes that
one combined list rather than a separate helper-specific path.

The League domain's equivalent of "squad" is `Selection` — the round's planned team allocation
(`AGENTS.md`'s "One planned assignment per player per round" invariant). `Selection` is explicitly
a *planning* concept: "A finalized League Round must remain finalised... normal round allocation
stays immutable." A League helper is not planning — it is *actual match participation* — so it
must not create, move, or alter a `Selection` row, the same way an Event helper never touches
`EventSquadPlayer`.

The League domain's equivalent of "actual participation" already exists too:
`PostMatchPlayerActual` (`source: "PLANNED" | "ADDED_POST_MATCH" | "EMERGENCY_BACKFILL"`,
`unplannedAppearanceReason: UnplannedAppearanceReason`), consumed uniformly by
`src/lib/selection/effective-participation.ts` — the canonical statistics/reporting layer already
correctly distinguishes planned (`Selection`) from actual (`PostMatchPlayerActual`) and already has
an `EMERGENCY_BACKFILL` category with an `EMERGENCY_SQUAD_COVER` reason that describes this exact
scenario. But `PostMatchPlayerActual` requires a `PostMatchReport` row (`reportId` is a required
FK), and a report is only created lazily — on the coach's first explicit post-match entry
(`seedMatchReport`/`seedReportFromFinalizedSquad`) — so it does not exist yet when a helper needs
to be added before or during a live match.

## Decision

### New model: `MatchHelperAssignment`

Mirrors `EventMatchSupportAssignment`'s shape and role, scoped to League `Match` instead of
`EventMatch`:

```prisma
model MatchHelperAssignment {
  id             String        @id @default(cuid())
  organisationId String
  matchId        String
  playerId       String
  sourceTeamId   String        // player's team context at assignment time — informational only
  note           String?
  addedByUserId  String?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  match          Match         @relation(fields: [matchId], references: [id], onDelete: Cascade)
  player         Player        @relation(fields: [playerId], references: [id], onDelete: Restrict)
  sourceTeam     Team          @relation(fields: [sourceTeamId], references: [id])
  organisation   Organisation? @relation(fields: [organisationId], references: [id], onDelete: Cascade)

  @@unique([matchId, playerId])
  @@index([matchId])
  @@index([playerId])
  @@index([organisationId])
}
```

This is a genuinely new, narrow model — not a reuse of an existing one — because nothing existing
fits: `Selection` is planning-scoped and round-immutable-after-finalisation by design;
`PostMatchPlayerActual` requires a report that doesn't exist yet pre-match;
`EventMatchSupportAssignment` is FK'd to `EventMatch`/`EventSquad`, not `Match`/`Team`. The
`[matchId, playerId]` unique constraint is the server-side duplicate-participant guard (mirrors
`EventMatchSupportAssignment`'s own `@@unique([eventMatchId, playerId])`).

**Deliberately not shared as one polymorphic table with `EventMatchSupportAssignment`**: League
`Match` and Event `EventMatch` have different FK shapes (`matchRoundId`+`teamId` vs.
`eventSquadId`), and Event's own eligibility rules (time-overlap conflict blocking) are the
opposite of what League needs (never block on the player already having played). A shared table
would need a discriminator and nullable dual FKs for a saving that doesn't materialize into real
duplication — the two tables stay separate; only the *domain pattern* (assignment model +
effective-roster union + eligibility function with the same shape) is shared/mirrored.

### Effective roster: `Selection ∪ MatchHelperAssignment`

New `src/lib/matches/match-helper-eligibility.ts`, mirroring
`event-match-eligibility.ts`'s two functions:

- `getEffectiveLeagueMatchRoster(matchId)` — returns every `Selection` row for the match plus every
  `MatchHelperAssignment` row for the match, as one combined list (each entry tagged
  `source: "planned" | "helper"` for UI context, e.g. showing "Player A · Team 1 · Helper").
- `assertEligibleLeagueMatchPlayer(matchId, playerId, orgFilter)` — used by the add-helper mutation
  itself; not wired into live-event recording, because nothing in `recordEvent()`
  (`src/lib/live-match/live-match-event-store.ts`) currently validates `playerId` against the
  roster for *any* player, helper or not — the roster's construction is the only real gate today
  (the client only offers players it was given). Adding a new, stricter server-side gate for
  helpers specifically that doesn't exist for ordinary squad players would be an inconsistent,
  unrequested hardening, not what this feature asks for.

`getLiveMatchPreMatchPackageAction()` (`src/app/(app)/matches/[matchId]/live/live-actions.ts`) is
the **single integration point** for live reporting: its `squad` array is already the only roster
`league-live-match-client.tsx` consumes for rotation/position/goal/assist selection. Extending its
underlying query to the effective roster (instead of `Selection` alone) is sufficient — no
helper-specific path is added anywhere in live reporting, satisfying `effectiveMatchPlayers =
normalMatchPlayers + matchHelpers` directly.

### Eligibility rules (deliberately narrower than Event's)

`assertEligibleLeagueMatchPlayer` checks only:

- match exists, in the caller's organisation, not cancelled;
- caller is authorised for the match's team/group (`requireMatchGroupAccess`, the same helper
  `post-match/actions.ts` already uses);
- player is not already a participant in the target match (existing `Selection` **or** existing
  `MatchHelperAssignment` for this exact match).

**Deliberately not checked** (both explicit programme requirements, not oversights):

- **Round finalisation.** Event's `requireEventNotFinalized` blocks support-assignment changes
  once the event is finalised — the League feature needs the opposite: adding a helper must work
  *specifically because* the round is finalised and its normal assignments must stay untouched.
  Nothing in this feature reads or checks `MatchRound.status` at all; a `MatchHelperAssignment` is
  a match-level fact, independent of round status by construction.
- **Time/round conflicts.** Event's `isPlayerAvailableForSupport` blocks a helper whose own squad
  has an overlapping match, or who has already played elsewhere. The League spec explicitly
  requires the opposite ("Do not block a helper because the player has already played another
  match in the same round. This use case is specifically required.") — a League helper assignment
  is an intentional coach override of the normal one-assignment-per-round expectation, not a
  scheduling conflict to prevent.

### After-match report integration (same underlying participation model)

`seedReportFromFinalizedSquad` (`src/lib/reports/report-mutations.ts`) — the single function behind
both the "seed from finalised squad" and "empty report" paths (`seedMatchReport` calls it
unconditionally; with zero finalised selections it already produces an empty report, matching
`AGENTS.md`'s documented two-path behaviour) — is extended to also seed one `PostMatchPlayerActual`
per `MatchHelperAssignment` on the match, with `source: "EMERGENCY_BACKFILL"` and
`unplannedAppearanceReason: "EMERGENCY_SQUAD_COVER"` (both pre-existing values,
`effective-participation.ts`'s counting logic requires no changes) and `attendanceStatus:
"UNKNOWN"` (same as normal squad seeding — attendance still needs confirming during the report,
not assumed). This is what makes "helper added before the match, already present in the after-match
report, no duplicate add" true: seeding is unconditional and a helper's `PostMatchPlayerActual` row
already exists by the time the coach opens the report.

Removing a helper (`removeMatchHelperAction`) deletes only the `MatchHelperAssignment` row. If a
`PostMatchPlayerActual` already exists for that match+player (report already seeded/started), the
action refuses — "should be removable before they have participated," and once a
`PostMatchPlayerActual` row exists, participation tracking (attendance, goals, assists, live
events) may already reference the player, and this feature does not invent destructive
cross-deletion the way `removeEventMatchSupportAssignmentAction` doesn't either (it only detaches
`EventMatchLineupAssignment.playerId`, never touches goal/assist data).

### Statistics: no changes required to `effective-participation.ts`

Because seeding reuses `source: "EMERGENCY_BACKFILL"` / `unplannedAppearanceReason:
"EMERGENCY_SQUAD_COVER"` — both already-modeled, already-counted values — `getEffectiveSeasonStats`
and every consumer of `EffectiveParticipationRow` (insights, audit, fairness) require zero code
changes to correctly count a helper appearance as a real, separate actual appearance without
touching the player's planned `Selection` for their own team. This is the practical mechanism
behind the spec's core rule: *"A League Round defines the player's planned team assignment. A
League Match records who actually participated. A helper can participate in an additional match
without changing the planned round assignment."*

### UI

"Add helper" action on the League match detail page's existing Squad tab
(`src/components/matches/match-detail.tsx`) — no navigation into round planning, works in a
finalised round exactly like a draft one (the action doesn't check round status at all, per
above). Player picker shows each candidate's current round team for context ("Player A · Team 1"),
sourced from `getEffectiveLeagueMatchRoster`'s "other teams in this round" query, not just the
match's own team.

## Consequences

- New `MatchHelperAssignment` model + one migration; no changes to `Selection`,
  `MatchRound.status`, or any finalisation code path.
- `getLiveMatchPreMatchPackageAction`'s query changes (adds the helper union) — the only touched
  live-reporting code; every downstream live-reporting component (rotation, position, goal, assist
  pickers) needs no changes, since they already just render whatever `squad` contains.
- `seedReportFromFinalizedSquad` gains a second seeding source; existing behaviour for matches with
  no helpers is unchanged (empty union).
- A player can legitimately have two real match appearances (one planned for their own team, one
  helper appearance for another) in the same round — expected and already correctly handled by the
  existing effective-participation layer's per-match (not per-round) `Selection` lookup.

## Non-goals (explicit)

Reopening finalised rounds; making finalised team allocations editable; transferring a helper
between League teams; rebalancing the round; a general loan/transfer system; blocking a player
from intentionally playing twice in a round.

## Related decisions

- `AGENTS.md`'s "Event match support planning" section — the reference pattern this mirrors.
- `AGENTS.md`'s "Canonical data truth" and "Actual double-load from post-match reports" /
  "Unplanned actual participation" sections — the existing planned-vs-actual separation this
  feature extends forward in time (pre-match) rather than only backward (retrospective).

## History

- 2026-08-20: Accepted. Design verified against the current repository state (Event helper
  implementation, League selection/live-reporting/statistics code) before writing this down, per
  the task's own explicit "do not assume architecture or model names" instruction.
