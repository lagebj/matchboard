/**
 * Match detail / planning hub presentation view model (Touchline Design Atlas,
 * `06_ROUTE_COMPOSITION_EVENTS_MATCHDAY.md §D-E`, `08_ROUTE_COMPOSITION_PLANNING_TACTICS.md §D-E`).
 *
 * Lineup/Tactics rendering itself is NOT re-derived here — `TacticsBoard`/`PitchPlayerToken`/
 * `classifyExactSuitability`/`FIT_TIER_LABEL` (already established) own that. This module covers
 * the surrounding planning-hub composition: preparation checklist, availability summary, planning
 * attention, squad balance, and the rotation safe-fit notice text.
 *
 * Sources:
 * - selections        -> EXISTING_DIRECT (Selection rows, match-detail.tsx MatchData.selections)
 * - planIntegrity      -> EXISTING_DIRECT (RoundPlanIntegrity.summary, src/lib/selection/compute-plan-integrity.ts)
 * - lineup existence    -> EXISTING_DIRECT (MatchLineup/MatchLineupAssignment presence)
 * - reportStatus        -> EXISTING_DIRECT (PostMatchReportViewModel.status)
 * - coverageIssues      -> EXISTING_DIRECT (checkPlannedRotationCoverage(), src/lib/planned-rotation/planned-rotation.ts)
 * - rotationDiagnostics -> EXISTING_DIRECT (GenerateRotationPlanResult.diagnostics — exact strings reused verbatim, provenance §6)
 * Derived:
 * - preparationChecklist -> DERIVED_PRESENTATION (2-3 explicit real booleans, never a fixed N/M matching a mockup's count — provenance §0.14)
 * - squadBalance         -> DERIVED_PRESENTATION (counts by role, already computed by the selection engine, just tallied for display)
 */

export interface MatchPreparationCheckInput {
  key: "squad" | "lineup" | "report";
  label: string;
  complete: boolean;
}

export interface MatchAvailabilitySummaryInput {
  available: number;
  doubtful: number;
  unavailable: number;
}

export interface MatchPlanningAttentionInput {
  title: string;
  detail: string;
  href?: string;
}

export interface MatchSquadBalanceInput {
  core: number;
  support: number;
  development: number;
  matchday: number; // helpers/guests added on matchday
}

export interface MatchViewModelInput {
  matchId: string;
  teamName: string;
  opponent: string;
  startsAt: string | null;
  venue: string | null;
  lifecycleStatus: string;
  checks: MatchPreparationCheckInput[];
  availability: MatchAvailabilitySummaryInput;
  planningAttention: MatchPlanningAttentionInput[];
  squadBalance: MatchSquadBalanceInput;
}

export interface MatchViewModel extends MatchViewModelInput {
  preparationCompleteCount: number;
  preparationTotalCount: number;
  squadTotal: number;
}

export function buildMatchViewModel(input: MatchViewModelInput): MatchViewModel {
  return {
    ...input,
    preparationCompleteCount: input.checks.filter((c) => c.complete).length,
    preparationTotalCount: input.checks.length,
    squadTotal:
      input.squadBalance.core +
      input.squadBalance.support +
      input.squadBalance.development +
      input.squadBalance.matchday,
  };
}

/** Rotation safe-fit notice — reuses the domain's own diagnostic strings, never re-worded into
 * player-blame language (`08§E`). Callers pass the diagnostic string exactly as produced by
 * `generateRotationPlan()`/`checkPlannedRotationCoverage()`. */
export function isSafeFitDiagnostic(diagnostic: string): boolean {
  return diagnostic.startsWith("No safe replacement for") || diagnostic.startsWith("No safe automatic fit for");
}
