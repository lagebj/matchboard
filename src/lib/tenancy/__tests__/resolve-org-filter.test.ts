import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  AuthorizationError: class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthorizationError";
    }
  },
  requireCoachAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

import { resolveOrgFilterForUser, orgFilterFromContext, MultipleMembershipsError } from "@/lib/tenancy/resolve-org-filter";
import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
import { AuthorizationError } from "@/lib/auth";

describe("resolveOrgFilterForUser", () => {
  it("throws AuthorizationError when user has no organisation membership", async () => {
    const mockClient = {
      organisationMembership: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    } as any;

    await expect(resolveOrgFilterForUser("nonexistent-user", mockClient)).rejects.toThrow(AuthorizationError);
    await expect(resolveOrgFilterForUser("nonexistent-user", mockClient)).rejects.toThrow("No active organisation membership");
  });

  it("returns org-scoped filter when user has one organisation membership", async () => {
    const orgId = "org-single-123";
    const mockClient = {
      organisationMembership: {
        findMany: vi.fn().mockResolvedValue([
          {
            organisationId: orgId,
            role: "COACH",
            expiresAt: null,
            organisation: { id: orgId, name: "Test Org", slug: "test-org", suspendedAt: null },
          },
        ]),
      },
    } as any;

    const result = await resolveOrgFilterForUser("user-single", mockClient);

    expect(result.type).toBe("org");
    if (result.type === "org") {
      expect(result.filter).toEqual({ organisationId: orgId });
      expect(result.filterNullable).toEqual({ organisationId: orgId });
      expect(result.organisationId).toBe(orgId);
    }
  });

  it("throws MultipleMembershipsError when user belongs to multiple organisations", async () => {
    const org1Id = "org-multi-1";
    const org2Id = "org-multi-2";
    const mockClient = {
      organisationMembership: {
        findMany: vi.fn().mockResolvedValue([
          {
            organisationId: org1Id,
            role: "COACH",
            expiresAt: null,
            organisation: { id: org1Id, name: "Org 1", slug: "org-1", suspendedAt: null },
          },
          {
            organisationId: org2Id,
            role: "VIEWER",
            expiresAt: null,
            organisation: { id: org2Id, name: "Org 2", slug: "org-2", suspendedAt: null },
          },
        ]),
      },
    } as any;

    try {
      await resolveOrgFilterForUser("user-multi", mockClient);
      expect.unreachable("Expected MultipleMembershipsError");
    } catch (error) {
      expect(error).toBeInstanceOf(MultipleMembershipsError);
      if (error instanceof MultipleMembershipsError) {
        expect(error.organisations).toHaveLength(2);
        expect(error.organisations.map((o) => o.id)).toContain(org1Id);
        expect(error.organisations.map((o) => o.id)).toContain(org2Id);
      }
    }
  });

  it("excludes expired SUPPORT memberships", async () => {
    const mockClient = {
      organisationMembership: {
        findMany: vi.fn().mockResolvedValue([
          {
            organisationId: "org-expired",
            role: "SUPPORT",
            expiresAt: new Date("2020-01-01"),
            organisation: { id: "org-expired", name: "Expired Support", slug: "expired", suspendedAt: null },
          },
        ]),
      },
    } as any;

    await expect(resolveOrgFilterForUser("user-expired-support", mockClient)).rejects.toThrow(AuthorizationError);
  });

  it("includes active SUPPORT memberships", async () => {
    const orgId = "org-active-support";
    const mockClient = {
      organisationMembership: {
        findMany: vi.fn().mockResolvedValue([
          {
            organisationId: orgId,
            role: "SUPPORT",
            expiresAt: new Date("2099-12-31"),
            organisation: { id: orgId, name: "Active Support", slug: "active-support", suspendedAt: null },
          },
        ]),
      },
    } as any;

    const result = await resolveOrgFilterForUser("user-active-support", mockClient);

    expect(result.type).toBe("org");
    if (result.type === "org") {
      expect(result.organisationId).toBe(orgId);
    }
  });

  it("excludes memberships in suspended organisations", async () => {
    const mockClient = {
      organisationMembership: {
        findMany: vi.fn().mockResolvedValue([
          {
            organisationId: "org-suspended",
            role: "COACH",
            expiresAt: null,
            organisation: { id: "org-suspended", name: "Suspended", slug: "suspended", suspendedAt: new Date() },
          },
        ]),
      },
    } as any;

    await expect(resolveOrgFilterForUser("user-suspended", mockClient)).rejects.toThrow(AuthorizationError);
  });

  it("resolves to single active membership when other memberships are expired SUPPORT", async () => {
    const org1Id = "org-coach-active";
    const mockClient = {
      organisationMembership: {
        findMany: vi.fn().mockResolvedValue([
          {
            organisationId: org1Id,
            role: "COACH",
            expiresAt: null,
            organisation: { id: org1Id, name: "Active Coach Org", slug: "active-coach", suspendedAt: null },
          },
          {
            organisationId: "org-expired-support",
            role: "SUPPORT",
            expiresAt: new Date("2020-01-01"),
            organisation: { id: "org-expired-support", name: "Expired Support Org", slug: "expired-support", suspendedAt: null },
          },
        ]),
      },
    } as any;

    const result = await resolveOrgFilterForUser("user-mixed", mockClient);

    expect(result.type).toBe("org");
    if (result.type === "org") {
      expect(result.organisationId).toBe(org1Id);
    }
  });

  it("MultipleMembershipsError is catchable as AuthorizationError", () => {
    const error = new MultipleMembershipsError("test", [
      { id: "org-1", name: "Org 1", slug: "org-1", role: "COACH" },
    ]);
    expect(error).toBeInstanceOf(AuthorizationError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("MultipleMembershipsError");
    expect(error.organisations).toHaveLength(1);
  });

  it("throws MultipleMembershipsError when two active memberships exist after filtering expired SUPPORT", async () => {
    const org1Id = "org-active-1";
    const org2Id = "org-active-2";
    const mockClient = {
      organisationMembership: {
        findMany: vi.fn().mockResolvedValue([
          {
            organisationId: org1Id,
            role: "COACH",
            expiresAt: null,
            organisation: { id: org1Id, name: "Active 1", slug: "active-1", suspendedAt: null },
          },
          {
            organisationId: org2Id,
            role: "COACH",
            expiresAt: null,
            organisation: { id: org2Id, name: "Active 2", slug: "active-2", suspendedAt: null },
          },
          {
            organisationId: "org-expired",
            role: "SUPPORT",
            expiresAt: new Date("2020-01-01"),
            organisation: { id: "org-expired", name: "Expired", slug: "expired", suspendedAt: null },
          },
        ]),
      },
    } as any;

    try {
      await resolveOrgFilterForUser("user-two-active", mockClient);
      expect.unreachable("Expected MultipleMembershipsError");
    } catch (error) {
      expect(error).toBeInstanceOf(MultipleMembershipsError);
      if (error instanceof MultipleMembershipsError) {
        expect(error.organisations).toHaveLength(2);
      }
    }
  });
});

describe("orgFilterFromContext", () => {
  const mockCtx: OrganisationAccessContext = {
    userId: "user-1",
    userEmail: "test@example.com",
    organisationId: "org-abc",
    organisationSlug: "test-org",
    organisationName: "Test Org",
    role: "COACH",
    membershipId: "mem-1",
    accessibleGroupIds: [],
    groupAccesses: [],
    canAccessAllTeams: false,
    canCreateTeam: false,
    canManageMemberships: false,
    canInviteRole: () => false,
    canManageRole: () => false,
    canDeleteOrganisation: false,
    canTransferOwnership: false,
  };

  it("returns org-scoped filter from context", () => {
    const result = orgFilterFromContext(mockCtx);

    expect(result.type).toBe("org");
    if (result.type === "org") {
      expect(result.filter).toEqual({ organisationId: "org-abc" });
      expect(result.filterNullable).toEqual({ organisationId: "org-abc" });
      expect(result.organisationId).toBe("org-abc");
    }
  });
});