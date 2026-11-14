import { WarningSeverity } from "@/generated/prisma/client";
import { ROD, HVIT, BLA, GRONN, buildRoster, KICKOFF_SATURDAY, type FixturePlayerSeed, type FixtureTeam } from "../w2-shared/round-identities";
import type { RoundBoardFixtureInitial } from "../w2-shared/round-board-fixture-harness";

/**
 * C06 — Dense allocation, position-precision disclosure (Gate C W2).
 *
 * Four matches, 54 eligible players total — well past the comfortable minimum for the
 * allocation matrix's secondary desktop mode. Two genuine cross-team movers (a Rød player sent
 * to Hvit as SUPPORT via an active rotation path; a Grønn player sent to Blå as DEVELOPMENT) so
 * the matrix shows real assignment constraints, not just same-team placements.
 *
 * Position precision: confirmed by direct code audit that Round Board's `Selection` model has
 * no tactical-position field at all — assignment is player×match only (`AllocationMatrixRow`,
 * `allocation-matrix.tsx`), and `Player.primaryPosition` is unconstrained free text. The real
 * 24-code `CANONICAL_TACTICAL_POSITIONS` vocabulary (ADR-0154) belongs to the separate
 * Lineup/Formation editor. This fixture does not fabricate a 24-code value anywhere — see
 * `docs/ui-lab/gate-c-w2-candidates/POSITION_VOCABULARY_AND_PRECISION.md`.
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

function matchOf(team: FixtureTeam, opponent: string, matchId: string, targetSquadSize: number) {
  return { matchId, teamId: team.teamId, teamName: team.teamName, teamKitColor: team.kitColor, opponent, matchDate: KICKOFF_SATURDAY, targetSquadSize, minSquadSize: 7, isFinalized: false };
}

export function buildC06DenseAllocationFixture(): RoundBoardFixtureInitial {
  const rodRoster = buildRoster(ROD, 14, 1);
  const hvitRoster = buildRoster(HVIT, 14, 21);
  const blaRoster = buildRoster(BLA, 13, 41);
  const gronnRoster = buildRoster(GRONN, 13, 61);

  // Cross-team movers — real assignment constraints, not just same-team placements.
  const rodToHvitMover = rodRoster[12]!; // SUPPORT, via an active Rød -> Hvit rotation path.
  const rodGenuinelyUnassigned = rodRoster[13]!; // No path anywhere — a genuine open decision.
  const gronnToBlaMover = gronnRoster[0]!; // DEVELOPMENT, via an active Grønn -> Blå rotation path.

  const rodMatch = {
    ...matchOf(ROD, "Asker SK", "w2-c06-rod", 12),
    players: rodRoster.slice(0, 12).map((p) => toAssigned(p)),
  };
  const hvitMatch = {
    ...matchOf(HVIT, "Nittedal IL", "w2-c06-hvit", 12),
    players: [...hvitRoster.slice(0, 11).map((p) => toAssigned(p)), toAssigned(rodToHvitMover, "SUPPORT")],
  };
  const blaMatch = {
    ...matchOf(BLA, "Lillestrøm 2", "w2-c06-bla", 11),
    players: [...blaRoster.slice(0, 10).map((p) => toAssigned(p)), toAssigned(gronnToBlaMover, "DEVELOPMENT")],
  };
  const gronnMatch = {
    ...matchOf(GRONN, "Fjellhamar IL", "w2-c06-gronn", 11),
    players: gronnRoster.slice(1, 11).map((p) => toAssigned(p)),
  };

  const allPlayers = [...rodRoster, ...hvitRoster, ...blaRoster, ...gronnRoster];

  return {
    roundLabel: "Week 46 — dense round",
    planningBoundaryOpen: true,
    matchRoundId: "w2-c06-round",
    matches: [rodMatch, hvitMatch, blaMatch, gronnMatch],
    availablePlayers: allPlayers.map(toAvailable),
    rotationPathMap: {
      [`${ROD.teamId}:${HVIT.teamId}`]: ["SUPPORT"],
      [`${GRONN.teamId}:${BLA.teamId}`]: ["DEVELOPMENT"],
    },
    warnings: [
      {
        code: "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY",
        message: `${rodGenuinelyUnassigned.name} is available but has no planned match opportunity this round.`,
        severity: WarningSeverity.REQUIRES_OVERRIDE,
        playerId: rodGenuinelyUnassigned.id,
        playerName: rodGenuinelyUnassigned.name,
        teamName: ROD.teamName,
      },
    ],
    signalSummary: { blocked: 0, decisionRequired: 1, planningNote: 0 },
    movementSummary: {
      supportSent: 1,
      supportReceived: 1,
      developmentSent: 1,
      developmentReceived: 1,
      squadRepairReceived: 0,
      drops: 0,
    },
    fairnessMetrics: [
      { label: "Players selected", value: 45 },
      { label: "Matches this round", value: 4 },
      { label: "Cross-team movers", value: 2 },
      { label: "Squad fill rate", value: "98%" },
    ],
    eligiblePlayerIds: allPlayers.map((p) => p.id),
    // The denied-assignment variant below (buildC06WithDeniedAssignmentFixture) adds a
    // deliberately-rejected destination for `hvitDeniedCandidate` — kept out of the primary
    // fixture so the default capture shows the happy path cleanly.
    deniedAssignments: [],
  };
}

/**
 * Same round, plus one deliberately denied destination (C06: "show pending, rejection and
 * conflict outcomes truthfully" — not just that happy-path assignment works).
 */
export function buildC06WithDeniedAssignmentFixture(): RoundBoardFixtureInitial {
  const base = buildC06DenseAllocationFixture();
  const hvitDeniedCandidate = base.availablePlayers.find((p) => p.coreTeamName === HVIT.teamName && !base.matches.some((m) => m.players.some((mp) => mp.id === p.id)))!;
  return {
    ...base,
    deniedAssignments: [
      { playerId: hvitDeniedCandidate.id, matchId: "w2-c06-bla", reason: "Fixture: Blå's squad is already at its accepted cap for a cross-team placement without an override." },
    ],
  };
}
