import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { createTestOpponentTeam, createTestMatch, createTestEvent, createTestEventSquad } from "@/test/support/factories";
import { getOrCreateDebrief, saveDraftDebrief, submitDebrief, reopenDebrief, isDebriefSubmittedForReport } from "../service";
import { DEBRIEF_SCHEMA_VERSION } from "../v1";

/**
 * ADR-0152 §3 (bundle §07.9 "Debrief mapping") — the DB-backed half of the debrief service:
 * draft creation/prefill, autosave, submit's canonical mapping, reopen, and League/Event parity.
 */

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

beforeAll(async () => {
  testDb = await setupTestDb();
  fixture = await seedTestFixture(testDb);
});

afterAll(async () => {
  await teardownTestDb();
});

function fullAnswers(overrides: Record<string, unknown> = {}) {
  return {
    version: DEBRIEF_SCHEMA_VERSION,
    answers: {
      team_execution: { effort: { value: "STRONG" }, teamCohesion: { value: "OK" }, positionalShape: { value: "NOT_OBSERVED" }, recoveryBehavior: { value: "OK" } },
      worked: { selected: ["PRESSING"], comment: "Won it back high twice." },
      needs_attention: { selected: ["NOTHING_TO_ADD"] },
      match_changes: { option: "NO_MEANINGFUL_CHANGE" },
      opponent_memory: {},
      player_observations: [],
      anything_else: {},
      ...overrides,
    },
  };
}

describe("post-match debrief service — League", () => {
  let matchId: string;
  let opponentTeamId: string;

  beforeAll(async () => {
    const opponent = await createTestOpponentTeam(testDb, fixture.organisationId);
    opponentTeamId = opponent.id;
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, opponentTeamId);
    matchId = match.id;
    await testDb.postMatchReport.create({ data: { organisationId: fixture.organisationId, matchId } });
  });

  it("creates a fresh DRAFT debrief on first open, with empty answers when there is no legacy data", async () => {
    const debrief = await getOrCreateDebrief({ kind: "LEAGUE", matchId }, fixture.organisationId);
    expect(debrief.status).toBe("DRAFT");
    expect(debrief.postMatchReportId).not.toBeNull();

    const again = await getOrCreateDebrief({ kind: "LEAGUE", matchId }, fixture.organisationId);
    expect(again.id).toBe(debrief.id);
  });

  it("saves a valid draft, and rejects an invalid one without touching the stored answers", async () => {
    const debrief = await getOrCreateDebrief({ kind: "LEAGUE", matchId }, fixture.organisationId);

    const saved = await saveDraftDebrief(debrief.id, fixture.organisationId, fullAnswers());
    expect(saved.success).toBe(true);

    const invalid = await saveDraftDebrief(debrief.id, fixture.organisationId, { version: 999, answers: {} });
    expect(invalid.success).toBe(false);

    const row = await testDb.postMatchDebrief.findUniqueOrThrow({ where: { id: debrief.id } });
    expect((row.answers as { answers: { worked: { selected: string[] } } }).answers.worked.selected).toEqual(["PRESSING"]);
  });

  it("rejects submission while required questions are unreviewed", async () => {
    const match2 = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, opponentTeamId);
    await testDb.postMatchReport.create({ data: { organisationId: fixture.organisationId, matchId: match2.id } });
    const debrief = await getOrCreateDebrief({ kind: "LEAGUE", matchId: match2.id }, fixture.organisationId);

    const result = await submitDebrief({ kind: "LEAGUE", matchId: match2.id }, debrief.id, fixture.organisationId, "coach@test.com");
    expect(result.success).toBe(false);
    if (!result.success) expect(result.missing).toContain("team_execution");

    const row = await testDb.postMatchDebrief.findUniqueOrThrow({ where: { id: debrief.id } });
    expect(row.status).toBe("DRAFT");
  });

  it("submit maps team execution, opponent memory, and 'anything else' onto the canonical models, and flips the debrief to SUBMITTED", async () => {
    const debrief = await getOrCreateDebrief({ kind: "LEAGUE", matchId }, fixture.organisationId);
    await saveDraftDebrief(
      debrief.id,
      fixture.organisationId,
      fullAnswers({ opponent_memory: { note: "Pressed high on goal kicks." }, anything_else: { note: "Good response after conceding." } }),
    );

    const result = await submitDebrief({ kind: "LEAGUE", matchId }, debrief.id, fixture.organisationId, "coach@test.com");
    expect(result.success).toBe(true);

    const updatedDebrief = await testDb.postMatchDebrief.findUniqueOrThrow({ where: { id: debrief.id } });
    expect(updatedDebrief.status).toBe("SUBMITTED");
    expect(updatedDebrief.submittedBy).toBe("coach@test.com");
    expect(updatedDebrief.submittedAt).not.toBeNull();

    const reflection = await testDb.teamReflection.findFirstOrThrow({ where: { matchId } });
    expect(reflection.effort).toBe("STRONG");
    expect(reflection.teamCohesion).toBe("OK");
    // NOT_OBSERVED maps to null on the canonical model while staying present in the debrief JSON.
    expect(reflection.positionalShape).toBeNull();

    const opponentObservation = await testDb.opponentEncounterObservation.findFirstOrThrow({ where: { matchId } });
    expect(opponentObservation.factualSummary).toBe("Pressed high on goal kicks.");
    // The debrief only ever knows about factualSummary — every other field keeps its schema
    // default, proving the partial writer never invents values for fields it doesn't own.
    expect(opponentObservation.overallEnvironment).toBe("NOT_ASSESSED");

    const report = await testDb.postMatchReport.findUniqueOrThrow({ where: { matchId } });
    expect(report.teamNote).toBe("Good response after conceding.");

    expect(await isDebriefSubmittedForReport({ kind: "LEAGUE", matchId }, fixture.organisationId)).toBe(true);
  });

  it("submit never overwrites an existing distinct opponent factual summary — it appends", async () => {
    const match3 = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, opponentTeamId);
    await testDb.postMatchReport.create({ data: { organisationId: fixture.organisationId, matchId: match3.id } });
    await testDb.opponentEncounterObservation.create({
      data: { organisationId: fixture.organisationId, matchId: match3.id, opponentTeamId, factualSummary: "Existing note from the standalone form." },
    });

    const debrief = await getOrCreateDebrief({ kind: "LEAGUE", matchId: match3.id }, fixture.organisationId);
    await saveDraftDebrief(debrief.id, fixture.organisationId, fullAnswers({ opponent_memory: { note: "New note from the debrief." } }));
    await submitDebrief({ kind: "LEAGUE", matchId: match3.id }, debrief.id, fixture.organisationId, "coach@test.com");

    const opponentObservation = await testDb.opponentEncounterObservation.findFirstOrThrow({ where: { matchId: match3.id } });
    expect(opponentObservation.factualSummary).toBe("Existing note from the standalone form.\n\nNew note from the debrief.");
  });

  it("prefills team execution/anything-else/opponent-memory from legacy data on first open, without submitting", async () => {
    const match4 = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, Object.values(fixture.teams)[0]!, opponentTeamId);
    await testDb.postMatchReport.create({ data: { organisationId: fixture.organisationId, matchId: match4.id, teamNote: "Legacy team note." } });
    await testDb.teamReflection.create({ data: { organisationId: fixture.organisationId, matchId: match4.id, effort: "STRONG", note: "Legacy reflection note." } });
    await testDb.opponentEncounterObservation.create({
      data: { organisationId: fixture.organisationId, matchId: match4.id, opponentTeamId, factualSummary: "Legacy opponent note." },
    });

    const debrief = await getOrCreateDebrief({ kind: "LEAGUE", matchId: match4.id }, fixture.organisationId);
    expect(debrief.status).toBe("DRAFT");
    const answers = debrief.answers as {
      answers: { team_execution: { effort?: { value: string }; note?: string }; anything_else: { note?: string }; opponent_memory: { note?: string } };
    };
    expect(answers.answers.team_execution.effort).toEqual({ value: "STRONG" });
    expect(answers.answers.team_execution.note).toBe("Legacy reflection note.");
    expect(answers.answers.anything_else.note).toBe("Legacy team note.");
    expect(answers.answers.opponent_memory.note).toBe("Legacy opponent note.");
  });

  it("reopen sets a SUBMITTED debrief back to DRAFT without losing its answers", async () => {
    const debrief = await getOrCreateDebrief({ kind: "LEAGUE", matchId }, fixture.organisationId);
    const submittedRow = await testDb.postMatchDebrief.findUniqueOrThrow({ where: { id: debrief.id } });
    expect(submittedRow.status).toBe("SUBMITTED");

    const reopened = await reopenDebrief(debrief.id, fixture.organisationId);
    expect(reopened.success).toBe(true);

    const row = await testDb.postMatchDebrief.findUniqueOrThrow({ where: { id: debrief.id } });
    expect(row.status).toBe("DRAFT");
    expect((row.answers as { answers: { worked: { selected: string[] } } }).answers.worked.selected).toEqual(["PRESSING"]);
  });
});

describe("post-match debrief service — Event parity", () => {
  let eventMatchId: string;

  beforeAll(async () => {
    const event = await createTestEvent(testDb, fixture.organisationId, fixture.footballGroupId);
    const squad = await createTestEventSquad(testDb, fixture.organisationId, event.id);
    const match = await testDb.eventMatch.create({
      data: {
        eventId: event.id,
        eventSquadId: squad.id,
        category: "CUP",
        organisationId: fixture.organisationId,
        opponentName: "Event Opponent",
        startsAt: new Date("2028-01-01T10:00:00Z"),
        status: "SCHEDULED",
      },
    });
    eventMatchId = match.id;
    await testDb.eventPostMatchReport.create({ data: { organisationId: fixture.organisationId, eventMatchId } });
  });

  it("creates, saves, and submits an Event debrief onto EventPostMatchReport's free-text fields", async () => {
    const debrief = await getOrCreateDebrief({ kind: "EVENT", eventMatchId }, fixture.organisationId);
    expect(debrief.eventPostMatchReportId).not.toBeNull();

    await saveDraftDebrief(
      debrief.id,
      fixture.organisationId,
      fullAnswers({ team_execution: { effort: { value: "STRONG" }, teamCohesion: { value: "OK" }, positionalShape: { value: "OK" }, recoveryBehavior: { value: "OK" }, note: "Solid all round." } }),
    );
    const result = await submitDebrief({ kind: "EVENT", eventMatchId }, debrief.id, fixture.organisationId, "coach@test.com");
    expect(result.success).toBe(true);

    const report = await testDb.eventPostMatchReport.findUniqueOrThrow({ where: { eventMatchId } });
    // Event has no structured TeamReflection — the free-text note is the closest compatible slot.
    expect(report.teamReflection).toBe("Solid all round.");
    expect(await isDebriefSubmittedForReport({ kind: "EVENT", eventMatchId }, fixture.organisationId)).toBe(true);
  });
});
