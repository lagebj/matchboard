# 0042 — Opponent Sporting Level and Player Development

Date: 2026-08-01

## Status

Accepted

Supersedes: 0026 (replaces coach-assessed sporting level with evidence-derived estimate; adds player development observations and profile suggestions)

## Context

ADR 0026 introduced coach-assessed opponent sporting level as a manual 1.0–5.0 decimal field on `OpponentEncounterObservation`. The product now requires:

1. Evidence-derived opponent sporting estimates from actual scorelines and fielded-team strength, not manual coach assessment alone.
2. Canonical 1–10 player attribute rating scale (the database already allows 1–10 via CHECK constraints; application code still validates 1–5).
3. Sparse player development observations leading to coach-approved profile mutations.
4. Position experience from actual participation leading to position suggestion review.

The existing manual `sportingLevel` field on `OpponentEncounterObservation` will be retained for backward compatibility but deprecated as the primary estimate source. A new `OpponentSportingEvidence` model will hold derived evidence per encounter.

## Decision

### A. Canonical 1–10 rating scale

Player editable attributes use integer 1–10 with null = not rated.

Migration: existing 1–5 values multiply by 2 (1→2, 2→4, 3→6, 4→8, 5→10, null→null). Preflight fails closed if unexpected values exist.

`overallLevel` = mean of non-null valid attributes, range 1.0–10.0.

Five-star display: `overallLevel / 2`, rounded to nearest half-star. Stars are presentation only.

### B. Opponent sporting evidence

Replace the manual assessment model with an evidence-derived model:

- One `OpponentSportingEvidence` record per completed eligible match.
- Formula: `fielded5 - 0.9 × ln((GF+1.5)/(GA+1.5))`, adjusted and clamped, then scaled to 1–10.
- Fielded rating uses actual participant ratings, snapshotted at evidence creation time.
- Weighted by actual minutes when available, otherwise equal average of rated participants.
- `MatchFit` values `CHAOTIC`, `SUPPORT_OVERPOWERED`, `SUPPORT_TOO_LOW` trigger automatic exclusion by default.
- Manual exclusion requires coach authority + structured reason; raw evidence is preserved.
- Formula version is stored with each evidence record.
- Derived aggregate uses six-month exponential half-life weighting over valid non-excluded evidence from the same opponent + game format within 12 months.

Confidence: 0 encounters = UNKNOWN, 1 = LOW, 2–3 = MEDIUM, 4+ = HIGH.

Planning target: `clamp(opponentEstimate + 0.4, 2.0, 10.0)` (0.4 preserves the old +0.2 on the 1–5 scale).

The existing `OpponentEncounterObservation.sportingLevel` field is retained for backward compatibility but no longer drives the primary estimate.

### C. Opponent planning influence

Opponent context is a bounded soft preference only:

- UNKNOWN/LOW: little or no scoring influence.
- MEDIUM: moderate soft preference.
- HIGH: full configured soft preference (capped magnitude, documented in selection scoring ranges).

Hard boundaries unchanged: opponent level cannot bypass availability, rotation paths, nonRotatable, same-round uniqueness, squad minimums, or finalised history.

Development opportunity remains possible against stronger opponents. Suitable development against lower opponents remains possible.

### D. Player development observations

Sparse, explicit, coach-created observations:

- Two kinds: ATTRIBUTE and POSITION.
- Direction: POSITIVE or NEGATIVE.
- One canonical attribute key list.
- Validation: actual participation in the source match.
- Child-safe/disallowed-language validation on observable notes.
- League and event matches use the same observation owner.

No mandatory per-player rating grid. Observations are optional.

### E. Evidence evaluation and suggestions

Attribute evidence evaluated per `organisation + player + attribute + last decided baseline`:

- LOW: <3 aligned or <3 matches or material contradiction → no suggestion.
- MEDIUM: ≥3 aligned across ≥3 matches, contradiction outnumbered by ≥2 → suggestion with confidence MEDIUM.
- HIGH: ≥5 aligned across ≥4 matches, contradiction ≤1 → suggestion with confidence HIGH.

Position evidence confidence: LOW (1–2 appearances), MEDIUM (~5 recurring), HIGH (8–10 regular + positive observations).

Only MEDIUM/HIGH creates a pending suggestion. At most one pending per player + target.

Attribute proposal: positive `x → min(10, x+1)`, negative `x → max(1, x-1)`. Unrated: surface review, require coach to set initial value.

Position suggestion classes: ADD_TERTIARY, REORDER_SECONDARY_TERTIARY, PROMOTE_TO_SECONDARY, REORDER_PRIMARY_SECONDARY_TERTIARY. Primary change requires HIGH + explicit coach approval.

### F. Suggestion lifecycle

Coach actions: Accept, Adjust and accept, Reject.

Decision must: re-authorise, detect stale current value, mutate Player inside transaction, mark suggestion decision, preserve evidence, create DecisionRecord, invalidate dependent projections.

After any decision, only evidence newer than the decision baseline can reopen that target.

### G. Domain separation

Three separate concepts remain:

- `Match.matchFit` = coach's qualitative encounter suitability.
- `OpponentSportingEvidence` = numeric inference from scoreline + fielded strength.
- `OpponentEncounterObservation` = factual match-environment/Fair Play context.

No merged "opponent score".

`MatchExecutionFeedback` remains separate from development observations. No automatic translation from feedback to attribute mutation.

### H. Privacy and terminology

- Opponent estimates are private coach-facing.
- Development observations are private coach-facing.
- Neither appears in parent-facing exports or external AI payloads.
- Prohibited terms: opponent rating, opponent strength, opponent quality score, reputation score, bad team, weak player, demoted, promoted (use: sent as support, development movement, estimated sporting level).

## Consequences

- Rating scale changes from 1–5 to 1–10, requiring data migration and validation updates.
- Existing `sportingLevel` field on `OpponentEncounterObservation` is deprecated as primary source; new `OpponentSportingEvidence` model holds derived evidence.
- Player development requires two new models: `PlayerDevelopmentObservation` and `PlayerProfileSuggestion` (plus `PlayerProfileSuggestionEvidence` link table).
- Position experience projection uses actual participation, not planned selection.
- All new models are organisation-scoped following existing multitenancy patterns.
- Selection engine gains a bounded opponent context preference that cannot override hard rules.