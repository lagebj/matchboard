// Regression coverage for a production bug: opening EventMatch live reporting threw
// "Refusing unscoped query on RLS-scoped model 'EventMatch'" (ADR-0087's fail-closed tenantRLS
// extension, src/lib/db.ts), which emptied the goal/assist/rotation player pickers even though
// starting live reporting itself appeared to work.
//
// Root cause: `getEventLiveMatchPreMatchPackageAction` (event-live-actions.ts) called a local
// `requireEventMatchOrgAccess()` helper that resolved its OWN actor context via
// `requirePageActorContext()`/`setTenantOrganisationId()` internally, then returned to the
// caller, which went on to run its own `db.eventMatch.findUnique()`/`db.eventMatchLineup
// .findUnique()` queries with no organisationId anywhere in their `where` clause. Per ARR-0029
// "Bug 3" (documented in src/lib/db.ts and src/lib/tenancy/tenant-async-storage.ts),
// AsyncLocalStorage's enterWith() mutation made inside an awaited helper never becomes visible to
// that helper's own caller once it returns -- so those subsequent queries ran with no trusted
// organisation context and the tenantRLS extension correctly refused them.
//
// This test deliberately does NOT mock @/lib/db (unlike most action tests in this codebase,
// which mock it to the raw, unwrapped test client) -- it exercises the REAL extended `db` export
// so the tenantRLS extension's fail-closed behavior is actually in play, matching the approach in
// src/lib/__tests__/db-tenant-fail-closed.test.ts.
import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, cleanTestDb } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";
import {
  createTestOrganisation,
  createTestGroup,
  createTestTeam,
  createTestPlayer,
  createTestEvent,
  createTestEventSquad,
} from "@/test/support/factories";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const auth = mockAuthContext({ role: "COACH" });

describe("Event live reporting: tenant context propagation (ADR-0087 / ARR-0029)", () => {
  let testDb: PrismaClient;
  let db: PrismaClient;
  let TenantContextError: new (message: string) => Error;

  let orgAId: string;
  let orgAEventMatchId: string;
  let orgAPlayerIds: string[];

  let orgBId: string;
  let orgBEventMatchId: string;

  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeAll(async () => {
    testDb = await setupTestDb();

    // src/lib/db.ts reads DATABASE_URL at module-load time. Point it at the same disposable
    // database TEST_DATABASE_URL already uses before importing it, exactly like
    // db-tenant-fail-closed.test.ts, so this file exercises the real tenantRLS extension.
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

    // Org A: the organisation the mocked actor belongs to.
    const orgA = await createTestOrganisation(testDb);
    orgAId = orgA.id;
    const groupA = await createTestGroup(testDb, orgAId);
    const teamA = await createTestTeam(testDb, orgAId, groupA.id);
    const playerA1 = await createTestPlayer(testDb, orgAId, teamA.id, { firstName: "Ada", lastName: "One" });
    const playerA2 = await createTestPlayer(testDb, orgAId, teamA.id, { firstName: "Bo", lastName: "Two" });
    orgAPlayerIds = [playerA1.id, playerA2.id];

    const eventA = await createTestEvent(testDb, orgAId, groupA.id, { gameFormat: "SEVEN_A_SIDE" });
    const squadA = await createTestEventSquad(testDb, orgAId, eventA.id, { targetSize: 7 });
    for (const playerId of orgAPlayerIds) {
      await testDb.eventSquadPlayer.create({
        data: { eventId: eventA.id, eventSquadId: squadA.id, playerId, organisationId: orgAId, source: "AUTO" },
      });
    }
    const matchA = await testDb.eventMatch.create({
      data: {
        eventId: eventA.id,
        eventSquadId: squadA.id,
        opponentName: "Rival FC",
        startsAt: new Date("2026-09-10T10:00:00Z"),
        organisationId: orgAId,
      },
    });
    orgAEventMatchId = matchA.id;

    auth.updateOrganisationId(orgAId);

    // Org B: a second, unrelated organisation with its own event match, to prove IDOR denial.
    const orgB = await createTestOrganisation(testDb);
    orgBId = orgB.id;
    const groupB = await createTestGroup(testDb, orgBId);
    const eventB = await createTestEvent(testDb, orgBId, groupB.id, { gameFormat: "SEVEN_A_SIDE" });
    const squadB = await createTestEventSquad(testDb, orgBId, eventB.id, { targetSize: 7 });
    const matchB = await testDb.eventMatch.create({
      data: {
        eventId: eventB.id,
        eventSquadId: squadB.id,
        opponentName: "Other Opponent",
        startsAt: new Date("2026-09-11T10:00:00Z"),
        organisationId: orgBId,
      },
    });
    orgBEventMatchId = matchB.id;
  });

  it("loads the EventMatch live pre-match package under a valid actor context, with goal/assist/rotation candidates resolved", async () => {
    const { getEventLiveMatchPreMatchPackageAction } = await import("../[eventId]/event-live-actions");

    const result = await getEventLiveMatchPreMatchPackageAction(orgAEventMatchId);

    expect(result.success).toBe(true);
    if (!result.success) return;
    // The returned `squad` array is exactly what feeds the goal scorer, assist, and
    // rotation/substitution player pickers in LiveMatchClient — this is the concrete
    // manifestation of "cannot select players when recording goals/assists".
    expect(result.data.squad.map((p) => p.playerId).sort()).toEqual([...orgAPlayerIds].sort());
    expect(result.data.eventId).toBeTruthy();
    expect(result.data.activeSession).toBeNull();
  });

  it("still rejects the same underlying EventMatch query with no trusted organisation context", async () => {
    await expect(db.eventMatch.findFirst({ where: { id: orgAEventMatchId } })).rejects.toThrow(
      TenantContextError,
    );
  });

  it("denies loading another organisation's EventMatch live package (cross-tenant access)", async () => {
    const { getEventLiveMatchPreMatchPackageAction } = await import("../[eventId]/event-live-actions");

    const result = await getEventLiveMatchPreMatchPackageAction(orgBEventMatchId);

    expect(result.success).toBe(false);
  });

  it("starting a live session and then reloading the pre-match package (page refresh) both succeed", async () => {
    const { startEventLiveSessionAction, getEventLiveMatchPreMatchPackageAction } = await import(
      "../[eventId]/event-live-actions"
    );

    const started = await startEventLiveSessionAction(orgAEventMatchId);
    expect(started.success).toBe(true);

    // Simulates a page refresh/re-fetch after live reporting has started: a fresh call into the
    // action, with no leftover in-process state to lean on.
    const reloaded = await getEventLiveMatchPreMatchPackageAction(orgAEventMatchId);
    expect(reloaded.success).toBe(true);
    if (!reloaded.success) return;
    expect(reloaded.data.activeSession).not.toBeNull();
    expect(reloaded.data.squad.length).toBe(orgAPlayerIds.length);
  });

  it("resolves recent live events for the same match after context is established (rotation/goal history)", async () => {
    const { getRecentEventEventsAction } = await import("../[eventId]/event-live-actions");

    const result = await getRecentEventEventsAction(orgAEventMatchId);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual([]);
  });
});
