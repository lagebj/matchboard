# Selection, planning, and fairness

This module captures the operating rules for automatic planning, manual adjustments, and fairness boundaries.

## Rule precedence and planning safety

Matchboard uses strict rule precedence for draft generation and automatic planning. Selection logic must not fabricate eligibility, violate exact positional semantics, or fill a slot with an unsafe or unsupported candidate when a valid fit is not available.

When automatic planning is used:

- exact positional eligibility is a hard gate
- fairness and evidence can reorder safe candidates, not create eligibility
- a slot with no safe fit remains manual rather than being silently filled unsafely

## Movement and draft lifecycle

The planning lifecycle includes draft generation, plan integrity checks, manual modifications, visibility of impacts, and derived finalization at the planning boundary. Movements and manual adjustments must preserve auditability and summarize their effect.

Key constraints:

- one planned assignment per player per round, per relevant scope
- plan changes must remain explainable
- the movement ledger tracks meaningful state transitions
- regenerate or repair only through the supported planning flows

## Fairness and integrity signals

Fairness is evaluated across the season or league season in aggregate. It is not a hidden score. The product explicitly separates:

- planned opportunity
- actual participation
- historical exposure or load
- support and development signals

The coach checks plan-integrity signals before accepting a draft, resolving blockers or adjusting manually.

## Relevant references

- `features/matchboard.feature`
- `docs/agents/product-operating-model.md`
- `docs/agents/coaching-domain-model.md`
- active ADRs covering selection safety, evidence-informed planning, and fairness
