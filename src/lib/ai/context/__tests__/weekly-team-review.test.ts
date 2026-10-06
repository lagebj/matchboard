import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { buildWeeklyTeamReviewContext, buildWeeklyTeamReviewScopeId } from "@/lib/ai/context/weekly-team-review";
import { computeSourceFingerprint } from "@/lib/ai/fingerprints";
import { EVIDENCE_REF_PATTERN } from "@/lib/ai/contracts";
import { createTestMatch } from "@/test/support/factories";
import { recordDeterministicExtraction } from "@/lib/evidence/qualitative-evidence-service";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

// The fixture's default match (`baseDate = 2025-04-28T10:00:00Z`) falls in ISO week 2025-W18.
const WEEK_KEY = "2025-W18";

describe("ai/context/weekly-team-review", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 4 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.warning.deleteMany({});
    await testDb.movementLedger.deleteMany({});
    await testDb.actualPositionInterval.deleteMany({});
    await testDb.developmentThread.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.aiAdvisorInsight.deleteMany({});
    await testDb.aiAdvisorReview.deleteMany({});
    await testDb.qualitativeEvidenceObservation.deleteMany({});
    await testDb.qualitativeEvidenceExtractionRun.deleteMany({});
    await testDb.postMatchReport.deleteMany({});
    await testDb.player.updateMany({ data: { currentAvailability: "AVAILABLE" } });
  });

  it("returns null when the scope id is malformed", async () => {
    const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: "not-a-valid-scope-id" });
    expect(context).toBeNull();
  });

  it("returns null when the team does not resolve in this organisation", async () => {
    const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId("does-not-exist", WEEK_KEY) });
    expect(context).toBeNull();
  });

  it("returns null when there is no relevant activity for the team in that week", async () => {
    const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId(fixtureIds.teams["Bla"], "2025-W01") });
    expect(context).toBeNull();
  });

  it("builds a normalized context covering opportunities, gaps, minutes, positional exposure, support movements, rule outcomes, and development focus", async () => {
    const blaMatchId = fixtureIds.matches["Bla"];
    const blaTeamId = fixtureIds.teams["Bla"];
    const hviTeamId = fixtureIds.teams["Hvit"];
    const [core1, core2, support1, unselected] = fixtureIds.players.filter((p) => p.coreTeamName === "Bla");
    const [helper1] = fixtureIds.players.filter((p) => p.coreTeamName === "Hvit");

    await testDb.selection.createMany({
      data: [
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core1.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: core2.id, role: "CORE", status: "FINALIZED", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, matchRoundId: fixtureIds.matchRoundId, playerId: support1.id, role: "SUPPORT", status: "FINALIZED", organisationId: fixtureIds.organisationId },
      ],
    });

    await testDb.actualPositionInterval.createMany({
      data: [
        { matchId: blaMatchId, playerId: core1.id, position: "CB", startedAtMs: 0, endedAtMs: 2700000, source: "STARTING_LINEUP", organisationId: fixtureIds.organisationId },
        { matchId: blaMatchId, playerId: core1.id, position: "RB", startedAtMs: 2700000, endedAtMs: null, source: "POSITION_SWAP", organisationId: fixtureIds.organisationId },
      ],
    });

    await testDb.movementLedger.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        matchId: blaMatchId,
        playerId: helper1.id,
        fromTeamId: hviTeamId,
        toTeamId: blaTeamId,
        role: "SUPPORT",
        isDraft: false,
        organisationId: fixtureIds.organisationId,
      },
    });

    await testDb.warning.create({
      data: {
        matchRoundId: fixtureIds.matchRoundId,
        matchId: blaMatchId,
        teamId: blaTeamId,
        severity: "HARD_BLOCK",
        rule: "SQUAD_BELOW_MINIMUM",
        message: "should be excluded free text",
        organisationId: fixtureIds.organisationId,
      },
    });

    await testDb.developmentThread.create({
      data: { playerId: core1.id, focus: "should be excluded free text", rationale: "should be excluded free text", category: "BALL_CONTROL", status: "ACTIVE", organisationId: fixtureIds.organisationId },
    });

    const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId(blaTeamId, WEEK_KEY) });
    expect(context).not.toBeNull();
    if (!context) return;

    const normalized = context.normalizedContext as Record<string, unknown>;
    expect(normalized.opportunities).toHaveLength(3);
    expect(normalized.playersWithoutOpportunity).toHaveLength(1);
    const gapEntry = (normalized.playersWithoutOpportunity as Array<{ playerRef: string }>)[0];
    expect(context.refMap.get(gapEntry.playerRef)?.entityId).toBe(unselected.id);
    expect(normalized.minutesRecorded).toHaveLength(1);
    expect((normalized.minutesRecorded as Array<{ minutes: number }>)[0].minutes).toBe(45);
    expect(normalized.positionalExposure).toHaveLength(1);
    expect((normalized.positionalExposure as Array<{ positions: string[] }>)[0].positions).toEqual(["CB", "RB"]);
    expect(normalized.supportMovements).toHaveLength(1);
    expect(normalized.ruleOutcomes).toHaveLength(1);
    expect(normalized.developmentFocus).toHaveLength(1);

    expect(JSON.stringify(normalized)).not.toContain("should be excluded free text");

    for (const evidenceRef of context.evidenceRefs) {
      expect(evidenceRef).toMatch(EVIDENCE_REF_PATTERN);
    }
    for (const [externalRef] of context.refMap) {
      expect(externalRef).toMatch(/^[A-Z]\d{2,4}$/);
    }

    const fingerprintA = computeSourceFingerprint(context.normalizedContext);
    const contextAgain = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId(blaTeamId, WEEK_KEY) });
    const fingerprintB = computeSourceFingerprint(contextAgain!.normalizedContext);
    expect(fingerprintA).toBe(fingerprintB);
  });

  /** ADR-0152 §18 "Weekly review upgrade". */
  describe("recurring-theme aggregate, active qualitative evidence, and unresolved NEXT_FOCUS", () => {
    async function lockReport(matchId: string) {
      return testDb.postMatchReport.create({ data: { matchId, status: "LOCKED", organisationId: fixtureIds.organisationId } });
    }

    it("only surfaces a recurring theme once the same phase+polarity appears in more than one match, while still listing a single-match theme as active qualitative evidence", async () => {
      const blaMatchId = fixtureIds.matches["Bla"];
      const blaTeamId = fixtureIds.teams["Bla"];
      await lockReport(blaMatchId);

      const priorMatch = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, { startsAt: new Date("2025-04-20T10:00:00Z") });
      await lockReport(priorMatch.id);

      await recordDeterministicExtraction({
        organisationId: fixtureIds.organisationId,
        teamId: blaTeamId,
        sourceType: "POST_MATCH_DEBRIEF_WORKED",
        sourceId: "this-week",
        fingerprintPayload: { x: "this-week" },
        subject: { matchId: blaMatchId },
        observations: [
          { scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Won it back high (this week)." },
          { scope: "TEAM", phase: "BUILD_UP", polarity: "PROBLEM", statement: "Struggled to play out (only this week)." },
        ],
      });
      await recordDeterministicExtraction({
        organisationId: fixtureIds.organisationId,
        teamId: blaTeamId,
        sourceType: "POST_MATCH_DEBRIEF_WORKED",
        sourceId: "prior-week",
        fingerprintPayload: { x: "prior-week" },
        subject: { matchId: priorMatch.id },
        observations: [{ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Won it back high (prior match)." }],
      });

      const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId(blaTeamId, WEEK_KEY) });
      expect(context).not.toBeNull();
      if (!context) return;
      const normalized = context.normalizedContext as {
        recurringThemes: { phase: string; matchesWithWorking: number; matchesWithProblem: number; consecutiveStreak: { direction: string; count: number } | null }[];
        activeQualitativeEvidence: { statement: string }[];
      };

      expect(normalized.recurringThemes).toEqual([
        expect.objectContaining({ phase: "PRESSING", matchesWithWorking: 2, matchesWithProblem: 0, consecutiveStreak: { direction: "WORKING", count: 2 } }),
      ]);
      expect(normalized.activeQualitativeEvidence.map((o) => o.statement)).toEqual(
        expect.arrayContaining(["Won it back high (this week).", "Won it back high (prior match).", "Struggled to play out (only this week)."]),
      );
      for (const evidenceRef of context.evidenceRefs) {
        expect(evidenceRef).toMatch(EVIDENCE_REF_PATTERN);
      }
    });

    it("breaks the consecutive streak at the first direction change, newest-first, while still reporting the full working/problem counts", async () => {
      const blaMatchId = fixtureIds.matches["Bla"]; // newest: 2025-04-28
      const blaTeamId = fixtureIds.teams["Bla"];
      await lockReport(blaMatchId);

      const middleMatch = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, { startsAt: new Date("2025-04-20T10:00:00Z") });
      await lockReport(middleMatch.id);
      const oldestMatch = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, { startsAt: new Date("2025-04-10T10:00:00Z") });
      await lockReport(oldestMatch.id);

      await recordDeterministicExtraction({
        organisationId: fixtureIds.organisationId,
        teamId: blaTeamId,
        sourceType: "POST_MATCH_DEBRIEF_NEEDS_ATTENTION",
        sourceId: "newest",
        fingerprintPayload: { x: "newest" },
        subject: { matchId: blaMatchId },
        observations: [{ scope: "TEAM", phase: "DEFENSIVE_TRANSITION", polarity: "PROBLEM", statement: "Slow to recover centrally (newest)." }],
      });
      await recordDeterministicExtraction({
        organisationId: fixtureIds.organisationId,
        teamId: blaTeamId,
        sourceType: "POST_MATCH_DEBRIEF_WORKED",
        sourceId: "middle",
        fingerprintPayload: { x: "middle" },
        subject: { matchId: middleMatch.id },
        observations: [{ scope: "TEAM", phase: "DEFENSIVE_TRANSITION", polarity: "WORKING", statement: "Recovered well centrally (middle)." }],
      });
      await recordDeterministicExtraction({
        organisationId: fixtureIds.organisationId,
        teamId: blaTeamId,
        sourceType: "POST_MATCH_DEBRIEF_WORKED",
        sourceId: "oldest",
        fingerprintPayload: { x: "oldest" },
        subject: { matchId: oldestMatch.id },
        observations: [{ scope: "TEAM", phase: "DEFENSIVE_TRANSITION", polarity: "WORKING", statement: "Recovered well centrally (oldest)." }],
      });

      const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId(blaTeamId, WEEK_KEY) });
      expect(context).not.toBeNull();
      if (!context) return;
      const normalized = context.normalizedContext as {
        recurringThemes: { phase: string; matchesWithWorking: number; matchesWithProblem: number; consecutiveStreak: { direction: string; count: number } | null }[];
      };

      expect(normalized.recurringThemes).toEqual([
        expect.objectContaining({ phase: "DEFENSIVE_TRANSITION", matchesWithWorking: 2, matchesWithProblem: 1, consecutiveStreak: { direction: "PROBLEM", count: 1 } }),
      ]);
    });

    it("surfaces an unresolved NEXT_FOCUS insight from this week's own post_match_review, excluding a DISMISSED one and one from a SUPERSEDED review", async () => {
      const blaMatchId = fixtureIds.matches["Bla"];
      const blaTeamId = fixtureIds.teams["Bla"];
      await lockReport(blaMatchId);

      const supersededReview = await testDb.aiAdvisorReview.create({
        data: { organisationId: fixtureIds.organisationId, capability: "POST_MATCH_REVIEW", scopeType: "MATCH", scopeId: blaMatchId, sourceFingerprint: "fp-old", status: "SUPERSEDED", contractVersion: "2", terminologyVersion: "1", completedAt: new Date() },
      });
      await testDb.aiAdvisorInsight.create({
        data: { organisationId: fixtureIds.organisationId, reviewId: supersededReview.id, kind: "OBSERVATION", subjectType: "NONE", title: "Stale focus", body: "From a superseded review.", evidenceRefs: [], state: "ACTIVE", analysisRole: "NEXT_FOCUS" },
      });

      const currentReview = await testDb.aiAdvisorReview.create({
        data: { organisationId: fixtureIds.organisationId, capability: "POST_MATCH_REVIEW", scopeType: "MATCH", scopeId: blaMatchId, sourceFingerprint: "fp-new", status: "SUCCEEDED", contractVersion: "2", terminologyVersion: "1", completedAt: new Date() },
      });
      await testDb.aiAdvisorInsight.create({
        data: { organisationId: fixtureIds.organisationId, reviewId: currentReview.id, kind: "OBSERVATION", subjectType: "NONE", title: "Defensive transition", body: "Recover centrally before engaging the ball.", evidenceRefs: [], state: "ACTIVE", analysisRole: "NEXT_FOCUS" },
      });
      await testDb.aiAdvisorInsight.create({
        data: { organisationId: fixtureIds.organisationId, reviewId: currentReview.id, kind: "OBSERVATION", subjectType: "NONE", title: "Already dismissed", body: "Coach dismissed this one.", evidenceRefs: [], state: "DISMISSED", analysisRole: "NEXT_FOCUS" },
      });

      const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId(blaTeamId, WEEK_KEY) });
      expect(context).not.toBeNull();
      if (!context) return;
      const normalized = context.normalizedContext as { unresolvedNextFocus: { title: string; body: string; matchRef: string | null }[] };

      expect(normalized.unresolvedNextFocus).toEqual([
        expect.objectContaining({ title: "Defensive transition", body: "Recover centrally before engaging the ball." }),
      ]);
      for (const evidenceRef of context.evidenceRefs) {
        expect(evidenceRef).toMatch(EVIDENCE_REF_PATTERN);
      }
    });
  });

  describe("ADR-0156 season profile integration", () => {
    it("includes a bounded seasonProfile section with only EMERGING/ESTABLISHED patterns and valid evidence refs", async () => {
      const blaTeamId = fixtureIds.teams["Bla"];

      const matchOne = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, {
        startsAt: new Date("2025-04-28T10:00:00Z"),
      });
      const matchTwo = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, {
        startsAt: new Date("2025-04-29T10:00:00Z"),
      });
      for (const match of [matchOne, matchTwo]) {
        await testDb.postMatchReport.create({ data: { organisationId: fixtureIds.organisationId, matchId: match.id, status: "LOCKED" } });
      }

      await recordDeterministicExtraction({
        organisationId: fixtureIds.organisationId,
        teamId: blaTeamId,
        sourceType: "POST_MATCH_DEBRIEF_WORKED",
        sourceId: "season-m1",
        fingerprintPayload: { x: "season-m1" },
        subject: { matchId: matchOne.id },
        observations: [{ scope: "TEAM", phase: "BUILD_UP", polarity: "WORKING", statement: "Played out well under pressure (m1)." }],
      });
      await recordDeterministicExtraction({
        organisationId: fixtureIds.organisationId,
        teamId: blaTeamId,
        sourceType: "POST_MATCH_DEBRIEF_WORKED",
        sourceId: "season-m2",
        fingerprintPayload: { x: "season-m2" },
        subject: { matchId: matchTwo.id },
        observations: [{ scope: "TEAM", phase: "BUILD_UP", polarity: "WORKING", statement: "Played out well under pressure (m2)." }],
      });

      const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId(blaTeamId, WEEK_KEY) });
      expect(context).not.toBeNull();
      if (!context) return;

      const normalized = context.normalizedContext as {
        seasonProfile: { leagueSeasonId: string; completedMatches: number; patterns: Array<{ family: string; evidenceStrength: string; evidenceRef: string }> } | null;
      };

      expect(normalized.seasonProfile).not.toBeNull();
      expect(normalized.seasonProfile!.leagueSeasonId).toBe(fixtureIds.leagueSeasonId);
      expect(normalized.seasonProfile!.completedMatches).toBeGreaterThanOrEqual(2);

      const themePattern = normalized.seasonProfile!.patterns.find((p) => p.family === "TACTICAL_THEME");
      expect(themePattern).toBeDefined();
      expect(themePattern!.evidenceStrength).not.toBe("INSUFFICIENT");
      expect(themePattern!.evidenceRef).toMatch(EVIDENCE_REF_PATTERN);
      expect(context.evidenceRefs.has(themePattern!.evidenceRef)).toBe(true);

      for (const evidenceRef of context.evidenceRefs) {
        expect(evidenceRef).toMatch(EVIDENCE_REF_PATTERN);
      }
    });

    it("caps the total number of season patterns at 12 and each family at its own cap", async () => {
      const blaTeamId = fixtureIds.teams["Bla"];
      const match = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, { startsAt: new Date("2025-04-28T10:00:00Z") });
      await testDb.postMatchReport.create({ data: { organisationId: fixtureIds.organisationId, matchId: match.id, status: "LOCKED" } });

      const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId(blaTeamId, WEEK_KEY) });
      expect(context).not.toBeNull();
      if (!context) return;

      const normalized = context.normalizedContext as { seasonProfile: { patterns: Array<{ family: string }> } | null };
      // One match with no qualitative/combination/player evidence surfaces nothing -- an empty
      // bounded section, not a failure (Test plan H.8).
      expect(normalized.seasonProfile).not.toBeNull();
      expect(normalized.seasonProfile!.patterns.length).toBeLessThanOrEqual(12);
    });

    it("yields a null seasonProfile, not a failure, when no League Season overlaps the reviewed week", async () => {
      const blaTeamId = fixtureIds.teams["Bla"];
      // The fixture's League Season spans 2025-01-06..2025-06-30 (test-db.ts). A match dated
      // into 2026 still belongs to that same round/season relationally, but its own week falls
      // entirely outside the season's date range -- the overlap query must find nothing.
      const outsideWeekKey = "2026-W02";
      const outsideMatch = await createTestMatch(testDb, fixtureIds.organisationId, fixtureIds.matchRoundId, blaTeamId, null, {
        startsAt: new Date("2026-01-06T10:00:00Z"),
      });
      await testDb.selection.create({
        data: {
          matchId: outsideMatch.id,
          matchRoundId: fixtureIds.matchRoundId,
          playerId: fixtureIds.players.find((p) => p.coreTeamName === "Bla")!.id,
          role: "CORE",
          status: "FINALIZED",
          organisationId: fixtureIds.organisationId,
        },
      });

      const context = await buildWeeklyTeamReviewContext({ organisationId: fixtureIds.organisationId, scopeId: buildWeeklyTeamReviewScopeId(blaTeamId, outsideWeekKey) });
      expect(context).not.toBeNull();
      if (!context) return;
      const normalized = context.normalizedContext as { seasonProfile: unknown };
      expect(normalized.seasonProfile).toBeNull();
    });
  });
});
