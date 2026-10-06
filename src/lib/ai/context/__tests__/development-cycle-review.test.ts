import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import {
  buildDevelopmentCycleReviewContext,
  buildDevelopmentCycleScopeId,
  parseDevelopmentCycleScopeId,
} from "@/lib/ai/context/development-cycle-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { EVIDENCE_REF_PATTERN } from "@/lib/ai/contracts";
import { createTestMatch } from "@/test/support/factories";
import { recordDeterministicExtraction } from "@/lib/evidence/qualitative-evidence-service";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

// The fixture's default match (`baseDate = 2025-04-28T10:00:00Z`) falls within the 35-day window
// anchored at this pinned "now" (2025-05-05), the same pin the weekly presentation test uses.
const NOW = new Date("2025-05-05T10:00:00Z");

describe("ai/context/development-cycle-review", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    await testDb.aiAdvisorInsight.deleteMany({});
    await testDb.aiAdvisorReview.deleteMany({});
    await testDb.qualitativeEvidenceObservation.deleteMany({});
    await testDb.qualitativeEvidenceExtractionRun.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.playerDevelopmentObservation.deleteMany({});
    await testDb.actualPositionInterval.deleteMany({});
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips the scope id", () => {
    const start = new Date("2025-01-01T00:00:00Z");
    const end = new Date("2025-02-04T23:59:59Z");
    const scopeId = buildDevelopmentCycleScopeId("team1", start, end);
    expect(parseDevelopmentCycleScopeId(scopeId)).toEqual({
      teamId: "team1",
      windowStart: start,
      windowEnd: end,
    });
    expect(parseDevelopmentCycleScopeId("not-a-scope-id")).toBeNull();
  });

  it("returns null when the scope id is malformed", async () => {
    const context = await buildDevelopmentCycleReviewContext({
      organisationId: fixtureIds.organisationId,
      scopeId: "not-a-valid-scope-id",
    });
    expect(context).toBeNull();
  });

  it("returns null when the team does not resolve in this organisation", async () => {
    const scopeId = buildDevelopmentCycleScopeId("does-not-exist", windowStart(), windowEnd());
    const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    expect(context).toBeNull();
  });

  it("returns null when the window contains no completed matches", async () => {
    const scopeId = buildDevelopmentCycleScopeId(fixtureIds.teams["Bla"], windowStart(), windowEnd());
    // The fixture match exists but has no LOCKED report yet.
    const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    expect(context).toBeNull();
  });

  it("builds a normalized context covering matches, participation facts, qualitative evidence, and recurring tactical aggregates", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const blaTeamId = fixtureIds.teams["Bla"];
    await lockReport(blaMatchId);

    const [core1] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    await testDb.actualPositionInterval.createMany({
      data: [
        { matchId: blaMatchId, playerId: core1.id, position: "CB", startedAtMs: 0, endedAtMs: 2700000, source: "STARTING_LINEUP", organisationId: fixtureIds.organisationId },
      ],
    });

    await testDb.playerDevelopmentObservation.create({
      data: {
        playerId: core1.id,
        matchId: blaMatchId,
        kind: "ATTRIBUTE",
        direction: "POSITIVE",
        observableNote: "Scanned earlier before receiving in midfield.",
        observedAt: new Date("2025-04-28T12:00:00Z"),
        recordedBy: "coach@test.example",
        organisationId: fixtureIds.organisationId,
      },
    });

    await recordDeterministicExtraction({
      organisationId: fixtureIds.organisationId,
      teamId: blaTeamId,
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: "cycle-test",
      fingerprintPayload: { x: "cycle-test" },
      subject: { matchId: blaMatchId },
      observations: [{ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Won it back high." }],
    });

    const scopeId = buildDevelopmentCycleScopeId(blaTeamId, windowStart(), windowEnd());
    const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as Record<string, unknown>;
    expect((normalized.matches as unknown[]).length).toBeGreaterThanOrEqual(1);
    expect(normalized.participationFacts).toBeDefined();
    expect((normalized.activeQualitativeEvidence as unknown[]).length).toBe(1);
    expect(normalized.recurringTacticalThemes).toBeDefined();
    expect(normalized.developmentObservations).toBeDefined();
    expect(normalized.playerStates).toBeDefined();

    for (const evidenceRef of context.evidenceRefs) {
      expect(evidenceRef).toMatch(EVIDENCE_REF_PATTERN);
    }
    for (const [externalRef] of context.refMap) {
      expect(externalRef).toMatch(/^[A-Z]\d{2,4}$/);
    }

    const fingerprintA = computeSourceFingerprint(context.normalizedContext);
    const contextAgain = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    const fingerprintB = computeSourceFingerprint(contextAgain!.normalizedContext);
    expect(fingerprintA).toBe(fingerprintB);
  });

  it("excludes a player with insufficient in-window evidence from playerStates (player evidence threshold)", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const blaTeamId = fixtureIds.teams["Bla"];
    await lockReport(blaMatchId);

    const [core1, core2] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

    // core1: one explicit coach development observation + match exposure -> eligible.
    await testDb.playerDevelopmentObservation.create({
      data: {
        playerId: core1.id,
        matchId: blaMatchId,
        kind: "ATTRIBUTE",
        direction: "POSITIVE",
        observableNote: "Scanned earlier before receiving.",
        observedAt: new Date("2025-04-28T12:00:00Z"),
        recordedBy: "coach@test.example",
        organisationId: fixtureIds.organisationId,
      },
    });

    // core2: minutes only, no coach observation and only one independent evidence item
    // (participation alone) -> below the threshold.
    await testDb.actualPositionInterval.createMany({
      data: [
        { matchId: blaMatchId, playerId: core1.id, position: "CM", startedAtMs: 0, endedAtMs: 2700000, source: "STARTING_LINEUP", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, playerId: core2.id, position: "RB", startedAtMs: 0, endedAtMs: 2700000, source: "STARTING_LINEUP", organisationId: fixtureIds.organisationId },
      ],
    });

    const scopeId = buildDevelopmentCycleScopeId(blaTeamId, windowStart(), windowEnd());
    const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as { playerStates: { playerRef: string }[] };
    const stateRefs = normalized.playerStates.map((s) => s.playerRef);
    const core1Ref = [...context.refMap.entries()].find(([, t]) => t.entityId === core1.id)?.[0];
    const core2Ref = [...context.refMap.entries()].find(([, t]) => t.entityId === core2.id)?.[0];
    expect(core1Ref && stateRefs.includes(core1Ref)).toBe(true);
    expect(core2Ref && stateRefs.includes(core2Ref)).toBe(false);
  });

  it("includes only completed matches inside the window in the recurring tactical aggregate", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const blaTeamId = fixtureIds.teams["Bla"];
    await lockReport(blaMatchId);

    // A locked match inside the window with PRESSING WORKING evidence.
    await recordDeterministicExtraction({
      organisationId: fixtureIds.organisationId,
      teamId: blaTeamId,
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: "in-window",
      fingerprintPayload: { x: "in-window" },
      subject: { matchId: blaMatchId },
      observations: [{ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Pressed well together." }],
    });

    // A locked match outside the window (before windowStart) — its evidence must not leak in.
    const oldMatch = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, {
      startsAt: new Date("2025-01-15T10:00:00Z"),
    });
    await lockReport(oldMatch.id);
    await recordDeterministicExtraction({
      organisationId: fixtureIds.organisationId,
      teamId: blaTeamId,
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: "out-window",
      fingerprintPayload: { x: "out-window" },
      subject: { matchId: oldMatch.id },
      observations: [{ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Pressed well together (old)." }],
    });

    const scopeId = buildDevelopmentCycleScopeId(blaTeamId, windowStart(), windowEnd());
    const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as {
      matches: unknown[];
      activeQualitativeEvidence: { statement: string }[];
    };
    expect(normalized.matches).toHaveLength(1);
    expect(normalized.activeQualitativeEvidence.map((o) => o.statement)).toEqual(["Pressed well together."]);
  });

  describe("ADR-0156 season profile integration", () => {
    it("includes a bounded seasonProfile section with only EMERGING/ESTABLISHED patterns and valid evidence refs", async () => {
      const blaTeamId = fixtureIds.teams["Bla"];
      const blaMatchId = fixtureIds.matches["Bla"];
      await lockReport(blaMatchId);

      await recordDeterministicExtraction({
        organisationId: fixtureIds.organisationId,
        teamId: blaTeamId,
        sourceType: "POST_MATCH_DEBRIEF_WORKED",
        sourceId: "cycle-season-m1",
        fingerprintPayload: { x: "cycle-season-m1" },
        subject: { matchId: blaMatchId },
        observations: [{ scope: "TEAM", phase: "BUILD_UP", polarity: "WORKING", statement: "Played out well under pressure (m1)." }],
      });
      const secondMatch = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, { startsAt: new Date("2025-04-20T10:00:00Z") });
      await lockReport(secondMatch.id);
      await recordDeterministicExtraction({
        organisationId: fixtureIds.organisationId,
        teamId: blaTeamId,
        sourceType: "POST_MATCH_DEBRIEF_WORKED",
        sourceId: "cycle-season-m2",
        fingerprintPayload: { x: "cycle-season-m2" },
        subject: { matchId: secondMatch.id },
        observations: [{ scope: "TEAM", phase: "BUILD_UP", polarity: "WORKING", statement: "Played out well under pressure (m2)." }],
      });

      const scopeId = buildDevelopmentCycleScopeId(blaTeamId, windowStart(), windowEnd());
      const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
      expect(context).not.toBeNull();
      if (!context) return;

      const normalized = context.normalizedContext as {
        seasonProfile: { leagueSeasonId: string; patterns: Array<{ family: string; evidenceStrength: string; evidenceRef: string }> } | null;
      };
      expect(normalized.seasonProfile).not.toBeNull();
      const themePattern = normalized.seasonProfile!.patterns.find((p) => p.family === "TACTICAL_THEME");
      expect(themePattern).toBeDefined();
      expect(themePattern!.evidenceStrength).not.toBe("INSUFFICIENT");
      expect(themePattern!.evidenceRef).toMatch(EVIDENCE_REF_PATTERN);
      expect(context.evidenceRefs.has(themePattern!.evidenceRef)).toBe(true);
      expect(normalized.seasonProfile!.patterns.length).toBeLessThanOrEqual(8);
    });

    it("excludes a season pattern naming a player who does not clear this capability's own evidence threshold", async () => {
      const blaTeamId = fixtureIds.teams["Bla"];
      const [, , , belowThresholdPlayer] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");

      // Three matches *before* the review window (season-wide evidence only) where
      // belowThresholdPlayer scores and plays enough minutes to clear the season-profile's own
      // player-contribution threshold -- but has zero evidence inside the review window itself.
      for (const startsAt of [new Date("2025-01-10T10:00:00Z"), new Date("2025-01-17T10:00:00Z"), new Date("2025-01-24T10:00:00Z")]) {
        const match = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, { startsAt });
        const report = await lockReport(match.id);
        await testDb.goal.create({ data: { organisationId: fixtureIds.organisationId, reportId: report.id, playerId: belowThresholdPlayer.id, minute: 10 } });
        await testDb.actualPositionInterval.create({
          data: { matchId: match.id, playerId: belowThresholdPlayer.id, position: "FORWARD", startedAtMs: 0, endedAtMs: 1_500_000, source: "STARTING_LINEUP", organisationId: fixtureIds.organisationId },
        });
      }

      // One in-window match keeps the capability itself active, with no evidence at all for
      // belowThresholdPlayer.
      const blaMatchId = fixtureIds.matches["Bla"];
      await lockReport(blaMatchId);

      const scopeId = buildDevelopmentCycleScopeId(blaTeamId, windowStart(), windowEnd());
      const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
      expect(context).not.toBeNull();
      if (!context) return;

      const normalized = context.normalizedContext as {
        playerStates: Array<{ playerRef: string }>;
        seasonProfile: { patterns: Array<{ family: string; playerRefs: string[] }> } | null;
      };

      // The player never clears the in-window threshold, so playerStates has no entry for them,
      // and no season pattern naming them may appear either -- the season profile must never be
      // the back door that introduces a below-threshold player into this capability's output.
      expect(normalized.seasonProfile).not.toBeNull();
      const playerContributionPattern = normalized.seasonProfile!.patterns.find((p) => p.family === "PLAYER_CONTRIBUTION");
      expect(playerContributionPattern).toBeUndefined();
    });

    it("yields a null seasonProfile, not a failure, when no League Season overlaps the review window", async () => {
      const blaTeamId = fixtureIds.teams["Bla"];
      const farFutureStart = new Date("2027-01-01T00:00:00Z");
      const farFutureEnd = new Date("2027-02-05T00:00:00Z");
      const match = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, { startsAt: new Date("2027-01-10T10:00:00Z") });
      await lockReport(match.id);

      const scopeId = buildDevelopmentCycleScopeId(blaTeamId, farFutureStart, farFutureEnd);
      const context = await buildDevelopmentCycleReviewContext({ organisationId: fixtureIds.organisationId, scopeId });
      expect(context).not.toBeNull();
      if (!context) return;
      const normalized = context.normalizedContext as { seasonProfile: unknown };
      expect(normalized.seasonProfile).toBeNull();
    });
  });
});

async function lockReport(matchId: string) {
  return testDb.postMatchReport.create({ data: { matchId, status: "LOCKED", organisationId: fixtureIds.organisationId } });
}

/** 35-day window ending at the pinned NOW, matching ADR-0152 §6's window length. */
function windowStart() {
  return new Date(NOW.getTime() - 35 * 24 * 60 * 60 * 1000);
}
function windowEnd() {
  return NOW;
}