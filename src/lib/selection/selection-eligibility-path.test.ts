import { describe, it, expect } from "vitest";
import { getPathBasedCategory } from "@/lib/selection/selection-eligibility";
import type { MatchRecord, PathDestination, PlayerRecord } from "@/lib/selection/selection-types";

const teamA = "team-a";
const teamB = "team-b";

function makePlayer(paths: PathDestination[], coreTeamId = teamA): PlayerRecord {
  return {
    coreTeamId,
    coreTeam: { id: coreTeamId, name: `Team ${coreTeamId}` },
    rotationPathsFromCoreTeam: paths,
    nonRotatable: false,
    supportSuitability: "neutral",
    developmentReadiness: "ready",
  } as PlayerRecord;
}

function makeMatch(teamId: string, developmentSlots = 2): MatchRecord {
  return {
    id: "match-1",
    startsAt: new Date(),
    teamId,
    developmentSlots,
    developmentSourceTeamIds: [],
    supportSourceTeamIds: [],
    supportSourceTeamNames: [],
    team: {
      id: teamId,
      name: `Team ${teamId}`,
      developmentSlots,
      maxSquadSize: 14,
      maxSupportCount: 5,
      minCorePlayers: 5,
      minSupportPlayers: 2,
      targetSupportCount: 3,
      supportPriority: 1,
    },
  } as MatchRecord;
}

describe("getPathBasedCategory role-specificity", () => {
  it("returns SUPPORT when SUPPORT path exists to target team", () => {
    const player = makePlayer([
      { fromTeamId: teamA, toTeamId: teamB, role: "SUPPORT", cooldownRounds: null },
    ]);
    const match = makeMatch(teamB);
    expect(getPathBasedCategory(player, match)).toBe("SUPPORT");
  });

  it("returns DEVELOPMENT when DEVELOPMENT path exists and team has development slots", () => {
    const player = makePlayer([
      { fromTeamId: teamA, toTeamId: teamB, role: "DEVELOPMENT", cooldownRounds: null },
    ]);
    const match = makeMatch(teamB, 2);
    expect(getPathBasedCategory(player, match)).toBe("DEVELOPMENT");
  });

  it("returns null when no path exists to target team", () => {
    const player = makePlayer([]);
    const match = makeMatch("team-c");
    expect(getPathBasedCategory(player, match)).toBeNull();
  });

  it("does not fall through to other roles — SUPPORT path does not enable DEVELOPMENT", () => {
    const player = makePlayer([
      { fromTeamId: teamA, toTeamId: teamB, role: "SUPPORT", cooldownRounds: null },
    ]);
    const match = makeMatch(teamB, 0);
    expect(getPathBasedCategory(player, match)).toBe("SUPPORT");
  });

  it("returns BACKFILL when BACKFILL path exists", () => {
    const player = makePlayer([
      { fromTeamId: teamA, toTeamId: teamB, role: "BACKFILL", cooldownRounds: null },
    ]);
    const match = makeMatch(teamB, 0);
    expect(getPathBasedCategory(player, match)).toBe("BACKFILL");
  });

  it("prioritizes SUPPORT over DEVELOPMENT when both paths exist", () => {
    const player = makePlayer([
      { fromTeamId: teamA, toTeamId: teamB, role: "SUPPORT", cooldownRounds: null },
      { fromTeamId: teamA, toTeamId: teamB, role: "DEVELOPMENT", cooldownRounds: null },
    ]);
    const match = makeMatch(teamB);
    expect(getPathBasedCategory(player, match)).toBe("SUPPORT");
  });

  it("returns CONFIDENCE_REBUILD when CONFIDENCE_REBUILD path exists", () => {
    const player = makePlayer([
      { fromTeamId: teamA, toTeamId: teamB, role: "CONFIDENCE_REBUILD", cooldownRounds: null },
    ]);
    const match = makeMatch(teamB, 0);
    expect(getPathBasedCategory(player, match)).toBe("CONFIDENCE_REBUILD");
  });

  it("returns null when DEVELOPMENT path exists but team has zero development slots", () => {
    const player = makePlayer([
      { fromTeamId: teamA, toTeamId: teamB, role: "DEVELOPMENT", cooldownRounds: null },
    ]);
    const match = makeMatch(teamB, 0);
    expect(getPathBasedCategory(player, match)).toBeNull();
  });
});