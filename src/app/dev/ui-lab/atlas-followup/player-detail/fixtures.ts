import type { PlayerIdentityViewModelInput } from "@/lib/touchline/presentation/player-identity-view-model";
import type { PlayerOverviewViewModelInput } from "@/lib/touchline/presentation/player-overview-view-model";
import type { PlayerMatchesViewModelInput } from "@/lib/touchline/presentation/player-matches-view-model";
import type { PlayerDevelopmentViewModelInput } from "@/lib/touchline/presentation/player-development-view-model";
import type { PlayerEvidenceViewModelInput } from "@/lib/touchline/presentation/player-evidence-view-model";

/**
 * Static fixtures for the Player Detail UI Lab (Phase F4, Hard Human Gate B). Reuses the same
 * "Noah Larsen" scenario the golden reference (`02-player-detail-original-golden.png`) already
 * established, for a like-for-like visual comparison.
 */
const RED_KIT = "#d5342c";

export const identityInput: PlayerIdentityViewModelInput = {
  playerId: "p-noah",
  firstName: "Noah",
  lastName: "Larsen",
  shirtNumber: 10,
  kitColor: RED_KIT,
  groupLabel: "G2015 · Autumn 2026",
  coreTeamName: "Graabein United",
  currentPrimaryPosition: "Left Wing",
  secondaryPositions: ["Left Midfield"],
  availabilityLabel: "Available",
  availabilityTone: "positive",
};

export const overviewInput: PlayerOverviewViewModelInput = {
  participation: { matches: 11, minutes: 327, starts: 8, goals: 2, assists: 4 },
  recentOpportunity: {
    perRound: [
      { roundLabel: "W32", hadOpportunity: true },
      { roundLabel: "W33", hadOpportunity: true },
      { roundLabel: "W34", hadOpportunity: true },
      { roundLabel: "W35", hadOpportunity: false },
      { roundLabel: "W36", hadOpportunity: true },
    ],
    recentCount: 4,
    recentTotal: 5,
    previousCount: 3,
    previousTotal: 5,
  },
  effectivePositions: [
    { positionCode: "LW", positionLabel: "Left Wing", rank: 1, supportBand: "STRONGEST", confidence: "HIGH" },
    { positionCode: "LM", positionLabel: "Left Midfield", rank: 2, supportBand: "STRONG", confidence: "MEDIUM" },
    { positionCode: "ST", positionLabel: "Striker", rank: 3, supportBand: "LIMITED", confidence: "LOW" },
  ],
  activeDevelopmentFocus: { id: "df1", focus: "Direct play in the final third", category: "positional_discipline", href: "#" },
  latestObservation: {
    id: "o1",
    note: "Noah consistently creates danger on the left with his pace and direct play. Keep working on decision making in the final third.",
    createdAt: "7 Sep",
    sourceLabel: "Coach feedback",
    themes: ["Direct play", "Creates chances", "Final third decisions"],
  },
  recentMatches: [
    { matchId: "m1", opponent: "Slemmestad Rød", matchDate: "12 Sep", role: "Core", goals: 1, assists: 1, href: "#" },
    { matchId: "m2", opponent: "Rød vs Graabein United", matchDate: "10 Sep", role: "Core", goals: 0, assists: 1, href: "#" },
    { matchId: "m3", opponent: "Sætre Lions", matchDate: "31 Aug", role: "Core", goals: 1, assists: 0, href: "#" },
  ],
};

export const matchesInput: PlayerMatchesViewModelInput = {
  seasonSummary: { matches: 11, minutes: 327, starts: 8, goals: 2, assists: 4 },
  availableLeagueSeasons: ["Autumn 2026"],
  availableEvents: ["Skiim Kiwi Bama Cup"],
  matches: [
    {
      matchId: "m1", source: "EVENT", date: "12 Sep", opponentOrEventName: "Slemmestad Rød", competitionLabel: "Skiim Kiwi Bama Cup",
      minutes: 42, actualPositions: ["LW"], context: "CORE", goals: 1, assists: 1, href: "#",
    },
    {
      matchId: "m2", source: "LEAGUE", date: "10 Sep", opponentOrEventName: "Graabein United", competitionLabel: "G2015 · League",
      minutes: 35, actualPositions: ["LW", "LM"], context: "CORE", goals: 0, assists: 1, href: "#",
    },
    {
      matchId: "m3", source: "LEAGUE", date: "31 Aug", opponentOrEventName: "Sætre Lions", competitionLabel: "G2015 · League",
      minutes: 28, actualPositions: ["ST"], context: "SUPPORT", goals: 1, assists: 0, href: "#",
    },
    {
      matchId: "m4", source: "LEAGUE", date: "24 Aug", opponentOrEventName: "Nordstrand IL", competitionLabel: "G2015 · League",
      minutes: 40, actualPositions: ["LW"], context: "CORE", goals: 0, assists: 1, href: "#",
    },
  ],
};

export const developmentInput: PlayerDevelopmentViewModelInput = {
  activeFocus: {
    id: "df1",
    focus: "Direct play in the final third",
    category: "positional_discipline",
    rationale: "Noah has pace and directness on the left but can rush the final decision.",
    startedAt: "18 Aug",
    reviewState: "PENDING",
    reviewDueAt: "29 Sep",
    observationCount: 3,
  },
  observationTimeline: [
    { id: "o1", note: "Noah consistently creates danger on the left with his pace and direct play. Keep working on decision making in the final third.", createdAt: "7 Sep", matchLabel: "vs Graabein United" },
    { id: "o2", note: "Stayed available for the pass on the left and looked to connect with teammates in the final third.", createdAt: "31 Aug", matchLabel: "vs Sætre Lions" },
    { id: "o3", note: "Took on his marker directly rather than recycling possession — created one clear chance.", createdAt: "24 Aug", matchLabel: "vs Nordstrand IL" },
  ],
  positionalContextNotes: ["Recent development observations overlap with increased Left Wing exposure this period."],
  completedFocusHistory: [{ id: "df0", focus: "Reset after ball loss", category: "reset_after_error", startedAt: "3 Jun", completedAt: "15 Aug" }],
};

export const evidenceInput: PlayerEvidenceViewModelInput = {
  stories: [
    {
      id: "e1", group: "OPPORTUNITY", question: "Has Noah had a consistent planned opportunity recently?",
      title: "Consistent involvement with increasing responsibility", value: "4/5", valueCaption: "eligible rounds with a planned opportunity",
      sample: "Last 5 eligible rounds", confidence: "Established",
      sparkline: [100, 100, 100, 0, 100], sparklineLabels: ["W32", "W33", "W34", "W35", "W36"],
    },
    {
      id: "e2", group: "POSITION", question: "Where does Noah's actual match time concentrate?",
      title: "Left Wing dominates recorded exposure", value: "68%", valueCaption: "of recorded minutes at Left Wing",
      sample: "11 matches with recorded position data", confidence: "Established",
      positionShares: [{ code: "LW", sharePercent: 68 }, { code: "LM", sharePercent: 22 }, { code: "ST", sharePercent: 10 }],
    },
    {
      id: "e3", group: "MATCH_CONTEXT", question: "Does Noah's on-field time coincide with a particular match phase?",
      title: "Not enough evidence yet for a match-phase pattern", sample: "2 matches with usable phase data", confidence: null,
      interpretation: "More completed matches are needed before a phase pattern can be shown.",
    },
  ],
};
