import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestDb, teardownTestDb } from "@/test/test-db";
import { resolveOrgFilterForUser, orgFilterFromContext } from "@/lib/tenancy/resolve-org-filter";
import type { OrganisationAccessContext } from "@/lib/organisations/organisation-access";
import type { PrismaClient } from "@/generated/prisma/client";

describe("resolveOrgFilterForUser", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns unscoped filter when user has no organisation membership", async () => {
    const email = `no-org-${Date.now()}@test.com`;
    const user = await db.user.create({ data: { email, name: "No Org User" } });

    const result = await resolveOrgFilterForUser(user.id, db);

    expect(result.type).toBe("unscoped");
    if (result.type === "unscoped") {
      expect(result.filter).toEqual({});
      expect(result.filterNullable).toEqual({});
    }
  });

  it("returns org-scoped filter when user has organisation membership", async () => {
    const slug = `filter-test-org-${Date.now()}`;
    const org = await db.organisation.create({ data: { name: "Filter Test Org", slug } });
    const email = `org-user-${Date.now()}@test.com`;
    const user = await db.user.create({ data: { email, name: "Org User" } });
    await db.organisationMembership.create({
      data: { userId: user.id, organisationId: org.id, role: "COACH" },
    });

    const result = await resolveOrgFilterForUser(user.id, db);

    expect(result.type).toBe("org");
    if (result.type === "org") {
      expect(result.filter).toEqual({ organisationId: org.id });
      expect(result.filterNullable).toEqual({ organisationId: org.id });
      expect(result.organisationId).toBe(org.id);
    }
  });

  it("returns org filter for first membership when user belongs to multiple orgs", async () => {
    const slug1 = `multi-org-1-${Date.now()}`;
    const slug2 = `multi-org-2-${Date.now()}`;
    const org1 = await db.organisation.create({ data: { name: "Multi Org 1", slug: slug1 } });
    const org2 = await db.organisation.create({ data: { name: "Multi Org 2", slug: slug2 } });
    const email = `multi-org-user-${Date.now()}@test.com`;
    const user = await db.user.create({ data: { email, name: "Multi Org User" } });
    await db.organisationMembership.create({
      data: { userId: user.id, organisationId: org1.id, role: "COACH" },
    });
    await db.organisationMembership.create({
      data: { userId: user.id, organisationId: org2.id, role: "VIEWER" },
    });

    const result = await resolveOrgFilterForUser(user.id, db);

    expect(result.type).toBe("org");
    if (result.type === "org") {
      expect(result.organisationId).toBeDefined();
      expect([org1.id, org2.id]).toContain(result.organisationId);
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
    permittedTeamIds: ["team-1"],
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