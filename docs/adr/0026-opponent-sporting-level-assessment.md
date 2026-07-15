# 0026 — Opponent Sporting-Level Assessment and Planning Guidance

Date: 2026-07-15

## Status

Accepted

Supersedes: 0013 (adds sporting-level assessment; retains encounter observations and Fair Play as separate concerns)

## Context

ADR 0013 introduced the opponent team registry and encounter observations, explicitly stating that opponent observations must not automatically alter selection-engine outcomes. Matchboard now needs to provide coaches with opponent sporting-level context when planning squads, while maintaining hard boundaries that prevent opponent data from overriding core eligibility.

Coaches currently have no structured way to record how strong an opponent appeared in a specific encounter, nor to receive planning guidance based on historical opponent level.

## Decision

### A. Sporting-level assessment

Add an optional decimal sporting-level assessment (1.0–5.0, 0.1 precision) to the post-match encounter observation model. This is a private coach-facing assessment of the opponent's observed football level in that specific match, not a timeless truth about the opponent.

- Stored on `OpponentEncounterObservation.sportingLevel` (Decimal, nullable, 0.0–5.0)
- Supports a short factual note (`sportingLevelNote`, max 280 chars)
- Records assessor and timestamp where the audit model supports this
- Must not overwrite historical encounter evidence
- Private and coach-facing; excluded from parent exports and external AI payloads

### B. Derived opponent estimate

Derive an opponent sporting-level estimate from historical encounter assessments:

- Deterministic calculation from the last N comparable encounters (max 5)
- Recency-weighted: more recent assessments carry more weight
- Game-format-aware where available: same-format assessments weighted higher
- Resistant to one unusual result (requires at least 2 assessments for "medium" or higher confidence)
- Returns: estimated level, confidence, assessment count, last assessed date, historical context summary

The derived estimate is computed on demand, not persisted as a duplicate aggregate unless performance or audit requirements justify it (currently not justified).

### C. Selection-engine integration

Opponent context influences suggestions and scoring as a bounded policy preference:

- Default challenge margin: +0.2 (opponent at 3.4 → suggested minimum squad strength of 3.6)
- Lower-level opponent: meet target without over-strengthening; increase appropriate development opportunities
- Higher-level opponent: favour eligible established or stabilising players; retain appropriate development opportunities
- Difficult match environment: advisory preference for players with readiness evidence for composure; never excludes players
- Planning note or decision signal when squad falls below suggested target
- Manual adjustment always available; coach can finalise with existing override model

Hard boundaries (opponent level must NOT):
- Make an ineligible player eligible
- Exclude an otherwise eligible player
- Bypass rotation paths, availability, same-round uniqueness, or squad minimums
- Override core invariants
- Create a public or parent-visible player ranking
- Mutate finalised history

### D. Separate concerns

- **Sporting level**: how strong the opponent appeared (1.0–5.0 per encounter)
- **Sporting fit**: how suitable the challenge was for our squad (existing `MatchFit` enum)
- **Match environment and Fair Play**: observable conditions (existing `MatchEnvironmentObservation` enum and `OpponentConcernCategory`)

These remain separate models. No merged "opponent score" combining level, fit and environment.

### E. Prohibited language

- Never use: opponent rating, opponent strength, opponent quality score, bad team, dirty players, threat assessment
- Use: sporting level, sporting fit, match environment, Fair Play concern, observed concern

## Consequences

- Coaches can record opponent sporting level as part of completing a post-match report
- Historical opponent level informs future squad suggestions as a bounded preference
- A 3.4 opponent produces a default suggested minimum of 3.6 (3.4 + 0.2 challenge margin)
- Opponent context cannot override core eligibility or create permanent player labels
- Difficult match-environment context remains separate, observable and private
- Parent exports and external AI payloads exclude opponent sporting-level data
- Existing `OpponentEncounterObservation` rows remain valid (sporting level is nullable)
- Historical reports without assessments remain valid