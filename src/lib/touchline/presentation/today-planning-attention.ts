/**
 * Today "Planning attention" adapter (ADR-0142 `02_PRODUCTION_COMPOSITION_CONTRACT.md` "Planning
 * attention"). Selects raw plan-integrity signals not already represented elsewhere on Today —
 * `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY` signals are always represented by Selection
 * decisions instead, and whichever signal was promoted into the page's primary Next Action is
 * excluded here to avoid duplication. Never collapses these into a `3 blocked`/`2 decisions
 * required` generic count — each row is the real signal.
 *
 * Pure and DB-free — every fact comes from the already-computed `roundPlanIntegrities`.
 */

import type { PlanIntegritySignal, RoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";

/** Sort: BLOCKED signals first (visually stronger, never dismissible), then DECISION_REQUIRED,
 * each group in stable original order. */
export function selectTodayPlanningAttentionSignals(
  roundPlanIntegrities: Record<string, RoundPlanIntegrity>,
  excludeSignalKeys: ReadonlySet<string>,
): PlanIntegritySignal[] {
  const signals = Object.values(roundPlanIntegrities)
    .flatMap((integrity) => integrity.signals)
    .filter(
      (s) => s.ruleCode !== "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" && !excludeSignalKeys.has(s.idempotencyKey),
    );

  return [...signals].sort((a, b) => {
    if (a.kind === b.kind) return 0;
    return a.kind === "BLOCKED" ? -1 : 1;
  });
}
