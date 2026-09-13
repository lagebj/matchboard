import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import {
  setupTestDb,
  teardownTestDb,
  getTestDb,
  seedTestFixture,
  type TestFixtureIds,
} from "@/test/test-db";
import type { OrgFilterMode } from "@/lib/tenancy/resolve-org-filter";
import { getPlayerMatchHistory } from "../get-player-match-history";

let db: PrismaClient;
let fixture: TestFixtureIds;
let orgFilter: OrgFilterMode;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

/**
 * Atlas Follow-up Phase F8 (Player Detail production migration, `04_PLAYER_DETAIL_CONTRACT.md
 * §5`): `getPlayerMatchHistory()` builds directly on the existing, canonical
 * `getPlayerActualPositionHistory()` (League+Event parity via `ActualPositionInterval`), enriched
 * with each match's opponent name, per-match goals/assists (canonical `Goal`/`Assist` events for
 * League — per AGENTS.md's "Canonical data truth" — and `EventGoalEvent`/`EventAssistEvent` for
 * Event), and the planned selection role for League matches.
 */
describe("getPlayerMatchHistory", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
    orgFilter = {
      type: "org",
      filter: { organisationId: fixture.organisationId },
      filterNullable: { organisationId: fixture.organisationId },
      organisationId: fixture.organisationId,
    };
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("returns an empty array when the player has no recorded actual position intervals", async () => {
    const player = fixture.players[0];
    const result = await getPlayerMatchHistory(player.id, orgFilter);
    expect(result).toEqual([]);
  });

  it("resolves a League match's opponent name and total minutes across its intervals", async () => {
    const player = fixture.players[1];
    const matchId = Object.values(fixture.matches)[0];

    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "CM",
        startedAtMs: 0,
        endedAtMs: 20 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });
    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "CM",
        startedAtMs: 20 * 60 * 1000,
        endedAtMs: 40 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });

    const match = await db.match.findUniqueOrThrow({ where: { id: matchId }, select: { opponent: true } });

    const result = await getPlayerMatchHistory(player.id, orgFilter);
    const row = result.find((r) => r.matchKey === matchId);

    expect(row).toBeDefined();
    expect(row!.source).toBe("LEAGUE_MATCH");
    expect(row!.opponentOrEventName).toBe(match.opponent);
    expect(row!.minutes).toBe(40);
    expect(row!.actualPositions).toEqual(["CM"]);
  });

  it("orders actualPositions by minutes played, descending", async () => {
    const player = fixture.players[2];
    const matchId = Object.values(fixture.matches)[1];

    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "RB",
        startedAtMs: 0,
        endedAtMs: 10 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });
    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "CB",
        startedAtMs: 10 * 60 * 1000,
        endedAtMs: 40 * 60 * 1000,
        source: "POSITION_SWAP",
      },
    });

    const result = await getPlayerMatchHistory(player.id, orgFilter);
    const row = result.find((r) => r.matchKey === matchId);

    expect(row!.actualPositions).toEqual(["CB", "RB"]);
  });

  it("counts goals and assists from locked report events and resolves the planned role", async () => {
    const player = fixture.players[3];
    const matchId = Object.values(fixture.matches)[2];

    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "ST",
        startedAtMs: 0,
        endedAtMs: 30 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });
    const match = await db.match.findUniqueOrThrow({ where: { id: matchId }, select: { matchRoundId: true, teamId: true } });
    await db.selection.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        matchRoundId: match.matchRoundId,
        playerId: player.id,
        role: "SUPPORT",
        status: "FINALIZED",
      },
    });
    const report = await db.postMatchReport.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        status: "LOCKED",
      },
    });
    await db.goal.create({
      data: { organisationId: fixture.organisationId, reportId: report.id, playerId: player.id, minute: 12 },
    });
    await db.goal.create({
      data: { organisationId: fixture.organisationId, reportId: report.id, playerId: player.id, minute: 25 },
    });
    await db.assist.create({
      data: { organisationId: fixture.organisationId, reportId: report.id, playerId: player.id },
    });

    const result = await getPlayerMatchHistory(player.id, orgFilter);
    const row = result.find((r) => r.matchKey === matchId);

    expect(row!.goals).toBe(2);
    expect(row!.assists).toBe(1);
    expect(row!.plannedRole).toBe("SUPPORT");
  });

  it("reports goals/assists as zero and plannedRole as null for an unplanned appearance", async () => {
    const player = fixture.players[4];
    // One of the two matches the previous tests did not already cover.
    const matchId = Object.values(fixture.matches)[2];
    await db.actualPositionInterval.deleteMany({
      where: { matchId, playerId: player.id },
    });
    await db.selection.deleteMany({
      where: { matchId, playerId: player.id },
    });

    await db.actualPositionInterval.create({
      data: {
        organisationId: fixture.organisationId,
        matchId,
        playerId: player.id,
        position: "LW",
        startedAtMs: 0,
        endedAtMs: 15 * 60 * 1000,
        source: "STARTING_LINEUP",
      },
    });

    const result = await getPlayerMatchHistory(player.id, orgFilter);
    const row = result.find((r) => r.matchKey === matchId);

    expect(row).toBeDefined();
    expect(row!.goals).toBe(0);
    expect(row!.assists).toBe(0);
    expect(row!.plannedRole).toBeNull();
  });
});
