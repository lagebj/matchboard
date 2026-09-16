import type { PlayersOverviewRow, PlayersOverviewInspectorData } from "@/lib/touchline/presentation/players-overview-view-model";
import type { PlayersCurrentRoundRow } from "@/lib/touchline/presentation/players-current-round-view-model";
import type { PlayersDevelopmentRow } from "@/lib/touchline/presentation/players-development-view-model";

/**
 * Static fixtures for the Players Overview UI Lab (Matchboard Players Operating Surface bundle,
 * `07_UI_LAB_AND_VISUAL_MERGE_GATE.md`). Reuses the same roster scenario the golden reference
 * (`04-atlas-planning-and-players.png`, "PLAYERS OVERVIEW (DESKTOP)" panel) already established,
 * for a like-for-like comparison. Column values are illustrative fixture data, shaped to match the
 * real, already-existing `getPlayersSeasonOverview()` result
 * (`src/lib/players/get-players-overview.ts`) — not invented fields.
 */
const RED_KIT = "#d5342c";
const BLUE_KIT = "#2c6bd5";

export const overviewRows: PlayersOverviewRow[] = [
  { playerId: "1", displayName: "William", shirtNumber: 1, kitColor: null, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "GK", currentPrimaryPosition: "GK", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 12, goals: 0, assists: 0, core: 10, support: 2, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
  { playerId: "2", displayName: "Lucas", shirtNumber: 2, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "RB", currentPrimaryPosition: "RB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 16, goals: 0, assists: 2, core: 11, support: 5, development: 0, matchdayAdditions: 1, plannedButAbsent: 0, attention: false },
  { playerId: "3", displayName: "Leon", shirtNumber: 3, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "LB", currentPrimaryPosition: "LB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 13, goals: 0, assists: 0, core: 10, support: 3, development: 0, matchdayAdditions: 0, plannedButAbsent: 1, attention: false },
  { playerId: "4", displayName: "Noah", shirtNumber: 4, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "CB", currentPrimaryPosition: "CB", availabilityLabel: "Doubtful", hasOpportunityThisWeek: false, played: 14, goals: 2, assists: 1, core: 11, support: 3, development: 0, matchdayAdditions: 1, plannedButAbsent: 0, attention: true },
  { playerId: "5", displayName: "Emil", shirtNumber: 5, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "CB", currentPrimaryPosition: "CB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 13, goals: 0, assists: 2, core: 9, support: 4, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
  { playerId: "6", displayName: "Matteo", shirtNumber: 6, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "RW", currentPrimaryPosition: "RW", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 14, goals: 1, assists: 2, core: 14, support: 0, development: 3, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
  { playerId: "7", displayName: "Elias", shirtNumber: 8, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "CM", currentPrimaryPosition: "CM", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 13, goals: 4, assists: 2, core: 13, support: 1, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
];

export const inspectorByPlayerId: Record<string, PlayersOverviewInspectorData> = {
  "4": {
    playerId: "4",
    displayName: "Noah",
    shirtNumber: 4,
    kitColor: RED_KIT,
    coreTeamName: "U14 Lions",
    currentPrimaryPosition: "Centre Back",
    availabilityLabel: "Doubtful — minor knock",
    opportunityLabel: "No opportunity yet this round",
    effectivePositions: [
      { positionCode: "CB", positionLabel: "Centre Back", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
      { positionCode: "RB", positionLabel: "Right Back", rank: 2, supportBand: "LIMITED", confidence: "LOW" },
    ],
    played: 14,
    goals: 2,
    assists: 1,
    core: 11,
    support: 3,
    development: 0,
    activeDevelopmentFocus: "Clinical finishing",
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
  { playerId: "7", displayName: "Elias", shirtNumber: 8, kitColor: RED_KIT, activeDevelopmentFocus: "Excellent game control", focusStartedAt: "3 Sep", latestObservationSummary: null, effectivePositionSummary: "CM (strong)", decisionReviewState: null },
  { playerId: "2", displayName: "Lucas", shirtNumber: 2, kitColor: RED_KIT, activeDevelopmentFocus: null, focusStartedAt: null, latestObservationSummary: null, effectivePositionSummary: "RB (established)", decisionReviewState: null },
];

/**
 * The seven required deterministic Overview states (`07_UI_LAB_AND_VISUAL_MERGE_GATE.md §1`).
 * Each entry supplies exactly what the real production `PlayersPageClient` composition needs —
 * rows, inspector data, metric counts, removed-player count, and any pre-applied filters — so
 * the fixture page can render the real production components unmodified for every state.
 */
export type OverviewStateKey =
  | "players-overview-selected"
  | "players-overview-opportunity-gap"
  | "players-overview-position-legacy"
  | "players-overview-filtered"
  | "players-overview-empty-filter"
  | "players-overview-no-position-history"
  | "players-overview-mobile";

export type OverviewStateFixture = {
  rows: PlayersOverviewRow[];
  inspectorByPlayerId: Record<string, PlayersOverviewInspectorData>;
  activePlayerCount: number;
  removedPlayerCount: number;
  opportunityGapsCount: number;
  initialSelectedPlayerId: string | null;
  initialSearch: string;
  initialTeamFilter: string;
  initialPositionFilter: string;
  initialAvailabilityFilter: string;
};

const BASE_INSPECTOR = inspectorByPlayerId["4"];

const SECOND_TEAM_ROWS: PlayersOverviewRow[] = [
  { playerId: "8", displayName: "Oskar", shirtNumber: 9, kitColor: BLUE_KIT, coreTeamName: "U13 Hawks", currentPrimaryPositionCode: "CM", currentPrimaryPosition: "CM", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 9, goals: 1, assists: 0, core: 7, support: 2, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
  { playerId: "9", displayName: "Henrik", shirtNumber: 10, kitColor: BLUE_KIT, coreTeamName: "U13 Hawks", currentPrimaryPositionCode: "CB", currentPrimaryPosition: "CB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 8, goals: 0, assists: 0, core: 8, support: 0, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false },
];

export const overviewStates: Record<OverviewStateKey, OverviewStateFixture> = {
  "players-overview-selected": {
    rows: overviewRows,
    inspectorByPlayerId,
    activePlayerCount: 7,
    removedPlayerCount: 2,
    opportunityGapsCount: 1,
    initialSelectedPlayerId: "4",
    initialSearch: "",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-opportunity-gap": {
    rows: overviewRows.map((row) =>
      row.playerId === "3" || row.playerId === "5"
        ? { ...row, hasOpportunityThisWeek: false as const, attention: true }
        : row,
    ),
    inspectorByPlayerId: {
      "4": { ...BASE_INSPECTOR, opportunityLabel: "No planned match in W34 2026" },
    },
    activePlayerCount: 7,
    removedPlayerCount: 0,
    // Decision-required rows (§3 of 02_ROUTE_COMPOSITION): Noah, Leon and Emil all lack a
    // planned match in the current operational round.
    opportunityGapsCount: 3,
    initialSelectedPlayerId: "4",
    initialSearch: "",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-position-legacy": {
    rows: [
      { ...overviewRows[3], currentPrimaryPositionCode: "DM", currentPrimaryPosition: "DM" },
      { ...overviewRows[4], currentPrimaryPositionCode: "DEFENDER", currentPrimaryPosition: "Defender" },
      ...overviewRows.slice(0, 3),
      ...overviewRows.slice(5),
    ],
    inspectorByPlayerId: {
      "4": {
        ...BASE_INSPECTOR,
        currentPrimaryPosition: "DM",
        // A legacy `DEFENSIVE_MIDFIELDER` observation normalizes to the same `DM` code as the
        // declared position — one dot, never a duplicate legacy entry alongside it.
        effectivePositions: [
          { positionCode: "DM", positionLabel: "Defensive Midfield", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
        ],
      },
    },
    activePlayerCount: 7,
    removedPlayerCount: 0,
    opportunityGapsCount: 0,
    initialSelectedPlayerId: "4",
    initialSearch: "",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-filtered": {
    rows: [...overviewRows, ...SECOND_TEAM_ROWS],
    inspectorByPlayerId,
    activePlayerCount: 9,
    removedPlayerCount: 0,
    opportunityGapsCount: 1,
    initialSelectedPlayerId: "4",
    initialSearch: "",
    // Pre-applied core-team filter narrows nine rows down to the seven U14 Lions rows —
    // demonstrates the filter row without an empty result.
    initialTeamFilter: "U14 Lions",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-empty-filter": {
    rows: overviewRows,
    inspectorByPlayerId,
    activePlayerCount: 7,
    removedPlayerCount: 0,
    opportunityGapsCount: 1,
    initialSelectedPlayerId: null,
    // A search query that matches no player's display name — real "no rows match" state, not a
    // fabricated empty-roster state.
    initialSearch: "zzz",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-no-position-history": {
    rows: [
      // Case A: declared position, no actual match/observation history yet. The declared
      // position still contributes a real (low-confidence) profile entry — the dot must appear.
      { ...overviewRows[3], displayName: "Noah (declared only)" },
      // Case B: no declared position and no evidence at all — honest empty position map.
      { ...overviewRows[4], displayName: "Emil (no position)", currentPrimaryPositionCode: null, currentPrimaryPosition: null },
      ...overviewRows.slice(0, 3),
      ...overviewRows.slice(5),
    ],
    inspectorByPlayerId: {
      "4": {
        ...BASE_INSPECTOR,
        displayName: "Noah (declared only)",
        effectivePositions: [
          { positionCode: "CB", positionLabel: "Centre Back", rank: 1, supportBand: "LIMITED", confidence: "LOW" },
        ],
      },
      "5": {
        ...BASE_INSPECTOR,
        playerId: "5",
        displayName: "Emil (no position)",
        currentPrimaryPosition: null,
        effectivePositions: [],
      },
    },
    activePlayerCount: 7,
    removedPlayerCount: 0,
    opportunityGapsCount: 0,
    initialSelectedPlayerId: "4",
    initialSearch: "",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-mobile": {
    // Same dataset as the primary state — the mobile state is captured by viewport (390px), not
    // by different fixture data (§10 of 05_INTERACTION_FILTER_AND_RESPONSIVE_CONTRACT.md).
    rows: overviewRows,
    inspectorByPlayerId,
    activePlayerCount: 7,
    removedPlayerCount: 2,
    opportunityGapsCount: 1,
    initialSelectedPlayerId: "4",
    initialSearch: "",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
};
