import type { PlayersOverviewRow, PlayersOverviewInspectorData } from "@/lib/touchline/presentation/players-overview-view-model";
import type { PlayersCurrentRoundRow } from "@/lib/touchline/presentation/players-current-round-view-model";
import type { PlayersDevelopmentRow } from "@/lib/touchline/presentation/players-development-view-model";

/**
 * Static fixtures for the Players Overview UI Lab (Phase F5, Hard Human Gate C). Reuses the same
 * roster scenario the golden reference (`04-atlas-planning-and-players.png`, "PLAYERS OVERVIEW
 * (DESKTOP)" panel) already established, for a like-for-like comparison. Column values are
 * illustrative fixture data, shaped to match the real, already-existing
 * `getPlayersSeasonOverview()` result (`src/lib/players/get-players-overview.ts`) — not invented
 * fields.
 */
const RED_KIT = "#d5342c";

export const overviewRows: PlayersOverviewRow[] = [
  { playerId: "1", displayName: "William", shirtNumber: 1, kitColor: null, coreTeamName: "U14 Lions", currentPrimaryPosition: "GK", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 12, goals: 0, assists: 0, core: 10, support: 2, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
  { playerId: "2", displayName: "Lucas", shirtNumber: 2, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPosition: "RB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 16, goals: 0, assists: 2, core: 11, support: 5, development: 0, matchdayAdditions: 1, plannedButAbsent: 0, attention: false },
  { playerId: "3", displayName: "Leon", shirtNumber: 3, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPosition: "LB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 13, goals: 0, assists: 0, core: 10, support: 3, development: 0, matchdayAdditions: 0, plannedButAbsent: 1, attention: false },
  { playerId: "4", displayName: "Noah", shirtNumber: 4, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPosition: "CB", availabilityLabel: "Doubtful", hasOpportunityThisWeek: false, played: 14, goals: 2, assists: 1, core: 11, support: 3, development: 0, matchdayAdditions: 1, plannedButAbsent: 0, attention: true },
  { playerId: "5", displayName: "Emil", shirtNumber: 5, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPosition: "CB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 13, goals: 0, assists: 2, core: 9, support: 4, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
  { playerId: "6", displayName: "Matteo", shirtNumber: 6, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPosition: "RW", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 14, goals: 1, assists: 2, core: 14, support: 0, development: 3, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
  { playerId: "7", displayName: "Elias", shirtNumber: 8, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPosition: "CM", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 13, goals: 4, assists: 2, core: 13, support: 1, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
];

export const inspectorByPlayerId: Record<string, PlayersOverviewInspectorData> = {
  "4": {
    playerId: "4",
    displayName: "Noah",
    shirtNumber: 4,
    kitColor: RED_KIT,
    currentPrimaryPosition: "Centre Back",
    availabilityLabel: "Doubtful — minor knock",
    opportunityLabel: "No opportunity yet this round",
    effectivePositions: [
      { positionCode: "CB", positionLabel: "Centre Back", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
      { positionCode: "RB", positionLabel: "Right Back", rank: 2, supportBand: "LIMITED", confidence: "LOW" },
    ],
    activeDevelopmentFocus: "Clinical finishing",
    latestObservationNote: "Strong in duels and good build-up play.",
    playerDetailHref: "#",
  },
};

export const currentRoundRows: PlayersCurrentRoundRow[] = [
  { playerId: "1", displayName: "William", shirtNumber: 1, kitColor: null, coreTeamName: "U14 Lions", availabilityLabel: "Available", currentAssignment: { teamName: "U14 Lions", opponent: "Riverside FC", role: "CORE" }, attentionState: "COVERED" },
  { playerId: "4", displayName: "Noah", shirtNumber: 4, kitColor: RED_KIT, coreTeamName: "U14 Lions", availabilityLabel: "Doubtful", currentAssignment: null, attentionState: "DECISION_REQUIRED_NO_PLANNED_MATCH" },
  { playerId: "8", displayName: "Fredrik", shirtNumber: 7, kitColor: RED_KIT, coreTeamName: "U14 Lions", availabilityLabel: "Unavailable", currentAssignment: { teamName: "U14 Lions", opponent: "Riverside FC", role: "CORE" }, attentionState: "BLOCKED_UNAVAILABLE_SELECTION" },
  { playerId: "6", displayName: "Matteo", shirtNumber: 6, kitColor: RED_KIT, coreTeamName: "U14 Lions", availabilityLabel: "Available", currentAssignment: { teamName: "U14 Lions", opponent: "Riverside FC", role: "DEVELOPMENT" }, attentionState: "COVERED" },
];

export const developmentRows: PlayersDevelopmentRow[] = [
  { playerId: "4", displayName: "Noah", shirtNumber: 4, kitColor: RED_KIT, activeDevelopmentFocus: "Clinical finishing", focusStartedAt: "18 Aug", latestObservationSummary: "Strong in duels and good build-up play.", effectivePositionSummary: "CB (strongest)", decisionReviewState: "PENDING" },
  { playerId: "7", displayName: "Elias", shirtNumber: 8, kitColor: RED_KIT, activeDevelopmentFocus: "Excellent game control", focusStartedAt: "3 Sep", latestObservationSummary: null, effectivePositionSummary: "CM (strong)", decisionReviewState: "PENDING" },
  { playerId: "2", displayName: "Lucas", shirtNumber: 2, kitColor: RED_KIT, activeDevelopmentFocus: null, focusStartedAt: null, latestObservationSummary: null, effectivePositionSummary: "RB (established)", decisionReviewState: null },
];
