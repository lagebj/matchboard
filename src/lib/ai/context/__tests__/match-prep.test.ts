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
        // ADR-0149 Decision 3's narrow exception: an exact-opponent prior encounter's
        // factualSummary is now eligible, bounded, attributed input -- sportingLevelNote must
        // remain excluded exactly as before (it stays an in-progress subjective note, never a
        // settled post-encounter summary).
        factualSummary: "Difficult playing centrally against their press.",
        sportingLevelNote: "must never appear in context",
        organisationId: fixtureIds.organisationId,
      },
    });

    const context = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as Record<string, unknown>;
    expect(normalized.squad).toHaveLength(3);
    expect(normalized.formation).toEqual({ matchRef: "M01", formation: "4-3-3", evidenceRef: "fact:formation:M01" });
    expect(normalized.plannedRotations).toHaveLength(1);

    const players = normalized.players as Array<Record<string, unknown>>;
    expect(players).toHaveLength(3); // core1, core2, support1 -- the union of squad + rotation players.

    const core1Ref = [...context.refMap.entries()].find(([, target]) => target.entityId === core1.id)?.[0];
    expect(core1Ref).toBeDefined();
    const core1Profile = players.find((p) => p.ref === core1Ref);
    expect(core1Profile).toBeDefined();
    expect(core1Profile?.development).toEqual([{ category: "BALL_CONTROL" }]);

    expect(Array.isArray(normalized.combinations)).toBe(true);
    expect(normalized.teamHistory).toBeDefined();
    expect(normalized.rotationContext).toHaveLength(1);

    const opponentContext = normalized.opponentContext as Record<string, unknown>;
    expect(opponentContext.exactOpponentHistoryAvailable).toBe(true);
    expect(opponentContext.previousEncounterCount).toBe(1);
    const previousEncounters = opponentContext.previousEncounters as Array<Record<string, unknown>>;
    expect(previousEncounters).toHaveLength(1);
    expect(previousEncounters[0].goalsFor).toBe(2);
    expect(previousEncounters[0].goalsAgainst).toBe(1);
    const trustedObservation = previousEncounters[0].trustedObservation as Record<string, unknown>;
    expect(trustedObservation.text).toBe("Difficult playing centrally against their press.");
    expect(trustedObservation.source).toBe("OPPONENT_ENCOUNTER_SUMMARY");

    // Never a database id anywhere in the AI-bound context -- every entity is an ephemeral ref,
    // and a previous encounter's own match id is never included at all (ADR-0148 Decision 5).
    expect(previousEncounters[0]).not.toHaveProperty("matchId");
    expect(JSON.stringify(normalized)).not.toContain(otherMatch.id);
    expect(JSON.stringify(normalized)).not.toContain("must never appear in context");

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

  it("keeps the fingerprint unchanged when nothing semantically relevant changes, and changes it when the plan does (acceptance E1/E3)", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    // Explicit baseline -- `formation` is not reset by `beforeEach` and can leak from a prior
    // test in this file, so pin it rather than assume null.
    await testDb.match.update({ where: { id: blaMatchId }, data: { formation: "4-3-3" } });

    await testDb.selection.createMany({
      data: [
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core1.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core2.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
      ],
    });

    const contextA1 = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    const contextA2 = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    expect(contextA1).not.toBeNull();
    expect(computeSourceFingerprint(contextA1!.normalizedContext)).toBe(computeSourceFingerprint(contextA2!.normalizedContext));

    // A meaningful plan change (formation) must change the fingerprint.
    await testDb.match.update({ where: { id: blaMatchId }, data: { formation: "4-4-2" } });
    const contextB = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    expect(computeSourceFingerprint(contextB!.normalizedContext)).not.toBe(computeSourceFingerprint(contextA1!.normalizedContext));

    // Undoing the change reproduces fingerprint A exactly (acceptance E5).
    await testDb.match.update({ where: { id: blaMatchId }, data: { formation: "4-3-3" } });
    const contextA3 = await buildMatchPrepContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    expect(computeSourceFingerprint(contextA3!.normalizedContext)).toBe(computeSourceFingerprint(contextA1!.normalizedContext));
  });
});
