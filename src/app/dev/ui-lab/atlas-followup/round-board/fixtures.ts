import type {
  RoundBoardViewModel,
  RoundBoardPlayerAssignmentContext,
  RoundBoardAttentionItem,
  RoundBoardDevelopmentContext,
} from "@/lib/touchline/presentation/round-board-view-model";
import type { AllocationMatrixColumn, AllocationMatrixRow } from "@/components/touchline/round-board/allocation-matrix";

/**
 * Static fixtures for the Round Board UI Lab (Phase F6, Hard Human Gate D). Reuses the golden
 * reference's own "Rød / Hvit / Blå" round scenario and player names for a like-for-like
 * comparison.
 */
const RED = "#d5342c";
const WHITE = "#f2f2f2";
const BLUE = "#1d4fa8";

export const roundBoardViewModel: RoundBoardViewModel = {
  status: "NEEDS_DECISIONS",
  roundLabel: "Week 42",
  dateRangeLabel: "Mon 13 Oct – Sun 19 Oct",
  summary: { decisions: 2, matches: 3, plannedOpportunities: 33, targetOpportunities: 36, coverageIssues: 0 },
  matches: [
    {
      matchId: "rod", teamName: "Rød", teamKitColor: RED, opponent: "Asker SK", kickoffLabel: "Sat, 14 Oct · 13:00",
      squadCount: 11, targetCount: 12, laneState: "NEEDS", laneStateDetail: "Needs 1",
      players: [
        { playerId: "p1", displayName: "William", shirtNumber: 1, kitColor: RED, position: "GK", role: "CORE", attention: false },
        { playerId: "p4", displayName: "Lucas", shirtNumber: 4, kitColor: RED, position: "RB", role: "CORE", attention: false },
        { playerId: "p5", displayName: "Noah", shirtNumber: 5, kitColor: RED, position: "CB", role: "CORE", attention: false },
        { playerId: "p8", displayName: "Emil", shirtNumber: 8, kitColor: RED, position: "CM", role: "CORE", attention: false },
        { playerId: "p10", displayName: "Oscar", shirtNumber: 10, kitColor: RED, position: "CM", role: "CORE", attention: false },
        { playerId: "p11", displayName: "Elias", shirtNumber: 11, kitColor: RED, position: "LW", role: "CORE", attention: false },
        { playerId: "p12", displayName: "Fredrik", shirtNumber: 12, kitColor: RED, position: "RW", role: "CORE", attention: false },
        { playerId: "p14", displayName: "Alex", shirtNumber: 14, kitColor: RED, position: "ST", role: "CORE", attention: false },
        { playerId: "p15", displayName: "Isak", shirtNumber: 15, kitColor: RED, position: "CB", role: "SUPPORT", attention: false },
        { playerId: "p16", displayName: "Theo", shirtNumber: 16, kitColor: RED, position: "CM", role: "SUPPORT", attention: false },
        { playerId: "p17", displayName: "Arvid", shirtNumber: 17, kitColor: RED, position: "RW", role: "SUPPORT", attention: false },
      ],
    },
    {
      matchId: "hvit", teamName: "Hvit", teamKitColor: WHITE, opponent: "Holmen IF", kickoffLabel: "Sat, 14 Oct · 15:00",
      squadCount: 12, targetCount: 12, laneState: "COMPLETE", laneStateDetail: "Complete",
      players: [
        { playerId: "p20", displayName: "Oliver", shirtNumber: 1, kitColor: WHITE, position: "GK", role: "CORE", attention: false },
        { playerId: "p21", displayName: "Leon", shirtNumber: 3, kitColor: WHITE, position: "LB", role: "CORE", attention: false },
        { playerId: "p22", displayName: "Matteo", shirtNumber: 6, kitColor: WHITE, position: "CB", role: "CORE", attention: false },
        { playerId: "p23", displayName: "Noel", shirtNumber: 11, kitColor: WHITE, position: "CM", role: "CORE", attention: false },
        { playerId: "p2", displayName: "Henrik", shirtNumber: 16, kitColor: WHITE, position: "CM", role: "SUPPORT", attention: true },
      ],
    },
    {
      matchId: "bla", teamName: "Blå", teamKitColor: BLUE, opponent: "Drøbak-Frogn", kickoffLabel: "Sun, 15 Oct · 12:00",
      squadCount: 10, targetCount: 12, laneState: "NEEDS", laneStateDetail: "Needs 2",
      players: [
        { playerId: "p30", displayName: "Adam", shirtNumber: 1, kitColor: BLUE, position: "GK", role: "CORE", attention: false },
        { playerId: "p31", displayName: "Lucas", shirtNumber: 3, kitColor: BLUE, position: "RB", role: "CORE", attention: false },
        { playerId: "p32", displayName: "Noah", shirtNumber: 5, kitColor: BLUE, position: "CB", role: "CORE", attention: false },
        { playerId: "p33", displayName: "Emil", shirtNumber: 8, kitColor: BLUE, position: "CM", role: "CORE", attention: false },
        { playerId: "p34", displayName: "Arvid", shirtNumber: 10, kitColor: BLUE, position: "CM", role: "CORE", attention: false },
        { playerId: "p35", displayName: "Fredrik", shirtNumber: 12, kitColor: BLUE, position: "RW", role: "CORE", attention: false },
        { playerId: "p36", displayName: "Alex", shirtNumber: 15, kitColor: BLUE, position: "ST", role: "CORE", attention: false },
      ],
    },
  ],
  attention: [
    { id: "a1", playerId: "p2", matchId: null, summary: "Henrik", detail: "No opportunity yet this round", severity: "DECISION_REQUIRED" },
    { id: "a2", playerId: null, matchId: "bla", summary: "Blå vs Drøbak-Frogn", detail: "Needs 2 players", severity: "DECISION_REQUIRED" },
  ],
};

export const assignmentContextByPlayerId: Record<string, RoundBoardPlayerAssignmentContext> = {
  p2: {
    playerId: "p2", displayName: "Henrik", shirtNumber: 16, kitColor: WHITE, positions: ["CM", "RM"],
    attentionSummary: "This player does not have a match assigned in this round.",
    suggestions: [
      { matchId: "bla", teamName: "Blå vs Drøbak-Frogn", teamKitColor: BLUE, resultingSquadCount: 10, targetCount: 12, isRecommended: true, reasons: ["Good squad balance", "Needs CM depth", "Counts as support opportunity"] },
      { matchId: "rod", teamName: "Rød vs Asker SK", teamKitColor: RED, resultingSquadCount: 10, targetCount: 12, isRecommended: false, reasons: ["Core team"] },
      { matchId: "hvit", teamName: "Hvit vs Holmen IF", teamKitColor: WHITE, resultingSquadCount: 12, targetCount: 12, isRecommended: false, reasons: ["Would exceed target size"] },
    ],
  },
};

export const allocationColumns: AllocationMatrixColumn[] = [
  { matchId: "rod", teamName: "Rød", teamKitColor: RED },
  { matchId: "hvit", teamName: "Hvit", teamKitColor: WHITE },
  { matchId: "bla", teamName: "Blå", teamKitColor: BLUE },
];

export const allocationRows: AllocationMatrixRow[] = [
  { playerId: "p1", displayName: "William", shirtNumber: 1, kitColor: RED, assignments: { rod: true }, total: 1, target: 1, status: "OK" },
  { playerId: "p5", displayName: "Noah", shirtNumber: 5, kitColor: RED, assignments: { rod: true }, total: 1, target: 1, status: "OK" },
  { playerId: "p2", displayName: "Henrik", shirtNumber: 16, kitColor: WHITE, assignments: {}, total: 0, target: 1, status: "NEEDS_ASSIGNMENT" },
  { playerId: "p8", displayName: "Emil", shirtNumber: 8, kitColor: RED, assignments: { rod: true }, total: 1, target: 1, status: "OK" },
  { playerId: "p11", displayName: "Elias", shirtNumber: 11, kitColor: RED, assignments: { rod: true }, total: 1, target: 1, status: "OK" },
  { playerId: "p10", displayName: "Oscar", shirtNumber: 10, kitColor: RED, assignments: { rod: true }, total: 1, target: 1, status: "OK" },
  { playerId: "p12", displayName: "Fredrik", shirtNumber: 12, kitColor: RED, assignments: { rod: true }, total: 1, target: 1, status: "OK" },
];

/** ADR-0157 C4 contextual-rail fixture data (C9 golden state: Round Board, desktop). Deterministic
 * attention/fairness/movement/development context — factual counts only, no composite score, no
 * Assistant Coach synthesis (the rail renders that only when a persisted, fresh review exists). */
export const railAttention: RoundBoardAttentionItem[] = [
  { id: "att-1", playerId: null, matchId: "rod", summary: "Rød has no goalkeeper in the squad", detail: "No goalkeeper is planned for Rød vs Asker SK.", severity: "BLOCKED" },
  { id: "att-2", playerId: "p2", matchId: null, summary: "Henrik has no assignment this round", detail: "One player with a target of one match is currently unassigned.", severity: "DECISION_REQUIRED" },
];

export const railFairnessMetrics: { label: string; value: string | number; detail?: string; trend?: "up" | "down" | "neutral" }[] = [
  { label: "Players with a finalized match", value: 41, detail: "of 42 players" },
  { label: "Support opportunities", value: 7 },
  { label: "Development opportunities", value: 3 },
  { label: "Players below target", value: 1, trend: "down" },
];

export const railMovementSummary = {
  supportSent: 5,
  supportReceived: 5,
  developmentSent: 2,
  developmentReceived: 3,
  squadRepairReceived: 1,
  drops: 0,
};

export const railDevelopmentContext: RoundBoardDevelopmentContext = {
  playerId: "p2",
  displayName: "Henrik",
  activeFocusCategories: ["Passing"],
  effectivePositions: [
    { positionId: "CM", supportBand: "ESTABLISHED", confidence: "MEDIUM", appearances: 6, minutes: 240 },
    { positionId: "RM", supportBand: "LIMITED", confidence: "LOW", appearances: 1, minutes: 18 },
  ],
};
