/**
 * Player detail presentation view model (Touchline Design Atlas,
 * `07_ROUTE_COMPOSITION_PLAYERS_INSIGHTS.md §B`).
 *
 * Sources:
 * - identity            -> EXISTING_DIRECT (Player: firstName, lastName, shirtNumber, primaryPosition, coreTeam)
 * - allTimeStats         -> EXISTING_DIRECT (getPlayerAllTimeStats(), src/lib/selection/effective-participation.ts)
 * - categoryStats        -> EXISTING_DIRECT (getPlayerCategoryStats(), src/lib/stats/player-category-stats.ts)
 * - recentOpportunity    -> EXISTING_DIRECT (getPlayerRecentOpportunity(), src/lib/players/get-player-recent-opportunity.ts)
 * - outfieldRoles        -> EXISTING_DIRECT (getPlayerOutfieldRoleSuitability(), src/lib/players/get-player-outfield-role-suitability.ts)
 * - selectionInvolvement -> EXISTING_DIRECT (getPlayerSelectionInvolvement(), src/lib/players/get-player-selection-involvement.ts)
 * - developmentThreads   -> CONDITIONAL   (DevelopmentThread rows where status=ACTIVE, only if present)
 * - quickObservations    -> CONDITIONAL   (QuickObservation rows where status=OPEN, only if present)
 * Derived:
 * - positionExposureShare -> DERIVED_PRESENTATION (realisedPositionCounts -> percentage share per position)
 * - opportunitySparkline  -> DERIVED_PRESENTATION (perRound hadOpportunity booleans -> 0/100 series for Sparkline)
 *
 * No overall player score/ranking hero (`07§B`). No player photo — identity uses shirt
 * number/initials only (see `docs/domain/touchline-atlas-provenance.md §0.6`).
 */

export interface PlayerDetailIdentityInput {
  playerId: string;
  firstName: string;
  lastName: string | null;
  shirtNumber: number | null;
  primaryPosition: string | null;
  coreTeamName: string | null;
  groupLabel: string | null;
}

export interface PlayerRecentOpportunityInput {
  perRound: { roundLabel: string; hadOpportunity: boolean }[];
  recentCount: number;
  recentTotal: number;
  previousCount: number | null;
  previousTotal: number | null;
}

export interface PlayerOutfieldRoleInput {
  role: string;
  tier: "NATURAL" | "STRONG" | "PLAUSIBLE" | "DEVELOPMENTAL" | "UNSUPPORTED";
}

export interface PlayerDevelopmentFocusInput {
  id: string;
  focus: string;
  category: string | null;
  href: string;
}

export interface PlayerObservationInput {
  id: string;
  note: string;
  createdAt: string;
  matchLabel?: string;
}

export interface PlayerRecentMatchInput {
  matchId: string;
  opponent: string;
  matchDate: string;
  role: string;
  href: string;
}

export interface PlayerDetailViewModelInput {
  identity: PlayerDetailIdentityInput;
  allTimeStats: { actualAppearances: number; goals: number; assists: number };
  recentOpportunity: PlayerRecentOpportunityInput | null;
  realisedPositionCounts: Record<string, number>;
  outfieldRoles: PlayerOutfieldRoleInput[];
  activeDevelopmentFocus: PlayerDevelopmentFocusInput | null;
  latestObservations: PlayerObservationInput[];
  recentMatches: PlayerRecentMatchInput[];
}

export interface PlayerPositionShare {
  code: string;
  count: number;
  sharePercent: number;
}

export interface PlayerDetailViewModel {
  identity: PlayerDetailIdentityInput;
  participation: { matches: number; goals: number; assists: number };
  opportunity: {
    ratioLabel: string; // e.g. "1 / 1"
    sparkline: number[]; // 0-100 per round, oldest first
    periodLabels: string[];
    trendLabel: string; // deterministic factual sentence, never causal
  } | null;
  positionExposure: PlayerPositionShare[];
  outfieldRoles: PlayerOutfieldRoleInput[];
  activeDevelopmentFocus: PlayerDevelopmentFocusInput | null;
  latestObservations: PlayerObservationInput[];
  recentMatches: PlayerRecentMatchInput[];
}

export function buildPlayerDetailViewModel(input: PlayerDetailViewModelInput): PlayerDetailViewModel {
  const positionExposure = computePositionShare(input.realisedPositionCounts);

  const opportunity = input.recentOpportunity
    ? {
        ratioLabel: `${input.recentOpportunity.recentCount} / ${input.recentOpportunity.recentTotal}`,
        sparkline: input.recentOpportunity.perRound.map((r) => (r.hadOpportunity ? 100 : 0)),
        periodLabels: input.recentOpportunity.perRound.map((r) => r.roundLabel),
        trendLabel: describeOpportunityTrend(input.recentOpportunity),
      }
    : null;

  return {
    identity: input.identity,
    participation: {
      matches: input.allTimeStats.actualAppearances,
      goals: input.allTimeStats.goals,
      assists: input.allTimeStats.assists,
    },
    opportunity,
    positionExposure,
    outfieldRoles: input.outfieldRoles,
    activeDevelopmentFocus: input.activeDevelopmentFocus,
    latestObservations: input.latestObservations,
    recentMatches: input.recentMatches,
  };
}

export function computePositionShare(counts: Record<string, number>): PlayerPositionShare[] {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  if (total === 0) return [];
  return Object.entries(counts)
    .map(([code, count]) => ({ code, count, sharePercent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Factual, non-causal, correlational-only description (per `03_DATA_PROVENANCE_AND_VIEW_MODELS.md
 * §2`/§3 — never a causal claim, never "improving because"). Compares the last 5 eligible rounds
 * against the previous 5 when at least 3 previous rounds exist; otherwise states involvement
 * plainly with no comparison.
 */
export function describeOpportunityTrend(o: PlayerRecentOpportunityInput): string {
  if (o.previousCount == null || o.previousTotal == null) {
    return `${o.recentCount} of the last ${o.recentTotal} eligible rounds included a planned opportunity.`;
  }
  if (o.recentCount === o.previousCount) {
    return `Consistent involvement: ${o.recentCount} of the last ${o.recentTotal} eligible rounds, same as the previous period.`;
  }
  const direction = o.recentCount > o.previousCount ? "more" : "fewer";
  return `${o.recentCount} of the last ${o.recentTotal} eligible rounds included a planned opportunity — ${direction} than the previous period (${o.previousCount} of ${o.previousTotal}).`;
}
