# UX, terminology, and explainability

This module captures the interface and vocabulary rules that must hold across Matchboard.

## UX composition

Matchboard is a single adaptive application with context-aware composition. The same canonical state is visible across viewport sizes, but the amount of information, density, and interaction model changes with context. The UI must preserve clarity for compact and large screens without drifting away from the same domain state.

The visual system, navigation patterns, and core surfaces remain subject to the current ADRs and product-surface decisions. `docs/product/navigation-model.md` is the canonical primary-navigation reference (the exact five items, their routes, and what is deliberately not a primary item) — read it before changing sidebar/nav composition.

## Product vocabulary

Use the approved product vocabulary in UI text, docs, and tests. Avoid deprecated synonyms and ensure user-facing terminology matches the canonical domain model. Terms like “Check”, “Adjust”, and “Reflect” carry specific meaning in Matchboard and must not be collapsed into informal synonyms.

## Explainability and coaching intent

Explainability is not a generic score. The system records the why behind movement, support, and planning decisions in a way coaches can inspect. Coaching intent belongs in the planning surfaces rather than the assistant page.

## Relevant references

- `features/matchboard.feature`
- `docs/agents/product-operating-model.md`
- `docs/agents/coaching-domain-model.md`
- `docs/domain/terminology.md` and public docs
- `docs/adr/0131-review-semantics-check-attention-reflect-peer-decision.md`
