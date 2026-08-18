import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    team: {
      findFirst: vi.fn(),
    },
  },
}));

import { requireRole, requireTeamGroupAccess } from "../organisation-access";
import { db } from "@/lib/db";

describe("organisation-access", () => {
  const baseCtx = {
    userId: "user1",
    userEmail: "coach@example.com",
    organisationId: "org1",
    organisationSlug: "test-club",
    organisationName: "Test Club",
    membershipId: "mem1",
    accessibleGroupIds: ["group1", "group2"],
    groupAccesses: [],
    canAccessAllGroups: false,
    canCreateTeam: false,
    canManageMemberships: false,
    canInviteRole: () => false as const,
    canManageRole: () => false as const,
    canDeleteOrganisation: false,
    canTransferOwnership: false,
  };

  describe("requireRole", () => {
    it("passes when role is in allowed list", () => {
      const coachCtx = { ...baseCtx, role: "COACH" as const };
      expect(() => requireRole(coachCtx, "COACH", "VIEWER")).not.toThrow();
    });

    it("throws when role is not in allowed list", () => {
      const coachCtx = { ...baseCtx, role: "COACH" as const };
      expect(() => requireRole(coachCtx, "OWNER", "ADMIN")).toThrow("Role COACH is not authorised");
    });

    it("passes for OWNER when OWNER is allowed", () => {
      const ownerCtx = { ...baseCtx, role: "OWNER" as const };
      expect(() => requireRole(ownerCtx, "OWNER")).not.toThrow();
    });

    it("passes for ADMIN when ADMIN is allowed", () => {
      const adminCtx = { ...baseCtx, role: "ADMIN" as const };
      expect(() => requireRole(adminCtx, "OWNER", "ADMIN")).not.toThrow();
    });

    it("throws for VIEWER when only COACH is allowed", () => {
      const viewerCtx = { ...baseCtx, role: "VIEWER" as const };
      expect(() => requireRole(viewerCtx, "COACH")).toThrow("Role VIEWER is not authorised");
    });
  });

  describe("requireTeamGroupAccess", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("passes when user has canAccessAllGroups", async () => {
      const adminCtx = { ...baseCtx, role: "ADMIN" as const, canAccessAllGroups: true };
      await expect(requireTeamGroupAccess(adminCtx, "any-team-id")).resolves.toBeUndefined();
    });

    it("passes when team's group is in accessibleGroupIds", async () => {
      (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "team1",
        footballGroupId: "group1",
      });
      const coachCtx = { ...baseCtx, role: "COACH" as const };
      await expect(requireTeamGroupAccess(coachCtx, "team1")).resolves.toBeUndefined();
    });

    it("throws when team's group is not in accessibleGroupIds", async () => {
      (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
        id: "team3",
        footballGroupId: "group3",
      });
      const coachCtx = { ...baseCtx, role: "COACH" as const };
      await expect(requireTeamGroupAccess(coachCtx, "team3")).rejects.toThrow("You do not have access to this team");
    });

    it("throws when team not found", async () => {
      (db.team.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);
      const coachCtx = { ...baseCtx, role: "COACH" as const };
      await expect(requireTeamGroupAccess(coachCtx, "team-missing")).rejects.toThrow("You do not have access to this team");
    });
  });
});