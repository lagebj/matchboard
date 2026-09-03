# ADR-0106: GuestPlayer identity and a shared Match participant model

## Status

Accepted

## Date

2026-08-29

## Context

Coaches routinely need to field a player who is not a tracked member of their Matchboard Group —
a friend's child, a player borrowed from an unaffiliated club, someone helping out for a single
Event or League Round. Matchboard's Match participant model currently assumes every participant
is a permanent, tracked `Player` row: lineup, rotation, live reporting, goals, assists, and
post-match reporting all key on `playerId` referencing `Player`. There is no way to record this
kind of participant without either (a) creating a permanent `Player` record that wrongly implies
long-term squad membership, longitudinal statistics, and development evidence for someone who
isn't actually part of the Group, or (b) not recording them as a real participant at all.

Separately, Event participation today is all-or-nothing at the Event level
(`EventPlayerAvailability`): a participant is either available for the whole Event or not. Coaches
need to record that a participant (a normal `Player` or the new `GuestPlayer`) attends an Event but
is unavailable for specific Matches within it (arrives after Match 1, leaves before Match 4).

This program also anticipates, but explicitly does not implement, a further future capability:
bilateral collaboration between two Matchboard Groups, letting a Group borrow another Group's real
`Player` (not a copy) for temporary participation. That capability is out of scope here — see
`docs/domain/future-group-collaboration.md` — but the design below deliberately avoids choices
that would require another fundamental Match-fact migration to accommodate it later.

### Existing precedent: League Match helpers (ADR-0077)

ADR-0077 already extended League Match participation beyond `Selection` (the round's planned
team allocation) with `MatchHelperAssignment`, unioned into one effective roster via
`getEffectiveLeagueMatchRoster()` and consumed through a single choke point
(`getLiveMatchPreMatchPackageAction()`'s `squad` array) that every downstream live-reporting
component already treats opaquely. Event's `EventMatchSupportAssignment` +
`getEligibleEventMatchPlayers()` is the mirrored precedent on the Event side. Both are real,
proven examples of "a participant beyond the primary squad-assignment mechanism, unioned into one
list, consumed by unchanged downstream code" — exactly the shape a `GuestPlayer` participant needs,
just for an identity that isn't a `Player` at all rather than a `Player` playing outside their own
team.

ADR-0077 also established a load-bearing precedent this decision follows directly: League and
Event helper tables were deliberately kept **separate**, not merged into one polymorphic table,
because the two domains have materially different FK shapes and eligibility rules (Event blocks on
time overlap; League deliberately does not). Only the *domain pattern* — assignment model +
effective-roster union + eligibility function — is shared.

### Existing precedent: nullable dual-FK + discriminator

`ActualPositionInterval.matchId?`/`eventMatchId?` (and the same pattern on `CombinationEvidence`,
`OpponentSportingEvidence`, `PlayerDevelopmentObservation`) already establishes this repo's native
mechanism for "exactly one of two FKs must be set," enforced by a hand-added Postgres `CHECK`
constraint in the migration SQL, since Prisma cannot express XOR declaratively. This is the correct
mechanism to reuse for "this fact belongs to either a `Player` or a `GuestPlayer`," rather than
inventing a new pattern.

### Verified structural safety for statistics and evidence isolation

Direct trace confirmed, before this decision was written, that the boundary this feature needs
(GuestPlayer facts must never become longitudinal Player statistics or evidence) is **already
structurally enforced** by existing code, not something requiring new schema-level exclusion logic:

- `getPlayersSeasonOverview()` (`src/lib/players/get-players-overview.ts`) derives its player set
  from `db.player.findMany(...)` first, then filters every fact query by that id set — a
  `GuestPlayer` fact cannot enter this result unless it is wrongly written into a `playerId`
  column, which this decision's design never does.
- Season export iterates `Selection` (a required, non-nullable `playerId` FK) — `GuestPlayer`s
  never create `Selection` rows in this design, so they are excluded with zero additional code.
- `computeAndApplyPlayerEvidenceForMatch()` (`src/lib/evidence/player-evidence-service.ts`) reads
  `PlayerDevelopmentObservation`, whose `playerId` is required/non-nullable — structurally
  incapable of referencing a `GuestPlayer`.

This means the schema changes below are sufficient on their own to preserve the statistics/evidence
boundary; no new exclusion mechanism is invented.

### Verified reuse of existing unrated-attribute handling

`src/lib/events/event-types.ts`'s `PlayerAttributeProfile` already types every rating field as
`number | null`, and `computeCompositeRatings()` already returns `null` (never `0`, never a
fabricated average) when nothing is rated; goalkeeper-coverage and position-fit logic already
derive correctly from `primaryPosition` alone when ratings are absent. A `GuestPlayer`, which has
no attribute fields at all, is represented as such a profile with every rating field `null` and
requires zero changes to selection/generation scoring logic.

## Decision

### GuestPlayer is a separate identity, not a Player flag

```prisma
model GuestPlayer {
  id              String    @id @default(cuid())
  organisationId  String
  footballGroupId String
  name            String
  sourceLabel     String?
  note            String?
  active          Boolean   @default(true)
  deactivatedAt   DateTime?
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt

  footballGroup FootballGroup @relation(fields: [footballGroupId], references: [id], onDelete: Restrict)
  organisation  Organisation? @relation(fields: [organisationId], references: [id], onDelete: Cascade)

  @@index([footballGroupId, active])
  @@index([organisationId])
}
```

No `Player.isGuest`/`isTemporary` flag: `Player` is already a large, heavily-relation-laden model,
and a guest is a different kind of thing — no attributes, no ratings, no development, no permanent
squad membership, no profile. `footballGroupId` is a direct FK (unlike `Player`, which only reaches
its Group via `coreTeamId -> Team.footballGroupId` or the `FootballGroupPlayer` join table) — a
`GuestPlayer` has no Team-mediated ownership concept, so direct is simpler and correct. Not
Season-scoped: no `seasonId`/`leagueSeasonId` field anywhere on this model — a `GuestPlayer`
identity is reusable across every future season the owning Group runs. `onDelete: Restrict` on the
Group FK matches every other identity model's convention: identities never cascade-vanish.

### Dual-FK extension: reuse the repo's existing XOR pattern everywhere a fact needs either identity

Two constraint shapes, both hand-added CHECK constraints in the migration SQL (Prisma cannot
express either declaratively):

- **Exactly-one** (a fact must belong to someone): `CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL))`
- **At-most-one** (zero is legal — an empty lineup slot, an unattributed goal): `CHECK (NOT ("playerId" IS NOT NULL AND "guestPlayerId" IS NOT NULL))`

No `participantType` column is ever persisted — it is always derived
(`playerId != null ? "PLAYER" : "GUEST_PLAYER"`) by the shared resolver below, never a second
source of truth that could desync from the FKs.

Applied, verified against the live schema field-by-field before this decision was written:

| Model | Change | Constraint |
|---|---|---|
| `EventPlayerAvailability` | `playerId` relaxed to `String?`, add `guestPlayerId String?` | exactly-one |
| `EventSquadPlayer` | same | exactly-one |
| `EventMatchSupportAssignment` | same | exactly-one |
| `EventMatchLineupAssignment` | add `guestPlayerId String?` (`playerId` already nullable — empty slot) | at-most-one |
| `MatchLineupAssignment` | same | at-most-one |
| `Goal` | add `guestPlayerId String?` (`playerId` already nullable — unattributed goal already exists) | at-most-one |
| `EventGoalEvent` | same | at-most-one |
| `Assist` | `playerId` relaxed from required to `String?`, add `guestPlayerId String?` | at-most-one |
| `EventAssistEvent` | same (also fixes a pre-existing schema inconsistency: `playerId` was `String` required, but its own FK used `onDelete: SetNull`, which is invalid for a non-nullable column — this decision makes the column nullable, which is what `SetNull` always required) | at-most-one |
| `ActualPositionInterval` | `playerId` relaxed to `String?`, add `guestPlayerId String?` — a **second, independent** CHECK alongside the existing `matchId`/`eventMatchId` CHECK | exactly-one |
| `MatchRotation` | `outPlayerId`/`inPlayerId` relaxed to `String?`, add `outGuestPlayerId String?` + `inGuestPlayerId String?` — two independent CHECKs, since the outgoing and incoming side of a rotation are independent identity slots | 2× exactly-one |
| `PostMatchPlayerActual` | `playerId` relaxed to `String?`, add `guestPlayerId String?` | exactly-one |
| `EventPostMatchPlayer` | same | exactly-one |
| `LiveMatchEvent` | add `guestPlayerId String?` + `secondaryGuestPlayerId String?` alongside the existing nullable `playerId`/`secondaryPlayerId` (both real FKs to `Player`, not loose strings) | 2× at-most-one |

`CombinationEvidence.playerIds` (a bare `Json` array, not FK-enforced) is deliberately **not**
changed — the evidence pipeline that populates it only ever iterates real `Player` ids by
construction (see "Verified structural safety" above); enforced by a test, not a schema
constraint.

Every extended model keeps its existing `@@unique([x, playerId])` and gains a parallel
`@@unique([x, guestPlayerId])`. Postgres treats each `NULL` as distinct by default (no
`NULLS NOT DISTINCT` override exists anywhere in this repo's migrations) — a `Player` row and a
`GuestPlayer` row never collide on uniqueness, and two guest rows for the same guest correctly do.

### New participation models

**`EventMatchAvailability`** — the new Event Match-specific availability capability. A row's mere
existence means "unavailable for this specific match" (sparse exception storage: Event-level
attendance is the default, a row here is the exception, and an Event-level `UNAVAILABLE` is never
overridden by a per-match row):

```prisma
model EventMatchAvailability {
  id             String   @id @default(cuid())
  organisationId String
  eventMatchId   String
  playerId       String?
  guestPlayerId  String?
  note           String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  eventMatch   EventMatch    @relation(fields: [eventMatchId], references: [id], onDelete: Cascade)
  player       Player?       @relation(fields: [playerId], references: [id], onDelete: Cascade)
  guestPlayer  GuestPlayer?  @relation(fields: [guestPlayerId], references: [id], onDelete: Cascade)
  organisation Organisation? @relation(fields: [organisationId], references: [id], onDelete: Cascade)

  @@unique([eventMatchId, playerId])
  @@unique([eventMatchId, guestPlayerId])
  @@index([eventMatchId])
  @@index([organisationId])
}
```

`onDelete: Cascade` on the identity FKs (not `Restrict`, unlike identity models themselves) —
deleting the exception row is a normal, expected coach action that simply restores inherited Event
availability; it is not identity deletion.

**`LeagueRoundParticipant`** — League has no existing Round-level participant concept at all;
Round participation today is entirely implicit via `Selection`/`Availability` rows per Match. This
is genuinely new, not a rename:

```prisma
model LeagueRoundParticipant {
  id             String   @id @default(cuid())
  organisationId String
  matchRoundId   String
  playerId       String?
  guestPlayerId  String?
  note           String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  matchRound   MatchRound    @relation(fields: [matchRoundId], references: [id], onDelete: Cascade)
  player       Player?       @relation(fields: [playerId], references: [id], onDelete: Restrict)
  guestPlayer  GuestPlayer?  @relation(fields: [guestPlayerId], references: [id], onDelete: Restrict)
  organisation Organisation? @relation(fields: [organisationId], references: [id], onDelete: Cascade)

  @@unique([matchRoundId, playerId])
  @@unique([matchRoundId, guestPlayerId])
  @@index([matchRoundId])
  @@index([organisationId])
}
```

Scope decision: only `GuestPlayer`s populate this table for now. Permanent `Player`s keep their
existing `Selection`/`Availability`-based Round presence unchanged — this table does not become a
second source of truth for `Player` round-participation. A round with zero `GuestPlayer`s behaves
identically to today, by construction.

**`LeagueMatchGuestAssignment`** — mirrors `MatchHelperAssignment`'s exact shape and role, kept as
a **separate table**, per ADR-0077's own explicit precedent of not merging League/Event
Player-helper tables:

```prisma
model LeagueMatchGuestAssignment {
  id             String   @id @default(cuid())
  organisationId String
  matchId        String
  matchRoundId   String
  guestPlayerId  String
  note           String?
  addedByUserId  String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  match        Match         @relation(fields: [matchId], references: [id], onDelete: Cascade)
  matchRound   MatchRound    @relation(fields: [matchRoundId], references: [id], onDelete: Restrict)
  guestPlayer  GuestPlayer   @relation(fields: [guestPlayerId], references: [id], onDelete: Restrict)
  organisation Organisation? @relation(fields: [organisationId], references: [id], onDelete: Cascade)

  @@unique([matchId, guestPlayerId])
  @@index([matchId])
  @@index([guestPlayerId])
}
```

`matchRoundId` is denormalized (derivable from `Match.matchRoundId`) so the write-time eligibility
check — a guest is assignable to a Match only if already a `LeagueRoundParticipant` of that Match's
Round — needs no extra join. No XOR needed: this table is guest-only by construction, exactly as
`MatchHelperAssignment` is player-only by construction.

### Shared TypeScript participant-resolution module

New `src/lib/participants/participant-ref.ts`:

```ts
export type ParticipantType = "PLAYER" | "GUEST_PLAYER";

export type ParticipantRef = {
  participantId: string;
  participantType: ParticipantType;
  playerId: string | null;
  guestPlayerId: string | null;
  displayName: string;
  sourceLabel: string | null;
};

export function resolveParticipantRef(input: {
  playerId: string | null;
  guestPlayerId: string | null;
  playerLookup: Map<string, { firstName: string; lastName: string | null }>;
  guestPlayerLookup: Map<string, { name: string; sourceLabel: string | null }>;
}): ParticipantRef;

export function assertExactlyOneParticipant(playerId: string | null, guestPlayerId: string | null): void;
export function assertAtMostOneParticipant(playerId: string | null, guestPlayerId: string | null): void;
export function formatParticipantDisplayName(ref: ParticipantRef): string;
```

`ParticipantType` is a plain string union, not a database enum with two members closed forever — a
future `"COLLABORATING_GROUP_PLAYER"` source (explicitly not implemented now; see
`docs/domain/future-group-collaboration.md`) is a type-union edit at that point, not a schema
migration. No generic `Person`/`Actor`/`Entity` framework is introduced — this module resolves
exactly the two sources that exist today.

This module's first, highest-priority consumers are the two existing "effective roster" functions
that already establish the union-of-sources pattern: `getEffectiveLeagueMatchRoster()`
(`src/lib/matches/match-helper-eligibility.ts`) and `getEligibleEventMatchPlayers()`
(`src/lib/events/event-match-eligibility.ts`). Both already return a `source`-discriminated union
of two `Player`-sourced lists; extending them to a third, `GuestPlayer`-sourced branch is the
direct generalization this module exists for. That extension work happens in the Event/League
integration follow-up PRs to this ADR, not in the PR that introduces this schema and module.

## Migration

Single additive migration. Per ADR-0105, this is the "additive-only" case even though several
columns are relaxed from required to nullable: the relaxation only ever *widens* what's
acceptable, no currently-deployed code depends on the column being absent, and the PR that ships
this migration deploys **zero application code that reads or writes any new column** — the
`GuestPlayer`/participation models and every new nullable column are pure headroom until the
Event/League integration PRs that follow. No data backfill is needed anywhere: nothing existing
ever had a `guestPlayerId` to populate, and relaxing `playerId` to nullable requires no rewrite of
existing non-null rows.

CHECK constraints are hand-added to the generated migration SQL, following the exact existing
`ActualPositionInterval` precedent:

```sql
ALTER TABLE "Assist" ADD CONSTRAINT "Assist_at_most_one_participant"
  CHECK (NOT ("playerId" IS NOT NULL AND "guestPlayerId" IS NOT NULL));
ALTER TABLE "EventMatchAvailability" ADD CONSTRAINT "EventMatchAvailability_exactly_one_participant"
  CHECK (("playerId" IS NOT NULL) != ("guestPlayerId" IS NOT NULL));
```

## Consequences

- `GuestPlayer` becomes a first-class, Group-scoped, reusable-across-seasons identity, distinct
  from `Player` at both the schema and domain-service level.
- Every Match-fact model that can plausibly involve a non-Player participant now has a
  `guestPlayerId` column and a hand-added CHECK constraint alongside its `playerId` column — this
  is now the canonical, repeatable pattern for participant polymorphism in this schema, extending
  the precedent `ActualPositionInterval` set for match-source polymorphism.
- League gains a genuinely new concept, `LeagueRoundParticipant`, that did not exist before —
  scoped narrowly to guest registration, not a rewrite of `Player` round-participation.
- No behaviour change for any existing data or code path: with zero `GuestPlayer` rows and zero
  populated `guestPlayerId`/`EventMatchAvailability`/`LeagueRoundParticipant`/
  `LeagueMatchGuestAssignment` rows, every query and constraint behaves exactly as before.
- Statistics and evidence isolation (a `GuestPlayer` must never contribute to longitudinal `Player`
  statistics or evidence) requires no new exclusion mechanism — the existing `Player`-keyed
  aggregation queries are already structurally incapable of including a `guestPlayerId`-only fact,
  as long as future write paths never write a guest's id into a `playerId` column (enforced by
  `assertExactlyOneParticipant`/`assertAtMostOneParticipant` at every write site, and locked in by
  dedicated tests in the statistics/evidence hardening follow-up).

## Non-goals (explicit)

Group-to-Group player collaboration (borrowing a real `Player` from another Group) —
discovered and documented, not implemented, in `docs/domain/future-group-collaboration.md`.
Season-scoping `GuestPlayer` identity. A generic `Person`/`Actor` framework. Merging League and
Event guest-assignment tables into one polymorphic table. Backfilling any historical data (there is
none to backfill).

## Related decisions

- ADR-0077 (League Match helpers) — the effective-roster-union and separate-table-per-domain
  precedent this decision extends to a second, non-Player identity source.
- ADR-0105 (Expand/contract migration safety) — governs why this can ship as one additive
  migration with no code reading the new columns yet.
- `docs/domain/future-group-collaboration.md` — the future capability this decision's
  `ParticipantType` union and `LeagueRoundParticipant`/`EventMatchAvailability` patterns are
  designed not to preclude.

## History

### 2026-08-29

Accepted. Design verified field-by-field against the live `prisma/schema.prisma` (not assumed)
before being written down, including confirming `Assist.playerId`/`EventAssistEvent.playerId` are
currently required with no "unattributed" precedent (unlike `Goal`), `LiveMatchEvent.playerId` is a
real FK rather than a loose string, and `MatchRotation.outPlayerId`/`inPlayerId` are both required
— each of these determined which constraint shape (exactly-one vs. at-most-one) applies to that
specific model.

### 2026-09-03 (Event planning parity completion)

A GuestPlayer could already be assigned to an Event squad, but several read paths built after this
ADR's own foundational migration still filtered to `playerId: { not: null }` (each marked with its
own `// ADR-0106:` "later, separate change" comment at the time), and `assignPlayerToLineupSlot()`
rejected every GuestPlayer id via a hardcoded `db.player.findFirst()` pre-check that ran before the
already-correct, already-GuestPlayer-aware `assertEligibleEventMatchPlayer()` eligibility check two
lines later. The practical effect: a coach could add a guest to an Event and assign them to a
squad, then watch them disappear from the squad overview, the actual-vs-target squad size count,
and the starting-lineup participant pool, and be silently excluded from the Excel export's Lineups
sheet if they were ever placed as a starter.

This pass closed that gap for every planning surface a GuestPlayer needs once assigned to an
Event — `getEventById()`'s stale filter, the Event detail page's squad/balance derivation,
`assignPlayerToLineupSlot()`'s participant-kind-aware rewrite, wiring the already-existing
`getEligibleEventMatchPlayers()` into the actual lineup/tactics UI (it had zero real callers
before this), a new `moveGuestPlayerBetweenSquadsAction()` (the prior guest-assignment action
explicitly refused re-assignment, so there was no move capability at all), and the export route's
Lineups sheet. See AGENTS.md's "Event planning parity (squad overview, squad size, lineup/tactics,
exports)" section for the full file-by-file account.

Two boundaries from this ADR's original phased plan remain deliberately unchanged, not resolved by
this pass: Event Match support/helper assignment for GuestPlayers, and automatic
`event-squad-generation.ts`/auto-fill candidate-pool inclusion — both stay Player-only by design
(a GuestPlayer is always a manual planning decision, never fairness-scored or auto-selected).
Evidence/statistics isolation was re-verified, not just assumed, with a new regression test
confirming a GuestPlayer occupying a lineup starting slot (now a real write path) still produces no
`ActualPositionInterval` row — `getEventStartingLineup()`'s own query stays `playerId: { not: null
}`, so this pass's planning-side fix does not create a new evidence-layer leak.
