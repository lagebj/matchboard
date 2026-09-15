# ADR-0142: Today composition ownership and golden-reference conformance

## Status

Accepted

## Context

ADR-0141 established Today as an operational command surface with explicit plan-integrity decisions, coordinated inline recommendations, durable Live Now state, browser-local dismissal/revisit context, and a static football atmosphere.

PR #586 implemented most of the new functional machinery, but the production route retained the previous `AssistantCommandCentrePage` composition and inserted the new features into it. As a result, generic round summaries, old grouped work, full-width weekly context, and top-level dashboard widgets remained alongside the new concrete decision surfaces.

The result was functionally richer but visually and compositionally inconsistent with the approved Today golden reference and with ADR-0141's intent to replace count-only dashboard presentation.

The original theme-specific SVG atmosphere files also contained a mask-coordinate defect that made them effectively invisible. Even after technical correction, their simple vector composition did not provide the visual depth shown by the approved reference.

Two smaller correctness issues were found during review:

1. recommendation reason copy can state that a core team has room while the same recommendation is disabled because the target is already full;
2. Today dismissal currently uses the stable plan-integrity signal key rather than a fingerprint of the current decision state, so a changed recommendation can remain hidden.

## Decision

### One Today composition owner

`src/components/touchline/today/today-surface.tsx` is the sole production composition owner for the Today route.

The route renders `TodaySurface` directly.

The previous assistant command-centre composition is not retained as a parallel Today layout.

### Expanded composition

Expanded Today uses a 9/3 operational/context layout.

The main column contains, in order when present:

1. Live Now;
2. Next Action;
3. Selection decisions;
4. remaining concrete planning attention;
5. other concrete attention;
6. Today in order.

The context rail contains, in order when present:

1. Since your last visit;
2. Squad today;
3. Carry forward;
4. Recent football.

Generic count-only round/decision summaries do not render when the underlying raw decisions are already presented concretely.

### Decision anatomy

A selection decision visually separates:

- player/problem;
- factual explanation;
- action.

`RECOMMENDED BECAUSE` is used only when Matchboard has a real safe/coordinated recommendation.

Review-only states use factual current-situation language instead of pseudo-recommendation language.

### Recommendation capacity language

Recommendation explanations use actual squad count and configured target.

A team at or above target is never described as having room and is never a safe one-click recommendation target.

The planner distinguishes a safe recommended target from a review-only contextual target.

### Dismissal fingerprint

Selection decisions expose a decision fingerprint derived from current material decision state.

Browser-local dismissal keys against that fingerprint, not only the plan-integrity signal identity.

A materially changed decision therefore reappears automatically.

### Atmosphere assets

The route uses repository-owned theme-specific WebP assets supplied by this programme.

The WebP files replace the original Today SVG assets.

CSS owns the vertical fade into the Touchline canvas.

No upload, object storage, remote image service, external photography, player photo, or club badge capability is introduced.

### Golden-reference verification

The deterministic Today UI Lab primary state is the implementation review surface.

Before merge, the implementation must be captured at the approved 1672×941 dark viewport and compared side-by-side with the approved golden reference.

After human approval, the resulting implementation screenshot becomes the baseline for automated Playwright visual-regression protection.

## Consequences

The functional engines delivered by PR #586 are retained.

The corrective work is primarily composition, presentation adaptation, atmosphere assets, and two narrow recommendation/local-state corrections.

Today no longer exposes the same plan-integrity obligation as both an aggregate dashboard row and a concrete decision.

The context rail provides useful data without competing with operational actions.

The visual merge gate prevents unit-test success from being treated as sufficient evidence of golden-reference conformance.

## Relationship

Extends and clarifies ADR-0141.

Supersedes ADR-0141 only where ADR-0141 names transparent SVG as the atmosphere implementation format.

Does not alter the five-item primary information architecture.

Does not change canonical plan-integrity rules, selection mutation rules, or live reporting architecture.
