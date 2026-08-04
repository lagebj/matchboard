# ADR-0049: Football Group as Operational Boundary

## Status

Proposed

## Date

2026-08-03

## Decision owners

- Matchboard engineering

## Context

Matchboard currently has a flat organisation model: `Organisation` is both the tenant boundary and the operational boundary. All teams, players, matches, events, seasons, and rules exist directly under the organisation. Access control for coaches and viewers uses per-team `TeamAccess` delegation — a coach without team delegation has no operational access.

This creates three structural problems:

1. **No shared player pool boundary.** Players belong to an organisation and are assigned to exactly one core team. There is no concept of a group of players sharing a pool across multiple teams. In real football operations, a cohort like "Boys 2015" trains together and splits into Red/White/Blue for match day. The current model forces each team to maintain its own isolated player list.

2. **Per-team access is too granular and too narrow.** A coach working with three teams in the same cohort needs TeamAccess to each team individually. There is no way to say "this coach manages the Boys 2015 group" — access is team-by-team, and it cannot express access to the shared player pool, events, or seasons as a unit.

3. **Events and seasons are org-wide.** Events, league seasons, and matches are created at organisation level with no operational grouping. A coach can see all events across all groups, even when they should be scoped to their own cohort.

The production deployment (Slemmestad Idrettsforening, "Boys 2015") currently uses one team to represent the entire cohort — a workaround that breaks down when the group has multiple teams, multiple leagues, or cup events.

## Decision

### 1. Introduce `FootballGroup` as the operational, player-pool, and permission boundary

A `FootballGroup` represents a stable cohort identity (e.g. "Boys 2015") that:
- Owns a shared player pool
- Contains zero or more teams
- Owns league seasons, fixtures, events, selection rules, and rotation paths
- Is the unit of coach/viewer access delegation

The hierarchy is:
```
Organisation (tenant, RLS boundary)
└── FootballGroup (operational boundary, player pool, access unit)
    ├── Teams (Red, White, Blue)
    ├── League Seasons (Spring 2026, Fall 2026)
    ├── Events (Sandar Cup)
    ├── Selection Rules
    ├── Rotation Paths
    ├── Reports
    └── Coaching Insights
```

### 2. Group identity is stable, not seasonal

Group names use a stable identity like "Boys 2015" or "Girls 2013", not seasonal age categories like "U11" or "U12". Age categories belong to league seasons and competition contexts because they change as the cohort ages.

### 3. GroupAccess replaces TeamAccess for operational access

`GroupAccess` with roles `COACH` and `VIEWER` replaces `TeamAccess` as the operational access control:

| OrganisationRole | Group Access | Effective Capability |
|---|---|---|
| OWNER | Implicit COACH for all groups | Full org management + full group operations |
| ADMIN | Implicit COACH for all groups | Full org management + full group operations |
| COACH (with GroupAccess) | Explicit per-group rows | Group-scoped operations per assigned groups |
| COACH (without GroupAccess) | None | No operational access (deny-by-default preserved) |
| VIEWER (with GroupAccess) | Explicit per-group rows (VIEWER) | Group-scoped read-only |
| VIEWER (without GroupAccess) | None | No operational access |
| SUPPORT | No GroupAccess rows | Temporary read-only to all groups (expires with membership) |

**Critical invariant:** A COACH without GroupAccess has exactly the same operational access as a COACH without TeamAccess today — none. The deny-by-default security model is preserved.

### 4. Organisation remains the PostgreSQL RLS boundary

Row-level security continues to use `app.current_organization_id` on every operational table. Group access is an **application authorization layer**, not a database RLS layer. `FootballGroup` rows are scoped by `organisationId` and RLS-protected at organisation level. Group access checks happen in application code after RLS passes.

### 5. Player pool via `FootballGroupPlayer`

Players remain organisation-level identities. A `FootballGroupPlayer` join table links players to groups with:
- `status`: ACTIVE or INACTIVE
- `membershipType`: PRIMARY (a player has at most one active primary membership)
- `joinedAt`, `leftAt` for temporal tracking
- `coreTeamId` (nullable) for the player's default team within the group

Historical memberships are preserved as INACTIVE with `leftAt`. The `Player` record itself is never deleted when removed from a group.

### 6. Cross-group interaction via `GroupMovementPath`

`GroupMovementPath` (distinct from intra-group `RotationPath`) configures eligibility for cross-group support:
- `sourceGroupId`, `targetGroupId`, `type` (SUPPORT, DEVELOPMENT), `scope` (MATCH, EVENT)
- Does not assign individual players — permanent transfer uses membership change, not movement paths
- Temporary cross-group support in a match creates a `Selection` with movement explanation but does not change group membership

### 7. Route hierarchy includes group scope

Canonical routes become:
```
/o/{orgSlug}/groups/{groupSlug}/teams
/o/{orgSlug}/groups/{groupSlug}/players
/o/{orgSlug}/groups/{groupSlug}/fixtures
/o/{orgSlug}/groups/{groupSlug}/rounds/{matchRoundId}
/o/{orgSlug}/groups/{groupSlug}/events/{eventId}
...
```

The server validates both `orgSlug` and `groupSlug` before loading entity IDs. Inaccessible groups are rejected with 403.

### 8. Migration from TeamAccess to GroupAccess

Migration is a 3-phase process:
1. **Foundation:** Add `FootballGroup`, `GroupAccess`, `FootballGroupPlayer`, `GroupMovementPath` as nullable/side tables
2. **Enforcement:** Wire group access checks alongside TeamAccess, dual-path
3. **Removal:** Remove TeamAccess, make group references non-nullable, redirect routes

Existing TeamAccess rows are collapsed into GroupAccess: multiple TeamAccess entries for teams in the same group become a single GroupAccess entry. OWNER/ADMIN/SUPPORT receive no GroupAccess rows (implicit access).

## Consequences

### Positive

- Coaches manage a cohesive player pool, not isolated team lists
- Access control matches real football operations (manage the cohort, not individual teams)
- Events, seasons, fixtures, and rules are scoped to the right operational unit
- Stable group identity survives seasonal changes
- Cross-group support is explicitly modelled rather than implicit
- Player transfer between groups is tracked with history
- Organisation remains the RLS boundary — no RLS policy changes needed

### Negative

- Three-phase migration with nullable period and dual authorization paths
- Route migration requires redirects and cookie-based resolution
- TeamAccess removal is a breaking change for any API consumers (currently none external)
- `GroupMovementPath` is a new concept alongside existing `RotationPath` — must be clearly distinguished in UI and code
- Production data requires backfill (creating "Boys 2015" group, migrating TeamAccess, linking players)

### Risks

- **Nullable group IDs during migration.** During the foundation phase, `footballGroupId` is nullable on models that will eventually require it. This is recorded as an ARR.
- **Dual authorization path.** During enforcement, both TeamAccess and GroupAccess are checked. This is recorded as an ARR.
- **Direct team-based player eligibility.** Current selection engine uses `player.coreTeamId` directly without group scoping. This must be updated to use group player pool membership. This is recorded as an ARR.
- **Legacy TeamAccess.** TeamAccess will be removed but must remain operational during migration. This is recorded as an ARR.

## Alternatives considered

### Flat organisation with team-level access only (current model)

Rejected because it cannot express shared player pools, cohort-level access, or group-scoped events and seasons. The "one team = one cohort" workaround breaks for multi-team groups.

### Nested tenants (sub-organisations)

Rejected because Organisation is the PostgreSQL RLS boundary and billing/tenant boundary. Adding sub-tenants would require RLS policy changes, separate billing logic, and admin complexity. Groups are operational boundaries, not tenant boundaries.

### Virtual groups (tags or labels only)

Rejected because tags cannot enforce access control, player pool boundaries, or cascade entity ownership. Groups need to be first-class entities with relationships, access control, and cascade behaviour.

### Expand TeamAccess to include group membership

Rejected because TeamAccess is per-team delegation. Extending it to include group access conflates two different concepts (team-level and group-level access) and makes the migration path unclear.

## Cross-references

- ADR-0035: Organisation-scoped routes
- ADR-0036: Authorisation model
- ADR-0048: orgSlug-authoritative route migration
- Implementation plan: `.matchboard-work/football-group-boundary/IMPLEMENTATION-PLAN.md`
- Migration plan: `.matchboard-work/football-group-boundary/MIGRATION-PLAN.md`
- Current-state audit: `.matchboard-work/football-group-boundary/CURRENT-STATE-AUDIT.md`
- Authorization matrix: `.matchboard-work/football-group-boundary/AUTHORIZATION-MATRIX.md`
- Feature contract: `features/matchboard.feature` — Rule: Football group as operational boundary