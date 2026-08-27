import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, createTestGroup } from "@/test/test-db";

/**
 * Regression test for the production crash: opening a player detail view threw
 * `unrecognized configuration parameter "app.current_organization_id"` (Postgres 42704)
 * from prisma.developmentThread.findMany(). Root cause: the DevelopmentThread/
 * DevelopmentThreadObservation/TeamFocus RLS policies used current_setting() without the
 * `missing_ok` argument, which throws whenever the GUC has never been set in that session
 * (the actual runtime state — tenant scoping is done at the Prisma where-clause-injection
 * layer, not via SET LOCAL). Fixed by migration 20260831000000_fix_rls_missing_permissive_fallback.
 *
 * This test exercises the real Postgres connection directly (bypassing the app-layer
 * tenantRLS extension) so it fails with the exact 42704 error against the pre-fix schema
 * and passes once the RLS policies are corrected.
 */
describe("DevelopmentThread RLS policies", () => {
  let db: PrismaClient;

  beforeAll(async () => {
    db = await setupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("does not throw 'unrecognized configuration parameter' when app.current_organization_id is unset", async () => {
    const org = await db.organisation.create({
      data: { name: "Org RLS DevThread", slug: `org-rls-devthread-${Date.now()}` },
    });
    const group = await createTestGroup(db, org.id);
    const team = await db.team.create({
      data: { name: "Team RLS", organisationId: org.id, footballGroupId: group, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
    });
    const player = await db.player.create({
      data: { playerCode: 9001, firstName: "Devon", coreTeamId: team.id, primaryPosition: "CM", preferredFoot: "RIGHT", secondaryFoot: "WEAK", bestSide: "CENTER", organisationId: org.id },
    });

    await expect(
      db.developmentThread.findMany({ where: { playerId: player.id, organisationId: org.id } }),
    ).resolves.not.toThrow();

    const created = await db.developmentThread.create({
      data: { organisationId: org.id, playerId: player.id, focus: "Positional discipline", status: "ACTIVE" },
    });
    expect(created.id).toBeTruthy();

    await expect(
      db.developmentThreadObservation.findMany({ where: { threadId: created.id, organisationId: org.id } }),
    ).resolves.not.toThrow();
  });

  it("scopes DevelopmentThread reads to the correct organisation", async () => {
    const org1 = await db.organisation.create({ data: { name: "Org DevThread One", slug: `org-devthread-one-${Date.now()}` } });
    const group1 = await createTestGroup(db, org1.id);
    const team1 = await db.team.create({
      data: { name: "Team One", organisationId: org1.id, footballGroupId: group1, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
    });
    const player1 = await db.player.create({
      data: { playerCode: 9002, firstName: "Ola", coreTeamId: team1.id, primaryPosition: "CB", preferredFoot: "RIGHT", secondaryFoot: "WEAK", bestSide: "CENTER", organisationId: org1.id },
    });

    const org2 = await db.organisation.create({ data: { name: "Org DevThread Two", slug: `org-devthread-two-${Date.now()}` } });
    const group2 = await createTestGroup(db, org2.id);
    const team2 = await db.team.create({
      data: { name: "Team Two", organisationId: org2.id, footballGroupId: group2, targetSquadSize: 11, minCorePlayers: 8, targetSupportCount: 0, maxSupportCount: 5, minSupportPlayers: 0, supportPriority: 1, developmentSlots: 3, minAcceptedSquadSize: 9, maxSquadSize: 14 },
    });
    const player2 = await db.player.create({
      data: { playerCode: 9003, firstName: "Kari", coreTeamId: team2.id, primaryPosition: "CM", preferredFoot: "RIGHT", secondaryFoot: "WEAK", bestSide: "CENTER", organisationId: org2.id },
    });

    const thread1 = await db.developmentThread.create({
      data: { organisationId: org1.id, playerId: player1.id, focus: "Org1 thread", status: "ACTIVE" },
    });
    const thread2 = await db.developmentThread.create({
      data: { organisationId: org2.id, playerId: player2.id, focus: "Org2 thread", status: "ACTIVE" },
    });

    const org1Threads = await db.developmentThread.findMany({ where: { organisationId: org1.id } });
    const org2Threads = await db.developmentThread.findMany({ where: { organisationId: org2.id } });

    expect(org1Threads.map((t) => t.id)).toContain(thread1.id);
    expect(org1Threads.map((t) => t.id)).not.toContain(thread2.id);
    expect(org2Threads.map((t) => t.id)).toContain(thread2.id);
    expect(org2Threads.map((t) => t.id)).not.toContain(thread1.id);
  });
});
