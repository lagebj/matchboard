# ADR-0099: Emergency Repair Options Generator

## Status

Accepted

## Context

Phase 9 requires that a late, pre-kickoff availability change can produce "a small set of viable repair options with consequences" (DECISIONS.md "Emergency repair") — eligibility/conflicts, coverage, opportunity/fairness, development, recent participation, combination evidence, continuity, opponent context — with the coach choosing; nothing is ever auto-applied.

The existing tooling (`src/lib/selection/edit-impact-preview.ts`'s `previewManualAddImpact`/`previewManualRemoveImpact`, `availability-impact.ts`'s `analyzeAvailabilityChangeImpact`) only previews the consequence of **one specific, coach-chosen candidate** the coach already had in mind, or reports which *rounds* an availability change affects — there was no ranked, multi-candidate generator. The coach had to already know who to try.

## Decision

1. **Reuse the existing manual-edit mutation as the single source of eligibility truth — do not re-implement it.** `generateEmergencyRepairOptions()` (`src/lib/selection/emergency-repair-options.ts`) tries each candidate through the real `addPlayerToDraftMatch()` (the same function every manual draft edit goes through), immediately reverting via `removePlayerFromDraftMatch()`, exactly mirroring the established transient-mutate-and-revert pattern already used by `previewManualAddImpact`. A candidate that would need an override reason (invalid rotation path, same-round conflict, etc.) fails this call and is excluded — not "viable" in the DECISIONS.md sense; the coach can still do that specific move manually with an override, unaffected by this feature.
2. **Candidate discovery is "try the plausible pool, keep what the real validator accepts,"** not a second, hand-rolled eligibility filter: available, active, not already selected anywhere in the round, own team first (unbounded — a single team's roster is small and self-repair is priority 1 per AGENTS.md's "Squad repair priority order"), then other organisation players up to a bounded cap (`MAX_CANDIDATES_TRIED = 60`) to keep the request cost predictable.
3. **Ranking composes existing scoring primitives rather than reconstructing the full `RotationCandidate` shape** (which would require re-deriving most of `generate-selection.ts`'s internal pipeline): own-team/position-match bonuses, `getSuitabilityAndReadinessScore` + `getNegativeReadinessSignals` (readiness), `getFloatingHistory` (recent load — a floating-matches penalty), and the Phase 4 bounded combination-evidence signal (`getCombinationScoreModifier`, intent-aware via the match's active coaching intent) against the players already in the squad. New Blocked/Decision-required plan-integrity signals introduced by adding the candidate are a heavy penalty (not exclusion — the coach still sees the option, but ranked low) rather than a second hard filter, since a candidate that resolves the original gap but creates a smaller elsewhere issue is still a legitimate thing to show, not hide.
4. **Generating options is a pure preview — it must leave the draft exactly as it found it**, including the originally-unavailable player: the function removes them, evaluates candidates, and always re-adds them in a `finally` block. The actual, real change (removing the unavailable player and adding the chosen replacement) is a separate, explicit act the coach performs afterward through the existing manual-edit actions — this generator never mutates the draft net of its own call, matching "never auto-apply."
5. **Position/GK coverage, opponent context, and continuity are represented through the plan-integrity signal diff** (`newBlockedSignals`/`newDecisionRequiredSignals`/`resolvedSignals`), the same canonical projection the rest of the app already uses for these checks (`computeRoundPlanIntegrity`) — no separate coverage/continuity calculation was invented for this feature.

## Consequences

- `src/lib/selection/emergency-repair-options.ts` is the single new owner; `generateEmergencyRepairOptionsAction` (`src/app/(app)/matches/emergency-repair-actions.ts`) adapts it for server actions, alongside the existing preview actions.
- Cost: each call performs up to ~60 add+integrity+remove round-trips against the draft. Acceptable for an occasional, explicit "suggest repair options" coach action — not a hot path, not called during normal draft generation.
- **UI surfacing is deferred.** This ships as a tested domain function and server action; wiring a trigger into the Round Board / match squad view is left for the same follow-up as the other Phase 7 (contextual evidence surfaces) UI work, rather than touching the Round Board's drag-and-drop surface under time pressure without the ability to verify it interactively.
- Converting a `PlayerDevelopmentObservation`-style deep evidence-engine classification into this ranking (beyond the existing readiness/floating-history/combination signals already used) is out of scope — those signals already cover "recent actual participation," "development," and "combination evidence" from DECISIONS.md's list at a reasonable depth.

## Migration

None — no schema change, additive function and action only.
