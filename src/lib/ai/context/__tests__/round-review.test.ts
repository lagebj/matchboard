import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { buildRoundReviewContext } from "@/lib/ai/context/round-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

describe("ai/context/round-review", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.warning.deleteMany({});
    await testDb.matchHelperAssignment.deleteMany({});
    await testDb.availability.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "DRAFT" } });
  });

  it("returns null when the scope id does not resolve to a MatchRound in this organisation", async () => {
    const context = await buildRoundReviewContext({ organisationId: fixtureIds.organisationId, scopeId: "does-not-exist" });
    expect(context).toBeNull();
  });

  it("returns null when the round has not reached FINALIZED", async () => {
    const context = await buildRoundReviewContext({ organisationId: fixtureIds.organisationId, scopeId: fixtureIds.matchRoundId });
    expect(context).toBeNull();
  });

  it("builds a normalized context from a FINALIZED round's allocation, availability, support movements, rule outcomes, and opportunity history", async () => {
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });

    const blaMatchId = fixtureIds.matches["Bla"];
    const blaTeamId = fixtureIds.teams["Bla"];
    const hvitTeamId = fixtureIds.teams["Hvit"];
    const [blaCore, blaSupport] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    const [hvitPlayer] = fixtureIds.players.filter((p) => p.coreTeamName === "Hvit");

    await testDb.selection.createMany({
      data: [
        {
          matchId: blaMatchId,
          matchRoundId: fixtureIds.matchRoundId,
          playerId: blaCore.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: fixtureIds.organisationId,
        },
        {
          matchId: blaMatchId,
          matchRoundId: fixtureIds.matchRoundId,
          playerId: blaSupport.id,
          role: "SUPPORT",
          status: "FINALIZED",
          organisationId: fixtureIds.organisationId,
        },
      ],
    });

    await testDb.availability.create({
      data: { playerId: hvitPlayer.id, matchRoundId: fixtureIds.matchRoundId, status: "TENTATIVE", organisationId: fixtureIds.organisationId },
    });

    // hvitPlayer helps out Bla's match — a cross-team support/helper movement.
    await testDb.matchHelperAssignment.create({
      data: { matchId: blaMatchId, playerId: hvitPlayer.id, sourceTeamId: hvitTeamId, organisationId: fixtureIds.organisationId },
    });

    await testDb.warning.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        matchId: blaMatchId,
        teamId: blaTeamId,
        severity: "WARNING",
        rule: "SUPPORT_FAIRNESS",
        message: "Support rotation is uneven this round.",
        organisationId: fixtureIds.organisationId,
      },
    });

    const context = await buildRoundReviewContext({ organisationId: fixtureIds.organisationId, scopeId: fixtureIds.matchRoundId });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as Record<string, unknown>;
    expect(normalized.roundAllocation).toHaveLength(2);
    expect(normalized.availability).toHaveLength(1);
    expect(normalized.supportMovements).toHaveLength(1);
    expect(normalized.ruleOutcomes).toHaveLength(1);
    expect(normalized.opportunityHistory).toHaveLength(3); // blaCore, blaSupport, hvitPlayer

    for (const evidenceRef of context.evidenceRefs) {
      expect(evidenceRef).toMatch(/^fact:[a-z][a-z-]*:[A-Za-z0-9]+(?::[A-Za-z0-9-]+)?$/);
    }
    for (const [externalRef] of context.refMap) {
      expect(externalRef).toMatch(/^[A-Z]\d{2,4}$/);
    }

    const fingerprintA = computeSourceFingerprint(context.normalizedContext);
    const contextAgain = await buildRoundReviewContext({ organisationId: fixtureIds.organisationId, scopeId: fixtureIds.matchRoundId });
    const fingerprintB = computeSourceFingerprint(contextAgain!.normalizedContext);
    expect(fingerprintA).toBe(fingerprintB);
  });

  it("counts season-to-date opportunity history across other FINALIZED rounds in the same league season", async () => {
    const otherRound = await testDb.matchRound.create({
      data: { name: "Round 0", leagueSeasonId: fixtureIds.leagueSeasonId, status: "FINALIZED", organisationId: fixtureIds.organisationId },
    });
    const blaPlayer = fixtureIds.players.find((p) => p.coreTeamName === "Bla")!;
    const otherMatch = await testDb.match.create({
      data: {
        matchRoundId: otherRound.id,
        teamId: fixtureIds.teams["Bla"],
        opponent: "Historic Opponent",
        startsAt: new Date("2025-01-01T10:00:00Z"),
        homeAway: "HOME",
        organisationId: fixtureIds.organisationId,
      },
    });
    await testDb.selection.create({
      data: {
        matchId: otherMatch.id,
        matchRoundId: otherRound.id,
        playerId: blaPlayer.id,
        role: "CORE",
        status: "FINALIZED",
        organisationId: fixtureIds.organisationId,
      },
    });

    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });
    await testDb.selection.create({
      data: {
        matchId: fixtureIds.matches["Bla"],
        matchRoundId: fixtureIds.matchRoundId,
        playerId: blaPlayer.id,
        role: "CORE",
        status: "FINALIZED",
        organisationId: fixtureIds.organisationId,
      },
    });

    const context = await buildRoundReviewContext({ organisationId: fixtureIds.organisationId, scopeId: fixtureIds.matchRoundId });
    expect(context).not.toBeNull();
    const normalized = context!.normalizedContext as { opportunityHistory: { playerRef: string; seasonAppearances: number }[] };
    expect(normalized.opportunityHistory).toHaveLength(1);
    expect(normalized.opportunityHistory[0].seasonAppearances).toBe(2);
  });
});
