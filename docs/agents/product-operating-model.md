# Product operating model

Matchboard is a private, coach-facing football operations cockpit for match-round squad planning, controlled player movement, coaching intent, plan integrity signals, and post-match reflection. It is not a generic club-management platform, a parent-facing communication product, or a public player-evaluation system.

## Workflow summary

The primary operating workflow is:

1. Setup
2. Define intent
3. Populate all
4. Check
5. Adjust
6. Derived planning-boundary finalization
7. Reflect
8. Learn

The key rule is that automatic planning is advisory until the coach checks the draft; the plan becomes historical only when the real-world planning boundary closes for a match.

## Canonical source of truth

Use `features/matchboard.feature` as the behavioral source of truth for selection rules, domain behavior, and expected outcomes. When product state, docs, or code disagree, fix the mismatch before shipping.

## Canonical routes and surfaces

- `/today` or `/assistant` — next action and workflow state, derived from live DB state
- `/fixtures` or the league view — season, round, and match hierarchy
- `/events` — event squad planning
- `/players` — player participation, current round attention, and development context
- `/more` / adjacent surfaces — history, groups, settings, insights, and supporting tools

## Mandatory boundaries

- No coach-operated finalize button exists; finalization is derived from real-world match state.
- Coaches can adjust draft selections, but manual changes must remain auditable and impact-aware.
- Finalized historical plans are not silently mutated.
- The assistant page must derive its work from live state rather than persisted issue rows.

## Relevant references

- `features/matchboard.feature`
- `docs/agents/coaching-domain-model.md`
- `docs/agents/selection-planning-and-fairness.md`
- `docs/development/coding-agent-working-session.md`
- active ADRs in `docs/adr/`
