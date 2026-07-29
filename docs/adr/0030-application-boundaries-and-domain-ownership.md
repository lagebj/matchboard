# ADR-0030: Application boundaries and domain ownership

## Status

Accepted

## Date

2026-07-29

## Context

IMPROVE-0A requires documenting application boundaries, league/event shared capabilities, and caching/infrastructure decisions before feature expansion and domain reconciliation.

The current codebase has domain logic distributed across route handlers, server actions, and React components without a clear command/query separation. This assessment identifies the current state and the target direction.

## Decision

### Domain module ownership

Each domain capability has one owning module. Other parts of the application call the owning module; they do not independently implement the same behaviour.

| Domain | Owning module | Current state | Target |
|--------|-------------|---------------|--------|
| Selection generation | `src/lib/selection/` | Well-structured | Continue current pattern |
| Round orchestration | `src/lib/selection/generate-round.ts` | Well-structured | Continue current pattern |
| Policy evaluation | `src/lib/policies/` | Well-structured | Continue current pattern |
| Plan integrity | `src/lib/selection/compute-plan-integrity.ts` | Well-structured | Continue current pattern |
| Movement candidates | `src/lib/selection/movement-candidate.ts` | Well-structured | Continue current pattern |
| Season overview | `src/lib/selection/get-season-overview.ts` | Well-structured | Continue current pattern |
| League season management | `src/lib/seasons/` | Partially structured | Extract business logic from server actions |
| Post-match reporting | Server actions + `src/lib/data-integrity/` | Logic in actions | Extract to `src/lib/reports/` |
| Event squad generation | `src/lib/events/` | Well-structured | Continue current pattern |
| Player management | Server actions | Logic in actions | Extract to `src/lib/players/` |
| Team management | Server actions | Logic in actions | Extract to `src/lib/teams/` |
| Match management | Server actions | Logic in actions | Extract to `src/lib/matches/` |
| Availability | Server actions | Logic in actions | Extract to `src/lib/availability/` |
| Opponent team registry | Server actions | Logic in actions | Extract to `src/lib/opponents/` |
| Formation management | `src/lib/formations/` | Well-structured | Continue current pattern |
| Assistant work items | `src/lib/assistant/` | Well-structured | Continue current pattern |
| Data integrity | `src/lib/data-integrity/` | Well-structured | Continue current pattern |
| Insights | `src/lib/insights/` | Well-structured | Continue current pattern |
| Audit | `src/lib/audit/` | Well-structured | Continue current pattern |
| Simulation | `src/lib/simulation/` | Well-structured | Continue current pattern |

### Server action boundary

Server actions are thin adapters. They:
- Authenticate and authorise via `requireCoachAccess()`
- Validate input using Zod schemas (to be introduced in SEC-1)
- Call domain logic from the owning module
- Return results

Server actions must not:
- Contain business logic that belongs in a domain module
- Make direct Prisma calls for domain behaviour that has an owning module
- Contain selection rules, fairness calculations, or policy evaluation

This boundary will be enforced gradually during IMPROVE-0B and subsequent stages.

### League/event shared capabilities

League matches and event matches have distinct aggregate roots (Match vs EventMatch). Their lifecycles differ (round-based planning vs event-based planning). However, they share common football concepts:

| Shared concept | Current league model | Current event model | Target |
|---------------|---------------------|--------------------|----|
| Goal recording | `Goal` | `EventGoalEvent` | Shared type definitions, distinct persistence |
| Assist recording | `Assist` | `EventAssistEvent` | Shared type definitions, distinct persistence |
| Player participation | `PostMatchPlayerActual` | `EventPostMatchPlayer` | Shared type definitions, distinct persistence |
| Attendance status | String enum values | String enum values | Shared enum type |
| Goal type | String enum values | String enum values | Shared enum type |
| Formation/lineup | `MatchLineup` | `EventMatchLineup` | Shared formation logic from `src/lib/formations/` |
| Post-match reporting | `PostMatchReport` | `EventPostMatchReport` | Distinct roots, shared validation patterns |
| Opponent reference | `Match.opponentTeamId` | `EventMatch.opponentTeamId` | Shared `OpponentTeam` lookup |

Target: Extract shared type definitions into `src/lib/shared/` for common enums, status types, and validation patterns. Domain logic remains in owning modules. Adapters in league and event code paths call into shared services. Do not merge aggregate roots.

### Caching decision

Current state: In-memory LRU cache (`src/lib/cache.ts`) with time-based expiry only. No Redis. No explicit cache invalidation tracking.

Decision: 
- Framework-supported caching (Next.js `unstable_cache` or `revalidateTag`) may be introduced for stable read models in IMPROVE-0D.
- Every cached read model must document its cache policy: uncached, request-memoised, or persistently cached.
- Every cached read model must have explicit, tested invalidation.
- Authentication, authorisation, availability, drafts, active lineups, match-day state, and unfinalised reports must not use unsafe shared caches.
- Redis is deferred (ADR to be written in IMPROVE-0D if a bounded measured need is demonstrated).

### Database constraint priorities

Critical (must add before feature expansion):
1. Partial unique index on `Selection(playerId, matchRoundId)` where `status = 'DRAFT'` — one active planned assignment per player per round

High (should add in IMPROVE-0C):
2. Unique constraint on `Availability(playerId, matchRoundId)`
3. Unique constraint on `RotationPath(fromTeamId, toTeamId, role)`
4. Enum constraints for string-typed fields listed in source-of-truth register

Medium (should add when schema changes allow):
5. CHECK constraints on Player rating fields (1-10, nullable)
6. CHECK constraint on LeagueSeason (endDate > startDate)
7. CHECK constraints on Team squad sizes

### Performance baseline

Performance baseline measurement is deferred to IMPROVE-0D. The current codebase has not been benchmarked for route timing, query counts, or bundle size. IMPROVE-0D will:
1. Record baseline timings for priority routes and server actions
2. Count queries per route
3. Measure cold/warm request behaviour
4. Analyse client/server bundle sizes
5. Verify Vercel Function and Neon region alignment

## Consequences

- Domain logic will be progressively extracted from server actions into owning modules during IMPROVE-0B
- League and event models remain separate but share type definitions
- Caching will not be introduced until read paths are optimised and invalidation is tested
- The critical Selection unique constraint must be added before feature expansion begins
- Redis remains deferred unless a concrete measured need emerges

## Related

- ADR-0028 (security baseline and threat model)
- ADR-0029 (source-of-truth inventory and deprecation map)
- Source-of-truth register: `docs/domain/source-of-truth-register.md`
- Threat model: `docs/security/threat-model.md`
- ASVS matrix: `docs/security/asvs-matrix.md`