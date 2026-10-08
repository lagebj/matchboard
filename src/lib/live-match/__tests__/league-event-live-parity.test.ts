import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestMatch, createTestEvent, createTestEventSquad } from "@/test/support/factories";

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

import { recordEventForActor, LiveMatchDomainError } from "../live-match-event-store";
import { recordEventForActorEvent } from "../event-live-match-event-store";
import { resolveLiveReportingPrimaryAction } from "../live-reporting-primary-action";
import { resolveLeagueMatchPeriodConfig, resolveEventMatchPeriodConfig } from "../resolve-live-period-config";
import { getOrCreateDebrief, saveDraftDebrief, submitDebrief } from "@/lib/post-match/debrief/service";
import { DEBRIEF_SCHEMA_VERSION } from "@/lib/post-match/debrief/v1";
import { getQualitativeEvidenceForMatch } from "@/lib/evidence/qualitative-evidence-service";

let testDb: PrismaClient;
let fixture: TestFixtureIds;

/**
 * ADR-0158 slice 3 — "one football rule, potentially two persistence adapters." Asserts
 * equivalent football semantics across League and Event for the shared-policy scenarios
 * ADR-0158 §08/§15 name, run through the real mutation entry points and services (not the
 * already-generic pure resolvers in isolation, which have nothing to diverge between — the real
 * parity risk is each adapter's own translation of its DB model into the shared policy's input
 * shape, exactly the class of bug issue #686 fixed).
 *
 * Scenarios intentionally NOT asserted as equivalent here (issues #691/#696): qualitative
 * evidence and the post-match-review AI context's plan/opponent-history sections are League-only
 * today because Event has no `teamId`-equivalent concept to key evidence off. The final test
 * below asserts that documented asymmetry explicitly, per ADR-0158's own instruction not to
 * force a false parity or invent a Team-equivalent concept for Event.
 */
describe("League/Event live-match adapter parity (ADR-0158 slice 3)", () => {
  let eventId: string;
  let eventSquadId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb);
    const event = await createTestEvent(testDb, fixture.organisationId, fixture.footballGroupId);
    const squad = await createTestEventSquad(testDb, fixture.organisationId, event.id);
    eventId = event.id;
    eventSquadId = squad.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("shared live-event guard (checkNormalLiveEventGuard via each adapter's own mutation entry point)", () => {
    it("both reject a normal event the same way when the period is not running", async () => {
      const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
      const leagueSession = await testDb.liveMatchSession.create({
        data: {
          matchId: match.id,
          coachId: "test-user-id",
          organisationId: fixture.organisationId,
          status: "ACTIVE",
          clockPeriod: "BEFORE",
          clockRunning: false,
        },
      });

      const eventMatch = await testDb.eventMatch.create({
        data: {
          eventId,
          eventSquadId,
          category: "CUP",
          organisationId: fixture.organisationId,
          opponentName: "Guard Parity FC",
          startsAt: new Date("2028-04-01T10:00:00Z"),
          status: "SCHEDULED",
        },
      });
      const eventSession = await testDb.eventLiveMatchSession.create({
        data: {
          eventMatchId: eventMatch.id,
          coachId: "test-user-id",
          organisationId: fixture.organisationId,
          status: "ACTIVE",
          clockPeriod: "BEFORE",
          clockRunning: false,
        },
      });

      const actor = { userId: "test-user-id", organisationId: fixture.organisationId };

      const leagueRejection = await recordEventForActor(
        { matchId: match.id, sessionId: leagueSession.id, eventType: "GOAL_FOR", clientEventId: "league-guard-1" },
        actor,
      ).catch((e) => e);
      const eventRejection = await recordEventForActorEvent(
        { eventMatchId: eventMatch.id, sessionId: eventSession.id, eventType: "GOAL_FOR", clientEventId: "event-guard-1" },
        actor,
      ).catch((e) => e);

      expect(leagueRejection).toBeInstanceOf(LiveMatchDomainError);
      expect(eventRejection).toBeInstanceOf(LiveMatchDomainError);
      expect((leagueRejection as InstanceType<typeof LiveMatchDomainError>).code).toBe("LIVE_PERIOD_NOT_RUNNING");
      expect((eventRejection as InstanceType<typeof LiveMatchDomainError>).code).toBe("LIVE_PERIOD_NOT_RUNNING");
    });

    it("both accept the same normal event when the period is running", async () => {
      const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
      const leagueSession = await testDb.liveMatchSession.create({
        data: {
          matchId: match.id,
          coachId: "test-user-id",
          organisationId: fixture.organisationId,
          status: "ACTIVE",
          clockPeriod: "FIRST_HALF",
          clockRunning: true,
        },
      });

      const eventMatch = await testDb.eventMatch.create({
        data: {
          eventId,
          eventSquadId,
          category: "CUP",
          organisationId: fixture.organisationId,
          opponentName: "Guard Parity Running FC",
          startsAt: new Date("2028-04-01T11:00:00Z"),
          status: "SCHEDULED",
        },
      });
      const eventSession = await testDb.eventLiveMatchSession.create({
        data: {
          eventMatchId: eventMatch.id,
          coachId: "test-user-id",
          organisationId: fixture.organisationId,
          status: "ACTIVE",
          clockPeriod: "FIRST_HALF",
          clockRunning: true,
        },
      });

      const actor = { userId: "test-user-id", organisationId: fixture.organisationId };

      const leagueResult = await recordEventForActor(
        { matchId: match.id, sessionId: leagueSession.id, eventType: "GOAL_FOR", clientEventId: "league-guard-2" },
        actor,
      );
      const eventResult = await recordEventForActorEvent(
        { eventMatchId: eventMatch.id, sessionId: eventSession.id, eventType: "GOAL_FOR", clientEventId: "event-guard-2" },
        actor,
      );

      expect(leagueResult.eventType).toBe("GOAL_FOR");
      expect(eventResult.eventType).toBe("GOAL_FOR");
    });
  });

  describe("shared lifecycle resolver via each adapter's own period-config resolution", () => {
    it("resolves the same primaryAction.kind for an equivalent frozen format snapshot", async () => {
      const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null, {
        matchType: "LEAGUE",
      });
      await testDb.liveMatchSession.create({
        data: {
          matchId: match.id,
          coachId: "test-user-id",
          organisationId: fixture.organisationId,
          status: "ACTIVE",
          clockPeriod: "FIRST_HALF",
          clockRunning: false,
          formatNumberOfPeriods: 2,
          formatPeriodDurationMinutes: 25,
          formatBreakDurationMinutes: 5,
        },
      });

      const eventMatch = await testDb.eventMatch.create({
        data: {
          eventId,
          eventSquadId,
          category: "CUP",
          organisationId: fixture.organisationId,
          opponentName: "Resolver Parity FC",
          startsAt: new Date("2028-04-01T12:00:00Z"),
          status: "SCHEDULED",
        },
      });
      await testDb.eventLiveMatchSession.create({
        data: {
          eventMatchId: eventMatch.id,
          coachId: "test-user-id",
          organisationId: fixture.organisationId,
          status: "ACTIVE",
          clockPeriod: "FIRST_HALF",
          clockRunning: false,
          formatNumberOfPeriods: 2,
          formatPeriodDurationMinutes: 25,
          formatBreakDurationMinutes: 5,
        },
      });

      const leaguePeriodConfig = await resolveLeagueMatchPeriodConfig(match.id, "LEAGUE");
      const eventPeriodConfig = await resolveEventMatchPeriodConfig({
        eventMatchId: eventMatch.id,
        fallbackMatchDurationMinutes: null,
        fallbackNumberOfHalves: 2,
        fallbackBreakDurationMinutes: null,
      });

      const leagueAction = resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "FIRST_HALF", running: false },
        periodConfig: leaguePeriodConfig,
      });
      const eventAction = resolveLiveReportingPrimaryAction({
        sessionStatus: "ACTIVE",
        clock: { period: "FIRST_HALF", running: false },
        periodConfig: eventPeriodConfig,
      });

      expect(leagueAction.kind).toBe(eventAction.kind);
      expect(leagueAction).toEqual(eventAction);
    });
  });

  describe("guided debrief (DebriefReportRef union — one service, both competition types)", () => {
    function fullAnswers() {
      return {
        version: DEBRIEF_SCHEMA_VERSION,
        answers: {
          team_execution: { effort: { value: "STRONG" }, teamCohesion: { value: "OK" }, positionalShape: { value: "OK" }, recoveryBehavior: { value: "OK" } },
          worked: { selected: ["PRESSING"], comment: "Won it back high twice." },
          needs_attention: { selected: ["NOTHING_TO_ADD"] },
          match_changes: { option: "NO_MEANINGFUL_CHANGE" },
          opponent_memory: {},
          player_observations: [],
          anything_else: {},
        },
      };
    }

    it("both competition types reach SUBMITTED through the identical service functions", async () => {
      const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
      await testDb.postMatchReport.create({ data: { organisationId: fixture.organisationId, matchId: match.id } });

      const eventMatch = await testDb.eventMatch.create({
        data: {
          eventId,
          eventSquadId,
          category: "CUP",
          organisationId: fixture.organisationId,
          opponentName: "Debrief Parity FC",
          startsAt: new Date("2028-04-01T13:00:00Z"),
          status: "SCHEDULED",
        },
      });
      await testDb.eventPostMatchReport.create({ data: { organisationId: fixture.organisationId, eventMatchId: eventMatch.id } });

      const leagueDebrief = await getOrCreateDebrief({ kind: "LEAGUE", matchId: match.id }, fixture.organisationId);
      await saveDraftDebrief(leagueDebrief.id, fixture.organisationId, fullAnswers());
      const leagueResult = await submitDebrief({ kind: "LEAGUE", matchId: match.id }, leagueDebrief.id, fixture.organisationId, "coach@test.com");

      const eventDebrief = await getOrCreateDebrief({ kind: "EVENT", eventMatchId: eventMatch.id }, fixture.organisationId);
      await saveDraftDebrief(eventDebrief.id, fixture.organisationId, fullAnswers());
      const eventResult = await submitDebrief({ kind: "EVENT", eventMatchId: eventMatch.id }, eventDebrief.id, fixture.organisationId, "coach@test.com");

      expect(leagueResult.success).toBe(true);
      expect(eventResult.success).toBe(true);
    });
  });

  describe("documented asymmetry (issue #691): qualitative evidence is League-only", () => {
    it("League's debrief produces active qualitative evidence; Event's equivalent submission does not", async () => {
      const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, null);
      await testDb.postMatchReport.create({ data: { organisationId: fixture.organisationId, matchId: match.id } });

      const eventMatch = await testDb.eventMatch.create({
        data: {
          eventId,
          eventSquadId,
          category: "CUP",
          organisationId: fixture.organisationId,
          opponentName: "Evidence Asymmetry FC",
          startsAt: new Date("2028-04-01T14:00:00Z"),
          status: "SCHEDULED",
        },
      });
      await testDb.eventPostMatchReport.create({ data: { organisationId: fixture.organisationId, eventMatchId: eventMatch.id } });

      const answers = () => ({
        version: DEBRIEF_SCHEMA_VERSION,
        answers: {
          team_execution: { effort: { value: "STRONG" }, teamCohesion: { value: "OK" }, positionalShape: { value: "OK" }, recoveryBehavior: { value: "OK" } },
          worked: { selected: ["PRESSING"], comment: "Won it back high twice." },
          needs_attention: { selected: ["NOTHING_TO_ADD"] },
          match_changes: { option: "NO_MEANINGFUL_CHANGE" },
          opponent_memory: {},
          player_observations: [],
          anything_else: {},
        },
      });

      const leagueDebrief = await getOrCreateDebrief({ kind: "LEAGUE", matchId: match.id }, fixture.organisationId);
      await saveDraftDebrief(leagueDebrief.id, fixture.organisationId, answers());
      await submitDebrief({ kind: "LEAGUE", matchId: match.id }, leagueDebrief.id, fixture.organisationId, "coach@test.com");

      const eventDebrief = await getOrCreateDebrief({ kind: "EVENT", eventMatchId: eventMatch.id }, fixture.organisationId);
      await saveDraftDebrief(eventDebrief.id, fixture.organisationId, answers());
      await submitDebrief({ kind: "EVENT", eventMatchId: eventMatch.id }, eventDebrief.id, fixture.organisationId, "coach@test.com");

      const leagueEvidence = await getQualitativeEvidenceForMatch({ matchId: match.id }, fixture.organisationId);
      const eventEvidence = await getQualitativeEvidenceForMatch({ eventMatchId: eventMatch.id }, fixture.organisationId);

      expect(leagueEvidence.length).toBeGreaterThan(0);
      expect(eventEvidence.length).toBe(0);
    });
  });
});
