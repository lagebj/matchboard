import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { suspendOrganisation, reactivateOrganisation, isOrganisationSuspended, deleteOrganisation } from "@/lib/organisations/organisation-lifecycle";
import { setupTestDb, teardownTestDb, cleanTestDb, createTestGroup } from "@/test/test-db";

describe("organisation-lifecycle", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb(db);
  });

  describe("suspendOrganisation", () => {
    it("suspends an active organisation", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org", slug: "test-org-suspend" },
      });

      const result = await suspendOrganisation(org.id, "Policy violation", db);

      expect(result.success).toBe(true);

      const updated = await db.organisation.findUnique({ where: { id: org.id } });
      expect(updated?.suspendedAt).not.toBeNull();
      expect(updated?.suspendedReason).toBe("Policy violation");
    });

    it("requires a reason", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org No Reason", slug: "test-org-no-reason" },
      });

      const result = await suspendOrganisation(org.id, "", db);
      expect(result.success).toBe(false);
      expect(result.error).toContain("required");
    });

    it("rejects double suspension", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Double", slug: "test-org-double-suspend" },
      });

      const result1 = await suspendOrganisation(org.id, "First suspension", db);
      expect(result1.success).toBe(true);

      const result2 = await suspendOrganisation(org.id, "Second suspension", db);
      expect(result2.success).toBe(false);
      expect(result2.error).toContain("already suspended");
    });

    it("rejects non-existent organisation", async () => {
      const result = await suspendOrganisation("non-existent-id", "Reason", db);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not found");
    });
  });

  describe("reactivateOrganisation", () => {
    it("reactivates a suspended organisation", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Reactivate", slug: "test-org-reactivate", suspendedAt: new Date(), suspendedReason: "Testing" },
      });

      const result = await reactivateOrganisation(org.id, db);
      expect(result.success).toBe(true);

      const updated = await db.organisation.findUnique({ where: { id: org.id } });
      expect(updated?.suspendedAt).toBeNull();
      expect(updated?.suspendedReason).toBeNull();
    });

    it("rejects reactivation of an active organisation", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Active", slug: "test-org-active" },
      });

      const result = await reactivateOrganisation(org.id, db);
      expect(result.success).toBe(false);
      expect(result.error).toContain("not suspended");
    });
  });

  describe("isOrganisationSuspended", () => {
    it("returns true for a suspended organisation", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Susp Check", slug: "test-org-susp-check", suspendedAt: new Date() },
      });

      const suspended = await isOrganisationSuspended(org.id, db);
      expect(suspended).toBe(true);
    });

    it("returns false for an active organisation", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Active Check", slug: "test-org-active-check" },
      });

      const suspended = await isOrganisationSuspended(org.id, db);
      expect(suspended).toBe(false);
    });
  });

  describe("deleteOrganisation", () => {
    it("deletes a suspended organisation", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Delete", slug: "test-org-delete", suspendedAt: new Date(), suspendedReason: "Deleting" },
      });

      const result = await deleteOrganisation(org.id, db);
      expect(result.success).toBe(true);

      const found = await db.organisation.findUnique({ where: { id: org.id } });
      expect(found).toBeNull();
    });

    it("deletes a synthetic organisation without suspension", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Synthetic Delete", slug: "test-org-syn-delete", isSynthetic: true },
      });

      const result = await deleteOrganisation(org.id, db);
      expect(result.success).toBe(true);

      const found = await db.organisation.findUnique({ where: { id: org.id } });
      expect(found).toBeNull();
    });

    it("rejects deletion of an active non-synthetic organisation", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Active Delete", slug: "test-org-active-delete" },
      });

      const result = await deleteOrganisation(org.id, db);
      expect(result.success).toBe(false);
      expect(result.error).toContain("suspended before deletion");
    });

    it("cascades deletion to memberships and teams", async () => {
      const org = await db.organisation.create({
        data: { name: "Test Org Cascade", slug: "test-org-cascade", suspendedAt: new Date(), suspendedReason: "Cascade test" },
      });
      const user = await db.user.create({
        data: { email: "cascade@test.com", name: "Cascade User" },
      });
      await db.organisationMembership.create({
        data: { userId: user.id, organisationId: org.id, role: "COACH" },
      });
      await db.team.create({
        data: { name: "Cascade Team", organisationId: org.id, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14, footballGroupId: await createTestGroup(db, org.id) },
      });

      const result = await deleteOrganisation(org.id, db);
      expect(result.success).toBe(true);

      const found = await db.organisation.findUnique({ where: { id: org.id } });
      expect(found).toBeNull();
    });
  });
});