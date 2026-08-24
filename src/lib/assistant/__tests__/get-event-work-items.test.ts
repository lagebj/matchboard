import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  createTestGroup,
} from "@/test/test-db";
import { getEventWorkItems } from "../get-event-work-items";

vi.mock("@/lib/db", () => {
  let _db: PrismaClient;
  return {
    get db() {
      return _db ?? getTestDb();
    },
    set db(v: PrismaClient) {
      _db = v;
    },
  };
});

let db: PrismaClient;
let opponentTeamId: string;
let testOrgId: string;
let testGroupId: string;

async function cleanEventTables(db: PrismaClient) {
  await db.eventGoalEvent.deleteMany();
  await db.eventAssistEvent.deleteMany();
  await db.eventPostMatchPlayer.deleteMany();
  await db.eventPostMatchReport.deleteMany();
  await db.eventMatchLineupAssignment.deleteMany();
  await db.eventMatchLineup.deleteMany();
  await db.eventMatchSupportAssignment.deleteMany();
  await db.eventMatch.deleteMany();
  await db.eventSquadPlayer.deleteMany();
  await db.eventSquad.deleteMany();
  await db.eventPlayerAvailability.deleteMany();
  await db.event.deleteMany();
}

describe("getEventWorkItems", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    await cleanEventTables(db);
    const org = await db.organisation.create({
      data: { name: "Event Test Org", slug: `event-test-org-${Date.now()}` },
    });
    testOrgId = org.id;
    testGroupId = await createTestGroup(db, testOrgId);
    const opp = await db.opponentTeam.create({
      data: { displayName: "Event Test Opponent", normalizedName: "event-test-opponent", organisationId: testOrgId },
    });
    opponentTeamId = opp.id;
  });

  afterAll(async () => {
    await cleanEventTables(db);
    await teardownTestDb();
  });

  it("returns event_setup_missing for event with no matches", async () => {
    const event = await db.event.create({
      data: {
        name: "Spring Cup 2026",
        eventType: "CUP",
        startsAt: new Date("2026-08-01T09:00:00Z"),
        endsAt: new Date("2026-08-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });

    const items = await getEventWorkItems();
    const setupItems = items.filter(
      (i) => i.category === "event_setup_missing" && i.eventId === event.id,
    );
    expect(setupItems.length).toBe(1);
    expect(setupItems[0]!.title).toContain("Spring Cup 2026");
    expect(setupItems[0]!.primaryActionLabel).toBe("Setup matches");
    expect(setupItems[0]!.primaryActionHref).toBe(`/events/${event.id}`);

    await cleanEventTables(db);
  });

  it("returns event_squads_missing for event with matches but no squads with players", async () => {
    const event = await db.event.create({
      data: {
        name: "Tournament 2026",
        eventType: "TOURNAMENT",
        startsAt: new Date("2026-08-15T09:00:00Z"),
        endsAt: new Date("2026-08-15T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Team A",
        intent: "COMPETITIVE",
        targetSize: 7,
        organisationId: testOrgId,
      },
    });
    await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Rivals FC",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2026-08-15T10:00:00Z"),
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const lineupItems = items.filter(
      (i) => i.eventId === event.id,
    );
    expect(lineupItems.length).toBeGreaterThanOrEqual(1);

    await cleanEventTables(db);
  });

  it("returns event_lineup_missing for event match without lineup", async () => {
    const event = await db.event.create({
      data: {
        name: "Friendly Day",
        eventType: "FRIENDLY_DAY",
        startsAt: new Date("2028-06-01T09:00:00Z"),
        endsAt: new Date("2028-06-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Team Alpha",
        intent: "BALANCED",
        targetSize: 7,
        organisationId: testOrgId,
      },
    });
    await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "OTHER",
        opponentName: "Local FC",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2028-06-01T10:00:00Z"),
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const lineupItems = items.filter(
      (i) => i.category === "event_lineup_missing" && i.eventId === event.id,
    );
    expect(lineupItems.length).toBe(1);
    expect(lineupItems[0]!.title).toContain("lineup needed");

    await cleanEventTables(db);
  });

  it("returns event_report_needed for past match with no report", async () => {
    const event = await db.event.create({
      data: {
        name: "Past Cup",
        eventType: "CUP",
        startsAt: new Date("2020-01-01T09:00:00Z"),
        endsAt: new Date("2020-01-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 20,
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Team Beta",
        intent: "COMPETITIVE",
        targetSize: 7,
        organisationId: testOrgId,
      },
    });
    const match = await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Old Rivals",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2020-01-01T10:00:00Z"),
        organisationId: testOrgId,
      },
    });
    await db.eventMatchLineup.create({
      data: {
        eventMatchId: match.id,
        status: "CONFIRMED",
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const reportItems = items.filter(
      (i) => i.category === "event_report_needed" && i.eventId === event.id,
    );
    expect(reportItems.length).toBe(1);
    expect(reportItems[0]!.title).toContain("post-match report needed");

    await cleanEventTables(db);
  });

  it("returns event_report_incomplete for past match with draft report", async () => {
    const event = await db.event.create({
      data: {
        name: "Draft Report Cup",
        eventType: "CUP",
        startsAt: new Date("2020-02-01T09:00:00Z"),
        endsAt: new Date("2020-02-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 20,
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Team Gamma",
        intent: "BALANCED",
        targetSize: 7,
        organisationId: testOrgId,
      },
    });
    const match = await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Another FC",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2020-02-01T10:00:00Z"),
        organisationId: testOrgId,
      },
    });
    await db.eventMatchLineup.create({
      data: {
        eventMatchId: match.id,
        status: "CONFIRMED",
        organisationId: testOrgId,
      },
    });
    await db.eventPostMatchReport.create({
      data: {
        eventMatchId: match.id,
        status: "DRAFT",
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const incompleteItems = items.filter(
      (i) => i.category === "event_report_incomplete" && i.eventId === event.id,
    );
    expect(incompleteItems.length).toBe(1);
    expect(incompleteItems[0]!.title).toContain("complete post-match report");

    await cleanEventTables(db);
  });

  it("does not return report items for future matches", async () => {
    const event = await db.event.create({
      data: {
        name: "Future Cup",
        eventType: "CUP",
        startsAt: new Date("2099-07-01T09:00:00Z"),
        endsAt: new Date("2099-07-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 20,
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Team Future",
        intent: "COMPETITIVE",
        targetSize: 7,
        organisationId: testOrgId,
      },
    });
    const match = await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Future Opponent",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2099-07-01T10:00:00Z"),
        organisationId: testOrgId,
      },
    });
    await db.eventMatchLineup.create({
      data: {
        eventMatchId: match.id,
        status: "CONFIRMED",
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const reportItems = items.filter(
      (i) =>
        i.eventId === event.id &&
        (i.category === "event_report_needed" || i.category === "event_report_incomplete"),
    );
    expect(reportItems.length).toBe(0);

    await cleanEventTables(db);
  });

  it("does not return lineup or report items for cancelled matches", async () => {
    const event = await db.event.create({
      data: {
        name: "Cancelled Cup",
        eventType: "CUP",
        startsAt: new Date("2020-03-01T09:00:00Z"),
        endsAt: new Date("2020-03-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 20,
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Team Cancelled",
        intent: "BALANCED",
        targetSize: 7,
        organisationId: testOrgId,
      },
    });
    await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Cancelled Opponent",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2020-03-01T10:00:00Z"),
        status: "CANCELLED",
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const eventItems = items.filter((i) => i.eventId === event.id);
    expect(eventItems.length).toBe(0);

    await cleanEventTables(db);
  });

  it("returns event_squads_draft when all squads are DRAFT", async () => {
    const event = await db.event.create({
      data: {
        name: "Draft Review Cup",
        eventType: "CUP",
        startsAt: new Date("2028-09-01T09:00:00Z"),
        endsAt: new Date("2028-09-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Draft Squad",
        intent: "COMPETITIVE",
        targetSize: 7,
        status: "DRAFT",
        organisationId: testOrgId,
      },
    });
    await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Draft Opponent",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2028-09-01T10:00:00Z"),
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const draftItems = items.filter(
      (i) => i.category === "event_squads_draft" && i.eventId === event.id,
    );
    expect(draftItems.length).toBe(1);
    expect(draftItems[0]!.title).toContain("Draft Review Cup");
    expect(draftItems[0]!.primaryActionLabel).toBe("View squads");

    await cleanEventTables(db);
  });

  it("does not return event_squads_draft when all squads are LOCKED", async () => {
    const event = await db.event.create({
      data: {
        name: "Locked Cup",
        eventType: "CUP",
        startsAt: new Date("2028-10-01T09:00:00Z"),
        endsAt: new Date("2028-10-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Locked Squad",
        intent: "COMPETITIVE",
        targetSize: 7,
        status: "LOCKED",
        organisationId: testOrgId,
      },
    });
    await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Locked Opponent",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2028-10-01T10:00:00Z"),
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const draftItems = items.filter(
      (i) => i.category === "event_squads_draft" && i.eventId === event.id,
    );
    expect(draftItems.length).toBe(0);

    await cleanEventTables(db);
  });

  it("does not return event_squads_draft when some squads are LOCKED", async () => {
    const event = await db.event.create({
      data: {
        name: "Mixed Cup",
        eventType: "CUP",
        startsAt: new Date("2028-11-01T09:00:00Z"),
        endsAt: new Date("2028-11-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Draft Squad",
        intent: "BALANCED",
        targetSize: 7,
        status: "DRAFT",
        organisationId: testOrgId,
      },
    });
    await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Locked Squad",
        intent: "COMPETITIVE",
        targetSize: 7,
        status: "LOCKED",
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const draftItems = items.filter(
      (i) => i.category === "event_squads_draft" && i.eventId === event.id,
    );
    expect(draftItems.length).toBe(0);

    await cleanEventTables(db);
  });

  it("does not return event_squads_draft once the event is fully played and reported (2026-08-24 stale-item regression)", async () => {
    const event = await db.event.create({
      data: {
        name: "Sandar Cup 2026",
        eventType: "CUP",
        startsAt: new Date("2020-03-01T09:00:00Z"),
        endsAt: new Date("2020-03-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 20,
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: event.id,
        name: "Draft Squad",
        intent: "COMPETITIVE",
        targetSize: 7,
        status: "DRAFT",
        organisationId: testOrgId,
      },
    });
    const match = await db.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Finished Rivals",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2020-03-01T10:00:00Z"),
        organisationId: testOrgId,
      },
    });
    await db.eventPostMatchReport.create({
      data: {
        eventMatchId: match.id,
        status: "LOCKED",
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const draftItems = items.filter(
      (i) => i.category === "event_squads_draft" && i.eventId === event.id,
    );
    expect(draftItems.length).toBe(0);

    await cleanEventTables(db);
  });

  it("still surfaces report items for past events", async () => {
    const pastEvent = await db.event.create({
      data: {
        name: "Long Past Event",
        eventType: "CUP",
        startsAt: new Date("2019-01-01T09:00:00Z"),
        endsAt: new Date("2019-01-01T17:00:00Z"),
        gameFormat: "SEVEN_A_SIDE",
        matchDurationMinutes: 20,
        organisationId: testOrgId,
        footballGroupId: testGroupId,
      },
    });
    const squad = await db.eventSquad.create({
      data: {
        eventId: pastEvent.id,
        name: "Past Team",
        intent: "BALANCED",
        targetSize: 7,
        organisationId: testOrgId,
      },
    });
    const pastMatch = await db.eventMatch.create({
      data: {
        eventId: pastEvent.id,
        eventSquadId: squad.id,
        category: "CUP",
        opponentName: "Old Opponent",
        opponentTeamId: opponentTeamId,
        startsAt: new Date("2019-01-01T10:00:00Z"),
        organisationId: testOrgId,
      },
    });
    await db.eventMatchLineup.create({
      data: {
        eventMatchId: pastMatch.id,
        status: "CONFIRMED",
        organisationId: testOrgId,
      },
    });

    const items = await getEventWorkItems();
    const pastReportItems = items.filter(
      (i) => i.eventId === pastEvent.id && i.category === "event_report_needed",
    );
    expect(pastReportItems.length).toBe(1);

    await cleanEventTables(db);
  });
});