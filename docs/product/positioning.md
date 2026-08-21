# Product Positioning

> **Status:** Canonical. Defines what Matchboard is and is not, for product, design, and engineering decisions. Does not itself change navigation, terminology, or visual identity — see `docs/product/navigation-model.md`, `docs/domain/terminology.md`, and `docs/adr/0007-calm-cockpit-design-system.md` for those.

## Product definition

Matchboard is:

> A football operations workspace for coaches.

The product centers:

- squad decisions
- league selection
- event-team composition
- player allocation
- player movement
- lineup preparation
- match preparation
- live match operation
- post-match context
- player-development context
- explainable coaching decision support

Matchboard is deliberately **not** repositioned as:

- team messaging
- club administration
- payments
- parent communication
- generic scheduling
- training-content library
- tactical video analysis
- social/community platform

Matchboard should integrate with surrounding club systems (messaging, payments, club admin) rather than compete with them unnecessarily. A feature request that would move Matchboard toward one of the excluded categories above is a positioning question, not a routine feature decision — raise it rather than building it as a normal increment.

## Working brand promise

> Clearer coaching decisions across the whole squad.

## Brand characteristics

Matchboard's tone and visual language should be:

- calm
- competent
- practical
- football-native
- trustworthy
- analytical without being clinical
- modern without fashionable SaaS styling
- appropriate for youth and adult football

## Avoid

- esports aesthetics
- neon tactical-tech clichés
- generic SaaS gradients
- cartoon youth styling
- enterprise-management language
- AI-magic language
- making the entire application look like a football pitch

## Relationship to existing design work

`docs/adr/0007-calm-cockpit-design-system.md` already established a "calm coach-cockpit" visual system (quiet `Surface` primitive, restrained semantic tokens, reduced visual noise) before this positioning document existed. That work is consistent with the brand characteristics above and should be treated as the starting foundation for visual identity, not replaced.

## Source

This document restates the product definition and brand direction from the UI/UX programme specification (`.matchboard-work/ux-branding-language-ui/PROGRAMME.md` §1, gitignored working bundle). It is promoted here because positioning is a durable product fact, not disposable programme-tracking state.
