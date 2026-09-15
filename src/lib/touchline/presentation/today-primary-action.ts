/**
 * Today primary-action resolver (ADR-0141, ADR-0142 `02_PRODUCTION_COMPOSITION_CONTRACT.md`).
 * Resolves the single "Next Action" the page features from the situational projection's top
 * decision, WITHOUT ever falling back to unrelated `actionable[0]` assistant-item order — the
 * exact defect the corrective bundle requires fixing.
 *
 * Resolution order, tried against `projection.decisions[0]` only (the situation policy's own
 * ordering is authoritative — this module never re-ranks):
 *   1. a Selection decision (`idempotencyKeyFromCandidateId` maps to a `TodaySelectionDecision`);
 *   2. a raw plan-integrity signal (`idempotencyKeyFromCandidateId` maps to a
 *      `PlanIntegritySignal` in `roundPlanIntegrities`, when it wasn't already claimed above);
 *   3. a live-session decision (`matchIdFromCandidateId` maps to a live/imminent match);
 *   4. the raw `CoachDecision` rendered generically from its own title/summary/recommendedAction/
 *      deepLink fields — never invented, always the projection's own data;
 *   5. `NONE` when there is no top decision at all (a genuinely quiet day).
 *
 * Pure and DB-free — every fact this module needs is already resolved by its caller.
 */

import { idempotencyKeyFromCandidateId } from "@/lib/situational/providers/plan-integrity-candidate-provider";
import { matchIdFromCandidateId } from "@/lib/situational/providers/live-session-candidate-provider";
import type { CoachDecision } from "@/lib/situational/situation-types";
import type { PlanIntegritySignal, RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import type { TodaySelectionDecision } from "@/lib/touchline/presentation/today-selection-recommendation-plan";
import type { TodayMatch } from "@/lib/assistant/types";

export type TodayPrimaryAction =
  | { kind: "SELECTION_DECISION"; decision: TodaySelectionDecision }
  | { kind: "PLAN_INTEGRITY_SIGNAL"; signal: PlanIntegritySignal }
  | { kind: "MATCH"; match: TodayMatch; decision: CoachDecision }
  | { kind: "GENERIC"; decision: CoachDecision }
  | { kind: "NONE" };

export function resolveTodayPrimaryAction(input: {
  projectionDecisions: CoachDecision[];
  selectionDecisions: TodaySelectionDecision[];
  roundPlanIntegrities: Record<string, RoundPlanIntegrity>;
  todayMatches: TodayMatch[];
  /** Candidate ids already represented by Matchday's own primary action (ADR-0143 §4.9) — this
   * resolver skips them and takes the next decision in the projection's own order, without
   * reranking the remaining decisions. */
  excludedCandidateIds?: ReadonlySet<string>;
}): TodayPrimaryAction {
  const topDecision = input.excludedCandidateIds
    ? input.projectionDecisions.find((d) => !input.excludedCandidateIds!.has(d.candidateId))
    : input.projectionDecisions[0];
  if (!topDecision) return { kind: "NONE" };

  const signalKey = idempotencyKeyFromCandidateId(topDecision.candidateId);
  if (signalKey) {
    const selectionDecision = input.selectionDecisions.find((d) => d.signalKey === signalKey);
    if (selectionDecision) return { kind: "SELECTION_DECISION", decision: selectionDecision };

    for (const integrity of Object.values(input.roundPlanIntegrities)) {
      const signal = integrity.signals.find((s) => s.idempotencyKey === signalKey);
      if (signal) return { kind: "PLAN_INTEGRITY_SIGNAL", signal };
    }
  }

  const matchId = matchIdFromCandidateId(topDecision.candidateId);
  if (matchId) {
    const match = input.todayMatches.find((m) => m.matchId === matchId);
    if (match) return { kind: "MATCH", match, decision: topDecision };
  }

  // No natural raw-signal mapping succeeded — render the projection's own decision generically
  // rather than silently reverting to unrelated assistant-item order (the exact anti-fallback
  // requirement this resolver exists to satisfy).
  return { kind: "GENERIC", decision: topDecision };
}
