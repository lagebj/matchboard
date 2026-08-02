# ADR-0046: Simulation semantics and command palette

## Status

Proposed

## Date

2026-08-01

## Context

The current season simulation (`src/lib/simulation/simulation-service.ts`) calls `generateMatchRound()` which persists DRAFT selections to the database. An explicit comment in the code states "this is not a true dry-run." The deferred work specification requires simulation to produce zero football-data writes.

The current top-bar search is limited to players and teams with no keyboard shortcut. The deferred work specification requires a cross-domain command palette with organisation and team scoping.

## Decision

### Simulation no-write invariant

1. Extract or create a pure planning function `simulateSeasonPlan(input): SimulationResult` that operates on an immutable input snapshot
2. The pure function must use the same selection rules as normal generation
3. The pure function must return proposed selections, explanations, warnings, fairness effects, and unresolved constraints
4. The pure function must not create, update, or delete any football data rows
5. Provide a separate `applySimulationAsDrafts()` action that reloads source state, detects stale inputs, shows mutation summary, requires confirmation, runs normal authorization, and invokes normal generation services
6. Temporary operational telemetry is permitted only when it contains no simulated football state

### Command palette

1. Replace the current player/team-only search bar with a command palette
2. Entry points: Ctrl+K, Cmd+K, visible button, mobile-accessible trigger
3. Search domains: players, teams, event squads, opponents, fixtures, events, seasons, reports, rules, Assistant actions, application commands
4. Only display commands the actor may execute (organisation and team scoped)
5. First version is deterministic: exact, prefix, token, aliases, identifiers
6. Each provider requires ActorContext, applies org and team filtering, avoids leaking inaccessible counts
7. Destinations re-authorize on navigation

### Simulation comparison

1. Compare simulation results with: current draft plan, current finalised plan, another simulation result
2. Show changes in: player assignments, team balance, support paths, fairness, unresolved constraints

## Consequences

- Simulation is truly non-mutating
- Applying simulation results is an explicit, authorised, separate operation
- Command palette covers multiple domains
- Search is permission-scoped

## Related

- ADR-0021 (Season planning simulation)
- 06-planning-tools.md (deferred work specification)
- MB-DW-013, MB-DW-014