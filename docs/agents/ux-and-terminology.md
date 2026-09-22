# UX, terminology, and explainability

This module captures the interface and vocabulary rules that must hold across Matchboard.

## UX composition

Matchboard is a single adaptive application with context-aware composition. The same canonical state is visible across viewport sizes, but the amount of information, density, and interaction model changes with context. The UI must preserve clarity for compact and large screens without drifting away from the same domain state.

The visual system, navigation patterns, and core surfaces remain subject to the current ADRs and product-surface decisions. `docs/product/navigation-model.md` is the canonical primary-navigation reference (the exact five items, their routes, and what is deliberately not a primary item) — read it before changing sidebar/nav composition.

## Product vocabulary

Use the approved product vocabulary in UI text, docs, and tests. Avoid deprecated synonyms and ensure user-facing terminology matches the canonical domain model. Terms like “Check”, “Adjust”, and “Reflect” carry specific meaning in Matchboard and must not be collapsed into informal synonyms.

## Explainability and coaching intent

Explainability is not a generic score. The system records the why behind movement, support, and planning decisions in a way coaches can inspect. Coaching intent belongs in the planning surfaces rather than the assistant page.

## Match Insights and the before-match Tactics layout (ADR-0149)

Match Insights (`src/components/matches/match-insights/`) is the single pre-match decision-support
surface on the before-match Match Details Overview tab. It combines deterministic Matchboard facts
with optional bounded AI interpretation of those same facts — never a separate "Partnership
Evidence" section or a separate "AI Advisor" panel on that tab. Deterministic insights remain
useful with AI disabled or unavailable; AI failure never removes them. The UI shows the
highest-priority insights first (a semantic HIGH/MEDIUM/CONTEXTUAL relevance, never a numeric
score), normally up to five, with "Show all" for the rest.

On desktop, the planning pitch (`MatchTacticsPanel`) is intentionally narrower than before —
roughly 35-40% of the primary planning workspace, with Match Insights taking the larger remaining
share. On smartphone, the pitch keeps its own touch-optimized behavior rather than mirroring the
desktop ratio; Match Insights stacks below it in the normal mobile flow, with no permanent
split-column layout and no oversized modal for "Show all". See ADR-0149 for the full decision
record.

## Relevant references

- `features/matchboard.feature`
- `docs/agents/product-operating-model.md`
- `docs/agents/coaching-domain-model.md`
- `docs/domain/terminology.md` and public docs
- `docs/adr/0131-review-semantics-check-attention-reflect-peer-decision.md`
