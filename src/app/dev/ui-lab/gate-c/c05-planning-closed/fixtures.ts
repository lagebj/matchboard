import { WarningSeverity } from "@/generated/prisma/client";
import { ROD, HVIT, buildRoster, KICKOFF_LAST_WEEK, KICKOFF_SATURDAY, type FixturePlayerSeed } from "../w2-shared/round-identities";
import type { RoundBoardFixtureInitial } from "../w2-shared/round-board-fixture-harness";

/**
 * C05 — Planning closed, historical warnings (Gate C W2).
 *
 * Primary candidate: a genuinely MIXED planning boundary — Rød's match kicked off last week and
 * is closed (`isFinalized: true`), carrying a retained historical BLOCKED warning; Hvit's match
 * is this coming Saturday and is still open, with its own genuine unresolved decision. Round-level
 * `planningBoundaryOpen` is false (every match must be open for the round-level gate — ADR-0109),
 * but Hvit's own per-match boundary remains open, so a valid action must still be reachable for it
 * (brief §4: "Do not disable valid open-match actions merely because another match is closed.").
 */

function toAssigned(seed: FixturePlayerSeed, role: "CORE" | "SUPPORT" | "BACKFILL" | "DEVELOPMENT" = "CORE") {
  return {
    id: seed.id,
    name: seed.name,
    coreTeamName: seed.coreTeamName,
    coreTeamId: seed.coreTeamId,
    playerCoreTeamId: seed.coreTeamId,
    primaryPosition: seed.primaryPosition,
    role,
    shirtNumber: seed.shirtNumber,
    kitColor: seed.kitColor,
  };
}

function toAvailable(seed: FixturePlayerSeed) {
  return {
    id: seed.id,
    name: seed.name,
    coreTeamName: seed.coreTeamName,
    coreTeamId: seed.coreTeamId,
    primaryPosition: seed.primaryPosition,
    shirtNumber: seed.shirtNumber,
    kitColor: seed.kitColor,
  };
}

export function buildC05PlanningClosedFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  const hvitRoster = buildRoster(HVIT, 11, 21);
  const erikHvit = hvitRoster.find((p) => p.name === "Erik")!;
  const hvitAssigned = hvitRoster.filter((p) => p.id !== erikHvit.id);
  const oskar = rodRoster.find((p) => p.name === "Oskar")!;

  return {
    roundLabel: "Week 45",
    planningBoundaryOpen: false,
    matchRoundId: "w2-c05-round",
    matches: [
      {
        matchId: "w2-c05-rod",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_LAST_WEEK,
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: true,
        players: rodRoster.map((p) => toAssigned(p)),
      },
      {
        matchId: "w2-c05-hvit",
        teamId: HVIT.teamId,
        teamName: HVIT.teamName,
        teamKitColor: HVIT.kitColor,
        opponent: "Nittedal IL",
        matchDate: KICKOFF_SATURDAY,
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: false,
        players: hvitAssigned.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: [...rodRoster, ...hvitRoster].map(toAvailable),
    rotationPathMap: {},
    warnings: [
      {
        code: "SELECTED_PLAYER_UNAVAILABLE",
        message: `${oskar.name} was marked unavailable but was included in the finalised squad for this match.`,
        severity: WarningSeverity.HARD_BLOCK,
        playerId: oskar.id,
        playerName: oskar.name,
        teamName: ROD.teamName,
      },
      {
        code: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
        message: `${erikHvit.name} is available but has no planned match opportunity this round.`,
        severity: WarningSeverity.REQUIRES_OVERRIDE,
        playerId: erikHvit.id,
        playerName: erikHvit.name,
        teamName: HVIT.teamName,
      },
    ],
    signalSummary: { blocked: 1, decisionRequired: 1, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [
      { label: "Players selected", value: 21 },
      { label: "Matches this round", value: 2 },
      { label: "Cross-team movers", value: 0 },
      { label: "Squad fill rate", value: "88%" },
    ],
    eligiblePlayerIds: [...rodRoster, ...hvitRoster].map((p) => p.id),
  };
}

/** Edge case: closed round, but no unresolved historical warning remains. */
export function buildC05ClosedNoWarningFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  return {
    roundLabel: "Week 44",
    planningBoundaryOpen: false,
    matchRoundId: "w2-c05-closed-clean",
    matches: [
      {
        matchId: "w2-c05-rod-clean",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_LAST_WEEK,
        targetSquadSize: 11,
        minSquadSize: 7,
        isFinalized: true,
        players: rodRoster.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: rodRoster.map(toAvailable),
    rotationPathMap: {},
    warnings: [],
    signalSummary: { blocked: 0, decisionRequired: 0, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [],
    eligiblePlayerIds: rodRoster.map((p) => p.id),
  };
}

/** Control case: a fully open round (no closed matches at all) — Resolve remains a genuinely valid action. */
export function buildC05FullyOpenControlFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  const noah = rodRoster.find((p) => p.name === "Noah")!;
  const rodAssigned = rodRoster.filter((p) => p.id !== noah.id);

  return {
    roundLabel: "Week 47",
    planningBoundaryOpen: true,
    matchRoundId: "w2-c05-fully-open",
    matches: [
      {
        matchId: "w2-c05-rod-open",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_SATURDAY,
        targetSquadSize: 11,
        minSquadSize: 7,
        isFinalized: false,
        players: rodAssigned.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: rodRoster.map(toAvailable),
    rotationPathMap: {},
    warnings: [
      {
        code: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
        message: `${noah.name} is available but has no planned match opportunity this round.`,
        severity: WarningSeverity.REQUIRES_OVERRIDE,
        playerId: noah.id,
        playerName: noah.name,
        teamName: ROD.teamName,
      },
    ],
    signalSummary: { blocked: 0, decisionRequired: 1, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [],
    eligiblePlayerIds: rodRoster.map((p) => p.id),
  };
}
