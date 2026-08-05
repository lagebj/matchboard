# ADR-0058: Extend live match reporting to event matches

## Status

Proposed

## Date

2026-08-05

## Decision owners

- Matchboard domain lead

## Context

Matchboard has live match reporting for league matches (`/matches/[matchId]/live`) using `LiveMatchSession` and `LiveMatchEvent` models keyed on `matchId` (FK to `Match`). Event matches use a separate `EventMatch` model with their own post-match reporting (`EventPostMatchReport`).

Event matches are typically single-period (one half) rather than two halves. The existing `MatchPeriod` enum and `MATCH_PERIOD_ORDER` are hardcoded for `BEFORE → FIRST_HALF → HALF_TIME → SECOND_HALF → EXTRA_* → FULL_TIME`.

The requirement is to reuse the same `LiveMatchClient` component for both league and event matches, adapting the period model for single-period events while preserving all live reporting capabilities (goals, rotations, fair play, marked moments).

Key constraints:
- `LiveMatchSession.matchId` has a `@unique` constraint (FK to `Match`), so event matches cannot share this table without a schema change.
- `LiveMatchEvent.matchId` similarly references `Match`.
- `MatchRotation` and `FairPlayObservation` also reference `matchId` (FK to `Match`).
- The `LiveMatchClient` component is tightly coupled to league match context (team name, round name, `matchId`-keyed actions).
- Event matches need configurable period durations from `Event.matchDurationMinutes`.
- Event matches typically have 1 period instead of 2 halves.

## Decision

### 1. New Prisma models: EventLiveMatchSession and EventLiveMatchEvent

Create parallel models for event matches:

- `EventLiveMatchSession` — mirrors `LiveMatchSession` but keyed on `eventMatchId` (FK to `EventMatch`) with `@unique` constraint.
- `EventLiveMatchEvent` — mirrors `LiveMatchEvent` but keyed on `eventMatchId` (FK to `EventMatch`).

Do **not** add a polymorphic match-type column to the existing `LiveMatchSession`/`LiveMatchEvent` tables. The existing league models have a unique constraint on `matchId` and FK references that make polymorphic sharing complex and error-prone. Parallel models keep the schema clean, maintain referential integrity, and allow event-specific queries without conditionally filtering by match type.

### 2. Clock configuration: context-based period model

The `LiveMatchClient` component will accept a `periodConfig` prop that defines:
- `periods`: ordered array of `{ key: string; label: string; type: 'playing' | 'break'; durationMs: number | null }`
- The league match configuration defaults to the current `MATCH_PERIOD_ORDER` with `MATCH_PERIOD_DURATIONS`.
- The event match configuration derives from `Event.matchDurationMinutes`:
  - If null, default to a single period (no half-time).
  - If set, create a single playing period with that duration.

The `advancePeriod` function and related clock utilities will be parameterized with a `PeriodConfig` instead of using the global `MATCH_PERIOD_ORDER`. For backward compatibility, `createInitialClockState()` and the existing period functions remain available for league matches. New functions accept explicit config.

### 3. Shared LiveMatchClient with context abstraction

Refactor `LiveMatchClient` to accept a `LiveMatchContext` prop:
- `matchId`: league match ID or event match ID (used as a display key)
- `matchType: 'league' | 'event'`
- `contextId`: the actual ID used for server actions (league `matchId` or event `eventMatchId`)
- `squad`: array of `{ playerId, playerName, position, shirtNumber, role, availability }`
- `matchInfo`: `{ teamName, opponentName, gameFormat, startsAt, roundOrEventName }`
- `periodConfig`: the period configuration for this match type
- `eventId`: for event matches, the parent event ID (for navigation back)

The component's UI, state management, clock, event recording, goal flow, fair play flow, and rotation flow remain identical. Only the data fetching and action dispatching differ by context.

### 4. Event live match server actions

Create `src/app/(app)/events/[eventId]/event-live-actions.ts` with parallel actions to the league `live-actions.ts`:
- `startEventLiveSessionAction(eventMatchId)`
- `getEventActiveSessionAction(eventMatchId)`
- `endEventLiveSessionAction(sessionId)`
- `heartbeatEventAction(sessionId)`
- `recordEventLiveEventAction(input)`
- `getEventMatchEventsAction(eventMatchId)`
- `getRecentEventEventsAction(eventMatchId, limit?)`
- `getEventLiveMatchPreMatchPackageAction(eventMatchId)`
- `endEventLiveSessionAndCreateReportAction(sessionId, eventMatchId)`

These use `EventLiveMatchSession`/`EventLiveMatchEvent` tables and resolve org access through `EventMatch → Event → Organisation`.

### 5. Event live match report handoff

`endEventLiveSessionAndCreateReportAction` ends the event live session and creates or returns an `EventPostMatchReport` seeded from `EventSquadPlayer` + `EventMatchSupportAssignment` data (parallel to the league handoff that seeds from `Selection`).

### 6. Route and page

Add route `/events/[eventId]/matches/[eventMatchId]/live` with a server page that:
- Validates org access via `requireEventOrgAccess`
- Loads event match info, squad, and event context
- Passes event-specific `LiveMatchContext` to `LiveMatchClient`

### 7. Local sync adaptation

The `live-local-store.ts` IndexedDB store will use a `matchType` discriminator in the store key to separate league and event session/event data. The sync service will dispatch to the correct server action based on match type.

## Rationale

- Parallel models avoid polluting the existing `LiveMatchSession` unique constraint and FK relationships.
- Shared `LiveMatchClient` component ensures UI conformity between league and event matches.
- `PeriodConfig` prop makes the clock configurable without branching logic inside the component.
- Server actions are separate because the underlying tables and auth paths differ (league: `Match → Team → Organisation`, event: `EventMatch → Event → Organisation`).
- Single-period events are the common case for tournaments and cup days. The period config allows future extensibility for multi-period event formats without schema changes.

## Alternatives considered

### Polymorphic match-type column on LiveMatchSession

- Benefits: Single table, single set of queries.
- Costs: Requires nullable FK columns (`matchId` or `eventMatchId`), complex unique constraints, risk of cross-type data leakage, migration complexity.
- Reason not selected: Unique constraint on `matchId` would need to become composite or removed. FK references to both `Match` and `EventMatch` add join complexity. The risk of accidentally querying league sessions when looking for event sessions is real.

### Generic `sessionId` with separate lookup table

- Benefits: One event table for both types.
- Costs: Adds indirection, makes debugging harder, requires additional joins for every query.
- Reason not selected: More complex queries for no significant benefit given the small number of sessions.

### Duplicate the entire LiveMatchClient component

- Benefits: Zero shared code risk.
- Costs: Full duplication of ~600 lines of client code, drift risk, two places to fix bugs.
- Reason not selected: The requirement explicitly states "the same component(s) should be used to ensure conformity."

## Consequences

### Positive

- Live match reporting works for both league and event matches with identical UI.
- Period model is configurable — event matches can have 1 period or 2, with duration from event settings.
- Clean separation of data — no risk of cross-contamination between league and event sessions.
- Future event formats (multi-period tournaments) are supported without schema changes.

### Negative

- Two sets of session/event tables and two sets of server actions to maintain.
- Local sync needs a discriminator for match type.
- Period configuration adds a small runtime dependency to the clock.

### Risks and mitigations

- Risk: Period config could be inconsistent between client and server. Mitigation: The period config is derived from `Event.matchDurationMinutes` on the server and passed to the client as a prop. Events are immutable during live reporting.
- Risk: LiveMatchClient refactoring could break league match reporting. Mitigation: The refactored component must pass all existing league tests. The league page continues to pass the same props through the context abstraction.

## Migration and compatibility

- New migration adds `EventLiveMatchSession` and `EventLiveMatchEvent` tables with FKs to `EventMatch`.
- No changes to existing `LiveMatchSession` or `LiveMatchEvent` tables.
- `LiveMatchClient` is refactored to accept context props — the league live page passes the same data it does now, wrapped in the context format.
- Rollback: Remove the event live route, server actions, and the new tables. The league live reporting is unaffected.

## Security and operations

- Event live actions use `requireActorContext()` and org filter checks through `EventMatch → Event → Organisation`.
- `EventLiveMatchSession` has `organisationId` for tenant isolation.
- Single active reporter per event match — same constraint as league matches.
- Local-first sync uses IndexedDB — no sensitive data persisted beyond session scope.

## Related records

- ADRs: ADR-0041 (live match event sourcing and player pathways)
- AGENTS.md: Live Match Reporting files table, Event squad planning section

## Implementation evidence

- (To be added after implementation)

## Supersedes

None.

## Superseded by

None.

## History

### 2026-08-05

Record created.