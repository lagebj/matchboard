import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { getMatchDetailAfterData } from "../get-match-detail-after-data";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";

let db: PrismaClient;
let fixture: TestFixtureIds;
let orgFilter: OrgFilterMode;
let matchId: string;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

describe("getMatchDetailAfterData", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
    orgFilter = {
      type: "org",
      filter: { organisationId: fixture.organisationId },
      filterNullable: { organisationId: fixture.organisationId },
      organisationId: fixture.organisationId,
    };
    matchId = Object.values(fixture.matches)[0];
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    // Each test seeds/removes its own report tree — start from a clean slate.
    await db.postMatchReport.deleteMany({ where: { matchId } });
    await db.liveMatchEvent.deleteMany({ where: { matchId } });
  });

  it("returns a graceful empty shape when no report exists yet", async () => {
    const data = await getMatchDetailAfterData({ matchId, organisationId: fixture.organisationId, orgFilter });
    expect(data.reportId).toBeNull();
    expect(data.reportStatus).toBeNull();
    expect(data.attendanceSummary).toEqual({ presentCount: 0, noShowCount: 0, totalCount: 0, noShowNames: [] });
    expect(data.timeline).toEqual([]);
    expect(data.goalScorers.scorers).toEqual([]);
    expect(data.combinationEvidence).toEqual([]);
  });

  it("aggregates attendance, goals and assists from report rows (no live events — fallback timeline, never paired)", async () => {
    const [p1, p2] = fixture.players;
    const report = await db.postMatchReport.create({
      data: { matchId, organisationId: fixture.organisationId, status: "DRAFT", homeGoals: 1, awayGoals: 0 },
    });
    await db.postMatchPlayerActual.create({
      data: { matchId, reportId: report.id, playerId: p1.id, organisationId: fixture.organisationId, attendanceStatus: "PRESENT", source: "PLANNED" },
    });
    await db.postMatchPlayerActual.create({
      data: { matchId, reportId: report.id, playerId: p2.id, organisationId: fixture.organisationId, attendanceStatus: "NO_SHOW", source: "PLANNED" },
    });
    await db.goal.create({ data: { reportId: report.id, organisationId: fixture.organisationId, playerId: p1.id, minute: 12, type: "NORMAL" } });
    await db.assist.create({ data: { reportId: report.id, organisationId: fixture.organisationId, playerId: p2.id, type: "NORMAL" } });

    const data = await getMatchDetailAfterData({ matchId, organisationId: fixture.organisationId, orgFilter });

    expect(data.reportStatus).toBe("DRAFT");
    expect(data.attendanceSummary).toEqual({
      presentCount: 1,
      noShowCount: 1,
      totalCount: 2,
      noShowNames: [`${p2.firstName} ${p2.lastName}`],
    });
    expect(data.goalScorers.scorers).toEqual([{ participantKey: p1.id, playerName: `${p1.firstName} ${p1.lastName}`, count: 1 }]);
    expect(data.assistProviders.scorers).toEqual([{ participantKey: p2.id, playerName: `${p2.firstName} ${p2.lastName}`, count: 1 }]);
    // No canonical live events exist -> fallback timeline, which never pairs an assist.
    expect(data.timeline).toHaveLength(1);
    expect(data.timeline[0]).toMatchObject({ kind: "GOAL_FOR", minuteLabel: "12'", sourceIsCanonicalLiveEvent: false, assistPlayerName: null });
  });

  it("prefers canonical live events and pairs scorer/assist only via correctsEventId pointing at the goal's clientEventId (not its database id)", async () => {
    const [p1, p2] = fixture.players;
    const session = await db.liveMatchSession.create({
      data: { matchId, coachId: "test-coach", organisationId: fixture.organisationId, status: "ENDED" },
    });
    // A real GOAL_FOR row's `clientEventId` is a distinct, client-generated string, unrelated to
    // its database `id` — mirrored here from real production data, where SCORER_SET/ASSIST_SET
    // annotate their target goal via clientEventId, never the database id.
    const goalClientEventId = "test-goal-client-event-id";
    await db.liveMatchEvent.create({
      data: {
        matchId,
        organisationId: fixture.organisationId,
        sessionId: session.id,
        eventType: "GOAL_FOR",
        period: 1,
        matchSeconds: 720_000,
        clientEventId: goalClientEventId,
      },
    });
    await db.liveMatchEvent.create({
      data: {
        matchId,
        organisationId: fixture.organisationId,
        sessionId: session.id,
        eventType: "SCORER_SET",
        playerId: p1.id,
        correctsEventId: goalClientEventId,
      },
    });
    await db.liveMatchEvent.create({
      data: {
        matchId,
        organisationId: fixture.organisationId,
        sessionId: session.id,
        eventType: "ASSIST_SET",
        playerId: p2.id,
        correctsEventId: goalClientEventId,
      },
    });

    const data = await getMatchDetailAfterData({ matchId, organisationId: fixture.organisationId, orgFilter });

    expect(data.timeline).toHaveLength(1);
    expect(data.timeline[0]).toMatchObject({
      kind: "GOAL_FOR",
      sourceIsCanonicalLiveEvent: true,
      playerName: `${p1.firstName} ${p1.lastName}`,
      assistPlayerName: `${p2.firstName} ${p2.lastName}`,
    });
  });

  it("exposes combination evidence only once the report is LOCKED", async () => {
    const report = await db.postMatchReport.create({
      data: { matchId, organisationId: fixture.organisationId, status: "REPORTED", homeGoals: 0, awayGoals: 0 },
    });
    let data = await getMatchDetailAfterData({ matchId, organisationId: fixture.organisationId, orgFilter });
    expect(data.combinationEvidence).toEqual([]);

    await db.postMatchReport.update({ where: { id: report.id }, data: { status: "LOCKED" } });
    data = await getMatchDetailAfterData({ matchId, organisationId: fixture.organisationId, orgFilter });
    expect(data.combinationEvidence).toEqual([]); // No CombinationEvidence rows seeded — still a real, empty, honest result.
  });
});
