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

### Wired in the C6 follow-up (2026-09-09)

- **Squad selection** — `ExplanationRecord` gains an additive `reason?: RecommendationReason`.
  `buildExplanation(code, summary, hardRule)` attaches it via `reasonFromLegacyExplanation(code,
  hardRule)` (a legacy-code → `ReasonCode` map + `polarity` from `hardRule`) for every code that
  has a clean mapping (~30 of the ~40); an unmapped code keeps just its prose. `summary` is
  **kept** as the display fallback — it carries team names / counts / priority ordinals the
  generic `renderReason()` cannot reproduce, and it is name-free after ARR-0043. `reason` is
  persisted alongside the prose in `Selection.explanation` JSON and `SelectionExplanation.rulesApplied`
  / `blockers`.
- **Round Board** — `page.tsx` now reads the full stored record array from the `explanations`
  key (`save-generated-draft.ts` always wrote it there; the parser previously only checked a
  never-written `records` key, so the tooltip's soft-note list was silently always empty).
  `explanationTooltipFor()` renders `renderReason(e.reason)` for each soft (non-hard-rule)
  explanation when the structured reason is present, falling back to `e.summary`. First real
  coach-facing consumer of a `RecommendationReason` outside the rotation generator.

### Still staged (needs its own schema migration; no consumer yet)

- **`suggestLineupForFormation()`** — its per-assignment `reasons: string[]` + the
  `evidenceBonusForSlot` hook stay as string prose. Structuring them requires either changing
  `LineupSuggestion` (many callers, regression-guarded) or adding a parallel field, plus a
  nullable `MatchLineupAssignment.reasons Json?` column so they survive `applySuggestedLineup`.
  Deferred until a surface actually reads structured lineup reasons — the Tactics panel already
  renders the string list, and building the column ahead of a reader is the speculative plumbing
  ADR-0117 / ADR-0128 caution against.

Doing all of the above in one change would make it unreviewable and risk regressions in
ARR-0002 / ARR-0033-sensitive selection-explanation storage. The contract + formatter + the two
generators + the Round Board consumer + the concrete leak fixes are the delivered scope.

## Consequences

- New reason data across selection / lineup / rotation has one vocabulary and one prose owner.
- The rotation generator no longer leaks score arithmetic; the Tactics panel no longer shows a
  raw score.
- Every squad-selection explanation whose code maps carries a structured, neutral `reason`,
  persisted and rendered on the Round Board — and the long-latent `records`/`explanations` key
  mismatch that made the Round Board soft-note tooltip always empty is fixed.
- ARR-0043 (player names in stored explanations) — resolved in the same follow-up.

## References

- F6 / Consolidation Programme C6
- PRINCIPLES.md #8 ("explain decisions through reasons, not raw scores")
- ARR-0002 (selection explanation dual storage), ARR-0033 (Round Board renders explanations),
  ARR-0043 (player names in stored explanations)
- AGENTS.md "Explanation model", "Coach-facing vs parent-facing language"
