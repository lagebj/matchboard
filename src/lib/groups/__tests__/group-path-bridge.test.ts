import { describe, it, expect } from "vitest";
import { groupPathsToRotationEdges, isGroupMovementPathAuthorized } from "@/lib/groups/group-path-bridge";
import type { GroupMovementPathInfo } from "@/lib/groups/group-pool-resolver";

function makePathInfo(overrides: Partial<GroupMovementPathInfo> = {}): GroupMovementPathInfo {
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

describe("groupPathsToRotationEdges", () => {
  it("expands group paths to team-level rotation edges", () => {
    const groupPaths = [makePathInfo()];
    const teamGroupMap = new Map<string, string>([
      ["team-1", "group-a"],
      ["team-2", "group-b"],
    ]);

    const edges = groupPathsToRotationEdges(groupPaths, teamGroupMap);

    expect(edges).toContainEqual({
      fromTeamId: "team-1",
      toTeamId: "team-2",
      role: "SUPPORT",
      active: true,
    });
  });

  it("expands BACKFILL group path to BACKFILL selection edge", () => {
    const groupPaths = [makePathInfo({ role: "BACKFILL" as const })];
    const teamGroupMap = new Map<string, string>([
      ["team-1", "group-a"],
      ["team-2", "group-b"],
    ]);

    const edges = groupPathsToRotationEdges(groupPaths, teamGroupMap);

    expect(edges).toContainEqual({
      fromTeamId: "team-1",
      toTeamId: "team-2",
      role: "BACKFILL",
      active: true,
    });
    expect(edges).toHaveLength(1);
  });

  it("expands CONFIDENCE_REBUILD group path to CONFIDENCE_REBUILD selection edge", () => {
    const groupPaths = [makePathInfo({ role: "CONFIDENCE_REBUILD" as const })];
    const teamGroupMap = new Map<string, string>([
      ["team-1", "group-a"],
      ["team-2", "group-b"],
    ]);

    const edges = groupPathsToRotationEdges(groupPaths, teamGroupMap);

    expect(edges).toContainEqual({
      fromTeamId: "team-1",
      toTeamId: "team-2",
      role: "CONFIDENCE_REBUILD",
      active: true,
    });
    expect(edges).toHaveLength(1);
  });

  it("handles multiple teams per group", () => {
    const groupPaths = [makePathInfo()];
    const teamGroupMap = new Map<string, string>([
      ["team-a1", "group-a"],
      ["team-a2", "group-a"],
      ["team-b1", "group-b"],
    ]);

    const edges = groupPathsToRotationEdges(groupPaths, teamGroupMap);

    expect(edges).toHaveLength(2);
    expect(edges.every((e) => e.role === "SUPPORT")).toBe(true);
    expect(edges.some((e) => e.fromTeamId === "team-a1")).toBe(true);
    expect(edges.some((e) => e.fromTeamId === "team-a2")).toBe(true);
    expect(edges.every((e) => e.toTeamId === "team-b1")).toBe(true);
  });

  it("returns empty edges when team group map has no matching groups", () => {
    const groupPaths = [makePathInfo()];
    const teamGroupMap = new Map<string, string>([
      ["team-x", "group-x"],
    ]);

    const edges = groupPathsToRotationEdges(groupPaths, teamGroupMap);

    expect(edges).toEqual([]);
  });

  it("expands DEVELOPMENT group path to DEVELOPMENT selection edge only", () => {
    const groupPaths = [makePathInfo({ role: "DEVELOPMENT" as const })];
    const teamGroupMap = new Map<string, string>([
      ["team-1", "group-a"],
      ["team-2", "group-b"],
    ]);

    const edges = groupPathsToRotationEdges(groupPaths, teamGroupMap);

    expect(edges).toContainEqual({
      fromTeamId: "team-1",
      toTeamId: "team-2",
      role: "DEVELOPMENT",
      active: true,
    });
    expect(edges).toHaveLength(1);
  });
});

describe("isGroupMovementPathAuthorized", () => {
  it("authorizes SUPPORT via SUPPORT group path", () => {
    const paths = [makePathInfo({ role: "SUPPORT" })];
    expect(isGroupMovementPathAuthorized(paths, "group-a", "group-b", "SUPPORT")).toBe(true);
  });

  it("authorizes SUPPORT via BACKFILL group path", () => {
    const paths = [makePathInfo({ role: "BACKFILL" })];
    expect(isGroupMovementPathAuthorized(paths, "group-a", "group-b", "SUPPORT")).toBe(true);
  });

  it("authorizes DEVELOPMENT via DEVELOPMENT group path", () => {
    const paths = [makePathInfo({ role: "DEVELOPMENT" })];
    expect(isGroupMovementPathAuthorized(paths, "group-a", "group-b", "DEVELOPMENT")).toBe(true);
  });

  it("authorizes DEVELOPMENT via CONFIDENCE_REBUILD group path", () => {
    const paths = [makePathInfo({ role: "CONFIDENCE_REBUILD" })];
    expect(isGroupMovementPathAuthorized(paths, "group-a", "group-b", "DEVELOPMENT")).toBe(true);
  });

  it("rejects DEVELOPMENT via SUPPORT group path", () => {
    const paths = [makePathInfo({ role: "SUPPORT" })];
    expect(isGroupMovementPathAuthorized(paths, "group-a", "group-b", "DEVELOPMENT")).toBe(false);
  });

  it("rejects when no path exists between groups", () => {
    const paths = [makePathInfo()];
    expect(isGroupMovementPathAuthorized(paths, "group-x", "group-b", "SUPPORT")).toBe(false);
  });

  it("rejects inactive paths", () => {
    const paths = [makePathInfo({ isActive: false })];
    expect(isGroupMovementPathAuthorized(paths, "group-a", "group-b", "SUPPORT")).toBe(false);
  });
});