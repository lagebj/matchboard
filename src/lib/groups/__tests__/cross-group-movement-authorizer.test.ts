import { describe, it, expect } from "vitest";
import {
  isMovementPathAuthorized,
  getEligibleTargetGroups,
  getPlayersEligibleForCrossGroupMovement,
} from "@/lib/groups/cross-group-movement-authorizer";
import type { GroupMovementPathInfo } from "@/lib/groups/group-pool-resolver";

function makePath(overrides: Partial<GroupMovementPathInfo> = {}): GroupMovementPathInfo {
  return {
    id: "path-1",
    fromGroupId: "group-a",
    toGroupId: "group-b",
    fromGroupName: "Group A",
    toGroupName: "Group B",
    role: "SUPPORT" as const,
    scope: "MATCH" as const,
    isActive: true,
    ...overrides,
  };
}

describe("isMovementPathAuthorized", () => {
  it("authorizes movement when a compatible path exists", () => {
    const paths = [makePath()];
    const result = isMovementPathAuthorized(paths, "group-a", "group-b", "SUPPORT");
    expect(result.authorized).toBe(true);
  });

  it("authorizes SUPPORT via BACKFILL path", () => {
    const paths = [makePath({ role: "BACKFILL" })];
    const result = isMovementPathAuthorized(paths, "group-a", "group-b", "SUPPORT");
    expect(result.authorized).toBe(true);
  });

  it("authorizes DEVELOPMENT via CONFIDENCE_REBUILD path", () => {
    const paths = [makePath({ role: "CONFIDENCE_REBUILD" })];
    const result = isMovementPathAuthorized(paths, "group-a", "group-b", "DEVELOPMENT");
    expect(result.authorized).toBe(true);
  });

  it("rejects movement when no path exists", () => {
    const paths = [makePath()];
    const result = isMovementPathAuthorized(paths, "group-a", "group-c", "SUPPORT");
    expect(result.authorized).toBe(false);
  });

  it("rejects movement when path role does not match", () => {
    const paths = [makePath({ role: "DEVELOPMENT" })];
    const result = isMovementPathAuthorized(paths, "group-a", "group-b", "SUPPORT");
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.explanation).toContain("SUPPORT");
    }
  });

  it("rejects movement for inactive path", () => {
    const paths = [makePath({ isActive: false })];
    const result = isMovementPathAuthorized(paths, "group-a", "group-b", "SUPPORT");
    expect(result.authorized).toBe(false);
  });

  it("filters by scope when provided", () => {
    const paths = [makePath({ scope: "EVENT" })];
    const result = isMovementPathAuthorized(paths, "group-a", "group-b", "SUPPORT", "MATCH");
    expect(result.authorized).toBe(false);
  });

  it("allows matching scope", () => {
    const paths = [makePath({ scope: "MATCH" })];
    const result = isMovementPathAuthorized(paths, "group-a", "group-b", "SUPPORT", "MATCH");
    expect(result.authorized).toBe(true);
  });
});

describe("getEligibleTargetGroups", () => {
  it("returns target group IDs for active paths from source group", () => {
    const paths = [
      makePath({ fromGroupId: "group-a", toGroupId: "group-b" }),
      makePath({ fromGroupId: "group-a", toGroupId: "group-c", role: "DEVELOPMENT" }),
      makePath({ fromGroupId: "group-b", toGroupId: "group-a" }),
    ];
    const result = getEligibleTargetGroups(paths, "group-a");
    expect(result).toContain("group-b");
    expect(result).toContain("group-c");
    expect(result).toHaveLength(2);
  });

  it("filters by role when provided", () => {
    const paths = [
      makePath({ fromGroupId: "group-a", toGroupId: "group-b", role: "SUPPORT" }),
      makePath({ fromGroupId: "group-a", toGroupId: "group-c", role: "DEVELOPMENT" }),
    ];
    const result = getEligibleTargetGroups(paths, "group-a", "SUPPORT");
    expect(result).toEqual(["group-b"]);
  });

  it("returns empty array for group with no paths", () => {
    const paths = [makePath()];
    const result = getEligibleTargetGroups(paths, "group-z");
    expect(result).toEqual([]);
  });
});

describe("getPlayersEligibleForCrossGroupMovement", () => {
  const paths = [makePath()];

  it("rejects non-rotatable players", () => {
    const players = [
      { playerId: "p1", nonRotatable: true, coreTeamId: "t1", footballGroupId: "group-a" },
    ];
    const result = getPlayersEligibleForCrossGroupMovement(players, paths, "group-b", "SUPPORT");
    expect(result[0].authorized).toBe(false);
    expect(result[0].explanation).toContain("non-rotatable");
  });

  it("authorizes players in the target group (core)", () => {
    const players = [
      { playerId: "p1", nonRotatable: false, coreTeamId: "t1", footballGroupId: "group-b" },
    ];
    const result = getPlayersEligibleForCrossGroupMovement(players, paths, "group-b", "SUPPORT");
    expect(result[0].authorized).toBe(true);
  });

  it("authorizes players from source group with matching path", () => {
    const players = [
      { playerId: "p1", nonRotatable: false, coreTeamId: "t1", footballGroupId: "group-a" },
    ];
    const result = getPlayersEligibleForCrossGroupMovement(players, paths, "group-b", "SUPPORT");
    expect(result[0].authorized).toBe(true);
  });

  it("rejects players from group with no path to target", () => {
    const players = [
      { playerId: "p1", nonRotatable: false, coreTeamId: "t1", footballGroupId: "group-z" },
    ];
    const result = getPlayersEligibleForCrossGroupMovement(players, paths, "group-b", "SUPPORT");
    expect(result[0].authorized).toBe(false);
  });
});