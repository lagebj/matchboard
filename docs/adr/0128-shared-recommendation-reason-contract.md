# ADR-0128: Shared structured recommendation-reason contract

## Status

Accepted

## Context

Matchboard's planning surfaces now weigh many factors — playing opportunity, fairness, role
suitability, position exposure, tactical attributes, opponent tendency, timing/context evidence,
combinations, downstream rotations. Consolidation Programme re-verification (F6) found the
coach-facing explanation of *why* a recommendation was made had become a liability:

- **Six+ generators, four incompatible output shapes:** squad selection emits
  `ExplanationRecord[]` (`{ code: string; summary: prose; hardRule }`, ~40 ad-hoc snake_case
  codes, no category); rotation generation emits one flat `explanation: string`
  (`parts.join("; ")`); lineup / integrated generation emits `{ score; reasons: string[] }`;
  Event squad generation emits a `selectionReason` string; the pre-match scenario evaluator
  emits `PlanEvidenceSignal { kind; text }`.
- **The same concept is re-worded per generator** — fairness under-share had ≥3 distinct
  sentences; two opponent-context strings were *byte-identical duplicated literals* across the
  rotation and integrated generators.
- **Prose is generated inside the algorithms** (F6 says prefer codes), and it leaked things it
  should not: raw score arithmetic (`goalsAgainstInWindow / occurrences` in the rotation
  generator; `score {n}` rendered in the Tactics panel) and — separately — player names into
  stored explanations (ARR-0043).
- **Only 1 of the 3 target generators has a real coach surface** — rotation reasons survive only
  as a `"Generated: "` prefix on a free-text notes field; lineup reasons are computed then
  discarded on apply.

## Decision

**One structured, client-safe reason model — `RecommendationReason` — and one prose owner.**

- `src/lib/explanations/recommendation-reason.ts` (new, no `@/lib/db` / no `@/generated/prisma`,
  mirroring `signal-category.ts`) defines:
  - `ReasonCategory` — the five material families: `HARD_CONSTRAINT`, `FAIRNESS_OPPORTUNITY`,
    `ROLE_POSITION_SUITABILITY`, `OPPONENT_EVIDENCE_CONTEXT`, `DOWNSTREAM_COVERAGE`.
  - `ReasonCode` — a closed union; `CODE_TO_CATEGORY` derives the category.
  - `RecommendationReason = { code, category, polarity: CONSTRAINT|SUPPORTING|CAUTION,
    confidence?, params?, material }` — `params` carry **counts / minutes / tier labels only,
    never a score/weight/delta**; `material` marks the few reasons that moved the decision.
  - `buildReason(code, opts?)` constructor; `classifyExplanationCode(legacyCode)` bridge that
    maps the existing ~40 squad-selection snake_case codes into `ReasonCategory` so that data is
    classifiable now, ahead of a staged migration of its emission path.
- `src/lib/formatters/recommendation-reason-text.ts` (new) — `renderReason()` is the **only**
  place a `RecommendationReason` becomes a sentence. Neutral language, correlational wording for
  evidence, no ranking, no leaked numbers — enforced by
  `recommendation-reason-text.test.ts` (snapshot of every code + a banned-substring guard reusing
  `DISALLOWED_FEEDBACK_TERMS`).

### Wired in this ADR

- **Rotation generation** (`generate-rotation-plan.ts`): `GeneratedRotationChange` gains
  `reasons: RecommendationReason[]` as the single source; `explanation` is now
  `reasons.map(renderReason).join("; ")`. The `goalsAgainst / occurrences` arithmetic clause is
  **replaced** by a `TRANSITION_STRUCTURE_CONTEXT` reason carrying only the occurrence count and
  confidence.
- **Tactics panel** (`match-tactics-panel.tsx`): the visible `· score {n}` is removed (F6).

### Staged follow-up (contract is ready; emission paths not migrated here)

- **Squad selection** — `buildExplanation(code, prose, hardRule)` in `generate-selection.ts` /
  `resolve-round-support.ts` / `generate-round.ts` keeps emitting `ExplanationRecord`s for now;
  `classifyExplanationCode()` already classifies its codes into the shared vocabulary. Its ~20
  sites also interpolate player names into stored strings — a distinct PII pass tracked as
  **ARR-0043**, not this ADR.
- **`suggestLineupForFormation()`** — its `reasons: string[]` + `evidenceBonusForSlot` hook stay
  as-is (many callers, regression-guarded); migrating them to `RecommendationReason[]` and adding
  a persistence path so lineup reasons stop being discarded on apply is follow-up.

Doing all of the above in one change would make it unreviewable and risk regressions in
ARR-0002 / ARR-0033-sensitive selection-explanation storage. The contract + formatter + the
highest-value generator + the concrete leak fixes are the C6 deliverable; the rest is
incremental against a stable contract.

## Consequences

- New reason data across selection / lineup / rotation has one vocabulary and one prose owner.
- The rotation generator no longer leaks score arithmetic; the Tactics panel no longer shows a
  raw score.
- ARR-0043 records the player-name-in-explanations residue that surfaced during this work.

## References

- F6 / Consolidation Programme C6
- PRINCIPLES.md #8 ("explain decisions through reasons, not raw scores")
- ARR-0002 (selection explanation dual storage), ARR-0033 (Round Board renders explanations),
  ARR-0043 (player names in stored explanations)
- AGENTS.md "Explanation model", "Coach-facing vs parent-facing language"
