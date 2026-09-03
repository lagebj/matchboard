# ADR-0120: Position-Context Evidence and Transient Historical Rebuild

## Status

Accepted

## Context

A follow-up to the completed Evidence-Informed Match Planning programme (ADR-0113 through
ADR-0119, all 8 bundles merged to `main`) asked for two additions:

1. **Position-context outcome evidence** — "what has historically happened while this player
   occupied this outfield position, compared to the team's other recorded exposure at that
   position?" — as contextual evidence, explicitly never a player-quality judgement, with a hard
   neutral-language rule (no "bad"/"weak"/"poor"/"harmful"/"problematic"/"underperforming"/"risky"
   anywhere: code, UI copy, policy/audit reasons, documentation, tests).
2. **A transient "Rebuild historical evidence" admin action**, modelled on the existing transient
   "Populate opponent levels" tool, so an existing organisation's historical matches can be
   reprocessed through the completed programme's evidence pipeline.

### Repository audit findings

- `src/lib/evidence/post-match-learning-replay.ts`'s `replayPostMatchLearningHistory()` (built in
  Bundle 2) **already implemented the entire domain requirement for item 2** — reprocesses every
  completed League and Event match for an organisation through the one shared
  `runPostMatchLearning()` orchestrator (ADR-0104), per-match failure isolation, no giant
  transaction, idempotent, org-scoped, structured `{totalMatches, applied, skipped, failed,
  bySource, details}` result. It had no admin UI wired up yet — the actual gap was only that
  wiring, not the domain logic.
- `runPostMatchLearning()`'s four steps (actual timeline → opponent evidence → player evidence →
  combination evidence) already rebuild every fact the programme's other evidence types are
  *derived from on read*. Match-phase patterns, transition-structure evidence, opponent tactical
  tendency, and this ADR's own position-context evidence are all "derive on read, nothing
  persisted" (the programme's D-002) — there is no separate aggregate table for any of them to
  rebuild. Rebuilding `ActualPositionInterval`/`CombinationEvidence`/opponent evidence correctly is
  therefore sufficient; no new rebuild step was needed for item 1.
- A repository search found **no existing mechanism that automatically mutates
  `Player.primaryPosition`/`secondaryPosition`/`tertiaryPosition` from evidence** anywhere in this
  codebase — only a coach's own manual inline edit
  (`src/app/(app)/players/[playerId]/inline-actions.ts`). The programme's own D-010 ("existing
  position evidence owns persistent mutation; do not create a second mechanism") assumes such a
  mechanism exists; it does not, in this repository. This addendum honours D-010's actual intent
  by creating no new mutation path at all, rather than inventing a first one under this addendum's
  narrower scope — recorded here as a verified finding, not silently assumed true.

## Decision

### Position-context evidence

`src/lib/evidence/position-context-evidence.ts` is the one new owner. Team-season scoped,
League-only — the same D-003 scope decision Bundle 2 already made for match-phase patterns, for
the same reason (a League team is primarily a team-season instance). Baseline is "same
team-season at the same position, other players" — the one baseline the addendum's own worked
example requires; other named baselines (the same player at other positions, group-level
evidence) are a disclosed deferral, not built here. Confidence reuses Bundle 2's
`classifyMatchPhaseConfidence()` directly rather than a second threshold table.

Attribution hierarchy: before an individually-attributed pattern is surfaced, a broader
structural explanation is checked first — currently a recurring teammate combination during the
same exposure, reusing the existing season combination-evidence engine
(`selectRelevantPartnerships()`) outright.

`outcomeDifference` is a closed three-value union — `MORE_FAVORABLE` / `SIMILAR` /
`LESS_FAVORABLE` — the only vocabulary any generated text or UI is permitted to describe a
position-context pattern with.

Wired into:
- **Pre-match scenario evaluation** (Bundle 4): `evaluatePlannedScenario()` gained an optional
  `positionContextEvidence` input (pre-loaded plain data, matching how match-phase/combination
  evidence already work) and a new `startingLineupSignals` output field; a `HISTORICAL_PATTERN`
  signal is attached to a starting assignment or any transition where a player enters or changes
  position, recomputed automatically since the evaluator is a pure function of its inputs.
- **Automatic generation** (Bundles 7/8): `computePositionContextBonus()` — bounded via the
  existing `capEvidenceBonus()` (Bundle 6), confidence-gated, wired into the rotation generator's
  bench-candidate scoring and the integrated starting-line-up generator's `evidenceBonusForSlot()`
  after role-suitability scoring, alongside the existing opponent-function bonus. Only ever a
  bonus (0 for `SIMILAR`/`LESS_FAVORABLE`/unknown) — never a penalty, matching Bundle 6's
  "negative individual outcome evidence cannot exclude an eligible player" invariant by
  construction. Both callers' existing `assertEvidenceDidNotExcludeCandidates()` calls now cover
  this signal for free.
- **Position learning**: no new mutation path was created (see the audit finding above).

### Transient historical rebuild

`src/app/(app)/o/[orgSlug]/evidence-rebuild-actions.ts` (admin-only, org-scoped server action) +
`evidence-rebuild/page.tsx` + `evidence-rebuild-client-content.tsx` wrap the already-existing
`replayPostMatchLearningHistory()`, mirroring "Populate opponent levels"'s exact operational
pattern: explanatory copy, an explicit confirm before running, a final processed/updated/skipped/
failed summary with a per-source breakdown, a failed-match list (match id + generic error message
only, never player-identifying detail), and an explicit "safe to rerun" statement. Reachable from
More's admin-only "Advanced" section. No dry-run/preview mode was added (unlike "Populate
opponent levels") — the underlying replay is already idempotent and non-destructive, so a preview
step adds complexity without a safety benefit.

## Rationale

Both additions extend exactly the owners the completed programme already established rather than
building parallel machinery — the actual new work was one evidence module (with the neutral
language it introduces) and one thin admin-UI wrapper around domain logic that already existed.
This is a smaller, safer change than the size of the original request implied, and the audit
findings above are the reason why.

## Alternatives considered

### A second position-mutation-from-evidence engine

- Benefits: would fully realise the addendum's literal "feed it into the existing position
  evidence/suggestion mechanism" instruction if such a mechanism existed.
- Costs: no such mechanism exists in this repository; building one now would be new scope well
  beyond "position-context evidence" and duplicate the coach's existing manual position-edit
  control with an unrequested automatic one.
- Reason not selected: the addendum's own D-010 constraint ("do not create a second mechanism")
  is honoured by creating none, not by inventing a first one under this narrower addendum.

### A dry-run/preview mode for the historical rebuild

- Benefits: matches "Populate opponent levels"'s own two-step (dry-run, then apply) UX exactly.
- Costs: `replayPostMatchLearningHistory()` has no preview variant; building one would duplicate
  significant logic inside `runPostMatchLearning()`'s four steps for a tool whose underlying
  operation is already safe to run directly.
- Reason not selected: the operation is idempotent and mutates no historical fact a coach can
  see (report, lineup, scoreline, attendance) — an explicit confirm dialog is a proportionate
  safeguard for a rerun-safe derived-data rebuild.

## Consequences

### Positive

- Coaches gain a genuinely new decision-support signal (position-context evidence) grounded in
  the same evidence architecture, precedence rules, and language discipline the whole programme
  already established — no new class of risk introduced.
- Existing organisations gain a working path to rebuild their historical evidence once, closing
  the gap left by Bundle 2's replay engine having no UI.

### Negative

- `position-context-evidence.ts` issues one query per completed match per (player, position) pair
  batch (mitigated by `getTeamPositionContextEvidenceForPairs()`'s shared-sample batching — one
  match/interval/goal load shared across every pair a caller needs, not per pair) — acceptable at
  the youth-league scale this product targets, matching the same disclosed limitation Bundle 2's
  `match-phase-pattern-evidence.ts` already carries.

### Risks and mitigations

- **Language drift.** Mitigated by a direct unit test on the module's own exported
  `outcomeDifference` values and generated-text phrases, rather than relying solely on developer
  discipline or a broad terminology-checker regex that risks false-positiving on unrelated
  legitimate words like "poor" or "weak" elsewhere in the codebase.
- **Automation over-weighting a thin sample.** Mitigated by reusing Bundle 6's existing
  confidence-gating (`isEvidenceConfidentEnoughToInfluence`) and bonus cap
  (`capEvidenceBonus`/`MAX_POSITION_CONTEXT_BONUS`) exactly, the same primitives every other
  evidence-informed scoring signal in the programme already uses.

## Migration and compatibility

- No schema changes. `position-context-evidence.ts` reads only existing tables
  (`ActualPositionInterval`, `Goal`/`Assist`/live-event goal attribution, `CombinationEvidence`)
  through already-existing query functions.
- `evaluatePlannedScenario()`'s new `positionContextEvidence` input and `startingLineupSignals`
  output are both additive — every existing caller that does not pass the new input is unaffected.
- `generateRotationPlan()`'s new `positionContextEvidence` input is additive and optional.
- The "Rebuild historical evidence" tool is new UI over an existing, unmodified domain function.

## Security and operations

- The rebuild action requires `canAdmin()` and is scoped exclusively to the caller's own resolved
  organisation (`requireActorContext(orgSlug).organisationId`) — never a caller-supplied
  organisation id. Covered by a regression test proving a non-admin caller is rejected before the
  replay engine ever runs.
- Position-context evidence introduces no new external data flow, secret, or write path.

## Related records

- ADRs: ADR-0104 (canonical post-match learning pipeline), ADR-0113–ADR-0119 (Evidence-Informed
  Match Planning programme bundles), ADR-0116 (outfield role suitability), ADR-0117 (evidence
  guardrails and precedence), ADR-0118/ADR-0119 (rotation/integrated generation)
- ARRs: None
- Security findings: None
- Issues or plans: None

## Implementation evidence

- Tests: `src/lib/evidence/__tests__/position-context-evidence.test.ts`,
  `src/lib/planned-rotation/__tests__/scenario-evaluation.test.ts` (position-context describe
  block), `src/lib/planned-rotation/__tests__/generate-rotation-plan.test.ts` (position-context
  describe block), `src/app/(app)/o/[orgSlug]/__tests__/evidence-rebuild-actions.test.ts`.

## Supersedes

None.

## Superseded by

None.

## History

### 2026-09-03

Record created. Position-context evidence module, scenario-evaluator wiring, automation
integration (rotation generator and integrated starting-line-up generator), and the "Rebuild
historical evidence" transient admin tool all landed in the same change.

### 2026-09-03 (review fix: attribution hierarchy was silently non-functional)

A pre-merge review found that `buildStructuralNote()`'s call to the existing
`selectRelevantPartnerships([playerId], evidence)` could never return a match: that helper filters
to `PARTNERSHIP` rows fully *contained within* a given player set (`playerIds.every(id =>
idSet.has(id))`), built for "who's on the pitch together" (a multi-player query). Given a
single-player set, no real two-player partnership row can ever satisfy `every`, so the call always
returned `[]` and `structuralNote` was always `null` — the attribution-hierarchy requirement (a
broader structural explanation surfacing ahead of individual attribution) silently never fired,
and no test caught it since the only existing assertion checked the `structuralNote: null` case.
Fixed with a new, correctly-scoped `findRelevantPartnershipForPlayer()` (`playerIds.includes(playerId)`,
not `.every`), plus five new unit tests exercising the fixed function directly (including a
regression test naming the original bug). See AGENTS.md's "Position-context evidence" section for
the corrected description.
