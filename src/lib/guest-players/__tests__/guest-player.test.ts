import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupTestDb, teardownTestDb, seedTestFixture, createTestGroup, type TestFixtureIds } from "@/test/test-db";
import { PrismaClient } from "@/generated/prisma/client";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

vi.mock("@/lib/db", () => {
  return {
    get db() {
      return getTestDb();
    },
  };
});

import { getTestDb } from "@/test/test-db";

let db: PrismaClient;
let fixture: TestFixtureIds;

function orgFilterFor(organisationId: string): OrgFilterMode {
  return {
    type: "org" as const,
    filter: { organisationId },
    filterNullable: { organisationId },
    organisationId,
  };
}

async function createSecondOrganisation(): Promise<{ id: string }> {
  return db.organisation.create({
    data: { name: `Other Org ${Date.now()}`, slug: `other-org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` },
    select: { id: true },
  });
}

describe("GuestPlayer domain (ADR-0106)", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
  });

  afterEach(async () => {
    await db.guestPlayer.deleteMany();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("validateGuestPlayerFields", () => {
    it("requires a non-empty name", async () => {
      const { validateGuestPlayerFields } = await import("@/lib/guest-players/guest-player");
      const result = validateGuestPlayerFields({ name: "   " });
      expect(result.valid).toBe(false);
      if (!result.valid) expect(result.error).toContain("Name is required");
    });

    it("rejects a name over the length limit", async () => {
      const { validateGuestPlayerFields, GUEST_PLAYER_NAME_MAX_LENGTH } = await import("@/lib/guest-players/guest-player");
      const result = validateGuestPlayerFields({ name: "a".repeat(GUEST_PLAYER_NAME_MAX_LENGTH + 1) });
      expect(result.valid).toBe(false);
    });

    it("rejects a source label over the length limit", async () => {
      const { validateGuestPlayerFields, GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH } = await import("@/lib/guest-players/guest-player");
      const result = validateGuestPlayerFields({
        name: "Oliver Hansen",
        sourceLabel: "a".repeat(GUEST_PLAYER_SOURCE_LABEL_MAX_LENGTH + 1),
      });
      expect(result.valid).toBe(false);
    });

    it("rejects a note over the length limit", async () => {
      const { validateGuestPlayerFields, GUEST_PLAYER_NOTE_MAX_LENGTH } = await import("@/lib/guest-players/guest-player");
      const result = validateGuestPlayerFields({
        name: "Oliver Hansen",
        note: "a".repeat(GUEST_PLAYER_NOTE_MAX_LENGTH + 1),
      });
      expect(result.valid).toBe(false);
    });

    it("accepts name only (minimum required field)", async () => {
      const { validateGuestPlayerFields } = await import("@/lib/guest-players/guest-player");
      const result = validateGuestPlayerFields({ name: "Oliver Hansen" });
      expect(result.valid).toBe(true);
    });
  });

  describe("createGuestPlayer", () => {
    it("creates a guest player with name only", async () => {
      const { createGuestPlayer } = await import("@/lib/guest-players/guest-player");
      const result = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Oliver Hansen",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.guestPlayer.name).toBe("Oliver Hansen");
        expect(result.guestPlayer.sourceLabel).toBeNull();
        expect(result.guestPlayer.active).toBe(true);
        expect(result.guestPlayer.deactivatedAt).toBeNull();
      }
    });

    it("creates a guest player with a source label and note", async () => {
      const { createGuestPlayer } = await import("@/lib/guest-players/guest-player");
      const result = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Noah Berg",
        sourceLabel: "G2016",
        note: "Plays up for friendly days.",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.guestPlayer.sourceLabel).toBe("G2016");
        expect(result.guestPlayer.note).toBe("Plays up for friendly days.");
      }
    });

    it("is not Season-scoped -- no season-related field exists on the created row", async () => {
      const { createGuestPlayer } = await import("@/lib/guest-players/guest-player");
      const result = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Emil Larsen",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.guestPlayer).not.toHaveProperty("seasonId");
        expect(result.guestPlayer).not.toHaveProperty("leagueSeasonId");
      }
    });

    it("rejects a nonexistent group", async () => {
      const { createGuestPlayer } = await import("@/lib/guest-players/guest-player");
      const result = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: "nonexistent-group",
        name: "Oliver Hansen",
      });
      expect(result.success).toBe(false);
    });

    it("rejects a group belonging to a different organisation", async () => {
      const otherOrg = await createSecondOrganisation();
      const otherGroupId = await createTestGroup(db, otherOrg.id);

      const { createGuestPlayer } = await import("@/lib/guest-players/guest-player");
      const result = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: otherGroupId,
        name: "Oliver Hansen",
      });
      expect(result.success).toBe(false);
    });

    it("rejects an empty name", async () => {
      const { createGuestPlayer } = await import("@/lib/guest-players/guest-player");
      const result = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "   ",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("updateGuestPlayer", () => {
    it("updates the source label without touching other fields", async () => {
      const { createGuestPlayer, updateGuestPlayer } = await import("@/lib/guest-players/guest-player");
      const created = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Oliver Hansen",
        note: "Original note",
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const updated = await updateGuestPlayer(
        created.guestPlayer.id,
        { sourceLabel: "G2016" },
        orgFilterFor(fixture.organisationId),
      );
      expect(updated.success).toBe(true);
      if (updated.success) {
        expect(updated.guestPlayer.sourceLabel).toBe("G2016");
        expect(updated.guestPlayer.note).toBe("Original note");
      }
    });

    it("rejects update for a guest player in a different organisation", async () => {
      const otherOrg = await createSecondOrganisation();
      const { createGuestPlayer, updateGuestPlayer } = await import("@/lib/guest-players/guest-player");
      const created = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Oliver Hansen",
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const result = await updateGuestPlayer(
        created.guestPlayer.id,
        { name: "Someone Else" },
        orgFilterFor(otherOrg.id),
      );
      expect(result.success).toBe(false);
    });

    it("rejects an update that would clear the name", async () => {
      const { createGuestPlayer, updateGuestPlayer } = await import("@/lib/guest-players/guest-player");
      const created = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Oliver Hansen",
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const result = await updateGuestPlayer(
        created.guestPlayer.id,
        { name: "   " },
        orgFilterFor(fixture.organisationId),
      );
      expect(result.success).toBe(false);
    });
  });

  describe("setGuestPlayerActive (lifecycle)", () => {
    it("deactivates and records deactivatedAt", async () => {
      const { createGuestPlayer, setGuestPlayerActive } = await import("@/lib/guest-players/guest-player");
      const created = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Emil Larsen",
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const deactivated = await setGuestPlayerActive(created.guestPlayer.id, false, orgFilterFor(fixture.organisationId));
      expect(deactivated.success).toBe(true);
      if (deactivated.success) {
        expect(deactivated.guestPlayer.active).toBe(false);
        expect(deactivated.guestPlayer.deactivatedAt).not.toBeNull();
      }
    });

    it("reactivates and clears deactivatedAt", async () => {
      const { createGuestPlayer, setGuestPlayerActive } = await import("@/lib/guest-players/guest-player");
      const created = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Emil Larsen",
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      await setGuestPlayerActive(created.guestPlayer.id, false, orgFilterFor(fixture.organisationId));
      const reactivated = await setGuestPlayerActive(created.guestPlayer.id, true, orgFilterFor(fixture.organisationId));
      expect(reactivated.success).toBe(true);
      if (reactivated.success) {
        expect(reactivated.guestPlayer.active).toBe(true);
        expect(reactivated.guestPlayer.deactivatedAt).toBeNull();
      }
    });

    it("is a no-op when already in the target state", async () => {
      const { createGuestPlayer, setGuestPlayerActive } = await import("@/lib/guest-players/guest-player");
      const created = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Emil Larsen",
      });
      expect(created.success).toBe(true);
      if (!created.success) return;

      const result = await setGuestPlayerActive(created.guestPlayer.id, true, orgFilterFor(fixture.organisationId));
      expect(result.success).toBe(true);
      if (result.success) expect(result.guestPlayer.deactivatedAt).toBeNull();
    });

    it("there is no delete function -- a guest player is never hard-deleted", async () => {
      const guestPlayerModule = await import("@/lib/guest-players/guest-player");
      expect((guestPlayerModule as Record<string, unknown>).deleteGuestPlayer).toBeUndefined();
    });
  });

  describe("getGroupGuestPlayers", () => {
    it("returns only active guest players by default", async () => {
      const { createGuestPlayer, setGuestPlayerActive, getGroupGuestPlayers } = await import("@/lib/guest-players/guest-player");
      const active = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Active Guest",
      });
      const inactive = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Inactive Guest",
      });
      expect(active.success && inactive.success).toBe(true);
      if (!active.success || !inactive.success) return;
      await setGuestPlayerActive(inactive.guestPlayer.id, false, orgFilterFor(fixture.organisationId));

      const results = await getGroupGuestPlayers(fixture.footballGroupId, orgFilterFor(fixture.organisationId));
      expect(results.map((g) => g.name)).toContain("Active Guest");
      expect(results.map((g) => g.name)).not.toContain("Inactive Guest");
    });

    it("includes inactive guest players when requested", async () => {
      const { createGuestPlayer, setGuestPlayerActive, getGroupGuestPlayers } = await import("@/lib/guest-players/guest-player");
      const created = await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: fixture.footballGroupId,
        name: "Inactive Guest",
      });
      expect(created.success).toBe(true);
      if (!created.success) return;
      await setGuestPlayerActive(created.guestPlayer.id, false, orgFilterFor(fixture.organisationId));

      const results = await getGroupGuestPlayers(fixture.footballGroupId, orgFilterFor(fixture.organisationId), { includeInactive: true });
      expect(results.map((g) => g.name)).toContain("Inactive Guest");
    });

    it("does not leak guest players across organisations", async () => {
      const otherOrg = await createSecondOrganisation();
      const otherGroupId = await createTestGroup(db, otherOrg.id);

      const { createGuestPlayer, getGroupGuestPlayers } = await import("@/lib/guest-players/guest-player");
      await createGuestPlayer({
        organisationId: otherOrg.id,
        footballGroupId: otherGroupId,
        name: "Other Org Guest",
      });

      const results = await getGroupGuestPlayers(fixture.footballGroupId, orgFilterFor(fixture.organisationId));
      expect(results.map((g) => g.name)).not.toContain("Other Org Guest");
    });

    it("does not leak guest players across groups within the same organisation", async () => {
      const secondGroupId = await createTestGroup(db, fixture.organisationId);

      const { createGuestPlayer, getGroupGuestPlayers } = await import("@/lib/guest-players/guest-player");
      await createGuestPlayer({
        organisationId: fixture.organisationId,
        footballGroupId: secondGroupId,
        name: "Other Group Guest",
      });

      const results = await getGroupGuestPlayers(fixture.footballGroupId, orgFilterFor(fixture.organisationId));
      expect(results.map((g) => g.name)).not.toContain("Other Group Guest");
    });
  });
});
