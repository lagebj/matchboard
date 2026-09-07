import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { ensureMatchPlanningBaselineCaptured } from "@/lib/selection/capture-planning-baseline";

let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

async function selectAllPlayersForTeam(
  db: PrismaClient,
  fixtureIds: TestFixtureIds,
  teamName: string,
) {
  const matchId = fixtureIds.matches[teamName]!;
  const teamId = fixtureIds.teams[teamName]!;
  const teamPlayers = fixtureIds.players.filter((p) => p.coreTeamId === teamId);

  for (const player of teamPlayers) {
    await db.selection.create({
      data: {
        matchId,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: player.id,
        role: "CORE",
        status: "DRAFT",
        organisationId: fixtureIds.organisationId,
      },
    });
  }
}

describe("computeRoundPlanIntegrity: already-finalized matches within a DRAFT round", () => {
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 12 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.warning.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.movementLedger.deleteMany({});
    await testDb.matchRound.update({
      where: { id: fixtureIds.matchRoundId },
      data: { status: "DRAFT" },
    });
  });

  it("does not report a finalized match's squad as below minimum or missing goalkeeper coverage", async () => {
    // All three teams' 12 players include a primary-position goalkeeper (seedTestFixture
    // cycles GK/CB/CM/W/ST, so player index 0 is GK) — fully staffed squads, mirroring the
    // real reported scenario: Bla finalized individually, Hvit/Rod left in DRAFT.
    await selectAllPlayersForTeam(testDb, fixtureIds, "Bla");
    await selectAllPlayersForTeam(testDb, fixtureIds, "Hvit");
    await selectAllPlayersForTeam(testDb, fixtureIds, "Rod");

    const blaMatchId = fixtureIds.matches["Bla"]!;
    const blaTeamId = fixtureIds.teams["Bla"]!;

    const result = await ensureMatchPlanningBaselineCaptured(blaMatchId, { force: true });
    expect(result.captured).toBe(true);

    // Round stays DRAFT — Hvit and Rod still have real DRAFT selections.
    const round = await testDb.matchRound.findUnique({
      where: { id: fixtureIds.matchRoundId },
      select: { status: true },
    });
    expect(round!.status).toBe("DRAFT");

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const blaSignals = integrity.signals.filter((s) => s.teamId === blaTeamId);
    expect(blaSignals).toEqual([]);

    const squadBelowMinimum = integrity.signals.find(
      (s) => s.ruleCode === "SQUAD_BELOW_MINIMUM" && s.matchId === blaMatchId,
    );
    expect(squadBelowMinimum).toBeUndefined();

    const noGoalkeeperCoverage = integrity.signals.find(
      (s) => s.title.toLowerCase().includes("goalkeeper") && s.teamId === blaTeamId,
    );
    expect(noGoalkeeperCoverage).toBeUndefined();
  });

  it("still reports a genuinely under-staffed DRAFT match as below minimum", async () => {
    // Hvit gets zero selections — still correctly blocked (not the bug being fixed here).
    const hvitTeamId = fixtureIds.teams["Hvit"]!;
    const hvitMatchId = fixtureIds.matches["Hvit"]!;

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const squadBelowMinimum = integrity.signals.find(
      (s) => s.ruleCode === "SQUAD_BELOW_MINIMUM" && s.matchId === hvitMatchId,
    );
    expect(squadBelowMinimum).toBeDefined();
    expect(squadBelowMinimum!.teamId).toBe(hvitTeamId);
  });
});

// ARR-0041: these two signals both depend on knowing a player's current availability. Before
// the fix, that came from the round-scoped Availability model, which has no production write
// path anywhere in the app -- every real round therefore always resolved every player to the
// "no row" fallback (UNKNOWN), silently disabling both checks in production. The fix reads the
// same Player.currentAvailability field the Players page's availability control and
// generateSelection() itself already read/write, so a real coach-set status is honoured live.
describe("computeRoundPlanIntegrity: live current-availability checks (ARR-0041)", () => {
  let testDb: PrismaClient;
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.warning.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.movementLedger.deleteMany({});
    await testDb.player.updateMany({ data: { currentAvailability: "AVAILABLE" } });
    await testDb.matchRound.update({
      where: { id: fixtureIds.matchRoundId },
      data: { status: "DRAFT" },
    });
  });

  it("reports SELECTED_PLAYER_UNAVAILABLE for a DRAFT selection whose player is currently marked unavailable, without any round-scoped Availability row", async () => {
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const rodMatchId = fixtureIds.matches["Rod"]!;
    const rodPlayers = fixtureIds.players.filter((p) => p.coreTeamId === rodTeamId);
    const unavailablePlayer = rodPlayers[0]!;

    for (const player of rodPlayers) {
      await testDb.selection.create({
        data: {
          matchId: rodMatchId,
          matchRoundId: fixtureIds.matchRoundId,
          playerId: player.id,
          role: "CORE",
          status: "DRAFT",
          organisationId: fixtureIds.organisationId,
        },
      });
    }
    await testDb.player.update({
      where: { id: unavailablePlayer.id },
      data: { currentAvailability: "UNAVAILABLE" },
    });

    // Confirm no round-scoped Availability row exists — the signal must fire from
    // Player.currentAvailability alone, matching real production data shape.
    const roundScopedRows = await testDb.availability.count({
      where: { matchRoundId: fixtureIds.matchRoundId },
    });
    expect(roundScopedRows).toBe(0);

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const signal = integrity.signals.find(
      (s) => s.ruleCode === "SELECTED_PLAYER_UNAVAILABLE" && s.playerId === unavailablePlayer.id,
    );
    expect(signal).toBeDefined();
    expect(signal!.kind).toBe("BLOCKED");
    expect(signal!.matchId).toBe(rodMatchId);
    expect(integrity.summary.blockerCount).toBeGreaterThanOrEqual(1);
  });

  it("reports AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY as Decision required for an available, eligible, unselected player", async () => {
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const rodMatchId = fixtureIds.matches["Rod"]!;
    const rodPlayers = fixtureIds.players.filter((p) => p.coreTeamId === rodTeamId);
    const [selected, unselected] = rodPlayers;

    await testDb.selection.create({
      data: {
        matchId: rodMatchId,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: selected!.id,
        role: "CORE",
        status: "DRAFT",
        organisationId: fixtureIds.organisationId,
      },
    });
    // unselected stays AVAILABLE (the beforeEach default) and is never assigned.

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const signal = integrity.signals.find(
      (s) =>
        s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" &&
        s.playerId === unselected!.id,
    );
    expect(signal).toBeDefined();
    expect(signal!.kind).toBe("DECISION_REQUIRED");
    expect(integrity.summary.decisionRequiredCount).toBeGreaterThanOrEqual(1);
    expect(integrity.coverage.unassignedEligibleAvailablePlayerIds).toContain(unselected!.id);
  });

  it("does not report AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY for an unselected player who is currently unavailable", async () => {
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const rodPlayers = fixtureIds.players.filter((p) => p.coreTeamId === rodTeamId);
    const unselected = rodPlayers[0]!;

    await testDb.player.update({
      where: { id: unselected.id },
      data: { currentAvailability: "UNAVAILABLE" },
    });

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const signal = integrity.signals.find(
      (s) =>
        s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" &&
        s.playerId === unselected.id,
    );
    expect(signal).toBeUndefined();
    expect(integrity.coverage.unassignedEligibleAvailablePlayerIds).not.toContain(unselected.id);
  });
});

// AGENTS.md "Coaching/domain model" / round-attention Examples B & D: the normal expectation
// that an available player receives a planned opportunity only exists when the player's *core
// team* has a playable fixture in the round. Round Board visibility/availability alone must
// never create a fairness obligation or a coach decision -- a player whose core team is not
// playing this round is only an optional helper for another team.
describe("computeRoundPlanIntegrity: missing opportunity requires a core-team fixture", () => {
  let testDb: PrismaClient;
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.warning.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.movementLedger.deleteMany({});
    await testDb.player.updateMany({ data: { currentAvailability: "AVAILABLE" } });
    await testDb.match.updateMany({ data: { status: "SCHEDULED", cancelledAt: null, cancelledReason: null } });
    await testDb.matchRound.update({
      where: { id: fixtureIds.matchRoundId },
      data: { status: "DRAFT" },
    });
  });

  it("flags an available, unselected player whose core team HAS a match this round (Example A)", async () => {
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const rodPlayers = fixtureIds.players.filter((p) => p.coreTeamId === rodTeamId);

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    for (const player of rodPlayers) {
      const signal = integrity.signals.find(
        (s) =>
          s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" &&
          s.playerId === player.id,
      );
      expect(signal).toBeDefined();
      expect(signal!.kind).toBe("DECISION_REQUIRED");
    }
  });

  it("does NOT flag players whose core team has no non-cancelled match this round (Example B/D)", async () => {
    const hvitTeamId = fixtureIds.teams["Hvit"]!;
    const hvitPlayers = fixtureIds.players.filter((p) => p.coreTeamId === hvitTeamId);

    // Cancel Hvit's only fixture -> Hvit has no playable match this round.
    await testDb.match.update({
      where: { id: fixtureIds.matches["Hvit"]! },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledReason: "Test" },
    });

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    for (const player of hvitPlayers) {
      const signal = integrity.signals.find(
        (s) =>
          s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" &&
          s.playerId === player.id,
      );
      expect(signal).toBeUndefined();
      expect(integrity.coverage.unassignedEligibleAvailablePlayerIds).not.toContain(player.id);
    }

    // A team that still has a fixture is unaffected.
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const rodPlayer = fixtureIds.players.find((p) => p.coreTeamId === rodTeamId)!;
    expect(
      integrity.signals.some(
        (s) =>
          s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" &&
          s.playerId === rodPlayer.id,
      ),
    ).toBe(true);
  });

  it("does not flag a player selected as a helper for another team, and no prior obligation existed (Example C)", async () => {
    const hvitTeamId = fixtureIds.teams["Hvit"]!;
    const rodMatchId = fixtureIds.matches["Rod"]!;
    const hvitPlayers = fixtureIds.players.filter((p) => p.coreTeamId === hvitTeamId);

    // Hvit has no fixture; one Hvit player helps Rod.
    await testDb.match.update({
      where: { id: fixtureIds.matches["Hvit"]! },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelledReason: "Test" },
    });
    const helper = hvitPlayers[0]!;
    await testDb.selection.create({
      data: {
        matchId: rodMatchId,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: helper.id,
        role: "SUPPORT",
        status: "DRAFT",
        organisationId: fixtureIds.organisationId,
      },
    });

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    // No Hvit player -- helper or not -- is a missing-opportunity decision.
    for (const player of hvitPlayers) {
      expect(
        integrity.signals.some(
          (s) =>
            s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" &&
            s.playerId === player.id,
        ),
      ).toBe(false);
    }
  });

  it("does not flag a player planned for at least one of their core team's matches (Example E)", async () => {
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const rodMatchId = fixtureIds.matches["Rod"]!;
    const rodPlayer = fixtureIds.players.find((p) => p.coreTeamId === rodTeamId)!;

    await testDb.selection.create({
      data: {
        matchId: rodMatchId,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: rodPlayer.id,
        role: "CORE",
        status: "DRAFT",
        organisationId: fixtureIds.organisationId,
      },
    });

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    expect(
      integrity.signals.some(
        (s) =>
          s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" &&
          s.playerId === rodPlayer.id,
      ),
    ).toBe(false);
  });
});

// ADR-0121: once a round is FINALIZED, availability checks read the immutable per-round snapshot
// frozen at boundary close -- not the player's since-changed current value. A round finalized
// before ADR-0121 (no snapshot) asserts nothing rather than guessing.
describe("computeRoundPlanIntegrity: historical availability for a FINALIZED round (ADR-0121)", () => {
  let testDb: PrismaClient;
  let fixtureIds: TestFixtureIds;

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, { playersPerTeam: 3 });
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    await testDb.warning.deleteMany({});
    await testDb.availability.deleteMany({});
    await testDb.selection.deleteMany({});
    await testDb.movementLedger.deleteMany({});
    await testDb.player.updateMany({ data: { currentAvailability: "AVAILABLE" } });
    await testDb.matchRound.update({
      where: { id: fixtureIds.matchRoundId },
      data: { status: "DRAFT" },
    });
  });

  it("uses the captured snapshot, not the current (since-changed) availability value", async () => {
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const rodMatchId = fixtureIds.matches["Rod"]!;
    const [selected, capturedUnavailable, capturedAvailable] = fixtureIds.players.filter(
      (p) => p.coreTeamId === rodTeamId,
    );

    await testDb.selection.create({
      data: {
        matchId: rodMatchId,
        matchRoundId: fixtureIds.matchRoundId,
        playerId: selected!.id,
        role: "CORE",
        status: "FINALIZED",
        organisationId: fixtureIds.organisationId,
      },
    });

    // Snapshot frozen at boundary close: one player was out, one was available-and-unassigned.
    await testDb.availability.createMany({
      data: [
        { playerId: selected!.id, matchRoundId: fixtureIds.matchRoundId, status: "AVAILABLE", organisationId: fixtureIds.organisationId },
        { playerId: capturedUnavailable!.id, matchRoundId: fixtureIds.matchRoundId, status: "UNAVAILABLE", organisationId: fixtureIds.organisationId },
        { playerId: capturedAvailable!.id, matchRoundId: fixtureIds.matchRoundId, status: "AVAILABLE", organisationId: fixtureIds.organisationId },
      ],
    });
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });

    // Every player's CURRENT availability now disagrees with the snapshot.
    await testDb.player.updateMany({ data: { currentAvailability: "UNAVAILABLE" } });

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    const missingFor = (playerId: string) =>
      integrity.signals.some(
        (s) => s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" && s.playerId === playerId,
      );

    // Captured-available + unassigned -> still a decision, despite the current UNAVAILABLE value.
    expect(missingFor(capturedAvailable!.id)).toBe(true);
    // Captured-unavailable -> not a missing opportunity.
    expect(missingFor(capturedUnavailable!.id)).toBe(false);
    // Selected -> never a missing opportunity.
    expect(missingFor(selected!.id)).toBe(false);
  });

  it("asserts no availability-derived signal for a FINALIZED round with no snapshot (pre-ADR-0121)", async () => {
    const rodTeamId = fixtureIds.teams["Rod"]!;
    const rodPlayers = fixtureIds.players.filter((p) => p.coreTeamId === rodTeamId);

    // Round is FINALIZED but has zero Availability rows (closed before the feature existed).
    await testDb.matchRound.update({ where: { id: fixtureIds.matchRoundId }, data: { status: "FINALIZED" } });

    const integrity = await computeRoundPlanIntegrity(fixtureIds.matchRoundId);

    for (const p of rodPlayers) {
      expect(
        integrity.signals.some(
          (s) => s.ruleCode === "AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY" && s.playerId === p.id,
        ),
      ).toBe(false);
    }
  });
});
