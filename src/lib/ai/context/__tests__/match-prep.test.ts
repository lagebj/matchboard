import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { buildMatchPrepContext } from "@/lib/ai/context/match-prep";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

describe("ai/context/match-prep", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.opponentSportingEvidence.deleteMany({});
    await testDb.opponentEncounterObservation.deleteMany({});
    await testDb.developmentThread.deleteMany({});
    await testDb.plannedRotationChange.deleteMany({});
    await testDb.plannedRotation.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.match.update({ where: { id: fixtureIds.matches["Bla"] }, data: { squadSize: 2, status: "SCHEDULED" } });
  });

  it("returns null when the scope id does not resolve to a Match in this organisation", async () => {
    const context = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: "does-not-exist" });
    expect(context).toBeNull();
  });

  it("returns null when the match has been cancelled", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await testDb.selection.createMany({
      data: [
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core1.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core2.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
      ],
    });
    await testDb.match.update({ where: { id: blaMatchId }, data: { status: "CANCELLED" } });

    const context = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    expect(context).toBeNull();
  });

  it("returns null when no complete plan exists yet", async () => {
    const context = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: fixtureIds.matches["Bla"] });
    expect(context).toBeNull();
  });

  it("builds a normalized context covering squad, formation, rotations, development focus, participation, and opponent evidence", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const blaTeamId = fixtureIds.teams["Bla"];
    const [core1, core2, support1] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    const match = await testDb.match.findUniqueOrThrow({ where: { id: blaMatchId }, select: { opponentTeamId: true } });
    expect(match.opponentTeamId).not.toBeNull();

    await testDb.match.update({ where: { id: blaMatchId }, data: { formation: "4-3-3" } });

    await testDb.selection.createMany({
      data: [
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core1.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core2.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: support1.id, role: "SUPPORT", status: "DRAFT", organisationId: fixtureIds.organisationId },
      ],
    });

    const rotation = await testDb.plannedRotation.create({
      data: { matchId: blaMatchId, teamId: blaTeamId, status: "DRAFT", organisationId: fixtureIds.organisationId },
    });
    await testDb.plannedRotationChange.create({
      data: {
        plannedRotationId: rotation.id,
        sequence: 1,
        outPlayerId: core1.id,
        inPlayerId: support1.id,
        outPosition: "CB",
        inPosition: "CB",
        approximateMatchSeconds: 1800,
        organisationId: fixtureIds.organisationId,
      },
    });

    await testDb.developmentThread.create({
      data: { playerId: core1.id, focus: "Improve first touch", category: "BALL_CONTROL", status: "ACTIVE", organisationId: fixtureIds.organisationId },
    });

    const otherMatch = await testDb.match.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        teamId: blaTeamId,
        opponent: "Opponent Bla",
        opponentTeamId: match.opponentTeamId,
        startsAt: new Date("2025-01-01T10:00:00Z"),
        homeAway: "AWAY",
        organisationId: fixtureIds.organisationId,
      },
    });
    await testDb.opponentSportingEvidence.create({
      data: {
        matchId: otherMatch.id,
        opponentTeamId: match.opponentTeamId!,
        occurredAt: new Date("2025-01-01T10:00:00Z"),
        goalsFor: 2,
        goalsAgainst: 1,
        participantCount: 11,
        ratedParticipantCount: 11,
        estimate: 5.5,
        formulaVersion: "v1",
        organisationId: fixtureIds.organisationId,
      },
    });
    await testDb.opponentEncounterObservation.create({
      data: {
        matchId: otherMatch.id,
        opponentTeamId: match.opponentTeamId!,
        overallEnvironment: "POSITIVE",
        sportingLevel: 6,
        playingStyleTags: ["HIGH_PRESSING"],
        concernCategories: [],
        factualSummary: "should be excluded",
        sportingLevelNote: "should be excluded",
        organisationId: fixtureIds.organisationId,
      },
    });

    const context = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as Record<string, unknown>;
    expect(normalized.squad).toHaveLength(3);
    expect(normalized.formation).toEqual({ matchRef: "M01", formation: "4-3-3" });
    expect(normalized.plannedRotations).toHaveLength(1);
    expect(normalized.developmentFocus).toHaveLength(1);
    expect(normalized.recentParticipation).toHaveLength(3);
    expect(normalized.opponentSportingEvidence).toHaveLength(1);
    expect(normalized.opponentEncounterEvidence).toHaveLength(1);

    expect(JSON.stringify(normalized)).not.toContain("should be excluded");

    for (const evidenceRef of context.evidenceRefs) {
      expect(evidenceRef).toMatch(/^fact:[a-z][a-z-]*:[A-Za-z0-9]+(?::[A-Za-z0-9-]+)?$/);
    }
    for (const [externalRef] of context.refMap) {
      expect(externalRef).toMatch(/^[A-Z]\d{2,4}$/);
    }

    const fingerprintA = computeSourceFingerprint(context.normalizedContext);
    const contextAgain = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    const fingerprintB = computeSourceFingerprint(contextAgain!.normalizedContext);
    expect(fingerprintA).toBe(fingerprintB);
  });
});
