import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { createTestMatch, createTestOpponentTeam } from "@/test/support/factories";
import {
  recordDeterministicExtraction,
  getQualitativeEvidenceForMatch,
  getQualitativeEvidenceForTeamWindow,
  getQualitativeEvidenceForOpponent,
  getQualitativeEvidenceForPlayer,
} from "../qualitative-evidence-service";

/**
 * ADR-0152 §4 (bundle `04_QUALITATIVE_EVIDENCE_MODEL.md` §9/§11/§16) — the deterministic writer's
 * fingerprint-keyed idempotency/supersession contract, and the tenant-scoped read helpers that
 * only ever surface active (SUCCEEDED, non-superseded) evidence.
 */
vi.mock("@/lib/db", async () => {
  const { getTestDb } = await import("@/test/test-db");
  return {
    get db() {
      return getTestDb();
    },
  };
});

let testDb: PrismaClient;
let fixture: TestFixtureIds;
let teamId: string;

beforeAll(async () => {
  testDb = await setupTestDb();
  fixture = await seedTestFixture(testDb);
  teamId = Object.values(fixture.teams)[0]!;
});

afterAll(async () => {
  await teardownTestDb();
});

describe("recordDeterministicExtraction", () => {
  it("creates a SUCCEEDED run and its observations on first call", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, teamId, null);
    const result = await recordDeterministicExtraction({
      organisationId: fixture.organisationId,
      teamId,
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: `debrief-${match.id}`,
      fingerprintPayload: { selected: ["PRESSING"] },
      subject: { matchId: match.id },
      observations: [{ scope: "TEAM", phase: "PRESSING", polarity: "WORKING", statement: "Won it back high." }],
    });
    expect(result.status).toBe("RECORDED");
    if (result.status !== "RECORDED") return;
    expect(result.observationCount).toBe(1);

    const run = await testDb.qualitativeEvidenceExtractionRun.findUniqueOrThrow({ where: { id: result.runId } });
    expect(run.status).toBe("SUCCEEDED");
    expect(run.derivationMethod).toBe("DETERMINISTIC");
    expect(run.supersededAt).toBeNull();

    const observations = await testDb.qualitativeEvidenceObservation.findMany({ where: { extractionRunId: result.runId } });
    expect(observations).toHaveLength(1);
    expect(observations[0]).toMatchObject({ teamId, matchId: match.id, phase: "PRESSING", polarity: "WORKING", statement: "Won it back high." });
  });

  it("is a no-op for the exact same fingerprint — same run, no new rows", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, teamId, null);
    const sourceId = `debrief-${match.id}`;
    const call = () =>
      recordDeterministicExtraction({
        organisationId: fixture.organisationId,
        teamId,
        sourceType: "POST_MATCH_DEBRIEF_NEEDS_ATTENTION",
        sourceId,
        fingerprintPayload: { selected: ["DEFENSIVE_SHAPE"] },
        subject: { matchId: match.id },
        observations: [{ scope: "TEAM", phase: "DEFENSIVE_SHAPE", polarity: "PROBLEM", statement: "Lost shape late." }],
      });

    const first = await call();
    const second = await call();

    expect(second.status).toBe("UNCHANGED");
    if (second.status !== "UNCHANGED") return;
    expect(second.runId).toBe(first.status === "RECORDED" ? first.runId : undefined);

    const runs = await testDb.qualitativeEvidenceExtractionRun.findMany({ where: { organisationId: fixture.organisationId, sourceType: "POST_MATCH_DEBRIEF_NEEDS_ATTENTION", sourceId } });
    expect(runs).toHaveLength(1);
  });

  it("supersedes the prior successful run when the fingerprint changes, retaining old observations for audit", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, teamId, null);
    const sourceId = `debrief-${match.id}`;

    const first = await recordDeterministicExtraction({
      organisationId: fixture.organisationId,
      teamId,
      sourceType: "POST_MATCH_DEBRIEF_OPPONENT",
      sourceId,
      fingerprintPayload: { note: "First note." },
      subject: { matchId: match.id },
      observations: [{ scope: "OPPONENT", phase: "GENERAL", polarity: "NEUTRAL", statement: "First note." }],
    });
    expect(first.status).toBe("RECORDED");
    if (first.status !== "RECORDED") return;

    const second = await recordDeterministicExtraction({
      organisationId: fixture.organisationId,
      teamId,
      sourceType: "POST_MATCH_DEBRIEF_OPPONENT",
      sourceId,
      fingerprintPayload: { note: "Revised note." },
      subject: { matchId: match.id },
      observations: [{ scope: "OPPONENT", phase: "GENERAL", polarity: "NEUTRAL", statement: "Revised note." }],
    });
    expect(second.status).toBe("RECORDED");
    if (second.status !== "RECORDED") return;
    expect(second.runId).not.toBe(first.runId);

    const oldRun = await testDb.qualitativeEvidenceExtractionRun.findUniqueOrThrow({ where: { id: first.runId } });
    expect(oldRun.supersededAt).not.toBeNull();
    // Old observations are retained (audit), just no longer active.
    const oldObservations = await testDb.qualitativeEvidenceObservation.findMany({ where: { extractionRunId: first.runId } });
    expect(oldObservations).toHaveLength(1);

    const active = await getQualitativeEvidenceForMatch({ matchId: match.id }, fixture.organisationId);
    const opponentStatements = active.filter((o) => o.scope === "OPPONENT").map((o) => o.statement);
    expect(opponentStatements).toEqual(["Revised note."]);
  });

  it("an empty-observations call still supersedes a prior active run (a retracted claim)", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, teamId, null);
    const sourceId = `debrief-${match.id}`;

    await recordDeterministicExtraction({
      organisationId: fixture.organisationId,
      teamId,
      sourceType: "POST_MATCH_DEBRIEF_CHANGE",
      sourceId,
      fingerprintPayload: { option: "WE_CHANGED", description: "Pushed higher." },
      subject: { matchId: match.id },
      observations: [{ scope: "TEAM", phase: "GENERAL", polarity: "NEUTRAL", statement: "Pushed higher." }],
    });

    await recordDeterministicExtraction({
      organisationId: fixture.organisationId,
      teamId,
      sourceType: "POST_MATCH_DEBRIEF_CHANGE",
      sourceId,
      fingerprintPayload: { option: "UNSURE", description: "" },
      subject: { matchId: match.id },
      observations: [],
    });

    const active = await getQualitativeEvidenceForMatch({ matchId: match.id }, fixture.organisationId);
    expect(active).toHaveLength(0);
  });
});

describe("read helpers", () => {
  it("getQualitativeEvidenceForTeamWindow returns only this team's active observations within the window", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, teamId, null, { startsAt: new Date("2026-03-01T10:00:00Z") });
    await recordDeterministicExtraction({
      organisationId: fixture.organisationId,
      teamId,
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: `window-${match.id}`,
      fingerprintPayload: { selected: ["BUILD_UP"] },
      subject: { matchId: match.id },
      observations: [{ scope: "TEAM", phase: "BUILD_UP", polarity: "WORKING", statement: "Built up calmly." }],
    });

    const inWindow = await getQualitativeEvidenceForTeamWindow(teamId, new Date("2026-01-01"), new Date("2026-12-31"), fixture.organisationId);
    expect(inWindow.some((o) => o.statement === "Built up calmly.")).toBe(true);

    const outOfWindow = await getQualitativeEvidenceForTeamWindow(teamId, new Date("2020-01-01"), new Date("2020-12-31"), fixture.organisationId);
    expect(outOfWindow.some((o) => o.statement === "Built up calmly.")).toBe(false);
  });

  it("getQualitativeEvidenceForOpponent returns only OPPONENT-scoped observations from matches against that opponent", async () => {
    const opponentTeam = await createTestOpponentTeam(testDb, fixture.organisationId);
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, teamId, opponentTeam.id);
    await recordDeterministicExtraction({
      organisationId: fixture.organisationId,
      teamId,
      sourceType: "POST_MATCH_DEBRIEF_OPPONENT",
      sourceId: `opp-${match.id}`,
      fingerprintPayload: { note: "Presses high on goal kicks." },
      subject: { matchId: match.id },
      observations: [{ scope: "OPPONENT", phase: "GENERAL", polarity: "NEUTRAL", statement: "Presses high on goal kicks." }],
    });

    const forThisOpponent = await getQualitativeEvidenceForOpponent(teamId, opponentTeam.id, fixture.organisationId);
    expect(forThisOpponent.some((o) => o.statement === "Presses high on goal kicks.")).toBe(true);

    const otherOpponent = await createTestOpponentTeam(testDb, fixture.organisationId);
    const forOtherOpponent = await getQualitativeEvidenceForOpponent(teamId, otherOpponent.id, fixture.organisationId);
    expect(forOtherOpponent).toHaveLength(0);
  });

  it("getQualitativeEvidenceForPlayer matches both the primary and secondary player of a PAIR observation", async () => {
    const match = await createTestMatch(testDb, fixture.organisationId, fixture.matchRoundId, teamId, null);
    const [playerA, playerB] = fixture.players;
    await recordDeterministicExtraction({
      organisationId: fixture.organisationId,
      teamId,
      sourceType: "POST_MATCH_DEBRIEF_WORKED",
      sourceId: `pair-${match.id}`,
      fingerprintPayload: { pair: [playerA!.id, playerB!.id] },
      subject: { matchId: match.id },
      observations: [{ scope: "PAIR", phase: "PROGRESSION", polarity: "WORKING", statement: "Combined well down the left.", playerId: playerA!.id, secondaryPlayerId: playerB!.id }],
    });

    const from = new Date("2000-01-01");
    const to = new Date("2100-01-01");
    const forA = await getQualitativeEvidenceForPlayer(playerA!.id, from, to, fixture.organisationId);
    const forB = await getQualitativeEvidenceForPlayer(playerB!.id, from, to, fixture.organisationId);
    expect(forA.some((o) => o.statement === "Combined well down the left.")).toBe(true);
    expect(forB.some((o) => o.statement === "Combined well down the left.")).toBe(true);
  });
});
