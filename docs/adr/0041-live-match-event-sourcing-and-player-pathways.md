# ADR 0041: Live Match Event Sourcing and Player Pathways

## Status

Accepted

## Date

2026-07-31

## Context

Matchboard needs two new features:

1. **Player Pathways** — A season matrix view showing player context (core, support, development) across rounds, derived from selections and actual participation.
2. **Live Match Reporting** — A mobile-first, local-first match reporting mode where coaches record goals, rotations, fair play observations, and marked moments during a match.

Both features require new data models and new UI routes. The live match reporting feature specifically requires an append-only event model, local-first persistence, and clock anchors rather than incrementing counters.

## Decision

### Player Pathways

- Derive pathway data from existing `Selection`, `Availability`, and `Match` data — no new persistence models needed.
- Add `/insights/player-pathways` route with server data function `getPlayerPathways()`.
- Cell status distinguishes finalized vs draft context (no mixing).
- Support `finalized_only` and `include_drafts` view modes.

### Live Match Reporting

- Add four new Prisma models: `LiveMatchSession`, `LiveMatchEvent`, `MatchRotation`, `FairPlayObservation`.
- Add seven new enums: `LiveSessionStatus`, `LiveMatchEventType`, `LiveEventCorrectionType`, `MatchPeriod`, `FairPlayCategory`, `FairPlayObservationSource`, `FairPlayObservationStatus`, `RotationSource`.
- Events are append-only. Undo appends a reversal event. Corrections reference the original event.
- Clock is derived from period anchors and timestamps, not an incrementing counter.
- Single active reporter per match (first session wins; others can resume after release).
- Local-first storage with client-generated event IDs for idempotency.
- Route: `/matches/[matchId]/live`.
- Fair play observations are provisional until post-match review. No player ranking, no automatic rating.

### Assistant integration

- Add `live_report_available` work item category to detect matches happening today with finalized squads but no active live session.

## Consequences

### Positive

- Append-only events preserve full audit history without silent deletion.
- Local-first architecture prevents network latency from blocking common actions.
- Clock anchors remain correct across screen locks and backgrounding.
- Player Pathways derives from existing data without duplication.
- Fair play categories use observable, child-safe language.

### Negative

- Live match data grows per event per match. Indexes and pruning needed for large deployments.
- Local-first sync requires reconciliation logic for offline scenarios.
- Single-reporter constraint means only one device at a time, requiring explicit takeover flow.

### Risks

- IndexedDB/localStorage persistence on mobile browsers may be cleared by the OS under storage pressure. Local events must sync promptly.
- Clock anchor derivation depends on server timestamps. Clock correction requires careful UX to avoid confusion.

## References

- Player Pathways and Live Match Reporting specification (internal)
- AGENTS.md: Live Match Reporting files table
- `src/lib/live-match/` — domain logic, session, event store, clock
- `src/lib/pathways/` — pathway types, helpers, data function
- `prisma/migrations/20260731150000_add_live_match_reporting_and_pathway_models/`