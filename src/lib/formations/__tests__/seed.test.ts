import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { setTenantOrganisationId } from "@/lib/tenancy/tenant-async-storage";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

// Regression test (user-documentation-experience Phase 2/6): seedSystemFormations() had zero
// callers before this programme's docs seed script first exercised it end-to-end. Its nested
// `slots: { create: [...] } }` write never included organisationId -- Prisma extension-based
// where-clause/data injection (src/lib/db.ts's tenantRLS) only patches a create's *top-level*
// data, never a nested relation write -- so every real invocation threw a NOT NULL constraint
// violation on FormationSlot.organisationId. The fix passes organisationId explicitly into the
// nested create, which this test verifies directly (independent of whether the tenantRLS
// extension itself is present in the client under test, matching this codebase's established
// vi.mock("@/lib/db") test pattern).
let testDb: PrismaClient;
let fixture: TestFixtureIds;

describe("seedSystemFormations", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("creates system formations with every slot scoped to the current tenant, without throwing", async () => {
    setTenantOrganisationId(fixture.organisationId);
    const { seedSystemFormations } = await import("../seed");
    await expect(seedSystemFormations()).resolves.toBeUndefined();

    const formations = await testDb.formation.findMany({
      where: { organisationId: fixture.organisationId, source: "SYSTEM" },
      include: { slots: true },
    });
    expect(formations.length).toBeGreaterThan(0);

    for (const formation of formations) {
      expect(formation.slots.length).toBeGreaterThan(0);
      for (const slot of formation.slots) {
        expect(slot.organisationId).toBe(fixture.organisationId);
      }
    }
  });

  it("is idempotent: a second call does not create duplicates", async () => {
    setTenantOrganisationId(fixture.organisationId);
    const { seedSystemFormations } = await import("../seed");
    const before = await testDb.formation.count({ where: { organisationId: fixture.organisationId, source: "SYSTEM" } });
    await seedSystemFormations();
    const after = await testDb.formation.count({ where: { organisationId: fixture.organisationId, source: "SYSTEM" } });
    expect(after).toBe(before);
  });

  it("throws a clear error when no tenant context is set, rather than a raw NOT NULL constraint violation", async () => {
    const { runWithTenantOrganisationId } = await import("@/lib/tenancy/tenant-async-storage");
    const { seedSystemFormations } = await import("../seed");
    // Empty string is falsy, matching seed.ts's own `if (!organisationId)` guard -- exercises
    // the "no tenant context" branch without needing to fight AsyncLocalStorage's per-test
    // isolation to prove "truly unset".
    await runWithTenantOrganisationId("", async () => {
      await expect(seedSystemFormations()).rejects.toThrow(/requires tenant context/);
    });
  });
});
