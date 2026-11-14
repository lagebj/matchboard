import { WarningSeverity } from "@/generated/prisma/client";
import { ROD, HVIT, buildRoster, KICKOFF_SATURDAY, KICKOFF_SATURDAY_LATE, type FixturePlayerSeed } from "../w2-shared/round-identities";
import type { RoundBoardFixtureInitial } from "../w2-shared/round-board-fixture-harness";

/**
 * C04 — Planning open, unresolved player decision (Gate C W2).
 *
 * Primary candidate: Rød has 10 of 11 eligible players assigned (one, Noah, genuinely has no
 * planned opportunity this round — the unresolved decision); Hvit's 11 are all assigned (every
 * eligible player covered), shown side by side in the same round so both states are visible at
 * once without a second route. `eligibleCoverage` ("21 / 22 eligible players with an
 * opportunity") is the canonical `RoundPlanIntegrity.coverage` denominator — distinct from
 * `plannedOpportunities`/`targetOpportunities` ("21 / 22 opportunities planned"), which happen to
 * read the same number here by coincidence of this fixture's shape, not because they are the same
 * measure (see `docs/ui-lab/gate-c-w2-candidates/OPPORTUNITY_COVERAGE_SEMANTICS.md`).
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

export function buildC04PlanningOpenFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  const hvitRoster = buildRoster(HVIT, 11, 21);
  const noah = rodRoster[3]!; // "Noah" by the shared first-name list's deterministic order.

  const rodAssigned = rodRoster.filter((p) => p.id !== noah.id);

  return {
    roundLabel: "Week 46",
    planningBoundaryOpen: true,
    matchRoundId: "w2-c04-round",
    matches: [
      {
        matchId: "w2-c04-rod",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_SATURDAY,
        // Deliberately 12, not 11 (the roster size): keeps "opportunities planned" (squad
        // placements, 21/24) numerically distinct from "eligible players with an opportunity"
        // (distinct players, 21/22) — the two measures must never read as the same number.
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: false,
        players: rodAssigned.map((p) => toAssigned(p)),
      },
      {
        matchId: "w2-c04-hvit",
        teamId: HVIT.teamId,
        teamName: HVIT.teamName,
        teamKitColor: HVIT.kitColor,
        opponent: "Nittedal IL",
        matchDate: KICKOFF_SATURDAY_LATE,
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: false,
        players: hvitRoster.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: [...rodRoster, ...hvitRoster].map(toAvailable),
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
    movementSummary: {
      supportSent: 0,
      supportReceived: 0,
      developmentSent: 0,
      developmentReceived: 0,
      squadRepairReceived: 0,
      drops: 0,
    },
    fairnessMetrics: [
      { label: "Players selected", value: 21 },
      { label: "Matches this round", value: 2 },
      { label: "Cross-team movers", value: 0 },
      { label: "Squad fill rate", value: "88%" },
    ],
    effectivePositionsByPlayerId: {
      [noah.id]: [{ positionId: "CB", supportBand: "STRONG", confidence: "HIGH", appearances: 9, minutes: 612 }],
    },
    activeFocusByPlayerId: {},
    eligiblePlayerIds: [...rodRoster, ...hvitRoster].map((p) => p.id),
  };
}

/** Edge case: no eligible players at all this round (e.g. a bye week fixture with an empty roster). */
export function buildC04NoEligiblePlayersFixture(): RoundBoardFixtureInitial {
  return {
    roundLabel: "Week 46",
    planningBoundaryOpen: true,
    matchRoundId: "w2-c04-empty",
    matches: [],
    availablePlayers: [],
    rotationPathMap: {},
    warnings: [],
    signalSummary: { blocked: 0, decisionRequired: 0, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [],
    eligiblePlayerIds: [],
  };
}

/** Edge case: every eligible player already has a planned opportunity (no unresolved decision). */
export function buildC04AllAssignedFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  return {
    roundLabel: "Week 46",
    planningBoundaryOpen: true,
    matchRoundId: "w2-c04-complete",
    matches: [
      {
        matchId: "w2-c04-rod-complete",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_SATURDAY,
        // 12, not 11, for the same reason as the primary fixture — keeps the two measures
        // ("11 / 12 opportunities planned" vs "11 / 11 eligible players covered") distinct.
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: false,
        players: rodRoster.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: rodRoster.map(toAvailable),
    rotationPathMap: {},
    warnings: [],
    signalSummary: { blocked: 0, decisionRequired: 0, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [{ label: "Players selected", value: 11 }, { label: "Matches this round", value: 1 }, { label: "Cross-team movers", value: 0 }, { label: "Squad fill rate", value: "92%" }],
    eligiblePlayerIds: rodRoster.map((p) => p.id),
  };
}

/** Edge case: several players (not just one) missing an opportunity, across more than one team. */
export function buildC04SeveralMissingFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 11, 1);
  const hvitRoster = buildRoster(HVIT, 11, 21);
  const rodMissing = rodRoster.slice(0, 2); // 2 Rød players without an opportunity.
  const hvitMissing = hvitRoster.slice(0, 1); // 1 Hvit player without an opportunity.
  const rodAssigned = rodRoster.filter((p) => !rodMissing.includes(p));
  const hvitAssigned = hvitRoster.filter((p) => !hvitMissing.includes(p));

  const missing = [...rodMissing, ...hvitMissing];

  return {
    roundLabel: "Week 46",
    planningBoundaryOpen: true,
    matchRoundId: "w2-c04-several-missing",
    matches: [
      {
        matchId: "w2-c04-rod-several",
        teamId: ROD.teamId,
        teamName: ROD.teamName,
        teamKitColor: ROD.kitColor,
        opponent: "Asker SK",
        matchDate: KICKOFF_SATURDAY,
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: false,
        players: rodAssigned.map((p) => toAssigned(p)),
      },
      {
        matchId: "w2-c04-hvit-several",
        teamId: HVIT.teamId,
        teamName: HVIT.teamName,
        teamKitColor: HVIT.kitColor,
        opponent: "Nittedal IL",
        matchDate: KICKOFF_SATURDAY_LATE,
        targetSquadSize: 12,
        minSquadSize: 7,
        isFinalized: false,
        players: hvitAssigned.map((p) => toAssigned(p)),
      },
    ],
    availablePlayers: [...rodRoster, ...hvitRoster].map(toAvailable),
    rotationPathMap: {},
    warnings: missing.map((p) => ({
      code: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
      message: `${p.name} is available but has no planned match opportunity this round.`,
      severity: WarningSeverity.REQUIRES_OVERRIDE,
      playerId: p.id,
      playerName: p.name,
      teamName: p.coreTeamName,
    })),
    signalSummary: { blocked: 0, decisionRequired: missing.length, planningNote: 0 },
    movementSummary: { supportSent: 0, supportReceived: 0, developmentSent: 0, developmentReceived: 0, squadRepairReceived: 0, drops: 0 },
    fairnessMetrics: [],
    eligiblePlayerIds: [...rodRoster, ...hvitRoster].map((p) => p.id),
  };
}
