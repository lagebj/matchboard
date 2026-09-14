# Coaching domain model

This module covers the domain objects and responsibilities that drive Matchboard decisions.

## Teams, players, and matches

Matchboard operates over teams, players, groups, league seasons, rounds, and matches. The coach sets up these objects, marks availability, defines intent, and then plans squads by round.

The product is explicit about the coach-facing nature of the system:

- Coach-facing language is the default.
- Parent-facing exports remain separate and are not the source of truth for planning decisions.
- Player participation is evidential; actual match experience and reported data remain authoritative.

## Readiness, absence, and planning signals

The system distinguishes between:

- player availability and actual match participation
- readiness or development signals
- match-specific absence or conflict
- planned vs historical assignments
- explainability for why a plan is safe or blocked

The product rules require observable, explainable reasoning and avoid hidden or opaque player-ranking logic.

## Post-match learning and reflection

Historical match data is used for fairness, learning, and future planning. Finalized state is not recomputed or silently mutated. Reflections and observations remain grounded in observable play and recorded behaviour.

## Key decisions to preserve

- A player does not gain eligibility via a generic fairness heuristic.
- Selection generation is bounded by role- and position-specific rules.
- Coach intent and match context remain separate from assistant automation.
- Historical evidence informs later planning, but completed history is treated as immutable evidence.

## Relevant references

- `features/matchboard.feature`
- `docs/agents/selection-planning-and-fairness.md`
- `docs/agents/event-and-league-behavior.md`
- `docs/agents/ux-and-terminology.md`
- active ADRs tied to evidence, readiness, and historical workflow
