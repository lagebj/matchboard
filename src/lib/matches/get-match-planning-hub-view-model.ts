import { computeMatchSquadBalance } from "@/lib/matches/get-match-squad-balance";
import {
  buildMatchViewModel,
  type MatchViewModel,
  type MatchPreparationCheckInput,
  type MatchPlanningAttentionInput,
} from "@/lib/touchline/presentation/match-view-model";

/**
 * Pure assembly of the Match detail planning-hub view model (Touchline Design Atlas, ADR-0136)
 * from the fields the match-detail page/component already load — no new selection-engine logic,
 * no new domain computation, only tallying/mapping already-known facts. Kept separate from
 * `match-detail.tsx` (a large `"use client"` component) so this is directly unit-testable.
 *
 * "Availability" (per-selected-player currentAvailability) is deliberately not computed here —
 * the existing selections query doesn't load it; see the provenance doc's disclosed deferral.
 */
export interface MatchPlanningHubInput {
  matchId: string;
  teamName: string;
  opponent: string;
  startsAt: string | null;
  venue: string | null;
  lifecycleStatus: string;
  selections: Array<{ role: string }>;
  /** Already-filtered by severity, matching match-detail.tsx's own `blockingWarnings`/
   * `requiresOverrideWarnings` — the single highest-priority one becomes "Planning attention". */
  priorityWarnings: Array<{ code: string; message: string }>;
  formatWarningTitle: (code: string) => string;
  postMatchStatus: string | null | undefined;
  hasLineup: boolean;
}

export function buildMatchPlanningHubViewModel(input: MatchPlanningHubInput): MatchViewModel {
  const checks: MatchPreparationCheckInput[] = [
    { key: "squad", label: "Squad selected", complete: input.selections.length > 0 },
    { key: "lineup", label: "Lineup set", complete: input.hasLineup },
    {
      key: "report",
      label: "Report complete",
      complete: input.postMatchStatus === "REPORTED" || input.postMatchStatus === "LOCKED",
    },
  ];

  const planningAttention: MatchPlanningAttentionInput[] = input.priorityWarnings.slice(0, 1).map((w) => ({
    title: input.formatWarningTitle(w.code),
    detail: w.message,
  }));

  return buildMatchViewModel({
    matchId: input.matchId,
    teamName: input.teamName,
    opponent: input.opponent,
    startsAt: input.startsAt,
    venue: input.venue,
    lifecycleStatus: input.lifecycleStatus,
    checks,
    availability: { available: 0, doubtful: 0, unavailable: 0 },
    planningAttention,
    squadBalance: computeMatchSquadBalance(input.selections),
  });
}
