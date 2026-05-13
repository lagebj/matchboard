import { describe, it, expect } from "vitest";
import {
  canMoveForRole,
  filterPathsForRole,
  getSourceTeamIdsForRole,
  getValidPathForRole,
  explainInvalidMovementPath,
  type RotationPathEdge,
} from "@/lib/selection/rotation-path-policy";

describe("rotation-path-policy", () => {
  const teamA = "team-a";
  const teamB = "team-b";
  const teamC = "team-c";

  const activePaths: RotationPathEdge[] = [
    { fromTeamId: teamA, toTeamId: teamB, role: "SUPPORT", active: true },
    { fromTeamId: teamB, toTeamId: teamC, role: "DEVELOPMENT", active: true },
    { fromTeamId: teamC, toTeamId: teamB, role: "BACKFILL", active: true },
    { fromTeamId: teamA, toTeamId: teamC, role: "DEVELOPMENT", active: true },
  ];

  describe("getValidPathForRole", () => {
    it("returns the path when an active SUPPORT path exists from team A to team B", () => {
      const path = getValidPathForRole(activePaths, teamA, teamB, "SUPPORT");
      expect(path).not.toBeNull();
      expect(path!.role).toBe("SUPPORT");
      expect(path!.fromTeamId).toBe(teamA);
      expect(path!.toTeamId).toBe(teamB);
    });

    it("returns null when no SUPPORT path exists from team B to team A", () => {
      const path = getValidPathForRole(activePaths, teamB, teamA, "SUPPORT");
      expect(path).toBeNull();
    });

    it("returns null when DEVELOPMENT path is queried for a SUPPORT-only path", () => {
      const path = getValidPathForRole(activePaths, teamA, teamB, "DEVELOPMENT");
      expect(path).toBeNull();
    });

    it("returns null for inactive paths", () => {
      const inactivePaths: RotationPathEdge[] = [
        { fromTeamId: teamA, toTeamId: teamB, role: "SUPPORT", active: false },
      ];
      const path = getValidPathForRole(inactivePaths, teamA, teamB, "SUPPORT");
      expect(path).toBeNull();
    });

    it("treats paths as directional — reverse direction requires separate path", () => {
      const path = getValidPathForRole(activePaths, teamB, teamA, "SUPPORT");
      expect(path).toBeNull();
    });
  });

  describe("canMoveForRole", () => {
    it("allows SUPPORT movement when SUPPORT path exists", () => {
      const result = canMoveForRole(teamA, teamB, "SUPPORT", false, activePaths);
      expect(result.valid).toBe(true);
    });

    it("blocks SUPPORT movement when only DEVELOPMENT path exists", () => {
      const result = canMoveForRole(teamA, teamC, "SUPPORT", false, activePaths);
      expect(result.valid).toBe(false);
      expect(result.explanation).toContain("SUPPORT");
    });

    it("blocks DEVELOPMENT movement when only SUPPORT path exists", () => {
      const result = canMoveForRole(teamA, teamB, "DEVELOPMENT", false, activePaths);
      expect(result.valid).toBe(false);
      expect(result.explanation).toContain("DEVELOPMENT");
    });

    it("blocks BACKFILL movement when only DEVELOPMENT path exists", () => {
      const result = canMoveForRole(teamB, teamC, "BACKFILL", false, activePaths);
      expect(result.valid).toBe(false);
    });

    it("blocks non-rotatable player from any non-core movement", () => {
      const result = canMoveForRole(teamA, teamB, "SUPPORT", true, activePaths);
      expect(result.valid).toBe(false);
      expect(result.explanation).toContain("non-rotatable");
    });

    it("blocks movement when core team equals target team", () => {
      const result = canMoveForRole(teamA, teamA, "SUPPORT", false, activePaths);
      expect(result.valid).toBe(false);
    });

    it("blocks movement when no path exists at all", () => {
      const result = canMoveForRole(teamC, teamA, "SUPPORT", false, activePaths);
      expect(result.valid).toBe(false);
      expect(result.explanation).toContain("SUPPORT");
    });
  });

  describe("filterPathsForRole", () => {
    it("filters to only SUPPORT paths (includes BACKFILL paths that authorize SUPPORT)", () => {
      const paths = filterPathsForRole(activePaths, "SUPPORT");
      // activePaths has: A→B SUPPORT and C→B BACKFILL
      expect(paths).toHaveLength(2);
      expect(paths.some((p) => p.role === "SUPPORT")).toBe(true);
      expect(paths.some((p) => p.role === "BACKFILL")).toBe(true);
    });

    it("filters to only DEVELOPMENT paths", () => {
      const paths = filterPathsForRole(activePaths, "DEVELOPMENT");
      expect(paths).toHaveLength(2);
    });

    it("excludes inactive paths", () => {
      const mixedPaths: RotationPathEdge[] = [
        { fromTeamId: teamA, toTeamId: teamB, role: "SUPPORT", active: true },
        { fromTeamId: teamB, toTeamId: teamA, role: "BACKFILL", active: false },
      ];
      const paths = filterPathsForRole(mixedPaths, "BACKFILL");
      expect(paths).toHaveLength(0);
    });
  });

  describe("getSourceTeamIdsForRole", () => {
    it("returns source team IDs for SUPPORT paths to team B (includes BACKFILL paths)", () => {
      const ids = getSourceTeamIdsForRole(activePaths, teamB, "SUPPORT");
      // A→B SUPPORT and C→B BACKFILL both authorize SUPPORT movement
      expect(ids).toContain(teamA);
      expect(ids).toContain(teamC);
    });

    it("returns source team IDs for DEVELOPMENT paths to team C", () => {
      const ids = getSourceTeamIdsForRole(activePaths, teamC, "DEVELOPMENT");
      expect(ids).toContain(teamA);
      expect(ids).toContain(teamB);
    });

    it("returns empty array when no paths match", () => {
      const ids = getSourceTeamIdsForRole(activePaths, teamA, "BACKFILL");
      expect(ids).toEqual([]);
    });
  });

  describe("additional role and direction enforcement", () => {
    it("support requires exact support path", () => {
      const pathsWithOnlyBToCSupport: RotationPathEdge[] = [
        { fromTeamId: teamB, toTeamId: teamC, role: "SUPPORT", active: true },
      ];

      const fromA = canMoveForRole(teamA, teamC, "SUPPORT", false, pathsWithOnlyBToCSupport);
      expect(fromA.valid).toBe(false);

      const fromB = canMoveForRole(teamB, teamC, "SUPPORT", false, pathsWithOnlyBToCSupport);
      expect(fromB.valid).toBe(true);
    });

    it("development path does not permit support", () => {
      const devPathOnly: RotationPathEdge[] = [
        { fromTeamId: teamA, toTeamId: teamC, role: "DEVELOPMENT", active: true },
      ];
      const result = canMoveForRole(teamA, teamC, "SUPPORT", false, devPathOnly);
      expect(result.valid).toBe(false);
    });

    it("BACKFILL path permits SUPPORT movement (squad repair uses SUPPORT role)", () => {
      const backfillPathOnly: RotationPathEdge[] = [
        { fromTeamId: teamA, toTeamId: teamC, role: "BACKFILL", active: true },
      ];
      const result = canMoveForRole(teamA, teamC, "SUPPORT", false, backfillPathOnly);
      expect(result.valid).toBe(true);
    });

    it("support path does not permit development", () => {
      const supportPathOnly: RotationPathEdge[] = [
        { fromTeamId: teamA, toTeamId: teamC, role: "SUPPORT", active: true },
      ];
      const result = canMoveForRole(teamA, teamC, "DEVELOPMENT", false, supportPathOnly);
      expect(result.valid).toBe(false);
    });

    it("path direction matters — reverse direction requires separate path", () => {
      const singleDirectionPaths: RotationPathEdge[] = [
        { fromTeamId: teamB, toTeamId: teamC, role: "SUPPORT", active: true },
      ];

      const reversePath = getValidPathForRole(singleDirectionPaths, teamC, teamB, "SUPPORT");
      expect(reversePath).toBeNull();

      const forwardPath = getValidPathForRole(singleDirectionPaths, teamB, teamC, "SUPPORT");
      expect(forwardPath).not.toBeNull();

      const reverseResult = canMoveForRole(teamC, teamB, "SUPPORT", false, singleDirectionPaths);
      expect(reverseResult.valid).toBe(false);
    });

    it("fairness cannot override path validity: DEVELOPMENT path does not permit SUPPORT", () => {
      const devPathOnly: RotationPathEdge[] = [
        { fromTeamId: teamA, toTeamId: teamC, role: "DEVELOPMENT", active: true },
      ];

      const result = canMoveForRole(teamA, teamC, "SUPPORT", false, devPathOnly);
      expect(result.valid).toBe(false);
      expect(result.explanation).toContain("SUPPORT");
    });

    it("no invalid fallback support: DEVELOPMENT does not permit SUPPORT", () => {
      const noSupportPaths: RotationPathEdge[] = [
        { fromTeamId: teamA, toTeamId: teamC, role: "DEVELOPMENT", active: true },
      ];

      const checkA = canMoveForRole(teamA, teamC, "SUPPORT", false, noSupportPaths);
      expect(checkA.valid).toBe(false);

      const checkC = canMoveForRole(teamC, teamA, "SUPPORT", false, noSupportPaths);
      expect(checkC.valid).toBe(false);
    });

    it("BACKFILL path permits SUPPORT (squad repair uses SUPPORT)", () => {
      const backfillPaths: RotationPathEdge[] = [
        { fromTeamId: teamA, toTeamId: teamC, role: "BACKFILL", active: true },
        { fromTeamId: teamB, toTeamId: teamC, role: "BACKFILL", active: true },
      ];

      const checkA = canMoveForRole(teamA, teamC, "SUPPORT", false, backfillPaths);
      expect(checkA.valid).toBe(true);

      const checkB = canMoveForRole(teamB, teamC, "SUPPORT", false, backfillPaths);
      expect(checkB.valid).toBe(true);
    });

    it("non-rotatable blocks automatic support", () => {
      const validSupportPath: RotationPathEdge[] = [
        { fromTeamId: teamA, toTeamId: teamB, role: "SUPPORT", active: true },
      ];
      const result = canMoveForRole(teamA, teamB, "SUPPORT", true, validSupportPath);
      expect(result.valid).toBe(false);
      expect(result.explanation.toLowerCase()).toContain("non-rotatable");
    });
  });

  describe("explainInvalidMovementPath", () => {
    it("explains when a path exists for a different role", () => {
      const explanation = explainInvalidMovementPath(
        "Team A",
        "Team B",
        "DEVELOPMENT",
        activePaths,
        teamA,
        teamB,
      );
      expect(explanation).toContain("SUPPORT");
      expect(explanation).toContain("DEVELOPMENT");
    });

    it("explains when no path exists at all", () => {
      const explanation = explainInvalidMovementPath(
        "Team C",
        "Team A",
        "SUPPORT",
        activePaths,
        teamC,
        teamA,
      );
      expect(explanation).toContain("No rotation path");
    });
  });
});