import { describe, it, expect } from "vitest";
import { requireRole, requireTeamAccess } from "../organisation-access";

describe("organisation-access", () => {
  const baseCtx = {
    userId: "user1",
    userEmail: "coach@example.com",
    organisationId: "org1",
    organisationSlug: "test-club",
    organisationName: "Test Club",
    membershipId: "mem1",
    permittedTeamIds: ["team1", "team2"],
    canAccessAllTeams: false,
    canCreateTeam: false,
    canManageMemberships: false,
    canInviteRole: () => false,
    canManageRole: () => false,
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

  describe("requireTeamAccess", () => {
    it("passes when user has canAccessAllTeams", () => {
      const adminCtx = { ...baseCtx, role: "ADMIN" as const, canAccessAllTeams: true };
      expect(() => requireTeamAccess(adminCtx, "any-team-id")).not.toThrow();
    });

    it("passes when team is in permittedTeamIds", () => {
      const coachCtx = { ...baseCtx, role: "COACH" as const };
      expect(() => requireTeamAccess(coachCtx, "team1")).not.toThrow();
    });

    it("throws when team is not in permittedTeamIds", () => {
      const coachCtx = { ...baseCtx, role: "COACH" as const };
      expect(() => requireTeamAccess(coachCtx, "team3")).toThrow("You do not have access to this team");
    });
  });
});