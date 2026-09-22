import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { buildPostMatchReviewContext } from "@/lib/ai/context/post-match-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

describe("ai/context/post-match-review", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns null when the scope id resolves to neither a League Match nor an EventMatch", async () => {
    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: "does-not-exist" });
    expect(context).toBeNull();
  });

  it("returns null when the League report has not reached LOCKED", async () => {
    const matchId = fixtureIds.matches["Bla"];
    await testDb.postMatchReport.create({
      data: { matchId, status: "DRAFT", organisationId: fixtureIds.organisationId },
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    expect(context).toBeNull();
  });

  it("builds a normalized context from a LOCKED League report's goals, assists, attendance, and minutes", async () => {
    const matchId = fixtureIds.matches["Hvit"];
    const [scorer, assister, benchPlayer] = fixtureIds.players.filter((p) => p.coreTeamName === "Hvit");

    const match = await testDb.match.findUniqueOrThrow({ where: { id: matchId }, select: { homeAway: true } });
    const report = await testDb.postMatchReport.create({
      data: {
        matchId,
        status: "LOCKED",
        organisationId: fixtureIds.organisationId,
        homeGoals: match.homeAway === "HOME" ? 2 : 0,
        awayGoals: match.homeAway === "HOME" ? 0 : 2,
      },
    });

    await testDb.goal.createMany({
      data: [
        { reportId: report.id, playerId: scorer.id, minute: 12, organisationId: fixtureIds.organisationId },
        { reportId: report.id, playerId: scorer.id, minute: 55, organisationId: fixtureIds.organisationId },
      ],
    });
    await testDb.assist.create({
      data: { reportId: report.id, playerId: assister.id, organisationId: fixtureIds.organisationId },
    });
    await testDb.postMatchPlayerActual.createMany({
      data: [
        { reportId: report.id, matchId, playerId: scorer.id, attendanceStatus: "PRESENT", organisationId: fixtureIds.organisationId },
        { reportId: report.id, matchId, playerId: assister.id, attendanceStatus: "PRESENT", organisationId: fixtureIds.organisationId },
        { reportId: report.id, matchId, playerId: benchPlayer.id, attendanceStatus: "NO_SHOW", organisationId: fixtureIds.organisationId },
      ],
    });
    await testDb.actualPositionInterval.create({
      data: {
        matchId,
        playerId: scorer.id,
        position: "ST",
        startedAtMs: 0,
        endedAtMs: 60 * 60_000,
        source: "LIVE_RECORDED",
        organisationId: fixtureIds.organisationId,
      },
    });
    // Still-open interval — must not contribute estimated minutes.
    await testDb.actualPositionInterval.create({
      data: {
        matchId,
        playerId: assister.id,
        position: "CM",
        startedAtMs: 0,
        endedAtMs: null,
        source: "LIVE_RECORDED",
        organisationId: fixtureIds.organisationId,
      },
    });
    await testDb.developmentThread.create({
      data: {
        playerId: scorer.id,
        focus: "Finishing under pressure",
        category: "CONFIDENCE_REBUILD",
        status: "ACTIVE",
        organisationId: fixtureIds.organisationId,
      },
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    expect(context).not.toBeNull();
    if (!context) return;

    // Never a real player id/name, only ephemeral refs — reversed via refMap only.
    const serialized = JSON.stringify(context.normalizedContext);
    expect(serialized).not.toContain(scorer.id);
    expect(serialized).not.toContain(scorer.firstName);
    expect(serialized).toMatch(/"ref":"M01"/);

    const scorerRef = [...context.refMap.entries()].find(([, target]) => target.entityId === scorer.id)?.[0];
    const assisterRef = [...context.refMap.entries()].find(([, target]) => target.entityId === assister.id)?.[0];
    const benchRef = [...context.refMap.entries()].find(([, target]) => target.entityId === benchPlayer.id)?.[0];
    expect(scorerRef).toBeDefined();
    expect(assisterRef).toBeDefined();
    expect(benchRef).toBeDefined();

    expect(context.refMap.get("M01")).toEqual({ subjectType: "MATCH", entityId: matchId });

    const normalized = context.normalizedContext as {
      match: { score: { ourScore: number; opponentScore: number } };
      goals: { playerRef: string; minute: number }[];
      assists: { playerRef: string }[];
      minutes: { playerRef: string; minutes: number; evidenceRef: string }[];
      attendance: { playerRef: string; status: string; evidenceRef: string }[];
      developmentFocus: { playerRef: string; categories: string[]; evidenceRef: string }[];
    };

    expect(normalized.match.score).toEqual({ ourScore: 2, opponentScore: 0, evidenceRef: "fact:score:M01" });
    expect(normalized.goals).toHaveLength(2);
    expect(normalized.goals.every((g) => g.playerRef === scorerRef)).toBe(true);
    expect(normalized.assists).toEqual([{ playerRef: assisterRef, evidenceRef: expect.any(String) }]);
    expect(normalized.minutes).toEqual(
      expect.arrayContaining([
        { playerRef: scorerRef, minutes: 60, evidenceRef: `fact:minutes:${scorerRef}` },
        { playerRef: assisterRef, minutes: 0, evidenceRef: `fact:minutes:${assisterRef}` },
      ]),
    );
    expect(normalized.minutes).toHaveLength(2);
    expect(normalized.attendance).toContainEqual({ playerRef: benchRef, status: "NO_SHOW", evidenceRef: `fact:attendance:${benchRef}` });
    expect(normalized.developmentFocus).toEqual([{ playerRef: scorerRef, categories: ["CONFIDENCE_REBUILD"], evidenceRef: `fact:development-focus:${scorerRef}` }]);


    for (const evidenceRef of [`fact:score:M01`, `fact:goal:${scorerRef}:1`, `fact:goal:${scorerRef}:2`, `fact:assist:${assisterRef}:1`, `fact:minutes:${scorerRef}`, `fact:attendance:${benchRef}`, `fact:development-focus:${scorerRef}`]) {
      expect(context.evidenceRefs.has(evidenceRef)).toBe(true);
    }

    // Deterministic: rebuilding from the same unchanged data yields the same fingerprint.
    const second = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: matchId });
    expect(second).not.toBeNull();
    expect(computeSourceFingerprint(context.normalizedContext)).toBe(computeSourceFingerprint(second!.normalizedContext));
  });

  it("builds a normalized context from a LOCKED Event report, using its own ourScore/opponentScore fields", async () => {
    const [player] = fixtureIds.players.filter((p) => p.coreTeamName === "Rod");

    const event = await testDb.event.create({
      data: {
        name: "Test tournament",
        eventType: "TOURNAMENT",
        startsAt: new Date("2025-05-10T09:00:00Z"),
        gameFormat: "ELEVEN_A_SIDE",
        footballGroupId: fixtureIds.footballGroupId,
        organisationId: fixtureIds.organisationId,
      },
    });
    const squad = await testDb.eventSquad.create({
      data: { name: "Event squad", eventId: event.id, intent: "MANUAL", targetSize: 11, organisationId: fixtureIds.organisationId },
    });
    const eventMatch = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        opponentName: "Event Opponent",
        startsAt: new Date("2025-05-10T10:00:00Z"),
        organisationId: fixtureIds.organisationId,
      },
    });
    const report = await testDb.eventPostMatchReport.create({
      data: { eventMatchId: eventMatch.id, status: "LOCKED", ourScore: 4, opponentScore: 2, organisationId: fixtureIds.organisationId },
    });
    await testDb.eventGoalEvent.create({
      data: { reportId: report.id, playerId: player.id, minute: 30, organisationId: fixtureIds.organisationId },
    });
    await testDb.eventPostMatchPlayer.create({
      data: { reportId: report.id, playerId: player.id, attendanceStatus: "PRESENT", organisationId: fixtureIds.organisationId },
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: eventMatch.id });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as { match: { score: { ourScore: number; opponentScore: number } } };
    expect(normalized.match.score).toEqual({ ourScore: 4, opponentScore: 2, evidenceRef: "fact:score:M01" });
    expect(context.refMap.get("M01")).toEqual({ subjectType: "MATCH", entityId: eventMatch.id });
  });
});
