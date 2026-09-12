import type { MatchSquadBalanceInput } from "@/lib/touchline/presentation/match-view-model";

/**
 * Pure squad-balance tally for the Match detail planning-hub header (Touchline Design Atlas,
 * ADR-0136) -- computed entirely from selections/helpers the match-detail page already loads,
 * no new query. CORE/SUPPORT/DEVELOPMENT map directly; legacy BACKFILL (squad repair -- new
 * generation never produces it, AGENTS.md "Squad repair rules") is bucketed with SUPPORT, since
 * both represent non-core movement into this team for squad-strength reasons and the Atlas view
 * model has no separate "repair" bucket. A synthetic "HELPER" role (matchHelperAssignment rows,
 * not a real Selection row -- see match-detail.tsx's own helperSelectionData) counts as matchday.
 */
export interface MatchSquadBalanceRoleSource {
  role: string;
}

export function computeMatchSquadBalance(selections: MatchSquadBalanceRoleSource[]): MatchSquadBalanceInput {
  const balance: MatchSquadBalanceInput = { core: 0, support: 0, development: 0, matchday: 0 };
  for (const s of selections) {
    switch (s.role) {
      case "CORE":
        balance.core += 1;
        break;
      case "DEVELOPMENT":
        balance.development += 1;
        break;
      case "SUPPORT":
      case "BACKFILL":
        balance.support += 1;
        break;
      case "HELPER":
        balance.matchday += 1;
        break;
      default:
        // Unknown/legacy role values are not silently dropped from the total count elsewhere
        // (match.selections.length already shows the raw total); they're simply not attributed
        // to a specific bucket here.
        break;
    }
  }
  return balance;
}
