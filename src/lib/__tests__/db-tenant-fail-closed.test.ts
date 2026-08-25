/* eslint-disable @typescript-eslint/no-explicit-any */
// ADR-0087: the tenantRLS extension (src/lib/db.ts) must fail closed — refuse, not silently
// run unscoped — when an RLS-scoped model is queried with no trusted organisation context.
// This exercises the REAL extended client (not the raw testDb used elsewhere), pointed at the
// same disposable TEST_DATABASE_URL so no real dev/prod database is ever touched.
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@/test/test-db";
import type { PrismaClient } from "@/generated/prisma/client";
// Static imports so these share the exact module instance (and AsyncLocalStorage) that
// src/lib/db.ts's own static imports resolve to. Only @/lib/db itself needs a dynamic import
// below — it reads DATABASE_URL at module-load time and must be imported after that env var is
// pointed at the test database.
import { runWithTenantOrganisationId, runWithSystemPrivilege } from "@/lib/tenancy/tenant-async-storage";
import { withTenantContext } from "@/lib/tenancy/tenant-client";

describe("tenantRLS extension: fail-closed tenant scoping (ADR-0087)", () => {
  let testDb: PrismaClient;
  let db: PrismaClient;
  let TenantContextError: new (message: string) => Error;

  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    testDb = await setupTestDb();

    // src/lib/db.ts reads DATABASE_URL at module-load time. Point it at the same disposable
    // database TEST_DATABASE_URL already uses before importing it, so this file exercises the
    // real tenantRLS extension without ever touching a real dev/prod database.
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

    const dbModule = await import("@/lib/db");
    db = dbModule.db;
    TenantContextError = dbModule.TenantContextError;
  });

  afterAll(async () => {
    process.env.DATABASE_URL = originalDatabaseUrl;
    await teardownTestDb();
  });

  beforeEach(async () => {
    await cleanTestDb(testDb);
  });

  describe("fail-closed (no trusted context)", () => {
    it("throws TenantContextError on a read against an RLS-scoped model", async () => {
      await expect(db.team.findMany()).rejects.toThrow(TenantContextError);
    });

    it("throws TenantContextError on a mutation against an RLS-scoped model", async () => {
      await expect(db.team.create({ data: {} as any })).rejects.toThrow(TenantContextError);
    });

    it("throws TenantContextError when orgId is present but malformed", async () => {
      await expect(
        runWithTenantOrganisationId("not a valid org id!!", async () => await db.team.findMany()),
      ).rejects.toThrow(TenantContextError);
    });

    it("does not throw for a model that is not tenant-scoped (Organisation)", async () => {
      await expect(db.organisation.findMany()).resolves.toBeDefined();
    });
  });

  describe("explicit escape hatches (ADR-0087)", () => {
    it("runWithSystemPrivilege allows an unscoped query through", async () => {
      await expect(
        runWithSystemPrivilege("test: verify system privilege bypass", async () => await db.team.findMany()),
      ).resolves.toBeDefined();
    });

    it("runWithSystemPrivilege requires a non-empty reason", () => {
      expect(() => runWithSystemPrivilege("", () => db.team.findMany())).toThrow();
    });
  });

  describe("real cross-tenant isolation with the extension active", () => {
    it("runWithTenantOrganisationId scopes reads to the given organisation only", async () => {
      const org1 = await db.organisation.create({ data: { name: "Org 1", slug: `fc-org1-${Date.now()}` } });
      const org2 = await db.organisation.create({ data: { name: "Org 2", slug: `fc-org2-${Date.now()}` } });
      const group1 = await runWithTenantOrganisationId(org1.id, async () =>
        await db.footballGroup.create({
          data: { name: "G1", slug: `fc-g1-${Date.now()}`, type: "AGE_GROUP", organisationId: org1.id },
        }),
      );
      const group2 = await runWithTenantOrganisationId(org2.id, async () =>
        await db.footballGroup.create({
          data: { name: "G2", slug: `fc-g2-${Date.now()}`, type: "AGE_GROUP", organisationId: org2.id },
        }),
      );
      const teamOpts = {
        targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5,
        minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9,
        maxSquadSize: 14,
      };

      await runWithTenantOrganisationId(org1.id, async () =>
        await db.team.create({ data: { name: "Org1 Team", organisationId: org1.id, footballGroupId: group1.id, ...teamOpts } }),
      );
      await runWithTenantOrganisationId(org2.id, async () =>
        await db.team.create({ data: { name: "Org2 Team", organisationId: org2.id, footballGroupId: group2.id, ...teamOpts } }),
      );

      const org1Teams = await runWithTenantOrganisationId(org1.id, async () => await db.team.findMany());
      expect(org1Teams.map((t: any) => t.name)).toEqual(["Org1 Team"]);

      const org2Teams = await runWithTenantOrganisationId(org2.id, async () => await db.team.findMany());
      expect(org2Teams.map((t: any) => t.name)).toEqual(["Org2 Team"]);
    });

    it("withTenantContext now actually scopes queries by organisation (ADR-0087 fix)", async () => {
      // Regression test for the getEffectiveGroupAccess()-class gap: before ADR-0087,
      // withTenantContext() only wrapped a transaction and never set tenant context, so a
      // query inside it with no explicit organisationId filter returned rows from every
      // organisation. This proves it is now genuinely scoped.
      const org1 = await db.organisation.create({ data: { name: "WTC Org 1", slug: `wtc-org1-${Date.now()}` } });
      const org2 = await db.organisation.create({ data: { name: "WTC Org 2", slug: `wtc-org2-${Date.now()}` } });
      const group1 = await runWithTenantOrganisationId(org1.id, async () =>
        await db.footballGroup.create({
          data: { name: "WTC G1", slug: `wtc-g1-${Date.now()}`, type: "AGE_GROUP", organisationId: org1.id },
        }),
      );
      const group2 = await runWithTenantOrganisationId(org2.id, async () =>
        await db.footballGroup.create({
          data: { name: "WTC G2", slug: `wtc-g2-${Date.now()}`, type: "AGE_GROUP", organisationId: org2.id },
        }),
      );
      const teamOpts = {
        targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5,
        minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9,
        maxSquadSize: 14,
      };

      await runWithTenantOrganisationId(org1.id, async () =>
        await db.team.create({ data: { name: "WTC Org1 Team", organisationId: org1.id, footballGroupId: group1.id, ...teamOpts } }),
      );
      await runWithTenantOrganisationId(org2.id, async () =>
        await db.team.create({ data: { name: "WTC Org2 Team", organisationId: org2.id, footballGroupId: group2.id, ...teamOpts } }),
      );

      // No explicit `where: { organisationId }` in this query — relies entirely on the
      // extension's auto-injection now that withTenantContext sets ALS context.
      const scopedTeams = (await withTenantContext(db, org1.id, (tx) => tx.team.findMany())) as any[];
      expect(scopedTeams.map((t: any) => t.name)).toEqual(["WTC Org1 Team"]);
    });

    it("findUnique with a compound-unique where (e.g. userId_organisationId) still works once org-scoped -> findFirst conversion kicks in", async () => {
      // Regression test: converting findUnique -> findFirst (to safely merge organisationId
      // into `where`) previously kept Prisma's compound-unique-key shape
      // (`{ userId_organisationId: { userId, organisationId } }`), which findFirst's WhereInput
      // rejects as an unknown argument (`findFirst` only accepts flattened filter fields, unlike
      // `findUnique`). This bug was fully dormant until ARR-0029's casing fix made this
      // conversion path actually run for the first time — it then broke every real caller of
      // this pattern (resolveOrganisationAccess, organisation-invitation.ts,
      // organisation-domain.ts), crashing every `/o/{orgSlug}/...` page load.
      const org = await db.organisation.create({ data: { name: "CU Org", slug: `cu-org-${Date.now()}` } });
      const user = await db.user.create({ data: { email: `cu-${Date.now()}@example.com`, name: "CU" } });
      const membership = await runWithTenantOrganisationId(org.id, async () =>
        await db.organisationMembership.create({
          data: { userId: user.id, organisationId: org.id, role: "OWNER" },
        }),
      );

      const found = await runWithTenantOrganisationId(org.id, async () =>
        await db.organisationMembership.findUnique({
          where: { userId_organisationId: { userId: user.id, organisationId: org.id } },
        }),
      );

      expect((found as any)?.id).toBe(membership.id);
    });
  });
});
