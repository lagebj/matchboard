import { describe, it, expect } from "vitest";
import {
  isValidOrganisationRole,
  requireValidOrganisationRole,
  canInviteRole,
  canManageRole,
  canCreateTeam,
  canManageMemberships,
  canDeleteOrganisation,
  canTransferOwnership,
  canAccessAllTeams,
} from "../organisation-domain";

describe("organisation-domain", () => {
  describe("isValidOrganisationRole", () => {
    it("returns true for OWNER", () => {
      expect(isValidOrganisationRole("OWNER")).toBe(true);
    });

    it("returns true for ADMIN", () => {
      expect(isValidOrganisationRole("ADMIN")).toBe(true);
    });

    it("returns true for COACH", () => {
      expect(isValidOrganisationRole("COACH")).toBe(true);
    });

    it("returns true for VIEWER", () => {
      expect(isValidOrganisationRole("VIEWER")).toBe(true);
    });

    it("returns false for invalid role", () => {
      expect(isValidOrganisationRole("SUPERADMIN")).toBe(false);
    });
  });

  describe("requireValidOrganisationRole", () => {
    it("returns role for valid input", () => {
      expect(requireValidOrganisationRole("OWNER")).toBe("OWNER");
    });

    it("throws for invalid input", () => {
      expect(() => requireValidOrganisationRole("INVALID")).toThrow("Invalid organisation role: INVALID");
    });
  });

  describe("canInviteRole", () => {
    it("OWNER can invite any role", () => {
      expect(canInviteRole("OWNER", "OWNER")).toBe(true);
      expect(canInviteRole("OWNER", "ADMIN")).toBe(true);
      expect(canInviteRole("OWNER", "COACH")).toBe(true);
      expect(canInviteRole("OWNER", "VIEWER")).toBe(true);
    });

    it("ADMIN can invite COACH and VIEWER", () => {
      expect(canInviteRole("ADMIN", "COACH")).toBe(true);
      expect(canInviteRole("ADMIN", "VIEWER")).toBe(true);
    });

    it("ADMIN cannot invite OWNER or ADMIN", () => {
      expect(canInviteRole("ADMIN", "OWNER")).toBe(false);
      expect(canInviteRole("ADMIN", "ADMIN")).toBe(false);
    });

    it("COACH cannot invite anyone", () => {
      expect(canInviteRole("COACH", "COACH")).toBe(false);
      expect(canInviteRole("COACH", "VIEWER")).toBe(false);
    });

    it("VIEWER cannot invite anyone", () => {
      expect(canInviteRole("VIEWER", "COACH")).toBe(false);
    });
  });

  describe("canManageRole", () => {
    it("OWNER can manage any role", () => {
      expect(canManageRole("OWNER", "ADMIN")).toBe(true);
      expect(canManageRole("OWNER", "COACH")).toBe(true);
    });

    it("ADMIN cannot manage OWNER or ADMIN", () => {
      expect(canManageRole("ADMIN", "OWNER")).toBe(false);
      expect(canManageRole("ADMIN", "ADMIN")).toBe(false);
    });

    it("ADMIN can manage COACH and VIEWER", () => {
      expect(canManageRole("ADMIN", "COACH")).toBe(true);
      expect(canManageRole("ADMIN", "VIEWER")).toBe(true);
    });

    it("COACH cannot manage any role", () => {
      expect(canManageRole("COACH", "VIEWER")).toBe(false);
    });
  });

  describe("canCreateTeam", () => {
    it("OWNER can create teams", () => {
      expect(canCreateTeam("OWNER")).toBe(true);
    });

    it("ADMIN can create teams", () => {
      expect(canCreateTeam("ADMIN")).toBe(true);
    });

    it("COACH cannot create teams", () => {
      expect(canCreateTeam("COACH")).toBe(false);
    });

    it("VIEWER cannot create teams", () => {
      expect(canCreateTeam("VIEWER")).toBe(false);
    });
  });

  describe("canManageMemberships", () => {
    it("OWNER can manage memberships", () => {
      expect(canManageMemberships("OWNER")).toBe(true);
    });

    it("ADMIN can manage memberships", () => {
      expect(canManageMemberships("ADMIN")).toBe(true);
    });

    it("COACH cannot manage memberships", () => {
      expect(canManageMemberships("COACH")).toBe(false);
    });
  });

  describe("canDeleteOrganisation", () => {
    it("only OWNER can delete organisation", () => {
      expect(canDeleteOrganisation("OWNER")).toBe(true);
      expect(canDeleteOrganisation("ADMIN")).toBe(false);
      expect(canDeleteOrganisation("COACH")).toBe(false);
      expect(canDeleteOrganisation("VIEWER")).toBe(false);
    });
  });

  describe("canTransferOwnership", () => {
    it("only OWNER can transfer ownership", () => {
      expect(canTransferOwnership("OWNER")).toBe(true);
      expect(canTransferOwnership("ADMIN")).toBe(false);
    });
  });

  describe("canAccessAllTeams", () => {
    it("OWNER and ADMIN can access all teams", () => {
      expect(canAccessAllTeams("OWNER")).toBe(true);
      expect(canAccessAllTeams("ADMIN")).toBe(true);
    });

    it("COACH and VIEWER cannot access all teams", () => {
      expect(canAccessAllTeams("COACH")).toBe(false);
      expect(canAccessAllTeams("VIEWER")).toBe(false);
    });
  });
});