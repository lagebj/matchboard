import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { buildLineupReviewContext } from "@/lib/ai/context/lineup-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

describe("ai/context/lineup-review", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.plannedRotationChange.deleteMany({});
    await testDb.plannedRotation.deleteMany({});
    await testDb.selection.deleteMany({});
    // shrink the squad-completeness threshold down to the 4 players seeded per team
    await testDb.match.update({ where: { id: fixtureIds.matches["Bla"] }, data: { squadSize: 2 } });
  });

  it("returns null when the scope id does not resolve to a Match in this organisation", async () => {
    const context = await buildLineupReviewContext({ organisationId: fixtureIds.organisationId, scopeId: "does-not-exist" });
    expect(context).toBeNull();
  });

  it("returns null when the starting line-up is not yet complete", async () => {
    const context = await buildLineupReviewContext({ organisationId: fixtureIds.organisationId, scopeId: fixtureIds.matches["Bla"] });
    expect(context).toBeNull();
  });

  it("builds a normalized context once a complete line-up is saved, covering squad, formation, planned rotations, match format, and opportunity history", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const blaTeamId = fixtureIds.teams["Bla"];
    const [core1, core2, support1] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    await testDb.match.update({ where: { id: blaMatchId }, data: { formation: "4-4-2" } });

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

    const context = await buildLineupReviewContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as Record<string, unknown>;
    expect(normalized.squad).toHaveLength(3);
    expect(normalized.formation).toEqual({ matchRef: "M01", formation: "4-4-2", lineup: null, evidenceRef: "fact:formation:M01" });
    expect(normalized.plannedRotations).toHaveLength(1);
    expect(normalized.opportunityHistory).toHaveLength(3);

    for (const evidenceRef of context.evidenceRefs) {
      expect(evidenceRef).toMatch(/^fact:[a-z][a-z-]*:[A-Za-z0-9]+(?::[A-Za-z0-9-]+)?$/);
    }
    for (const [externalRef] of context.refMap) {
      expect(externalRef).toMatch(/^[A-Z]\d{2,4}$/);
    }

    const fingerprintA = computeSourceFingerprint(context.normalizedContext);
    const contextAgain = await buildLineupReviewContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    const fingerprintB = computeSourceFingerprint(contextAgain!.normalizedContext);
    expect(fingerprintA).toBe(fingerprintB);
  });

  it("counts season-to-date opportunity history across other FINALIZED rounds in the same league season", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    const otherRound = await testDb.matchRound.create({
      data: { name: "Round 0", leagueSeasonId: fixtureIds.leagueSeasonId, status: "FINALIZED", organisationId: fixtureIds.organisationId },
    });
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
      data: { matchId: otherMatch.id, matchRoundId: otherRound.id, playerId: core1.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
    });

    await testDb.selection.createMany({
      data: [
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core1.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core2.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
      ],
    });

    const context = await buildLineupReviewContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    expect(context).not.toBeNull();
    const normalized = context!.normalizedContext as { opportunityHistory: { playerRef: string; seasonAppearances: number }[] };
    const core1Ref = normalized.opportunityHistory.find((o) => o.seasonAppearances === 2);
    expect(core1Ref).toBeDefined();
  });

  // ARR-0051: a Tactics-panel-only edit (MatchLineup/MatchLineupAssignment) must be visible to
  // the Advisor even when Selection itself is untouched -- this was the actual production bug.
  it("surfaces the Tactics panel's formation-slot assignment as assignedPosition, distinct from the player's primaryPosition", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const blaTeamId = fixtureIds.teams["Bla"];
    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    await testDb.selection.createMany({
      data: [
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core1.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core2.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
      ],
    });

    const formation = await testDb.formation.create({
      data: { name: "4-4-2 Diamond", gameFormat: "SEVEN_A_SIDE", source: "SYSTEM", organisationId: fixtureIds.organisationId },
    });
    const slot = await testDb.formationSlot.create({
      data: { formationId: formation.id, gridX: 2, gridY: 4, label: "Striker", shortLabel: "ST", roleType: "FORWARD", organisationId: fixtureIds.organisationId },
    });
    const lineup = await testDb.matchLineup.create({
      data: { matchId: blaMatchId, teamId: blaTeamId, formationId: formation.id, organisationId: fixtureIds.organisationId },
    });
    await testDb.matchLineupAssignment.create({
      data: { matchLineupId: lineup.id, slotId: slot.id, playerId: core1.id, organisationId: fixtureIds.organisationId },
    });

    const context = await buildLineupReviewContext({ organisationId: fixtureIds.organisationId, scopeId: blaMatchId });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as {
      squad: { playerRef: string; assignedPosition: string | null }[];
      formation: { lineup: { name: string; assignedPlayerCount: number } | null } | null;
    };
    const assignedFacts = normalized.squad.filter((s) => s.assignedPosition !== null);
    expect(assignedFacts).toHaveLength(1);
    expect(assignedFacts[0].assignedPosition).toBe("Forward");
    expect(normalized.formation?.lineup).toEqual({ name: "4-4-2 Diamond", gameFormat: "SEVEN_A_SIDE", assignedPlayerCount: 1 });
  });
});
