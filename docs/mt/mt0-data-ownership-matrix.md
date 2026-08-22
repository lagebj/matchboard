# MT-0: Data-Ownership Matrix

Classifies every persistent Prisma model by tenant ownership, identifying which models need `organizationId` and which are infrastructure or global.

Per ADR-0035: all mutable football-domain entities are organisation-scoped. Direct `organizationId` is preferred over indirect relationships. The organisation is the hard tenant boundary. The team is a delegation boundary inside the organisation.

## Tenant-bearing models (need `organizationId`)

These models own football-domain data that belongs to exactly one organisation. Each row must have a non-null `organizationId` after migration.

| Model | Current ownership path | Direct `organizationId` needed | Notes |
|-------|----------------------|-------------------------------|-------|
| Team | none (global) | Yes | Team is a delegation boundary within org. `name` unique becomes `@@unique([organizationId, name])` |
| Player | none (global) | Yes | Belongs to exactly one org. `playerCode` unique becomes scoped to org |
| Match | `Match → Team → Organisation` (indirect) | Yes | Direct preferred per ADR-0035 |
| OpponentTeam | none (global) | Yes | Organisation-scoped per MT-0.3 |
| RuleConfig | none (global) | Yes | Organisation-scoped configuration |
| Season | none (global) | Yes | Organisation-scoped |
| MatchRound | `MatchRound → LeagueSeason → Organisation` (indirect) | Yes | Direct preferred |
| LeagueSeason | none (global) | Yes | Same real-world league in two orgs = two records |
| Availability | `Availability → Player → Organisation` (indirect) | Yes | Direct preferred |
| Selection | `Selection → Match → Team → Organisation` (indirect) | Yes | Direct preferred |
| RotationPath | `RotationPath → fromTeam/toTeam → Organisation` | Yes | Must validate both teams belong to same org |
| MovementLedger | `MovementLedger → Selection → Match → Team → Organisation` (indirect) | Yes | Direct preferred |
| Formation | `Formation → Team → Organisation` (indirect) | Yes | Direct preferred |
| FormationSlot | `FormationSlot → Formation → Team → Organisation` (indirect) | Yes | Direct preferred |
| MatchLineup | `MatchLineup → Match → Team → Organisation` (indirect) | Yes | Direct preferred |
| MatchLineupAssignment | `MatchLineupAssignment → MatchLineup → Match → Organisation` (indirect) | Yes | Direct preferred |
| Warning | `Warning → Selection → Match → Team → Organisation` (indirect) | Yes | Direct preferred |
| PlayerLock | `PlayerLock → Player → Organisation` (indirect) | Yes | Direct preferred |
| SelectionAudit | `SelectionAudit → Selection → Match → Team → Organisation` (indirect) | Yes | Direct preferred |
| DecisionRecord | none (global) | Yes | Organisation-scoped audit |
| CoachingIntent | `CoachingIntent → Match → Team → Organisation` (indirect) | Yes | Direct preferred |
| PostMatchReport | `PostMatchReport → Match → Team → Organisation` (indirect) | Yes | Direct preferred |
| PostMatchPlayerActual | `PostMatchPlayerActual → PostMatchReport → Match → Organisation` (indirect) | Yes | Direct preferred |
| Goal | `Goal → PostMatchReport → Match → Organisation` (indirect) | Yes | Direct preferred |
| Assist | `Assist → PostMatchReport → Match → Organisation` (indirect) | Yes | Direct preferred |
| MatchReportAbsence | `MatchReportAbsence → PostMatchReport → Match → Organisation` (indirect) | Yes | Direct preferred |
| MatchReportPlayerStat | `MatchReportPlayerStat → PostMatchReport → Match → Organisation` (indirect) | Yes | Direct preferred |
| PlayerReadinessSignal | `PlayerReadinessSignal → Player → Organisation` (indirect) | Yes | Direct preferred |
| MatchExecutionFeedback | `MatchExecutionFeedback → Match → Team → Organisation` (indirect) | Yes | Direct preferred |
| TeamReflection | `TeamReflection → Team → Organisation` (indirect) | Yes | Direct preferred |
| OpponentEncounterObservation | `OpponentEncounterObservation → OpponentTeam → Organisation` (indirect) | Yes | Direct preferred |
| SelectionExplanation | `SelectionExplanation → Selection → Match → Team → Organisation` (indirect) | Yes | Direct preferred |
| MovementCandidate | `MovementCandidate → Player → Organisation` (indirect) | Yes | Direct preferred |
| Event | none (global) | Yes | Organisation-scoped |
| EventPlayerAvailability | `EventPlayerAvailability → Event → Organisation` (indirect) | Yes | Direct preferred |
| EventSquad | `EventSquad → Event → Organisation` (indirect) | Yes | Direct preferred |
| EventSquadPlayer | `EventSquadPlayer → EventSquad → Event → Organisation` (indirect) | Yes | Direct preferred |
| EventMatch | `EventMatch → Event → Organisation` (indirect) | Yes | Direct preferred |
| EventPostMatchReport | `EventPostMatchReport → EventMatch → Event → Organisation` (indirect) | Yes | Direct preferred |
| EventPostMatchPlayer | `EventPostMatchPlayer → EventPostMatchReport → EventMatch → Organisation` (indirect) | Yes | Direct preferred |
| EventGoalEvent | `EventGoalEvent → EventMatch → Event → Organisation` (indirect) | Yes | Direct preferred |
| EventAssistEvent | `EventAssistEvent → EventMatch → Event → Organisation` (indirect) | Yes | Direct preferred |
| EventMatchSupportAssignment | `EventMatchSupportAssignment → EventMatch → Event → Organisation` (indirect) | Yes | Direct preferred |
| EventMatchLineup | `EventMatchLineup → EventMatch → Event → Organisation` (indirect) | Yes | Direct preferred |
| EventMatchLineupAssignment | `EventMatchLineupAssignment → EventMatchLineup → EventMatch → Organisation` (indirect) | Yes | Direct preferred |
| SeasonPeriodSnapshot | `SeasonPeriodSnapshot → LeagueSeason → Organisation` (indirect) | Yes | Direct preferred |
| TeamSeasonSnapshot | `TeamSeasonSnapshot → Team → Organisation` (indirect) | Yes | Direct preferred |
| TeamSeasonSnapshotPlayer | `TeamSeasonSnapshotPlayer → TeamSeasonSnapshot → Team → Organisation` (indirect) | Yes | Direct preferred |
| PolicyDecisionLog | none (global) | Yes | Organisation-scoped audit |

**Total: 50 tenant-bearing models need `organizationId`**

## Multi-tenant models (new models for MT-1)

These models don't exist yet. They will be created during MT-1.

| Model | Purpose | `organizationId` needed |
|-------|---------|------------------------|
| Organisation | Top-level tenant boundary | No (is the tenant) |
| OrganizationMembership | User → Organisation role mapping | Yes (belongs to one org) |
| OrganizationInvitation | Email-bound invitation to join org | Yes (belongs to one org) |
| TeamAccess | COACH/VIEWER → Team delegation | Yes (belongs to one org) |
| MachinePrincipal | Machine identity for automation | Yes (scoped to one org) |

## Global/infrastructure models (no `organizationId`)

These models are not tenant-bearing. They serve authentication, identity, or platform infrastructure.

| Model | Purpose | `organizationId` needed | Notes |
|-------|---------|------------------------|-------|
| User | Global identity (Google OAuth) | No | Belongs to no single org; linked via OrganizationMembership |
| Account | Auth.js account linkage | No | Tied to User, not org |
| Session | Auth.js session (retained for adapter compat) | No | Will be replaced by database-backed sessions in MT-1 |
| VerificationToken | Auth.js email verification | No | Tied to User, not org |

**Total: 4 global/infrastructure models**

## Summary

| Category | Count | `organizationId` |
|----------|-------|-------------------|
| Tenant-bearing football domain | 50 | Required (NOT NULL after migration) |
| New multi-tenant models (MT-1) | 5 | Per-model (see above) |
| Global/infrastructure | 4 | Not needed |
| **Total** | **59** | **55 models need `organizationId`** |

## Unique constraints that become composite

Per ADR-0035, these unique constraints must become composite with `organizationId`:

| Current constraint | Becomes |
|-------------------|---------|
| `Team.name` @unique | `@@unique([organizationId, name])` |
| `Player.playerCode` @unique | `@@unique([organizationId, playerCode])` |
| `OpponentTeam.name` (if unique) | `@@unique([organizationId, name])` |
| `LeagueSeason.name` (if unique) | `@@unique([organizationId, name])` |

## Ambiguous data requiring migration decisions

| Data | Ambiguity | Resolution |
|------|-----------|------------|
| All current data | Belongs to one implicit organisation | Automatic migration into one initial org via bootstrap env vars |
| `User` records | Multiple users may need different roles in the initial org | First user becomes OWNER; others invited |
| `Session` records | Inactive Auth.js sessions | Retained for adapter compat; replaced by database-backed sessions in MT-1 |
| `RuleConfig` rows | Currently global per team | Will become org-scoped configuration |

## Entry points requiring tenant resolution

Every server action and API route that reads or writes protected data must resolve the authenticated user's organisation context before accessing any tenant-bearing data.

Current entry points that need tenant resolution (non-exhaustive):

- All routes under `/o/{organisationSlug}/...` (new)
- All server actions in `src/app/(app)/` (require `requireOrganisationAccess()`)
- All API routes under `/api/` (require organisation context)
- Auth.js callbacks (must resolve organisation membership after authentication)
- Middleware (must resolve organisation from route param, not client header)