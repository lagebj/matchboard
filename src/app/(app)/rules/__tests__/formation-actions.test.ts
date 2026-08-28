import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture } from "@/test/test-db";
import type { TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { createCustomFormation, duplicateFormation } from "../formation-actions";

// 3v3 needs exactly 3 slots and no goalkeeper (validateFormationForMatchUse), the smallest
// formation shape that satisfies validation without extra scaffolding.
const THREE_V_THREE_SLOTS = [
  { gridX: 2, gridY: 5, label: "Defender", shortLabel: "DEF", roleType: "DEFENDER", acceptedPositionIds: ["defender"], sortOrder: 0 },
  { gridX: 1, gridY: 2, label: "Midfielder", shortLabel: "MID", roleType: "MIDFIELDER", acceptedPositionIds: ["midfielder"], sortOrder: 1 },
  { gridX: 3, gridY: 0, label: "Forward", shortLabel: "FWD", roleType: "FORWARD", acceptedPositionIds: ["forward"], sortOrder: 2 },
];

describe("formation-actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("createCustomFormation", () => {
    // Regression test: nested `slots: { create: [...] }` writes under Formation.create() were
    // missing organisationId (the tenantRLS extension only injects it into the top-level create
    // data, never into nested relation writes), causing every custom formation creation to fail
    // with a NOT NULL constraint violation on FormationSlot.organisationId (P2011).
    it("creates the formation and persists all nested slots with organisationId set", async () => {
      const formation = await createCustomFormation({
        name: "Regression 3v3",
        gameFormat: "THREE_A_SIDE",
        slots: THREE_V_THREE_SLOTS,
      });

      expect(formation.id).toBeDefined();
      expect(formation.slots).toHaveLength(3);
      for (const slot of formation.slots) {
        expect(slot.organisationId).toBe(fixture.organisationId);
      }

      // Verify directly against the database too, not just the create() return value.
      const persistedSlots = await testDb.formationSlot.findMany({ where: { formationId: formation.id } });
      expect(persistedSlots).toHaveLength(3);
      for (const slot of persistedSlots) {
        expect(slot.organisationId).toBe(fixture.organisationId);
      }
    });
  });

  describe("duplicateFormation", () => {
    it("duplicates the formation and persists all nested slots with organisationId set", async () => {
      const source = await createCustomFormation({
        name: "Regression 3v3 Source",
        gameFormat: "THREE_A_SIDE",
        slots: THREE_V_THREE_SLOTS,
      });

      const copy = await duplicateFormation(source.id, "Regression 3v3 Copy");

      expect(copy.slots).toHaveLength(3);
      const persistedSlots = await testDb.formationSlot.findMany({ where: { formationId: copy.id } });
      expect(persistedSlots).toHaveLength(3);
      for (const slot of persistedSlots) {
        expect(slot.organisationId).toBe(fixture.organisationId);
      }
    });
  });
});
