import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";

/**
 * ADR-0152 Slice 0: the hand-added CHECK constraints in
 * 20260926120000_add_coach_learning_loop are the database-level backstop for invariants Prisma
 * cannot express. Each case below must be rejected by Postgres itself, regardless of app code.
 */

let testDb: PrismaClient;
let fixture: TestFixtureIds;

describe("coach learning loop schema invariants (ADR-0152)", () => {
  let matchId: string;
  let teamId: string;
  let playerA: string;
  let playerB: string;
  let reportId: string;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, { playersPerTeam: 2 });
    matchId = Object.values(fixture.matches)[0];
    teamId = Object.values(fixture.teams)[0];
    playerA = fixture.players[0].id;
    playerB = fixture.players[1].id;
    const report = await testDb.postMatchReport.create({ data: { organisationId: fixture.organisationId, matchId } });
    reportId = report.id;
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  async function run() {
    return testDb.qualitativeEvidenceExtractionRun.create({
      data: {
        organisationId: fixture.organisationId,
        sourceType: "POST_MATCH_DEBRIEF_WORKED",
        sourceId: `src-${Math.random()}`,
        sourceFingerprint: "fp",
        derivationMethod: "DETERMINISTIC",
        status: "SUCCEEDED",
      },
    });
  }

  it("rejects a debrief attached to neither report", async () => {
    await expect(
      testDb.postMatchDebrief.create({ data: { organisationId: fixture.organisationId, answers: {} } }),
    ).rejects.toThrow();
  });

  it("accepts a debrief attached to exactly one report and enforces one debrief per report", async () => {
    await testDb.postMatchDebrief.create({ data: { organisationId: fixture.organisationId, postMatchReportId: reportId, answers: {} } });
    await expect(
      testDb.postMatchDebrief.create({ data: { organisationId: fixture.organisationId, postMatchReportId: reportId, answers: {} } }),
    ).rejects.toThrow();
  });

  it("rejects PLAYER scope without a player", async () => {
    const r = await run();
    await expect(
      testDb.qualitativeEvidenceObservation.create({
        data: { organisationId: fixture.organisationId, extractionRunId: r.id, teamId, matchId, scope: "PLAYER", phase: "GENERAL", polarity: "NEUTRAL", statement: "x" },
      }),
    ).rejects.toThrow();
  });

  it("rejects PAIR scope with the same player twice", async () => {
    const r = await run();
    await expect(
      testDb.qualitativeEvidenceObservation.create({
        data: { organisationId: fixture.organisationId, extractionRunId: r.id, teamId, matchId, playerId: playerA, secondaryPlayerId: playerA, scope: "PAIR", phase: "GENERAL", polarity: "NEUTRAL", statement: "x" },
      }),
    ).rejects.toThrow();
  });

  it("accepts a valid PAIR observation and rejects statements over 500 characters", async () => {
    const r = await run();
    await testDb.qualitativeEvidenceObservation.create({
      data: { organisationId: fixture.organisationId, extractionRunId: r.id, teamId, matchId, playerId: playerA, secondaryPlayerId: playerB, scope: "PAIR", phase: "PROGRESSION", polarity: "WORKING", statement: "Linked well on the right." },
    });
    await expect(
      testDb.qualitativeEvidenceObservation.create({
        data: { organisationId: fixture.organisationId, extractionRunId: r.id, teamId, matchId, scope: "TEAM", phase: "GENERAL", polarity: "NEUTRAL", statement: "x".repeat(501) },
      }),
    ).rejects.toThrow();
  });

  it("rejects an extraction run duplicating the same source fingerprint", async () => {
    const data = {
      organisationId: fixture.organisationId,
      sourceType: "POST_MATCH_TEAM_NOTE" as const,
      sourceId: "same-source",
      sourceFingerprint: "same-fp",
      derivationMethod: "AI_STRUCTURED" as const,
      status: "QUEUED" as const,
    };
    await testDb.qualitativeEvidenceExtractionRun.create({ data });
    await expect(testDb.qualitativeEvidenceExtractionRun.create({ data })).rejects.toThrow();
  });
});
