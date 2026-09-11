/**
 * Touchline Design Atlas UI Lab fixtures (Phase 2/3,
 * `13_IMPLEMENTATION_PHASES_AND_GATES.md`). Representative, in-memory only — no database, no
 * production writes. Shapes are typed against the real view-model input contracts
 * (`src/lib/touchline/presentation/**`) so this fixture set doubles as an end-to-end shape check.
 * Names/scores are illustrative fictional data, matching the existing UI Lab convention.
 */
import { buildMatchPresentation, type MatchPresentation } from "@/lib/matches/match-presentation";
import { buildTouchlineNav, type TouchlineNavKey } from "@/components/touchline";
import { buildTodayViewModel, type TodayViewModelInput } from "@/lib/touchline/presentation/today-view-model";
import { buildLeagueViewModel, type LeaguePeriodInput } from "@/lib/touchline/presentation/league-view-model";
import { buildHistoryViewModel, type HistoryViewModelInput } from "@/lib/touchline/presentation/history-view-model";
import { buildInsightsOverviewViewModel, type InsightsGroupInput } from "@/lib/touchline/presentation/insights-view-model";
import { buildPlayerDetailViewModel, type PlayerDetailViewModelInput } from "@/lib/touchline/presentation/player-detail-view-model";
import { buildEventListViewModel, buildEventDetailViewModel, type EventListRowInput, type EventDetailViewModelInput } from "@/lib/touchline/presentation/event-view-model";
import { buildEventSquadViewModel, type EventSquadViewModelInput } from "@/lib/touchline/presentation/event-squad-view-model";
import { buildMatchViewModel, type MatchViewModelInput } from "@/lib/touchline/presentation/match-view-model";
import { buildOpponentsViewModel, type OpponentsViewModelInput } from "@/lib/touchline/presentation/opponents-view-model";
import { buildOpponentDetailViewModel, type OpponentDetailViewModelInput } from "@/lib/touchline/presentation/opponent-detail-view-model";
import { buildTeamsOverviewViewModel, buildTeamDetailViewModel, type TeamOverviewRowInput, type TeamDetailViewModelInput } from "@/lib/touchline/presentation/team-view-model";
import { buildSeasonViewModel, type SeasonViewModelInput } from "@/lib/touchline/presentation/season-view-model";
import { buildRoundBoardViewModel, type RoundBoardViewModelInput } from "@/lib/touchline/presentation/round-board-view-model";
import { buildReviewsViewModel, type ReviewRowInput } from "@/lib/touchline/presentation/review-view-model";

export const ATLAS_ORG_CONTEXT = "Slemmestad IF · G2015 · Autumn 2026";

export function atlasNav(activeKey: TouchlineNavKey) {
  return { items: buildTouchlineNav((key) => `/dev/ui-lab/atlas/routes/${navRoute(key)}`), activeKey };
}
function navRoute(key: TouchlineNavKey): string {
  switch (key) {
    case "today": return "today";
    case "league": return "league";
    case "events": return "events";
    case "players": return "players";
    case "more": return "more";
  }
}

/* --- Shared match presentations ---------------------------------------- */
function finalRow(id: string, team: string, opponent: string, isHome: boolean, own: number, opp: number, outcome: "WON" | "LOST" | "DRAWN"): MatchPresentation {
  return buildMatchPresentation({ id, href: null, teamName: team, opponentName: opponent, isHome, kickoffAt: null, lifecycleStatus: "done", ownGoals: own, opponentGoals: opp, outcome });
}

export const recentMatches: MatchPresentation[] = [
  finalRow("h1", "Sætre Lions", "Rød", true, 6, 4, "WON"),
  finalRow("h2", "Rød", "Graabein United", true, 7, 2, "WON"),
  finalRow("h3", "Hurum City", "Rød", true, 3, 4, "LOST"),
];

const nextMatchPresentation = buildMatchPresentation({
  id: "next-1", href: "/dev/ui-lab/atlas/routes/match-detail", teamName: "Rød", opponentName: "Graabein United",
  isHome: true, kickoffAt: "2026-09-12T13:00:00", lifecycleStatus: "planning_open",
});

/* --- Today --------------------------------------------------------------- */
const todayInput: TodayViewModelInput = {
  dateLabel: "Thursday · 10 September 2026",
  nextMatch: nextMatchPresentation,
  decisions: [
    { id: "d1", title: "2 players below minimum for Hvit vs Tofte", urgency: "SOON", visibility: "PROMOTE", deepLink: "/dev/ui-lab/atlas/routes/round-board" },
    { id: "d2", title: "Available player without planned opportunity", summary: "Elias has no planned match this round", urgency: "NORMAL", visibility: "NORMAL" },
    { id: "d3", title: "Live reporting stalled", summary: "No heartbeat for 12 minutes", urgency: "SOON", visibility: "PROMOTE" },
  ],
  dueDecisionReviews: [
    { reviewId: "rev1", label: "Team focus ready to revisit", targetName: "Rød — Build from the back", targetHref: "/dev/ui-lab/atlas/routes/team-detail" },
  ],
  recentMatches,
  scheduleItems: [
    { id: "s1", timeLabel: "17:30", title: "Training", sublabel: "G2015 · Pitch 2" },
    { id: "s2", timeLabel: "Sat 13:00", title: "Rød vs Graabein United", sublabel: "2 planning decisions", isNow: true, isMatch: true },
    { id: "s3", timeLabel: "Sat 14:20", title: "Hvit vs Tofte", sublabel: "Ready", isMatch: true },
  ],
  squadStatusPlayers: [
    { playerId: "1", displayName: "Oliver Hansen", availability: "INJURED" },
    { playerId: "2", displayName: "Marius Dahl", availability: "TENTATIVE" },
    { playerId: "3", displayName: "Sander Nilsen", availability: "SICK" },
    ...Array.from({ length: 18 }, (_, i) => ({ playerId: `a${i}`, displayName: `Player ${i}`, availability: "AVAILABLE" as const })),
  ],
  evidenceSpotlight: {
    question: "How often do goals against arrive in the opening phase?",
    label: "Opening phases", title: "Opening phases remain vulnerable",
    value: "43%", valueCaption: "of recorded goals against arrived in the opening phase",
    sample: "14 goals · 8 matches", confidence: "ESTABLISHED",
    phaseSegments: [
      { label: "0–10", value: 6, highlighted: true }, { label: "10–20", value: 3 },
      { label: "20–30", value: 2 }, { label: "30–40", value: 1 }, { label: "40+", value: 2 },
    ],
    detailHref: "/dev/ui-lab/atlas/routes/insights",
  },
};
export const todayViewModel = buildTodayViewModel(todayInput);

/* --- League --------------------------------------------------------------- */
const leaguePeriods: LeaguePeriodInput[] = [{
  id: "p1", title: "Autumn 2026", isCurrent: true,
  rounds: [
    { id: "r34", title: "W34", selectionState: "FINALIZED", blockerCount: 0, decisionRequiredCount: 0, isCurrent: false,
      matches: [{ id: "m1", title: "Rød vs Graabein United", teamName: "Rød", selectionState: "FINALIZED", blockerCount: 0, decisionRequiredCount: 0, matchStatus: "SCHEDULED" }] },
    { id: "r35", title: "W35", selectionState: "READY", blockerCount: 0, decisionRequiredCount: 1, isCurrent: true,
      matches: [
        { id: "m2", title: "Rød vs Sætre Lions", teamName: "Rød", selectionState: "READY", blockerCount: 0, decisionRequiredCount: 1, matchStatus: "SCHEDULED" },
        { id: "m3", title: "Hvit vs Tofte", teamName: "Hvit", selectionState: "DRAFT", blockerCount: 0, decisionRequiredCount: 0, matchStatus: "SCHEDULED" },
      ] },
    { id: "r36", title: "W36", selectionState: "NOT_GENERATED", blockerCount: 0, decisionRequiredCount: 0, isCurrent: false, matches: [] },
  ],
}];
export const leagueViewModel = buildLeagueViewModel(leaguePeriods);
export const leagueScorebookRounds = { w34: [recentMatches[1]], w35: [recentMatches[0]] };

/* --- History --------------------------------------------------------------- */
const historyInput: HistoryViewModelInput = {
  players: [
    { playerId: "1", playerName: "Noah Larsen", coreTeamName: "Rød", roundsPlayed: 11, totalSelections: 11, coreMatches: 8, supportMatches: 2, developmentMatches: 1, backfillMatches: 0, doubleLoadRounds: 0, droppedRounds: 1, unavailableRounds: 0 },
    { playerId: "2", playerName: "Emil Nilsen", coreTeamName: "Rød", roundsPlayed: 9, totalSelections: 9, coreMatches: 9, supportMatches: 0, developmentMatches: 0, backfillMatches: 0, doubleLoadRounds: 0, droppedRounds: 0, unavailableRounds: 2 },
    { playerId: "3", playerName: "Elias Dahl", coreTeamName: "Hvit", roundsPlayed: 6, totalSelections: 6, coreMatches: 3, supportMatches: 2, developmentMatches: 1, backfillMatches: 0, doubleLoadRounds: 1, droppedRounds: 2, unavailableRounds: 1 },
    { playerId: "4", playerName: "Sander Aas", coreTeamName: "Blå", roundsPlayed: 13, totalSelections: 13, coreMatches: 10, supportMatches: 3, developmentMatches: 0, backfillMatches: 1, doubleLoadRounds: 0, droppedRounds: 0, unavailableRounds: 0 },
  ],
  movementPaths: [
    { fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", count: 6, uniquePlayers: 3, lastUsed: "2026-09-05" },
    { fromTeamName: "Blå", toTeamName: "Rød", role: "DEVELOPMENT", count: 2, uniquePlayers: 2, lastUsed: "2026-08-24" },
  ],
  recentMovements: [
    { playerId: "3", playerName: "Elias Dahl", matchRoundName: "W35", matchDate: "2026-09-05", fromTeamName: "Hvit", teamName: "Rød", role: "SUPPORT", explanation: "Squad repair after support movement" },
    { playerId: "4", playerName: "Sander Aas", matchRoundName: "W34", matchDate: "2026-08-29", fromTeamName: "Blå", teamName: "Blå", role: "DEVELOPMENT" },
  ],
  finalizedRoundCount: 34,
  draftRoundCount: 2,
};
export const historyViewModel = buildHistoryViewModel(historyInput);

/* --- Insights ------------------------------------------------------------- */
const insightsGroups: InsightsGroupInput[] = [
  { key: "opportunity_load", title: "Opportunity & load", exploreHref: "/dev/ui-lab/atlas/routes/insights",
    stories: [{ id: "og1", label: "Opportunity gap", title: "Most players are within one planned opportunity of parity",
      sample: "18 players · this season", confidence: "ESTABLISHED", detailHref: "#" }] },
  { key: "roles_development", title: "Roles & development", exploreHref: "/dev/ui-lab/atlas/routes/insights",
    stories: [{ id: "rd1", label: "Position exposure", title: "Wide roles carry the most recorded minutes this season",
      sample: "312 minutes recorded", confidence: "EMERGING", detailHref: "#" }] },
  { key: "match_patterns", title: "Match patterns", exploreHref: "/dev/ui-lab/atlas/routes/insights",
    stories: [{ id: "mp1", label: "Opening phases", title: "Opening phases remain vulnerable", value: "43%",
      valueCaption: "of recorded goals against arrived in the opening phase", sample: "14 goals · 8 matches",
      confidence: "ESTABLISHED", detailHref: "#" }] },
  { key: "planning_quality", title: "Planning quality", exploreHref: "/dev/ui-lab/atlas/routes/insights",
    stories: [
      { id: "pq1", label: "Planned vs actual", title: "3 matches this round have a planned-vs-actual deviation", sample: "This round", detailHref: "#" },
      { id: "pq2", label: "Operational health", title: "2 lineups are incomplete ahead of kickoff", sample: "Today", detailHref: "#" },
    ] },
];
export const insightsViewModel = buildInsightsOverviewViewModel(insightsGroups);

/* --- Players ---------------------------------------------------------------- */
export const playerRoster = [
  { playerId: "1", displayName: "Noah Larsen", coreTeamName: "Graabein United", primaryPosition: "LW", availability: "Available", actualAppearances: 11, coreAppearances: 8, supportAppearances: 2, developmentAppearances: 1, attention: null },
  { playerId: "2", displayName: "Emil Nilsen", coreTeamName: "Rød", primaryPosition: "CM", availability: "Available", actualAppearances: 9, coreAppearances: 9, supportAppearances: 0, developmentAppearances: 0, attention: null },
  { playerId: "3", displayName: "Elias Dahl", coreTeamName: "Hvit", primaryPosition: "RB", availability: "Doubtful", actualAppearances: 6, coreAppearances: 3, supportAppearances: 2, developmentAppearances: 1, attention: "Decision required" },
];
export const selectedPlayerInspector = {
  playerId: "1", displayName: "Noah Larsen", coreTeamName: "Graabein United", primaryPosition: "LW",
  seasonAppearances: 11, seasonGoals: 2, seasonAssists: 4,
  positionExposure: [{ code: "LW", share: 68 }, { code: "LM", share: 22 }, { code: "ST", share: 10 }],
  availability: "Available", developmentFocus: "Direct play in the final third",
};

/* --- Player detail ------------------------------------------------------ */
const playerDetailInput: PlayerDetailViewModelInput = {
  identity: { playerId: "1", firstName: "Noah", lastName: "Larsen", shirtNumber: 10, primaryPosition: "Left Wing", coreTeamName: "Graabein United", groupLabel: "G2015 · Autumn 2026" },
  allTimeStats: { actualAppearances: 11, goals: 2, assists: 4 },
  recentOpportunity: {
    perRound: [
      { roundLabel: "W32", hadOpportunity: true }, { roundLabel: "W33", hadOpportunity: true },
      { roundLabel: "W34", hadOpportunity: true }, { roundLabel: "W35", hadOpportunity: false }, { roundLabel: "W36", hadOpportunity: true },
    ],
    recentCount: 4, recentTotal: 5, previousCount: 3, previousTotal: 5,
  },
  realisedPositionCounts: { LW: 34, LM: 11, ST: 5 },
  outfieldRoles: [{ role: "LW", tier: "NATURAL" }, { role: "LM", tier: "STRONG" }, { role: "ST", tier: "PLAUSIBLE" }],
  activeDevelopmentFocus: { id: "df1", focus: "Direct play in the final third", category: "positional_discipline", href: "#" },
  latestObservations: [{ id: "o1", note: "Stayed available for the pass on the left and looked to connect with teammates in the final third.", createdAt: "2026-09-07" }],
  recentMatches: [
    { matchId: "m1", opponent: "Skrim Kiwi Bama Cup", matchDate: "12 Sep", role: "Core", href: "#" },
    { matchId: "m2", opponent: "Graabein United", matchDate: "10 Sep", role: "Core", href: "#" },
  ],
};
export const playerDetailViewModel = buildPlayerDetailViewModel(playerDetailInput);

/* --- Events ------------------------------------------------------------- */
const eventListRows: EventListRowInput[] = [
  { eventId: "e1", name: "Skrim Kiwi Bama Cup", startsAt: "2026-09-12T09:00:00", opponentSummary: "vs Skrim United", readiness: "Squads ready", isFinalized: false },
  { eventId: "e2", name: "Autumn Friendly Day", startsAt: "2026-09-20T09:00:00", opponentSummary: null, readiness: "Draft squads", isFinalized: false },
  { eventId: "e0", name: "Spring Cup", startsAt: "2026-05-10T09:00:00", opponentSummary: "vs Nordstrand", readiness: "Done", isFinalized: true },
];
export const eventListViewModel = buildEventListViewModel(eventListRows, "2026-09-11T00:00:00");

const eventDetailInput: EventDetailViewModelInput = {
  eventId: "e1", name: "Skrim Kiwi Bama Cup", venue: "Slemmestad · Pitch 3", gameFormat: "7-a-side",
  nextMatch: { eventMatchId: "em1", startsAt: "2026-09-12T11:00:00", opponentName: "Skrim United", status: "SCHEDULED", isLive: false, href: "#" },
  timeline: [
    { eventMatchId: "em1", startsAt: "2026-09-12T11:00:00", opponentName: "Skrim United", status: "SCHEDULED", isLive: false, href: "#" },
    { eventMatchId: "em2", startsAt: "2026-09-12T13:00:00", opponentName: "Bærum SK", status: "SCHEDULED", isLive: false, href: "#" },
  ],
  squadReadiness: [
    { squadId: "s1", squadName: "Rød", currentCount: 12, targetSize: 14, hasGoalkeeper: true, missingCount: 2 },
    { squadId: "s2", squadName: "Hvit", currentCount: 11, targetSize: 14, hasGoalkeeper: true, missingCount: 3 },
  ],
  helpers: [{ playerName: "Erik Johansen", targetMatchLabel: "vs Skrim United", confirmed: true }],
};
export const eventDetailViewModel = buildEventDetailViewModel(eventDetailInput);

/* --- Event squad ---------------------------------------------------------- */
const eventSquadInput: EventSquadViewModelInput = {
  squadId: "s1", squadName: "Rød", opponentSummary: "Skrim United", currentCount: 12, targetSize: 14,
  squadRail: [{ squadId: "s1", label: "Rød", currentCount: 12, targetSize: 14 }, { squadId: "s2", label: "Hvit", currentCount: 11, targetSize: 14 }, { squadId: "s3", label: "Blå", currentCount: 13, targetSize: 14 }],
  players: [
    { participantId: "p1", displayName: "Marius", shirtNumber: 1, position: "GK", availabilityLabel: "Available", isGuest: false },
    { participantId: "p2", displayName: "Sander", shirtNumber: 2, position: "LB", availabilityLabel: "Available", isGuest: false },
    { participantId: "p3", displayName: "Lukas", shirtNumber: 15, position: "CB", availabilityLabel: "Guest player", isGuest: true },
    { participantId: "p4", displayName: "Jonas", shirtNumber: 12, position: "RW", availabilityLabel: "Travelling", isGuest: false },
  ],
  guestCount: 1,
};
export const eventSquadViewModel = buildEventSquadViewModel(eventSquadInput);

/* --- Match detail / planning hub ------------------------------------------ */
const matchInput: MatchViewModelInput = {
  matchId: "m1", teamName: "Rød", opponent: "Graabein United", startsAt: "2026-09-12T13:00:00", venue: "Slemmestad · Pitch 1",
  lifecycleStatus: "planning_open",
  checks: [
    { key: "squad", label: "Squad populated", complete: true },
    { key: "lineup", label: "Lineup created", complete: true },
    { key: "report", label: "Report submitted", complete: false },
  ],
  availability: { available: 16, doubtful: 1, unavailable: 1 },
  planningAttention: [{ title: "Centre back cover", detail: "Only 2 CBs available. Consider adjusting the rotation plan." }],
  squadBalance: { core: 9, support: 6, development: 0, matchday: 3 },
};
export const matchViewModel = buildMatchViewModel(matchInput);

/* --- Opponents -------------------------------------------------------------- */
const opponentsInput: OpponentsViewModelInput = {
  nowIso: "2026-09-11T00:00:00Z",
  opponents: [
    { opponentTeamId: "o1", displayName: "Lillestrøm SK", encounterCount: 3, lastEncounterDate: "2026-09-01T00:00:00Z", lastEncounterResult: "lost", sportingLevel: "high", latestFollowUp: null },
    { opponentTeamId: "o2", displayName: "Kolbotn IL", encounterCount: 2, lastEncounterDate: "2026-08-20T00:00:00Z", lastEncounterResult: "lost", sportingLevel: "medium", latestFollowUp: "DISCUSSED_AFTER_MATCH" },
    { opponentTeamId: "o3", displayName: "Bærum SK", encounterCount: 4, lastEncounterDate: "2026-06-01T00:00:00Z", lastEncounterResult: "won", sportingLevel: "medium", latestFollowUp: "NO_FURTHER_ACTION_REQUIRED" },
  ],
};
export const opponentsViewModel = buildOpponentsViewModel(opponentsInput);

const opponentDetailInput: OpponentDetailViewModelInput = {
  opponentTeamId: "o1", displayName: "Stabæk", sportingLevel: "high", sportingLevelSampleCount: 5,
  encounters: [
    { matchId: "e1", matchDate: "2026-09-10", ownGoals: 1, opponentGoals: 3, outcome: "lost" },
    { matchId: "e2", matchDate: "2026-05-10", ownGoals: 0, opponentGoals: 2, outcome: "lost" },
    { matchId: "e3", matchDate: "2025-09-14", ownGoals: 2, opponentGoals: 1, outcome: "won" },
  ],
  tendencies: [
    { tag: "HIGH_PRESSING", occurrences: 4, confidence: "ESTABLISHED" },
    { tag: "COMPACT_MIDFIELD", occurrences: 3, confidence: "EMERGING" },
  ],
  tendencyOutcomes: [{ tag: "HIGH_PRESSING", matchCount: 4, goalsFor: 3, goalsAgainst: 6 }],
  latestFactualSummary: "Organised, disciplined. Good movement between lines and quick in transition.",
};
export const opponentDetailViewModel = buildOpponentDetailViewModel(opponentDetailInput);

/* --- Teams -------------------------------------------------------------- */
const teamRows: TeamOverviewRowInput[] = [
  { teamId: "t1", teamName: "Rød", matchesPlayed: 18, wins: 12, draws: 2, losses: 4, goalsFor: 61, goalsAgainst: 43, cleanSheets: 3, corePlayerCount: 14, unresolvedPlanningAttentionCount: 1 },
  { teamId: "t2", teamName: "Hvit", matchesPlayed: 18, wins: 8, draws: 4, losses: 6, goalsFor: 40, goalsAgainst: 38, cleanSheets: 2, corePlayerCount: 13, unresolvedPlanningAttentionCount: 0 },
  { teamId: "t3", teamName: "Blå", matchesPlayed: 18, wins: 10, draws: 3, losses: 5, goalsFor: 52, goalsAgainst: 44, cleanSheets: 4, corePlayerCount: 14, unresolvedPlanningAttentionCount: 2 },
];
export const teamsOverviewViewModel = buildTeamsOverviewViewModel(teamRows);

const teamDetailInput: TeamDetailViewModelInput = {
  teamId: "t1", teamName: "Rød", gameFormat: "7-a-side", corePlayerCount: 14, targetSquadSize: 14,
  record: { matchesPlayed: 18, wins: 12, draws: 2, losses: 4 }, supportPriorityRank: 1,
  activeFocuses: [
    { id: "f1", statement: "Build from the back with confidence", context: "Especially against high-pressing teams", status: "ACTIVE" },
    { id: "f2", statement: "Give all players meaningful minutes", context: null, status: "ACTIVE" },
  ],
  rotationPaths: [{ id: "rp1", direction: "outgoing", counterpartTeamName: "Hvit", role: "SUPPORT" }, { id: "rp2", direction: "incoming", counterpartTeamName: "Blå", role: "DEVELOPMENT" }],
  recentMovements: [{ playerName: "Elias Dahl", fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", roundLabel: "W35" }],
};
export const teamDetailViewModel = buildTeamDetailViewModel(teamDetailInput);

/* --- Season --------------------------------------------------------------- */
const seasonInput: SeasonViewModelInput = {
  leagueSeasonId: "ls1", displayLabel: "Autumn 2026", status: "OPEN",
  roundCount: 18, finalizedRoundCount: 8, playersWithAppearance: 17, totalCorePlayers: 19,
};
export const seasonViewModel = buildSeasonViewModel(seasonInput);

/* --- Round Board ------------------------------------------------------ */
const roundBoardInput: RoundBoardViewModelInput = {
  roundLabel: "W37 · Autumn 2026",
  columns: [
    { matchId: "m1", title: "Rød · vs Graabein", playerCount: 8 },
    { matchId: "m2", title: "Hvit · vs Tofte", playerCount: 7 },
    { matchId: "m3", title: "Blå · vs ROS", playerCount: 8 },
  ],
  blockerCount: 0, decisionRequiredCount: 2,
};
export const roundBoardViewModel = buildRoundBoardViewModel(roundBoardInput);
export const roundBoardPlayers = {
  m1: [{ name: "Noah", code: "LW" }, { name: "Emil", code: "CM" }, { name: "Elias", code: "RB" }, { name: "Henrik", code: "ST" }, { name: "Sander", code: "GK" }],
  m2: [{ name: "Marius", code: "LM" }, { name: "Oliver", code: "CB" }, { name: "Jonas", code: "RB" }],
  m3: [{ name: "David", code: "GK" }, { name: "Lars", code: "CB" }, { name: "Adam", code: "ST" }],
};

/* --- Peer reviews ------------------------------------------------------ */
const reviewRows: ReviewRowInput[] = [
  { id: "rv1", targetType: "MATCH_LINEUP", targetLabel: "Rød vs Graabein United", status: "PENDING", requestMessage: "Would love your thoughts on this lineup. Especially the midfield balance.", reviewerComment: null, requestedByMembershipId: "coach-a", reviewerMembershipId: "me", createdAt: "2026-09-10T18:00:00" },
  { id: "rv2", targetType: "EVENT_SQUAD", targetLabel: "Skrim Kiwi Bama Cup — Rød", status: "PENDING", requestMessage: null, reviewerComment: null, requestedByMembershipId: "me", reviewerMembershipId: "coach-b", createdAt: "2026-09-09T09:00:00" },
  { id: "rv3", targetType: "MATCH_LINEUP", targetLabel: "Hvit vs Tofte", status: "APPROVED", requestMessage: null, reviewerComment: "Looks solid.", requestedByMembershipId: "coach-a", reviewerMembershipId: "me", createdAt: "2026-09-01T09:00:00" },
];
export const reviewsViewModel = buildReviewsViewModel(reviewRows, "me");

/* --- Formations ------------------------------------------------------- */
export const formationsList = [
  { id: "f1", name: "4-3-3", gameFormat: "7-a-side", source: "System" as const, slotCount: 10 },
  { id: "f2", name: "3-2-1", gameFormat: "7-a-side", source: "Custom" as const, slotCount: 6 },
];

/* --- Groups ------------------------------------------------------------- */
export const groupSummary = { name: "U14 Tigers", memberCount: 24, poolCount: 6, guestCount: 3, coachCount: 2 };

/* --- Rules --------------------------------------------------------------- */
export const rotationPathRows = [
  { id: "rp1", fromTeamName: "Hvit", toTeamName: "Rød", role: "SUPPORT", active: true },
  { id: "rp2", fromTeamName: "Blå", toTeamName: "Rød", role: "DEVELOPMENT", active: true },
];

/* --- Invitation ------------------------------------------------------- */
export const invitationFixture = { organisationName: "Slemmestad IF", intendedRole: "COACH", invitedEmail: "coach@example.com" };

/* --- Lineup / Tactics / Rotations (08_ROUTE_COMPOSITION_PLANNING_TACTICS.md) ---------------
 * Reuses the existing production `TacticsBoard` (src/components/formations/tactics-board.tsx,
 * Touchline Finish-migrated) directly rather than a second hand-rolled pitch — see
 * docs/domain/touchline-atlas-provenance.md §0.9. */
export const lineupSlots = [
  { id: "gk", gridX: 2, gridY: 5, label: "Goalkeeper", shortLabel: "GK", roleType: "GOALKEEPER" as const, acceptedPositionIds: [], sortOrder: 0 },
  { id: "lb", gridX: 0, gridY: 4, label: "Left Back", shortLabel: "LB", roleType: "DEFENDER" as const, acceptedPositionIds: [], sortOrder: 1 },
  { id: "cb", gridX: 2, gridY: 4, label: "Centre Back", shortLabel: "CB", roleType: "DEFENDER" as const, acceptedPositionIds: [], sortOrder: 2 },
  { id: "rb", gridX: 4, gridY: 4, label: "Right Back", shortLabel: "RB", roleType: "DEFENDER" as const, acceptedPositionIds: [], sortOrder: 3 },
  { id: "cm", gridX: 2, gridY: 2, label: "Centre Midfield", shortLabel: "CM", roleType: "MIDFIELDER" as const, acceptedPositionIds: [], sortOrder: 4 },
  { id: "lw", gridX: 0, gridY: 0, label: "Left Wing", shortLabel: "LW", roleType: "FORWARD" as const, acceptedPositionIds: [], sortOrder: 5 },
  { id: "st", gridX: 2, gridY: 0, label: "Striker", shortLabel: "ST", roleType: "FORWARD" as const, acceptedPositionIds: [], sortOrder: 6 },
];
export const lineupPlayers = [
  { id: "p1", firstName: "Marius", lastName: "H", primaryPosition: "GK", shirtNumber: 1 },
  { id: "p2", firstName: "Sander", lastName: "K", primaryPosition: "LB", shirtNumber: 2 },
  { id: "p3", firstName: "Oliver", lastName: "T", primaryPosition: "CB", shirtNumber: 4 },
  { id: "p4", firstName: "Jonas", lastName: "B", primaryPosition: "RB", shirtNumber: 3 },
  { id: "p5", firstName: "Noah", lastName: "L", primaryPosition: "CM", shirtNumber: 8 },
  { id: "p6", firstName: "Emil", lastName: "S", primaryPosition: "LW", shirtNumber: 11 },
  { id: "p7", firstName: "Henrik", lastName: "A", primaryPosition: "ST", shirtNumber: 9 },
];
export const lineupAssignments = [
  { id: "a1", slotId: "gk", playerId: "p1", locked: false, source: "MANUAL" },
  { id: "a2", slotId: "lb", playerId: "p2", locked: false, source: "MANUAL" },
  { id: "a3", slotId: "cb", playerId: "p3", locked: true, source: "MANUAL" },
  { id: "a4", slotId: "rb", playerId: "p4", locked: false, source: "MANUAL" },
  { id: "a5", slotId: "cm", playerId: "p5", locked: false, source: "MANUAL" },
  { id: "a6", slotId: "lw", playerId: "p6", locked: false, source: "MANUAL" },
  { id: "a7", slotId: "st", playerId: "p7", locked: false, source: "MANUAL" },
];
export const lineupBench = [
  { id: "p8", name: "Elias Berg", role: "RW", number: 7 },
  { id: "p9", name: "Adam Nilsen", role: "CB", number: 5 },
];
export const positionFitEntries = [
  { tier: "NATURAL" as const, roles: ["LW"] },
  { tier: "STRONG" as const, roles: ["ST"] },
  { tier: "PLAUSIBLE" as const, roles: ["RW", "AM"] },
  { tier: "UNSUPPORTED" as const, roles: ["CB"] },
];
export const rotationPlanChanges = [
  { id: "rc1", atMinuteLabel: "15 min", outPlayerName: "Emil Sørensen", inPlayerName: "Elias Berg", role: "LW", applied: true },
  { id: "rc2", atMinuteLabel: "30 min", outPlayerName: "Henrik Aas", inPlayerName: "Adam Nilsen", role: "ST", applied: false },
];
export const rotationDiagnostics = ["No safe replacement for CB at 42 min"];

/* --- Live Reporting / Follow Live / Post-match ----------------------------------------------- */
export const liveMatchPresentation = buildMatchPresentation({
  id: "live-1", href: null, teamName: "Rød", opponentName: "Graabein United", isHome: true,
  kickoffAt: "2026-09-11T13:00:00", lifecycleStatus: "live", ownGoals: 1, opponentGoals: 0, liveClockLabel: "34'",
});
export const liveEventTimeline = [
  { id: "le1", minuteLabel: "12'", label: "Goal — Henrik Aas", type: "GOAL" as const },
  { id: "le2", minuteLabel: "23'", label: "Rotation — Emil Sørensen off, Elias Berg on", type: "ROTATION" as const },
  { id: "le3", minuteLabel: "34'", label: "Fair play observation recorded", type: "FAIR_PLAY" as const },
];
export const postMatchReportFixture = {
  matchId: "m1", teamName: "Rød", opponent: "Graabein United", finalScore: "1 - 0", status: "REPORTED" as const,
  goals: [{ id: "g1", minuteLabel: "12'", playerName: "Henrik Aas" }],
  assists: [{ id: "as1", minuteLabel: "12'", playerName: "Noah Larsen" }],
  attendanceUnknownCount: 0,
};
