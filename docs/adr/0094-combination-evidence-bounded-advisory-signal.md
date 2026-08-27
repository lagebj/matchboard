# ADR-0094: Combination Evidence as Bounded Advisory Signal

## Status

Proposed

## Context

Matchboard currently has a `PlayerCombinations` insight (I-005) that computes co-selection and co-appearance frequency. This is frequency-only, not effectiveness — it records how often two players were in the same squad or match, not how they performed together.

The Evidence-Driven Coaching Loop programme introduces structured combination evidence derived from actual on-pitch positions, with six canonical families: Partnership, Triangle, Line, Corridor, Functional Unit, and Full Configuration. Each family has subtypes and evidence measures (minutes together, goals/assists while present, opponent diversity, confidence levels).

## Decision

1. **Combination evidence is a bounded advisory signal.** It cannot override eligibility, availability, hard conflicts, required position/GK coverage, core opportunity/fairness rules, or development constraints. It is a soft scoring preference at best.

2. **No composite chemistry score.** There is no single number representing "how good" a combination is. Evidence is always presented as structured facts: "Players A and B played 96 minutes together at centre-back. The team conceded 2 goals during those minutes."

3. **Confidence is about data quantity, not quality.** INSUFFICIENT, EMERGING, and ESTABLISHED confidence levels reflect how much evidence exists, not how good the combination is. Unknown combinations are neutral, not negative.

4. **The existing `PlayerCombinations` insight (I-005) will be migrated.** Its co-selection frequency data is factual and will be preserved, but the insight surface will be enriched with position-level evidence from the canonical topology. The frequency-only calculation will not be removed — it will be contextualized within the richer evidence model.

5. **Combination evidence is coach-facing only.** It must not appear in parent-facing exports or external AI payloads.

6. **Anti-lock-in is required.** Known combinations must not dominate selection at the expense of unknown but viable alternatives. The selection engine must weight established positive evidence moderately and treat unknown combinations as neutral.

## Consequences

- A new `CombinationEvidence` model will store derived combination evidence per match, with family, subtype, participants, positions, minutes, context, and confidence level.
- The existing `player-combinations.ts` insight will be extended (not replaced) to include position-level and time-based evidence.
- Selection engine scoring will include a bounded combination evidence signal after all hard constraints and fairness rules.
- The `/insights/player-combinations` page will be enriched with confidence levels and structural context.

## Migration

- Phase 3 will add the `CombinationEvidence` model and aggregation engine.
- Phase 4 will integrate it as a bounded signal in selection scoring.
- Phase 7 will surface it in existing coaching workflows.
- The existing frequency-only insight remains functional throughout.