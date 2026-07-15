# ADR 0021: Season Planning Simulation

## Status

Proposed

## Context

Matchboard currently supports single-match and single-round generation. Coaches generate drafts for one round at a time (or populate all rounds at once), then review, adjust, and finalize each round individually. The workbench (ADR 0020) provides decision-level policy debugging for a single input.

However, coaches need to plan across time. They need to answer:

- Will every player get reasonable match opportunity across upcoming rounds?
- Which players are under-planned or overused?
- Do upcoming events conflict with league selections?
- Is goalkeeper and position coverage sustainable across rounds?
- Are fairness concerns building up over the season?

Single-match generation and workbench inspection cannot answer these questions. Fairness is inherently longitudinal — a player might look fine in one round but be consistently overused or under-selected across a season.

Currently, the only way to see longitudinal fairness is the `/season` page, which shows finalized history. There is no way to simulate future rounds and project fairness forward.

## Decision

Create Season Planning Simulation — a dry-run planning service that simulates league round generation and event squad construction over a selected horizon without committing any results.

### Core principles

1. **Dry-run only.** Simulation never persists selections, squads, lineups, helpers, reports, or snapshots. It computes and returns results in memory.
2. **Reuse existing engines.** Simulation calls the same generation, policy, fairness, and integrity logic as committed generation. No parallel rule system.
3. **Separate from workbench.** Workbench is for decision-level debugging. Simulation is for multi-round/multi-event planning overview. They link but do not duplicate.
4. **Practical fairness signals.** Simulation identifies specific fairness concerns (zero planned opportunity, low period participation, high recent load) rather than computing opaque fairness scores.
5. **League and event are separate concerns.** League simulation cares about round fairness, period participation, and season load balance. Event simulation cares about squad construction, position coverage, and match overlap. Combined simulation detects cross-context conflicts.

### Architecture

**Service layer** (`src/lib/simulation/`):

- `simulation-types.ts` — Request/result types, fairness flags, conflict types
- `simulation-context-builder.ts` — Assembles league season context (teams, players, availabilities, rotation paths, history, matches) for simulation input
- `simulate-league-rounds.ts` — Simulates league round generation across a horizon using `generateMatchRound` logic in dry-run mode
- `simulate-event.ts` — Simulates event squad generation and helper feasibility
- `simulation-fairness.ts` — Computes longitudinal fairness signals from simulated results + committed history
- `simulation-conflicts.ts` — Detects player overlaps, GK conflicts, position coverage gaps, and event/league time conflicts
- `simulation-service.ts` — Orchestrates simulation scope, calls appropriate sub-services, assembles result

**Dry-run generation**:

The generation engine currently writes to DB via `save-generated-draft.ts`. Simulation needs a non-persisting path. Rather than duplicating generation logic, the approach is:

- Extract the core computation from `generateMatchRound()` into a pure function that returns `GeneratedRoundResult` without persisting
- `generateMatchRound()` calls this function then persists; simulation calls it and returns the result directly
- This avoids a full refactor of the generation pipeline while enabling dry-run reuse

**API routes**:

- `POST /api/simulation/run` — Run a simulation (requires coach auth)
- `GET /api/simulation/fixtures` — List simulation fixtures for workbench-style dry-run

**UI route**:

- `/simulation` — Season Planning Simulation page with scope selector, controls, and results display

### Simulation scopes

| Scope | Description |
|-------|-------------|
| `league_round` | Simulate one or more specific rounds |
| `league_date_range` | Simulate all rounds within a date range |
| `league_period_remainder` | Simulate remaining rounds in current Spring/Fall period |
| `event` | Simulate event squad generation and helper feasibility |
| `combined_date_range` | Simulate league + events in same date range (follow-up) |

### Fairness signals

Simulation produces practical, labeled signals:

- Zero planned match opportunity in selected horizon
- Lower period participation than squad average
- High recent load across recent rounds
- Eligible but not selected
- Consecutive support burden
- GK coverage gap in simulated rounds
- Position coverage weakness

Not produced:

- Opaque fairness scores
- Permanent player labels
- Parent-facing export language

### Commit path

Stage 7 implements simulation-only (no bulk commit). Coaches commit through existing draft/preview workflows. If bulk commit from simulation is added later, it requires explicit validation and UX confirmation.

## Rejected alternatives

1. **Auto-commit full-period plans.** Too risky. Coaches need to review round-by-round before committing.
2. **Separate simulation rules outside policy.** Would create a parallel rule system that diverges from actual generation. Must reuse existing engines.
3. **One generic fairness score.** Opaque scores don't help coaches make decisions. Practical labeled signals are better.
4. **Spreadsheet-only planning.** Matchboard should provide simulation, not require external spreadsheets.
5. **Using assistant as the simulation engine.** Assistant surfaces simulation outcomes; it does not compute them.
6. **Full combined league/event simulation in this pass.** Combined simulation is important but complex. League and event simulation first; combined as follow-up.

## Consequences

- New service layer under `src/lib/simulation/`
- New API routes under `/api/simulation/`
- New UI route at `/simulation`
- Generation engine needs a dry-run extraction (non-persisting path)
- New simulation fixtures under `test/fixtures/simulation/`
- Assistant integration for simulation outcomes
- Workbench can link from simulation decisions to decision-level inspection
- No new Prisma models (simulation is ephemeral/in-memory)
- No new committed state (simulation is dry-run only)

## Supersedes

None. Extends ADR 0019 (policy contexts) and ADR 0020 (workbench).