# ADR 0023: Deferred Audit Extensions — Event Planned-vs-Actual and Simulation-Audit Feedback

## Status

Deferred

## Context

Stage 8 (Historical Audit and Planned-vs-Actual Review) established the core audit infrastructure for league match planning. Two potential extensions were identified during planning:

1. **Event planned-vs-actual review** — comparing event squad draft assignments to event post-match actual participation
2. **Simulation-audit feedback loop** — comparing simulation predictions to actual match outcomes

Both were evaluated for implementation value before deferral.

## Decision

Defer both extensions. The current audit infrastructure (Phases 1-4 of Stage 8) provides the core value. Neither extension justifies the implementation cost at this time.

### Event planned-vs-actual (deferred)

**Rationale for deferral:**

- Events are one-off (cup day, tournament, friendly day). The longitudinal fairness and load-balancing concern that drives league planned-vs-actual does not apply the same way.
- Events already have `EventPostMatchReport`, `EventGoalEvent`, `EventAssistEvent`, and `EventSquadPlayer` tracking. The data model already captures what happened.
- Adding a formal comparison layer duplicates the league audit pattern without the same coach urgency. Event coaches review results immediately; the post-match infrastructure already serves that need.
- If event review becomes a coach request, the service layer pattern from `src/lib/audit/planned-vs-actual.ts` can be adapted for event models with minimal design work.

**What to build if reinstated:**

- `src/lib/audit/event-planned-vs-actual.ts` — `getEventPlannedVsActual(eventId)` comparing EventSquad draft assignments to EventPostMatchReport actual participation
- `src/app/api/audit/event-planned-vs-actual/[eventId]/route.ts` — API route
- `EventPlannedVsActualPanel` — client component for event detail page
- Audit work items for event incomplete reports

### Simulation-audit feedback loop (deferred)

**Rationale for deferral:**

- Simulations produce draft selections and fairness signals. They do not produce match outcomes. Comparing "simulated selection X" to "actual result Y" compares planning intent to reality, which is exactly what the league planned-vs-actual layer already does.
- The simulation module (`src/lib/simulation/`) exists for dry-run preview, not audit. Making simulations auditable conflates preview with history.
- Simulation predictions depend on coach-configured inputs (rules, priorities). Comparing simulation output to reality evaluates coach configuration, not system accuracy. This is a different product concern (configuration tuning) that should be addressed separately if coaches request it.
- The planned-vs-actual layer (Phase 1) already answers "what did we plan vs what happened." Adding a "what did the simulation predict vs what we actually planned" layer is a second-order comparison with diminishing returns.

**What to build if reinstated:**

- `src/lib/audit/simulation-vs-actual.ts` — compare simulation output (stored as JSON fixtures) to finalized selections and actual outcomes
- A simulation comparison view showing where simulation predictions diverged from actual coach decisions and match outcomes
- Configuration tuning suggestions derived from simulation-vs-actual divergence patterns

## Consequences

### Positive

- No unused complexity added to the codebase
- Core audit infrastructure remains focused on the highest-value concern (league planned-vs-actual)
- Future implementers have a clear decision record explaining why these were deferred

### Negative

- Event coaches cannot yet see a formal planned-vs-actual comparison (they can still review event post-match reports directly)
- There is no simulation configuration tuning feedback loop (coaches can still compare simulation output manually)

## Revisit criteria

Revisit event planned-vs-actual if:
- Coaches request formal event review beyond post-match reporting
- Event fairness tracking becomes a product requirement

Revisit simulation-audit feedback if:
- Coaches request configuration tuning suggestions
- Simulation prediction accuracy becomes a measurable quality concern