# ARR-0036: `prisma/schema.prisma` has drifted from its own migration history

## State

Open

## Identified

2026-08-29, while preparing the migration for ADR-0106 (GuestPlayer and shared match participant
model). `prisma migrate dev`/`migrate diff` require either an interactive TTY or a working
shadow database to generate a new migration's SQL; both paths independently produce a diff
between the current `schema.prisma` and the database state implied by replaying every existing
migration file in `prisma/migrations/` from scratch. That diff included ~90 lines unrelated to
GuestPlayer, confirmed reproducible two ways:

1. Diffing `schema.prisma` against the live local dev database (`matchboard` on the local
   Postgres instance, itself built by applying every migration in order over time).
2. Diffing `schema.prisma` against a freshly created, empty shadow database
   (`matchboard_shadow`) with all 105 pre-existing migration files replayed onto it from a clean
   slate, with zero live-database influence.

Both diffs produced the identical drift, proving it is not local-dev-environment contamination —
`schema.prisma` itself has genuinely diverged from what its own migration history would produce.

## Residue

Per ADR-0105 (expand/contract migration safety) and this repo's general migration discipline, the
committed `schema.prisma` is expected to always be reconstructible by replaying
`prisma/migrations/*` in order — that is the entire point of keeping migration files in version
control instead of hand-editing the database. That invariant has been silently broken: at some
point prior migrations were presumably run, but `schema.prisma` was later hand-edited (or a
migration file's SQL doesn't match its own schema diff) without a corresponding migration being
generated and committed for every change.

The GuestPlayer migration (`20260829121910_guestplayer_and_shared_participant_model`) was
deliberately hand-curated to include **only** GuestPlayer-related SQL, explicitly excluding this
pre-existing drift, so as not to bundle an unrelated, unreviewed schema-history correction into an
otherwise purely-additive feature migration. The drift remains present in the live dev and test
databases and is captured here for a dedicated follow-up migration.

## Scope found (2026-08-29 audit, re-verified after the GuestPlayer migration was applied)

**Enum identity churn** (same enum values, but the migration history's enum object differs from
the one `schema.prisma` implies, forcing Prisma to recreate it):
- `CoachingIntentScopeType`

**Foreign keys dropped and recreated** (same target/columns, but some FK property — likely
`onDelete`/`onUpdate` action or constraint-name provenance — differs between what the migration
history produced and what `schema.prisma` now declares):
- `CombinationEvidence_leagueSeasonId_fkey`
- `Match_opponentTeamId_fkey`
- `ReviewRequest_organisationId_fkey`

**Missing `organisationId` indexes** — `schema.prisma` declares `@@index([organisationId])` (or
an equivalent single/composite index) on these models, but no migration ever created the index in
the database. ~35 affected models, all part of the RLS/tenant-scoping index convention (see
AGENTS.md "Tenant isolation"): `Assist`, `Availability`, `CoachingIntent`, `DecisionRecord`,
`EventAssistEvent`, `EventGoalEvent`, `EventMatch`, `EventMatchLineup`,
`EventMatchLineupAssignment`, `EventMatchSupportAssignment`, `EventPlayerAvailability`,
`EventPostMatchPlayer`, `EventPostMatchReport`, `EventSquad`, `EventSquadPlayer`, `Formation`,
`FormationSlot`, `Goal`, `LeagueSeason`, `MatchExecutionFeedback`, `MatchLineup`,
`MatchLineupAssignment`, `MatchReportAbsence`, `MatchReportPlayerStat`, `MovementCandidate`,
`MovementLedger`, `OpponentEncounterObservation`, `OpponentTeam`, `PlayerLock`,
`PlayerReadinessSignal`, `PolicyDecisionLog`, `PostMatchPlayerActual`, `PostMatchReport`,
`RotationPath`, `RuleConfig`, `Season`, `SeasonPeriodSnapshot`, `SelectionAudit`,
`SelectionExplanation`, `TeamSeasonSnapshot`, `TeamSeasonSnapshotPlayer`, `Warning`. Plus two
unrelated missing indexes: `OrganisationInvitation.token`, `ProviderWebhookEvent.eventId`.

This is a real, if low-severity, gap against the tenant-isolation design intent: query plans on
these tables filtering by `organisationId` (which every RLS-scoped query does, per `src/lib/db.ts`)
are not using the index the schema claims exists.

**Indexes/constraints present in the database but absent from `schema.prisma`** (dropped from the
schema at some point without a corresponding `DropIndex` migration ever being committed):
- `EventSquadPlayer_eventId_idx`
- `Match_planningClosedAt_idx`
- `Organisation_isSynthetic_idx`
- `Organisation_suspendedAt_idx`
- `ReviewRequest_supersededById_idx`
- `Selection_playerId_matchRoundId_draft_key`
- `Team_name_key`
- `WorkOwnership_one_active_per_target_per_org`

**Column type/default drift**:
- `Match.planningClosedAt`, `Organisation.suspendedAt` — timestamp column precision
  (`TIMESTAMP(3)` vs. the database's current type) differs.
- `Team.organisationId` — schema declares `NOT NULL`; database column is still nullable.
- `MachinePrincipal.scopes`, `OpponentEncounterObservation.playingStyleTags`,
  `TeamSeasonSnapshotPlayer.activeAtSnapshot` — schema declares no default; database column still
  has one.
- `OpponentSportingEvidence.dataQuality` — schema declares no default; database still has one.
- `OpponentSportingEvidence.lineupStateCount` — schema declares `NOT NULL`; database column is
  still nullable.

**Auto-generated index name truncation drift** (Postgres's 63-byte identifier limit truncates long
auto-generated names differently depending on exactly when/how the index was created — cosmetic,
zero behavioural difference):
- `FootballGroupPlayer_active_primary_unique` → schema-implied
  `FootballGroupPlayer_footballGroupId_playerId_membershipType_key`
- `GroupMovementPath_organisationId_fromGroupId_toGroupId_role_sco` → `..._role_key`
- `OpponentSportingEvidence_opponentTeamId_gameFormat_occurredAt_i` → `..._occurred_idx`
- `PlayerDevelopmentObservation_playerId_attributeKey_observedAt_i` → `..._observed_idx`
- `PlayerProfileSuggestion_playerId_targetType_attributeKey_positi` → `..._po_key`

## Intended architecture

`schema.prisma` is always reconstructible by replaying `prisma/migrations/*.sql` in order against
an empty database — no hand-edit to `schema.prisma` should ever be committed without an
accompanying migration that produces the equivalent database change, and no migration should be
applied to a shared database (local dev, test, or the CI-verified `test` Neon branch) without
`schema.prisma` reflecting the resulting state exactly. This is what CI's
`migration-upgrade-from-populated-state` and `migration-from-zero` jobs (ADR-0090) exist to
verify going forward for *new* migrations; this ARR documents that the invariant was already
broken for migration history predating this audit.

## Resolution criteria

- [ ] A dedicated, reviewed migration (separate from any feature work) is generated for exactly
  this diff, re-verified via a fresh shadow-database replay immediately before being written, to
  confirm no further drift has accumulated in the interim.
- [ ] The `organisationId` index gaps are added (real tenant-isolation query-performance
  correctness, not merely cosmetic).
- [ ] Each dropped-and-recreated FK and each present-in-DB-but-not-in-schema index/constraint is
  individually confirmed intentional (schema is correct, DB is stale) or a DB-state bug (DB is
  correct, schema regressed) before being resolved in either direction — this ARR takes no
  position on which side is "right" for any individual item, only that they disagree.
- [ ] CI's shadow-database replay (or an equivalent standing check) is confirmed to already catch
  a *future* recurrence of this drift; if it does not, add one.

## Related decisions

ADR-0106 (GuestPlayer and shared match participant model) — the migration whose preparation
surfaced this drift; ADR-0105 (expand/contract migration safety) — the migration discipline this
drift falls short of; ADR-0090 (migration-upgrade-from-populated-state CI job) — the existing
safeguard for *future* migrations.

## Related implementation

- `prisma/schema.prisma`
- `prisma/migrations/20260829121910_guestplayer_and_shared_participant_model/migration.sql` (its
  header comment references this ARR as the reason its own SQL was hand-curated to exclude this
  drift)
- `src/lib/db.ts` (`RLS_TABLES`, the tenant-isolation index convention the missing indexes fall
  short of)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-29

Identified while generating the ADR-0106 migration. Verified reproducible against both the live
local dev database and a from-scratch shadow-database replay of all pre-existing migrations,
confirming the drift is genuine and not local-environment contamination. Re-verified after the
ADR-0106 migration was applied, isolating exactly the remaining, unrelated drift documented above.
Recorded as open residue rather than fixed in the same change, since correcting it is independent,
unrelated-scope work deserving its own reviewed migration.
