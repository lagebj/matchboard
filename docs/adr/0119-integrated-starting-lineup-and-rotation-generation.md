# ADR-0119: Integrated Starting-Line-Up and Rotation Generation

## Status

Accepted

## Context

The Evidence-Informed Match Planning programme's Bundle 8 — the final bundle
(`.matchboard-work/evidence-informed-match-planning/`, a temporary, gitignored implementation
work bundle) — asks for starting-line-up generation that "does not generate a best XI," considers
eligibility, fairness, role/position viability, structural balance, developmental exploration,
combination/structural evidence, and opponent evidence, and — critically — **reasons together
with rotation generation**: "do not optimise the starting seven and force rotation generation to
repair an unfair or structurally brittle plan later."

### Repository audit findings

- **The existing owner for match-specific starting-lineup suggestion is
  `suggestLineupForFormation()` (`src/lib/formations/suggest.ts`)**, already wired to the Tactics
  tab's "Suggest lineup" button via `suggestLineupForMatch()`/`applySuggestedLineup()`
  (`suggest-actions.ts`). It already embodies "do not generate a best XI": it scores by
  position-fit tier (primary/secondary/flexible) and scarcity, never by an overall rating. It has
  zero awareness of fairness, role-suitability evidence (Bundle 5), opponent tendency (Bundle 2),
  or combination evidence (existing, pre-programme) — the gap this bundle closes, by extending
  this owner rather than building a second lineup generator.
- **Best Lineup (`src/lib/best-lineup/best-lineup.ts`) is a different, deliberately unrelated
  concept** (per its own existing doctrine, AGENTS.md "Best Lineup"): a per-team, match-independent
  starting-point generator, not match-specific and not evidence-aware. Left untouched — extending
  it would conflate two different questions ("what does this team's roster suggest in general"
  vs. "what does THIS match's squad/evidence/opponent suggest").
- **Bundle 7's `generateRotationPlan()` already accepts a starting XI as a plain input** — it does
  not care how that XI was produced. "Reasoning together" therefore did not require redesigning
  either stage's internals; it required composing them in one action, sharing one evidence
  context, so the starting-XI choice and the rotation plan are never computed from two
  independently-loaded, potentially-inconsistent views of the same match's fairness/evidence.
- **A football-judgment table (opponent tendency → preferred tactical function) was private to
  `generate-rotation-plan.ts`** — needed identically by the new starting-lineup evidence layer.
  Extracted to a new shared module, `src/lib/planned-rotation/opponent-function-preference.ts`,
  so this real football decision exists exactly once, not duplicated/re-justified in two files.
- **The `FormationSlotRoleType` ↔ `OutfieldStructuralRole` mapping** (`mapPositionLabelToOutfieldRole`,
  private to `generate-rotation-plan.ts` since Bundle 7) is needed by this bundle's evidence layer
  too. Moved to `position-suitability.ts` — the correct existing owner for position-mapping
  concerns (ADR-0116) — and both callers now import the one function.

## Decision

1. **`suggestLineupForFormation()` gains one new optional input**: `evidenceBonusForSlot?:
   (playerId, slot, alreadyAssignedPlayerIds) => LineupEvidenceBonus | undefined`. A callback, not
   a data map — `suggest.ts` never imports evidence/policy/team-composition code itself, keeping
   its existing dependency-light nature intact and matching AGENTS.md's "one business operation"
   rule (role/fairness/opponent/combination scoring stay owned where they already are; this module
   only adds whatever bounded score the caller supplies). Absent by default: every existing caller
   (Event lineup suggestion, the plain "Suggest lineup" flow) is provably unaffected — locked in
   by a new regression test asserting identical output with and without the hook, plus a test
   proving a large evidence bonus can never override a genuine position mismatch (the existing
   `-1000` no-match penalty still dominates).

2. **`generateIntegratedMatchPlanAction()`** (new,
   `src/app/(app)/matches/integrated-match-plan-actions.ts`) is the one orchestrator that makes
   the two stages "reason together":
   - Loads the match squad, season fairness (`getLeagueSeasonFairness()`, existing — `coreCount`
     is reused directly as the "how much has this player already started" signal, not a new
     fairness model), opponent tendency (Bundle 2), season combination evidence (existing,
     pre-programme), and per-player position-exposure evidence (Bundle 5's `getPositionExposure()`
     reuse, the same as the Player Profile panel).
   - Builds `evidenceBonusForSlot()` once, blending four bounded, capped contributions per
     (player, slot): fairness under-share (`capEvidenceBonus`, cap 20), a `DEVELOPMENTAL`-tier
     role-suitability discovery bonus (Bundle 5, +8 — only when demonstrated exposure supports a
     role the player has no declared fit for; `NATURAL`/`PLAUSIBLE` tiers are not separately
     scored here since the existing primary/secondary position-fit scoring already captures them),
     a capped opponent-function-continuity bonus (Bundle 6's `capEvidenceBonus`, shared with
     Bundle 7 via `opponent-function-preference.ts`), and a capped combination-evidence bonus
     (existing `getCombinationScoreModifier()`, reused unchanged, scored against whichever
     teammates are already placed in earlier slots in the same pass).
   - Calls `suggestLineupForFormation()` with this hook, then persists via the *existing*
     `applySuggestedLineup()` — never a new lineup-persistence path.
   - Immediately calls Bundle 7's `generateRotationPlan()` with the resulting starting XI, using
     the *same* opponent-tendency and transition-evidence data already loaded, and persists via
     the *existing* `createPlannedRotation()`.
   - `assertEvidenceDidNotExcludeCandidates()` (Bundle 6) verifies the lineup-suggestion step
     never structurally dropped a squad player from consideration.
   - Offered only when no rotation plan exists yet for the match/team (`createPlannedRotation()`
     already refuses otherwise) — the same "clear first, then regenerate" convention every prior
     bundle in this programme has used; no schema change.

3. **What "reason together" does *not* mean here, disclosed explicitly**: this is a *sequential*
   pipeline sharing one evidence context and one action — not joint combinatorial optimisation
   across both search spaces (trying multiple candidate starting XIs against multiple candidate
   rotation plans and picking the overall best pairing). That would be a substantially larger
   algorithmic undertaking with its own search-bound design questions. The chosen approach
   satisfies the stated requirement — the starting XI is never computed in ignorance of the
   match's fair-share/evidence context that the rotation plan will also use, and both are produced
   together, in one coach-facing action, from one evidence load — without inventing an
   unbounded search. A future bundle could add real joint search on top of this same shared
   evidence-loading and scoring foundation without changing its shape.

4. **UI**: one new button, "Generate lineup & rotation plan," beside the existing "Suggest
   lineup" button on the Tactics tab (`MatchTacticsPanel`) — deliberately additive, not replacing
   the existing plain-suggestion flow (a coach who only wants position-fit suggestions, with no
   evidence weighting, keeps that option).

## Consequences

- No schema changes.
- `suggest.ts`'s existing behaviour is unchanged for every current caller — proven by regression
  tests, not just asserted.
- The starting-lineup evidence layer deliberately reuses a *simpler* role-suitability signal
  (declared-position tiers + a flat `DEVELOPMENTAL` bonus) than it could in principle support —
  consistent with Bundle 7's own rotation-generator choice for bench-candidate scoring, kept
  the same across the pipeline for consistency rather than diverging.
- `generateIntegratedMatchPlanAction()` requires a `formationId` chosen by the coach first
  (formation *selection* itself is unchanged, existing `suggestFormationForMatch()` still owns
  that separate decision) — this bundle does not attempt to jointly search over formations too.
- This is the final functional bundle of the Evidence-Informed Match Planning programme. See
  CURRENT-STATE.md for the full programme-completion-criteria verification.

## Migration

None (additive; no schema change).

## Supersedes

None. Extends `suggest.ts` (unchanged behaviour for existing callers), `generate-rotation-plan.ts`
(Bundle 7, unchanged behaviour), and reuses `getLeagueSeasonFairness()`, `getPositionExposure()`,
`getCombinationScoreModifier()`, `getOpponentTacticalTendencies()` (all pre-existing, unchanged).
