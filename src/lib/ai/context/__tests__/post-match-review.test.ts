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
import { EVIDENCE_REF_PATTERN } from "@/lib/ai/contracts";
import { createTestOpponentTeam, createTestMatch } from "@/test/support/factories";
import { recordDeterministicExtraction } from "@/lib/evidence/qualitative-evidence-service";

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
      actual: {
        goals: { playerRef: string; minute: number }[];
        assists: { playerRef: string }[];
        minutes: { playerRef: string; minutes: number; evidenceRef: string }[];
        attendance: { playerRef: string; status: string; evidenceRef: string }[];
      };
      developmentFocus: { playerRef: string; categories: string[]; evidenceRef: string }[];
    };

    expect(normalized.match.score).toEqual({ ourScore: 2, opponentScore: 0, evidenceRef: "fact:score:M01" });
    expect(normalized.actual.goals).toHaveLength(2);
    expect(normalized.actual.goals.every((g) => g.playerRef === scorerRef)).toBe(true);
    expect(normalized.actual.assists).toEqual([{ playerRef: assisterRef, evidenceRef: expect.any(String) }]);
    expect(normalized.actual.minutes).toEqual(
      expect.arrayContaining([
        { playerRef: scorerRef, minutes: 60, evidenceRef: `fact:minutes:${scorerRef}` },
        { playerRef: assisterRef, minutes: 0, evidenceRef: `fact:minutes:${assisterRef}` },
      ]),
    );
    expect(normalized.actual.minutes).toHaveLength(2);
    expect(normalized.actual.attendance).toContainEqual({ playerRef: benchRef, status: "NO_SHOW", evidenceRef: `fact:attendance:${benchRef}` });
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

/** ADR-0152 Slice 4c — the richer v2 sections (bundle §6). */
describe("ai/context/post-match-review v2", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  const teamId = () => Object.values(fixtureIds.teams)[0]!;

  async function lockLeagueReport(opts: { opponentTeamId?: string | null } = {}) {
    const match = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, teamId(), opts.opponentTeamId ?? null);
    const report = await testDb.postMatchReport.create({
      data: { matchId: match.id, status: "LOCKED", organisationId: fixtureIds.organisationId, homeGoals: 1, awayGoals: 0 },
    });
    return { match, report };
  }

  it("includes bench-interval and substitution facts derived from the same ActualPositionInterval rows minutes reads", async () => {
    const { match, report } = await lockLeagueReport();
    const [starter, sub] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await testDb.postMatchPlayerActual.createMany({
      data: [
        { reportId: report.id, matchId: match.id, playerId: starter.id, attendanceStatus: "PRESENT", organisationId: fixtureIds.organisationId },
        { reportId: report.id, matchId: match.id, playerId: sub.id, attendanceStatus: "PRESENT", organisationId: fixtureIds.organisationId },
      ],
    });
    await testDb.actualPositionInterval.createMany({
      data: [
        { matchId: match.id, playerId: starter.id, position: "ST", startedAtMs: 0, endedAtMs: 40 * 60_000, source: "LIVE_RECORDED", organisationId: fixtureIds.organisationId },
        { matchId: match.id, playerId: sub.id, position: "BENCH", startedAtMs: 0, endedAtMs: 40 * 60_000, source: "STARTING_LINEUP", organisationId: fixtureIds.organisationId },
        { matchId: match.id, playerId: sub.id, position: "ST", startedAtMs: 40 * 60_000, endedAtMs: 60 * 60_000, source: "SUBSTITUTION", organisationId: fixtureIds.organisationId },
      ],
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: match.id });
    expect(context).not.toBeNull();
    if (!context) return;
    const subRef = [...context.refMap.entries()].find(([, t]) => t.entityId === sub.id)?.[0];

    const normalized = context.normalizedContext as { actual: { benchIntervals: { playerRef: string }[]; substitutions: { playerRef: string; position: string }[] } };
    expect(normalized.actual.benchIntervals).toEqual([expect.objectContaining({ playerRef: subRef })]);
    expect(normalized.actual.substitutions).toEqual([expect.objectContaining({ playerRef: subRef, position: "ST" })]);
  });

  it("includes recovered-timing facts from MatchPeriodTimingResolution", async () => {
    const { match } = await lockLeagueReport();
    await testDb.matchPeriodTimingResolution.create({
      data: {
        matchId: match.id,
        organisationId: fixtureIds.organisationId,
        period: "FIRST_HALF",
        rawElapsedMs: 40 * 60_000,
        resolvedDurationMs: 22 * 60_000,
        resolutionSource: "RECOVERED_BOUNDED",
        reviewStatus: "REVIEWED",
      },
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: match.id });
    expect(context).not.toBeNull();
    if (!context) return;
    const normalized = context.normalizedContext as { match: { recoveredTiming: { period: string; resolvedDurationMinutes: number; reviewStatus: string }[] } };
    expect(normalized.match.recoveredTiming).toEqual([expect.objectContaining({ period: "FIRST_HALF", resolvedDurationMinutes: 22, reviewStatus: "REVIEWED" })]);
    // MatchPeriod enum values are SCREAMING_SNAKE_CASE; a raw one embedded in an evidenceRef
    // would fail contracts.ts's own EVIDENCE_REF_PATTERN (no underscores allowed in a ref
    // segment) — a real bug caught this way once already, see toRefSegment()'s doc comment.
    for (const evidenceRef of context.evidenceRefs) {
      expect(evidenceRef).toMatch(EVIDENCE_REF_PATTERN);
    }
  });

  it("includes raw debrief text, TeamReflection, opponent encounter, and report teamNote as current qualitative evidence", async () => {
    const opponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);
    const { match, report } = await lockLeagueReport({ opponentTeamId: opponent.id });
    await testDb.postMatchReport.update({ where: { id: report.id }, data: { teamNote: "Good response after conceding." } });
    await testDb.postMatchDebrief.create({
      data: {
        organisationId: fixtureIds.organisationId,
        postMatchReportId: report.id,
        status: "SUBMITTED",
        answers: { version: 1, answers: { team_execution: { effort: { value: "STRONG" } }, worked: { selected: ["PRESSING"], comment: "Won it back high." }, needs_attention: { selected: ["NOTHING_TO_ADD"] }, match_changes: { option: "NO_MEANINGFUL_CHANGE" }, opponent_memory: { note: "Weak on their left." }, player_observations: [], anything_else: {} } },
      },
    });
    await testDb.teamReflection.create({ data: { organisationId: fixtureIds.organisationId, matchId: match.id, effort: "STRONG", note: "Solid effort." } });
    await testDb.opponentEncounterObservation.create({ data: { organisationId: fixtureIds.organisationId, matchId: match.id, opponentTeamId: opponent.id, factualSummary: "Physical side." } });
    await recordDeterministicExtraction({
      organisationId: fixtureIds.organisationId,
      teamId: teamId(),
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: "debrief-x",
      fingerprintPayload: { x: 1 },
      subject: { matchId: match.id },
      observations: [{ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Won it back high." }],
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: match.id });
    expect(context).not.toBeNull();
    if (!context) return;
    const normalized = context.normalizedContext as {
      currentQualitativeEvidence: {
        debrief: { worked: { selected: string[]; comment: string } } | null;
        teamReflection: { effort: string; note: string } | null;
        opponentEncounter: { factualSummary: string } | null;
        reportTeamNote: { note: string } | null;
        activeQualitativeObservations: { statement: string }[];
      };
    };
    expect(normalized.currentQualitativeEvidence.debrief?.worked).toEqual({ selected: ["PRESSING"], comment: "Won it back high." });
    expect(normalized.currentQualitativeEvidence.teamReflection).toMatchObject({ effort: "STRONG", note: "Solid effort." });
    expect(normalized.currentQualitativeEvidence.opponentEncounter).toEqual({ factualSummary: "Physical side.", evidenceRef: expect.any(String) });
    expect(normalized.currentQualitativeEvidence.reportTeamNote).toEqual({ note: "Good response after conceding.", evidenceRef: expect.any(String) });
    expect(normalized.currentQualitativeEvidence.activeQualitativeObservations).toEqual([expect.objectContaining({ statement: "Won it back high." })]);
  });

  it("populates Plan/PlayerContext/OpponentHistory for a League match (Match Insights domain layer)", async () => {
    const opponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);
    const { match } = await lockLeagueReport({ opponentTeamId: opponent.id });
    const [player] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    await testDb.selection.create({
      data: { matchId: match.id, matchRoundId: fixtureIds.matchRoundId, playerId: player.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: match.id });
    expect(context).not.toBeNull();
    if (!context) return;
    const playerRef = [...context.refMap.entries()].find(([, t]) => t.entityId === player.id)?.[0];

    const normalized = context.normalizedContext as {
      plan: { plannedSquadSize: number };
      playerContext: { playerRef: string; declaredPositions: unknown }[];
      opponentHistory: { exactOpponentHistoryAvailable: boolean } | null;
    };
    expect(normalized.plan.plannedSquadSize).toBe(1);
    expect(normalized.playerContext).toContainEqual(expect.objectContaining({ playerRef }));
    expect(normalized.opponentHistory).not.toBeNull();
  });

  it("ranks recent team patterns with same-opponent priority, excludes matches outside the 42-day window, and caps at 8 matches", async () => {
    const sameOpponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);
    const otherOpponent = await createTestOpponentTeam(testDb, fixtureIds.organisationId);

    const currentMatch = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, teamId(), sameOpponent.id, { startsAt: new Date("2026-06-15T10:00:00Z") });
    await testDb.postMatchReport.create({ data: { matchId: currentMatch.id, status: "LOCKED", organisationId: fixtureIds.organisationId } });

    const priorSameOpponent = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, teamId(), sameOpponent.id, { startsAt: new Date("2026-06-01T10:00:00Z") });
    await testDb.postMatchReport.create({ data: { matchId: priorSameOpponent.id, status: "LOCKED", organisationId: fixtureIds.organisationId } });

    const priorOtherOpponent = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, teamId(), otherOpponent.id, { startsAt: new Date("2026-05-20T10:00:00Z") });
    await testDb.postMatchReport.create({ data: { matchId: priorOtherOpponent.id, status: "LOCKED", organisationId: fixtureIds.organisationId } });

    const outOfWindow = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, teamId(), otherOpponent.id, { startsAt: new Date("2026-01-01T10:00:00Z") });
    await testDb.postMatchReport.create({ data: { matchId: outOfWindow.id, status: "LOCKED", organisationId: fixtureIds.organisationId } });

    await recordDeterministicExtraction({
      organisationId: fixtureIds.organisationId,
      teamId: teamId(),
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: "same-opponent",
      fingerprintPayload: { x: "same-opponent" },
      subject: { matchId: priorSameOpponent.id },
      observations: [{ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Same opponent finding." }],
    });
    await recordDeterministicExtraction({
      organisationId: fixtureIds.organisationId,
      teamId: teamId(),
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: "other-opponent",
      fingerprintPayload: { x: "other-opponent" },
      subject: { matchId: priorOtherOpponent.id },
      observations: [{ scope: "TEAM", phase: "BUILD_UP", polarity: "WORKING", statement: "Other opponent finding." }],
    });
    await recordDeterministicExtraction({
      organisationId: fixtureIds.organisationId,
      teamId: teamId(),
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: "out-of-window",
      fingerprintPayload: { x: "out-of-window" },
      subject: { matchId: outOfWindow.id },
      observations: [{ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Out of window finding." }],
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: currentMatch.id });
    expect(context).not.toBeNull();
    if (!context) return;
    const normalized = context.normalizedContext as { recentTeamPatterns: { matchesConsidered: number; observations: { statement: string }[] } | null };
    expect(normalized.recentTeamPatterns?.matchesConsidered).toBe(2);
    expect(normalized.recentTeamPatterns?.observations.map((o) => o.statement)).toEqual(["Same opponent finding.", "Other opponent finding."]);
  });

  it("gives an Event match the Actual/current-qualitative-evidence upgrade but null Plan/PlayerContext/OpponentHistory/RecentTeamPatterns (League-only, issue #696)", async () => {
    const event = await testDb.event.create({
      data: { name: "Event v2 test", eventType: "TOURNAMENT", startsAt: new Date("2026-06-01T09:00:00Z"), gameFormat: "ELEVEN_A_SIDE", footballGroupId: fixtureIds.footballGroupId, organisationId: fixtureIds.organisationId },
    });
    const squad = await testDb.eventSquad.create({ data: { name: "Squad", eventId: event.id, intent: "MANUAL", targetSize: 11, organisationId: fixtureIds.organisationId } });
    const eventMatch = await testDb.eventMatch.create({
      data: { eventId: event.id, eventSquadId: squad.id, opponentName: "Event Opponent 2", startsAt: new Date("2026-06-01T10:00:00Z"), organisationId: fixtureIds.organisationId },
    });
    await testDb.eventPostMatchReport.create({ data: { eventMatchId: eventMatch.id, status: "LOCKED", ourScore: 1, opponentScore: 1, organisationId: fixtureIds.organisationId } });
    await testDb.eventLiveMatchSession.create({ data: { eventMatchId: eventMatch.id, organisationId: fixtureIds.organisationId, coachId: "coach-1" } });
    await testDb.matchPeriodTimingResolution.create({
      data: { eventMatchId: eventMatch.id, organisationId: fixtureIds.organisationId, period: "FIRST_HALF", rawElapsedMs: 100, resolvedDurationMs: 100, resolutionSource: "RECOVERED_BOUNDED", reviewStatus: "REVIEWED" },
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: eventMatch.id });
    expect(context).not.toBeNull();
    if (!context) return;
    const normalized = context.normalizedContext as {
      match: { recoveredTiming: unknown[] };
      plan: { plannedSquadSize: number | null };
      playerContext: unknown[];
      opponentHistory: unknown | null;
      recentTeamPatterns: unknown | null;
      currentQualitativeEvidence: { debrief: unknown | null };
    };
    expect(normalized.match.recoveredTiming).toHaveLength(1);
    expect(normalized.plan.plannedSquadSize).toBeNull();
    expect(normalized.playerContext).toEqual([]);
    expect(normalized.opponentHistory).toBeNull();
    expect(normalized.recentTeamPatterns).toBeNull();
  });

  it("never puts a real player name into the provider payload, even for a pre-match review's plan text", async () => {
    const { match } = await lockLeagueReport();
    const [player] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    const fakeSession = await testDb.liveMatchSession.create({ data: { matchId: match.id, organisationId: fixtureIds.organisationId, coachId: "coach-1", startedAt: new Date() } });
    const review = await testDb.aiAdvisorReview.create({
      data: {
        organisationId: fixtureIds.organisationId,
        capability: "MATCH_PREP",
        scopeType: "MATCH",
        scopeId: match.id,
        sourceFingerprint: "fp-1",
        status: "SUCCEEDED",
        contractVersion: "2",
        terminologyVersion: "1",
        completedAt: new Date(fakeSession.startedAt.getTime() - 1000),
      },
    });
    await testDb.aiAdvisorInsight.create({
      data: { organisationId: fixtureIds.organisationId, reviewId: review.id, kind: "OBSERVATION", subjectType: "PLAYER", subjectId: player.id, title: "Rotation plan", body: "P01 is expected to start.", evidenceRefs: [], state: "ACTIVE" },
    });

    const context = await buildPostMatchReviewContext({ organisationId: fixtureIds.organisationId, scopeId: match.id });
    expect(context).not.toBeNull();
    if (!context) return;
    const serialized = JSON.stringify(context.normalizedContext);
    expect(serialized).not.toContain(player.firstName);
    expect(serialized).toContain("Rotation plan");
    for (const evidenceRef of context.evidenceRefs) {
      expect(evidenceRef).toMatch(EVIDENCE_REF_PATTERN);
    }
  });
});
