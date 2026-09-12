import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, getTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { getOrgActivePlayerAvailability } from "../get-org-active-player-availability";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

let db: PrismaClient;
let fixture: TestFixtureIds;
let orgFilter: OrgFilterMode;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

describe("getOrgActivePlayerAvailability", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
    orgFilter = {
      type: "org",
      filter: { organisationId: fixture.organisationId },
      filterNullable: { organisationId: fixture.organisationId },
      organisationId: fixture.organisationId,
    };
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns every active player in the organisation with a real availability value", async () => {
    const rows = await getOrgActivePlayerAvailability(orgFilter);
    expect(rows.length).toBe(fixture.players.length);
    for (const row of rows) {
      expect(row.playerId).toBeDefined();
      expect(row.displayName).toBeDefined();
      expect(["AVAILABLE", "UNAVAILABLE", "INJURED", "SICK", "AWAY", "TENTATIVE", "UNKNOWN"]).toContain(row.availability);
    }
  });

  it("excludes an inactive (removed) player", async () => {
    const target = fixture.players[0];
    await db.player.update({ where: { id: target.id }, data: { active: false, removedAt: new Date() } });
    try {
      const rows = await getOrgActivePlayerAvailability(orgFilter);
      expect(rows.find((r) => r.playerId === target.id)).toBeUndefined();
      expect(rows.length).toBe(fixture.players.length - 1);
    } finally {
      await db.player.update({ where: { id: target.id }, data: { active: true, removedAt: null } });
    }
  });

  it("reflects a player's current availability status", async () => {
    const target = fixture.players[1];
    await db.player.update({ where: { id: target.id }, data: { currentAvailability: "INJURED" } });
    try {
      const rows = await getOrgActivePlayerAvailability(orgFilter);
      expect(rows.find((r) => r.playerId === target.id)?.availability).toBe("INJURED");
    } finally {
      await db.player.update({ where: { id: target.id }, data: { currentAvailability: "AVAILABLE" } });
    }
  });

  it("never returns another organisation's players", async () => {
    const otherOrg = await db.organisation.create({ data: { name: "Other Org", slug: `other-org-${Date.now()}` } });
    const otherGroup = await db.footballGroup.create({
      data: { name: "Other Group", slug: `other-group-${Date.now()}`, type: "AGE_GROUP", organisationId: otherOrg.id },
    });
    const otherTeam = await db.team.create({
      data: { name: "Other Team", footballGroupId: otherGroup.id, organisationId: otherOrg.id },
    });
    await db.player.create({
      data: {
        firstName: "Other",
        lastName: "Player",
        coreTeamId: otherTeam.id,
        organisationId: otherOrg.id,
        active: true,
        playerCode: 1,
        primaryPosition: "CM",
        preferredFoot: "RIGHT",
        secondaryFoot: "WEAK",
        bestSide: "CENTER",
      },
    });

    const rows = await getOrgActivePlayerAvailability(orgFilter);
    expect(rows.length).toBe(fixture.players.length);
    expect(rows.some((r) => r.displayName === "Other Player")).toBe(false);
  });
});
