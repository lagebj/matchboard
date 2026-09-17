import type { PlayersOverviewRow, PlayersOverviewInspectorData } from "@/lib/touchline/presentation/players-overview-view-model";
import type { PlayersCurrentRoundRow } from "@/lib/touchline/presentation/players-current-round-view-model";
import type { PlayersDevelopmentRow } from "@/lib/touchline/presentation/players-development-view-model";
import type { PlayerRosterFilter } from "@/lib/players/roster-state";

/**
 * Static fixtures for the Players Overview UI Lab (Matchboard Players Operating Surface bundle,
 * `07_UI_LAB_AND_VISUAL_MERGE_GATE.md`; visual-convergence follow-up §4). Column values are
 * illustrative fixture data, shaped to match the real, already-existing
 * `getPlayersSeasonOverview()` result (`src/lib/players/get-players-overview.ts`) — not invented
 * fields. The primary (`players-overview-selected`) roster carries 14 rows across three core
 * teams and a spread of positions/availability, per the visual-convergence follow-up's density
 * requirement — a 7-row single-team roster read as materially thinner than production ever is.
 */
const RED_KIT = "#d5342c";
const BLUE_KIT = "#2c6bd5";
const GREEN_KIT = "#2c9c5b";

export const overviewRows: PlayersOverviewRow[] = [
  // U14 Lions
  { playerId: "1", displayName: "William", shirtNumber: 1, kitColor: null, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "GK", currentPrimaryPosition: "GK", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 12, goals: 0, assists: 0, core: 10, support: 2, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  { playerId: "2", displayName: "Lucas", shirtNumber: 2, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "RB", currentPrimaryPosition: "RB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 16, goals: 0, assists: 2, core: 11, support: 5, development: 0, matchdayAdditions: 1, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  { playerId: "3", displayName: "Leon", shirtNumber: 3, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "LB", currentPrimaryPosition: "LB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 13, goals: 0, assists: 0, core: 10, support: 3, development: 0, matchdayAdditions: 0, plannedButAbsent: 1, attention: false, rosterState: "ACTIVE" },
  { playerId: "4", displayName: "Noah", shirtNumber: 4, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "CB", currentPrimaryPosition: "CB", availabilityLabel: "Doubtful", hasOpportunityThisWeek: false, played: 14, goals: 2, assists: 1, core: 11, support: 3, development: 0, matchdayAdditions: 1, plannedButAbsent: 0, attention: true, rosterState: "ACTIVE" },
  { playerId: "5", displayName: "Emil", shirtNumber: 5, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "CB", currentPrimaryPosition: "CB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 13, goals: 0, assists: 2, core: 9, support: 4, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  { playerId: "6", displayName: "Matteo", shirtNumber: 6, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "RW", currentPrimaryPosition: "RW", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 14, goals: 1, assists: 2, core: 14, support: 0, development: 3, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  { playerId: "7", displayName: "Elias", shirtNumber: 8, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "CM", currentPrimaryPosition: "CM", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 13, goals: 4, assists: 2, core: 13, support: 1, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  // U13 Hawks
  { playerId: "8", displayName: "Oskar", shirtNumber: 9, kitColor: BLUE_KIT, coreTeamName: "U13 Hawks", currentPrimaryPositionCode: "CM", currentPrimaryPosition: "CM", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 9, goals: 1, assists: 0, core: 7, support: 2, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  { playerId: "9", displayName: "Henrik", shirtNumber: 10, kitColor: BLUE_KIT, coreTeamName: "U13 Hawks", currentPrimaryPositionCode: "CB", currentPrimaryPosition: "CB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 8, goals: 0, assists: 0, core: 8, support: 0, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  { playerId: "10", displayName: "Aksel", shirtNumber: 11, kitColor: BLUE_KIT, coreTeamName: "U13 Hawks", currentPrimaryPositionCode: "LB", currentPrimaryPosition: "LB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 9, goals: 0, assists: 1, core: 8, support: 1, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  { playerId: "11", displayName: "Isak", shirtNumber: 12, kitColor: BLUE_KIT, coreTeamName: "U13 Hawks", currentPrimaryPositionCode: "ST", currentPrimaryPosition: "ST", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 9, goals: 5, assists: 1, core: 9, support: 0, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  // U15 Falcons
  { playerId: "12", displayName: "Filip", shirtNumber: 1, kitColor: GREEN_KIT, coreTeamName: "U15 Falcons", currentPrimaryPositionCode: "GK", currentPrimaryPosition: "GK", availabilityLabel: "Injured", hasOpportunityThisWeek: false, played: 6, goals: 0, assists: 0, core: 5, support: 1, development: 0, matchdayAdditions: 0, plannedButAbsent: 1, attention: true, rosterState: "ACTIVE" },
  { playerId: "13", displayName: "Kasper", shirtNumber: 4, kitColor: GREEN_KIT, coreTeamName: "U15 Falcons", currentPrimaryPositionCode: "CB", currentPrimaryPosition: "CB", availabilityLabel: "Available", hasOpportunityThisWeek: true, played: 10, goals: 0, assists: 0, core: 9, support: 1, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "ACTIVE" },
  { playerId: "14", displayName: "Theo", shirtNumber: 7, kitColor: GREEN_KIT, coreTeamName: "U15 Falcons", currentPrimaryPositionCode: "RW", currentPrimaryPosition: "RW", availabilityLabel: "Doubtful", hasOpportunityThisWeek: false, played: 8, goals: 2, assists: 0, core: 6, support: 2, development: 1, matchdayAdditions: 0, plannedButAbsent: 0, attention: true, rosterState: "ACTIVE" },
];

/**
 * Inactive/Removed roster-state rows (roster-state-and-mobile-convergence pass §31) — a
 * dedicated set rather than the active roster with a flag flipped, because in production these
 * roster states load an entirely different player population (`roster=inactive`/`roster=removed`
 * scopes the server query itself, §4). Real, non-zero historical stats on both — an inactive or
 * removed player's genuine season history is retained, never zeroed (§5). Neither ever carries an
 * opportunity signal (§7).
 */
export const inactiveRows: PlayersOverviewRow[] = [
  { playerId: "15", displayName: "Magnus", shirtNumber: 14, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "CM", currentPrimaryPosition: "CM", availabilityLabel: "Available", hasOpportunityThisWeek: null, played: 6, goals: 1, assists: 0, core: 5, support: 1, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "INACTIVE" },
  { playerId: "16", displayName: "Jonas", shirtNumber: 15, kitColor: BLUE_KIT, coreTeamName: "U13 Hawks", currentPrimaryPositionCode: "LB", currentPrimaryPosition: "LB", availabilityLabel: "Available", hasOpportunityThisWeek: null, played: 3, goals: 0, assists: 0, core: 3, support: 0, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "INACTIVE" },
];

export const removedRows: PlayersOverviewRow[] = [
  { playerId: "17", displayName: "Sindre", shirtNumber: 16, kitColor: GREEN_KIT, coreTeamName: "U15 Falcons", currentPrimaryPositionCode: "ST", currentPrimaryPosition: "ST", availabilityLabel: "Available", hasOpportunityThisWeek: null, played: 9, goals: 4, assists: 2, core: 8, support: 1, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "REMOVED" },
  { playerId: "18", displayName: "Vetle", shirtNumber: 17, kitColor: RED_KIT, coreTeamName: "U14 Lions", currentPrimaryPositionCode: "CB", currentPrimaryPosition: "CB", availabilityLabel: "Available", hasOpportunityThisWeek: null, played: 2, goals: 0, assists: 0, core: 2, support: 0, development: 0, matchdayAdditions: 0, plannedButAbsent: 0, attention: false, rosterState: "REMOVED" },
];

export const inspectorByPlayerId: Record<string, PlayersOverviewInspectorData> = {
  "4": {
    playerId: "4",
    displayName: "Noah",
    shirtNumber: 4,
    kitColor: RED_KIT,
    coreTeamName: "U14 Lions",
    currentPrimaryPosition: "Centre Back",
    currentPrimaryPositionFull: "Centre Back",
    availabilityLabel: "Doubtful — minor knock",
    rosterState: "ACTIVE",
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
  "15": {
    playerId: "15",
    displayName: "Magnus",
    shirtNumber: 14,
    kitColor: RED_KIT,
    coreTeamName: "U14 Lions",
    currentPrimaryPosition: "CM",
    currentPrimaryPositionFull: "Centre Midfield",
    availabilityLabel: "Available",
    rosterState: "INACTIVE",
    // No current-round opportunity row for a non-active roster player (§7) — the inspector omits
    // it entirely rather than render a manufactured state.
    opportunityLabel: null,
    effectivePositions: [{ positionCode: "CM", positionLabel: "Centre Midfield", rank: 1, supportBand: "STRONG", confidence: "MEDIUM" }],
    played: 6,
    goals: 1,
    assists: 0,
    core: 5,
    support: 1,
    development: 0,
    activeDevelopmentFocus: null,
    playerDetailHref: "#",
  },
  "17": {
    playerId: "17",
    displayName: "Sindre",
    shirtNumber: 16,
    kitColor: GREEN_KIT,
    coreTeamName: "U15 Falcons",
    currentPrimaryPosition: "ST",
    currentPrimaryPositionFull: "Striker",
    availabilityLabel: "Available",
    rosterState: "REMOVED",
    opportunityLabel: null,
    effectivePositions: [{ positionCode: "ST", positionLabel: "Striker", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" }],
    played: 9,
    goals: 4,
    assists: 2,
    core: 8,
    support: 1,
    development: 0,
    activeDevelopmentFocus: null,
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
 * The required deterministic Overview states (`07_UI_LAB_AND_VISUAL_MERGE_GATE.md §1`, extended
 * by the roster-state-and-mobile-convergence pass §31 with dedicated `-inactive`/`-removed`
 * states). Each entry supplies exactly what the shared `PlayersOverviewSurface` needs — rows,
 * inspector data, summary counts, the roster filter, and any pre-applied filters — so the fixture
 * page can render the real shared component unmodified for every state.
 */
export type OverviewStateKey =
  | "players-overview-selected"
  | "players-overview-opportunity-gap"
  | "players-overview-position-legacy"
  | "players-overview-filtered"
  | "players-overview-empty-filter"
  | "players-overview-no-position-history"
  | "players-overview-mobile"
  | "players-overview-inactive"
  | "players-overview-removed";

export type OverviewStateFixture = {
  rows: PlayersOverviewRow[];
  inspectorByPlayerId: Record<string, PlayersOverviewInspectorData>;
  activePlayerCount: number;
  /** The roster filter this state represents — Overview's own summary counts always stay pinned
      to the active roster (§15) regardless of this value. */
  rosterFilter: PlayerRosterFilter;
  opportunityGapsCount: number;
  supportUsageCount: number;
  developmentFocusesCount: number;
  initialSelectedPlayerId: string | null;
  initialSearch: string;
  initialTeamFilter: string;
  initialPositionFilter: string;
  initialAvailabilityFilter: string;
};

// Active-roster-only summary figures, reused verbatim by every state (§15) — computed once here
// rather than re-derived per state entry below.
const ACTIVE_SUPPORT_USAGE_COUNT = overviewRows.filter((r) => r.support > 0).length;
const ACTIVE_DEVELOPMENT_FOCUSES_COUNT = developmentRows.filter((r) => r.activeDevelopmentFocus != null).length;

const BASE_INSPECTOR = inspectorByPlayerId["4"];

export const overviewStates: Record<OverviewStateKey, OverviewStateFixture> = {
  "players-overview-selected": {
    rows: overviewRows,
    inspectorByPlayerId,
    activePlayerCount: 14,
    rosterFilter: "active",
    opportunityGapsCount: 3,
    supportUsageCount: ACTIVE_SUPPORT_USAGE_COUNT,
    developmentFocusesCount: ACTIVE_DEVELOPMENT_FOCUSES_COUNT,
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
    activePlayerCount: 14,
    rosterFilter: "active",
    // Decision-required rows (§3 of 02_ROUTE_COMPOSITION): Noah, Leon, Emil, Filip and Theo all
    // lack a planned match in the current operational round.
    opportunityGapsCount: 5,
    supportUsageCount: ACTIVE_SUPPORT_USAGE_COUNT,
    developmentFocusesCount: ACTIVE_DEVELOPMENT_FOCUSES_COUNT,
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
        currentPrimaryPositionFull: "Defensive Midfield",
        // A legacy `DEFENSIVE_MIDFIELDER` observation normalizes to the same `DM` code as the
        // declared position — one dot, never a duplicate legacy entry alongside it.
        effectivePositions: [
          { positionCode: "DM", positionLabel: "Defensive Midfield", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
        ],
      },
    },
    activePlayerCount: 14,
    rosterFilter: "active",
    opportunityGapsCount: 0,
    supportUsageCount: ACTIVE_SUPPORT_USAGE_COUNT,
    developmentFocusesCount: ACTIVE_DEVELOPMENT_FOCUSES_COUNT,
    initialSelectedPlayerId: "4",
    initialSearch: "",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-filtered": {
    rows: overviewRows,
    inspectorByPlayerId,
    activePlayerCount: 14,
    rosterFilter: "active",
    opportunityGapsCount: 3,
    supportUsageCount: ACTIVE_SUPPORT_USAGE_COUNT,
    developmentFocusesCount: ACTIVE_DEVELOPMENT_FOCUSES_COUNT,
    initialSelectedPlayerId: "4",
    initialSearch: "",
    // Pre-applied core-team filter narrows fourteen rows down to the seven U14 Lions rows —
    // demonstrates the filter row without an empty result.
    initialTeamFilter: "U14 Lions",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-empty-filter": {
    rows: overviewRows,
    inspectorByPlayerId,
    activePlayerCount: 14,
    rosterFilter: "active",
    opportunityGapsCount: 3,
    supportUsageCount: ACTIVE_SUPPORT_USAGE_COUNT,
    developmentFocusesCount: ACTIVE_DEVELOPMENT_FOCUSES_COUNT,
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
        currentPrimaryPositionFull: null,
        effectivePositions: [],
      },
    },
    activePlayerCount: 14,
    rosterFilter: "active",
    opportunityGapsCount: 0,
    supportUsageCount: ACTIVE_SUPPORT_USAGE_COUNT,
    developmentFocusesCount: ACTIVE_DEVELOPMENT_FOCUSES_COUNT,
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
    activePlayerCount: 14,
    rosterFilter: "active",
    opportunityGapsCount: 3,
    supportUsageCount: ACTIVE_SUPPORT_USAGE_COUNT,
    developmentFocusesCount: ACTIVE_DEVELOPMENT_FOCUSES_COUNT,
    initialSelectedPlayerId: "4",
    initialSearch: "",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-inactive": {
    // A distinct population, not the active roster with a flag flipped — matches how
    // `roster=inactive` actually scopes the server query in production (§4). Summary counts stay
    // pinned to the active roster (§15); the two inactive rows carry real, non-zero historical
    // stats (§5) and no opportunity signal (§7).
    rows: inactiveRows,
    inspectorByPlayerId,
    activePlayerCount: 14,
    rosterFilter: "inactive",
    opportunityGapsCount: 3,
    supportUsageCount: ACTIVE_SUPPORT_USAGE_COUNT,
    developmentFocusesCount: ACTIVE_DEVELOPMENT_FOCUSES_COUNT,
    initialSelectedPlayerId: "15",
    initialSearch: "",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
  "players-overview-removed": {
    rows: removedRows,
    inspectorByPlayerId,
    activePlayerCount: 14,
    rosterFilter: "removed",
    opportunityGapsCount: 3,
    supportUsageCount: ACTIVE_SUPPORT_USAGE_COUNT,
    developmentFocusesCount: ACTIVE_DEVELOPMENT_FOCUSES_COUNT,
    initialSelectedPlayerId: "17",
    initialSearch: "",
    initialTeamFilter: "",
    initialPositionFilter: "",
    initialAvailabilityFilter: "",
  },
};
