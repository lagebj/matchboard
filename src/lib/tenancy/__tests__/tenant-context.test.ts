import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/organisations/organisation-resolver", () => ({
  resolveOrganisationAccess: vi.fn(),
}));

import { requireOrganisationId, organisationFilter, organisationFilterNullable } from "../tenant-context";

describe("tenant-context", () => {
  describe("requireOrganisationId", () => {
    it("returns the organisation ID from context", () => {
      const ctx = {
        userId: "user-1",
        userEmail: "test@example.com",
        organisationId: "org-1",
        organisationSlug: "test-org",
        organisationName: "Test Org",
        role: "OWNER" as const,
        membershipId: "mem-1",
        permittedTeamIds: [],
        accessibleGroupIds: [],
        groupAccesses: [],
        canAccessAllTeams: true,
        canCreateTeam: true,
        canManageMemberships: true,
        canInviteRole: () => true,
        canManageRole: () => true,
        canDeleteOrganisation: true,
        canTransferOwnership: false,
      };
      expect(requireOrganisationId(ctx)).toBe("org-1");
    });
  });

  describe("organisationFilter", () => {
    it("returns a Prisma filter object for non-nullable organisationId", () => {
      expect(organisationFilter("org-1")).toEqual({ organisationId: "org-1" });
    });
  });

  describe("organisationFilterNullable", () => {
    it("returns a Prisma filter object for nullable organisationId", () => {
      expect(organisationFilterNullable("org-1")).toEqual({ organisationId: "org-1" });
    });
  });
});