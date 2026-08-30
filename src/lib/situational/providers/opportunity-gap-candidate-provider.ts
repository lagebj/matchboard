import type { OpportunityGapRow } from "@/lib/insights/insights-types";
import type { CoachDecisionCandidate } from "../situation-types";

/**
 * First genuine LONG_TERM candidate source with real evidence data (docs/domain/
 * situational-decision-support.md Phase 7). Adapts `getOpportunityGap()`'s (I-003) descriptive
 * planned-vs-realised gap rows — never a debt score, never automatic future-selection obligation
 * (AGENTS.md) — into normalized candidates.
 *
 * Pure and DB-free: takes rows already loaded by the existing owner (`getOpportunityGap()`),
 * never recomputes them.
 */
export const OPPORTUNITY_GAP_CANDIDATE_PROVIDER_ID = "opportunity-gap";

/** Caps how many gap rows become candidates — this is a bounded, "small set" analytical signal
 * (docs/domain spec's CHOOSE-style guidance), not a full roster dump. */
const MAX_CANDIDATES = 10;

export function opportunityGapRowsToCandidates(rows: OpportunityGapRow[]): CoachDecisionCandidate[] {
  return rows
    .filter((row) => row.gap > 0)
    .sort((a, b) => b.gap - a.gap)
    .slice(0, MAX_CANDIDATES)
    .map(toCandidate);
}

function toCandidate(row: OpportunityGapRow): CoachDecisionCandidate {
  return {
    id: `${OPPORTUNITY_GAP_CANDIDATE_PROVIDER_ID}|${row.playerId}`,
    source: OPPORTUNITY_GAP_CANDIDATE_PROVIDER_ID,
    entityType: "PLAYER",
    entityId: row.playerId,
    // Never include the player's name here (AGENTS.md: "Do not store player names inside
    // assistant issues, explanations, recommendations, decision records ... Use player IDs.
    // Resolve names for display only."). The player id is already carried via entityId/
    // affectedPlayerIds; the UI resolves the display name from its own already-loaded
    // OpportunityGapRow list at render time.
    title: "Opportunity gap",
    summary: `${row.realisedOpportunities} realised vs ${row.plannedOpportunities} planned opportunities this league season (gap: ${row.gap}).`,
    facts: [
      { code: "PLANNED_OPPORTUNITIES", numericValue: row.plannedOpportunities },
      { code: "REALISED_OPPORTUNITIES", numericValue: row.realisedOpportunities },
      { code: "GAP", numericValue: row.gap },
    ],
    consequences: ["DEVELOPMENT_SIGNAL"],
    affectedMatchIds: [],
    affectedTeamIds: row.coreTeamId ? [row.coreTeamId] : [],
    affectedPlayerIds: [row.playerId],
    alternativeActions: [],
    defaultDeepLink: `/players/${row.playerId}`,
    sourceConfidence: "MEDIUM",
    isLongTermSignal: true,
    affectsNextRoundDecision: false,
    requiresReview: false,
  };
}
