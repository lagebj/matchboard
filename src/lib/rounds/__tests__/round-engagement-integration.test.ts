import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupTestDb, teardownTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { computeRoundEngagement, ENGAGEMENT_OVERRIDE_REASONS } from "../round-engagement";
import type { PrismaClient } from "@/generated/prisma/client";

describe("computeRoundEngagement", () => {
  let db: PrismaClient;
  let fx: TestFixtureIds;

  beforeEach(async () => {
    db = await setupTestDb();
    fx = await seedTestFixture(db);
  });

  afterEach(async () => {
    await teardownTestDb();
  });

  it("returns full engagement when all available players are selected", async () => {
    await db.matchRound.findUnique({ where: { id: fx.matchRoundId } });
    const matchIds = Object.values(fx.matches);
    const teamIds = Object.values(fx.teams);
    fx.players.map((p) => p.id);

    for (let i = 0; i < matchIds.length; i++) {
      const matchId = matchIds[i];
      const teamId = teamIds[i];
      const coreTeamPlayers = fx.players.filter((p) => p.coreTeamId === teamId);

      for (const player of coreTeamPlayers) {
        await db.selection.create({
          data: {
            matchId,
            matchRoundId: fx.matchRoundId,
            playerId: player.id,
            role: "CORE",
            status: "DRAFT",
            organisationId: fx.organisationId,
          },
        });
      }
    }

    for (const player of fx.players) {
      await db.availability.create({
        data: {
          playerId: player.id,
          matchRoundId: fx.matchRoundId,
          status: "AVAILABLE",
          organisationId: fx.organisationId,
        },
      });
    }

    const result = await computeRoundEngagement(fx.matchRoundId, db);

    expect(result.totalEligibleAvailable).toBeGreaterThan(0);
    expect(result.totalWithOpportunity).toBe(result.totalEligibleAvailable);
    expect(result.totalWithoutOpportunity).toBe(0);
    expect(result.missingOpportunityPlayers).toHaveLength(0);
    expect(result.engagementPercentage).toBe(100);
  });

  it("reports missing players when available players have no selection", async () => {
    for (const player of fx.players) {
      await db.availability.create({
        data: {
          playerId: player.id,
          matchRoundId: fx.matchRoundId,
          status: "AVAILABLE",
          organisationId: fx.organisationId,
        },
      });
    }

    const result = await computeRoundEngagement(fx.matchRoundId, db);

    expect(result.totalEligibleAvailable).toBeGreaterThan(0);
    expect(result.totalWithoutOpportunity).toBe(result.totalEligibleAvailable);
    expect(result.missingOpportunityPlayers.length).toBeGreaterThan(0);
    expect(result.engagementPercentage).toBe(0);
  });

  it("excludes unavailable players from engagement count", async () => {
    const matchIds = Object.values(fx.matches);
    const teamIds = Object.values(fx.teams);

    for (let i = 0; i < matchIds.length; i++) {
      const coreTeamPlayers = fx.players.filter((p) => p.coreTeamId === teamIds[i]);
      for (const player of coreTeamPlayers) {
        await db.selection.create({
          data: {
            matchId: matchIds[i],
            matchRoundId: fx.matchRoundId,
            playerId: player.id,
            role: "CORE",
            status: "DRAFT",
            organisationId: fx.organisationId,
          },
        });
      }
    }

    for (const player of fx.players) {
      await db.availability.create({
        data: {
          playerId: player.id,
          matchRoundId: fx.matchRoundId,
          status: "UNAVAILABLE",
          organisationId: fx.organisationId,
        },
      });
    }

    const result = await computeRoundEngagement(fx.matchRoundId, db);

    expect(result.totalEligibleAvailable).toBe(0);
    expect(result.totalWithoutOpportunity).toBe(0);
    expect(result.missingOpportunityPlayers).toHaveLength(0);
  });

  it("excludes cancelled matches from engagement count", async () => {
    const matchIds = Object.values(fx.matches);
    const teamIds = Object.values(fx.teams);

    for (let i = 0; i < matchIds.length; i++) {
      const coreTeamPlayers = fx.players.filter((p) => p.coreTeamId === teamIds[i]);
      for (const player of coreTeamPlayers) {
        await db.selection.create({
          data: {
            matchId: matchIds[i],
            matchRoundId: fx.matchRoundId,
            playerId: player.id,
            role: "CORE",
            status: "DRAFT",
            organisationId: fx.organisationId,
          },
        });
      }
    }

    for (const player of fx.players) {
      await db.availability.create({
        data: {
          playerId: player.id,
          matchRoundId: fx.matchRoundId,
          status: "AVAILABLE",
          organisationId: fx.organisationId,
        },
      });
    }

    const matches = await db.match.findMany({ where: { id: { in: matchIds } } });
    for (const match of matches.slice(0, 1)) {
      await db.match.update({
        where: { id: match.id },
        data: { status: "CANCELLED" },
      });
    }

    const result = await computeRoundEngagement(fx.matchRoundId, db);

    expect(result.cancelledMatchCount).toBeGreaterThan(0);
    expect(result.totalEligibleAvailable).toBeGreaterThan(0);
  });

  it("counts TENTATIVE availability as eligible", async () => {
    const matchIds = Object.values(fx.matches);
    const teamIds = Object.values(fx.teams);

    for (let i = 0; i < matchIds.length; i++) {
      const coreTeamPlayers = fx.players.filter((p) => p.coreTeamId === teamIds[i]);
      for (const player of coreTeamPlayers) {
        await db.selection.create({
          data: {
            matchId: matchIds[i],
            matchRoundId: fx.matchRoundId,
            playerId: player.id,
            role: "CORE",
            status: "DRAFT",
            organisationId: fx.organisationId,
          },
        });
      }
    }

    for (const player of fx.players) {
      await db.availability.create({
        data: {
          playerId: player.id,
          matchRoundId: fx.matchRoundId,
          status: "TENTATIVE",
          organisationId: fx.organisationId,
        },
      });
    }

    const result = await computeRoundEngagement(fx.matchRoundId, db);

    expect(result.totalEligibleAvailable).toBe(fx.players.length);
    expect(result.totalWithOpportunity).toBe(fx.players.length);
  });

  it("returns empty result for non-existent round", async () => {
    const result = await computeRoundEngagement("nonexistent-round-id", db);

    expect(result.totalEligibleAvailable).toBe(0);
    expect(result.totalWithOpportunity).toBe(0);
    expect(result.totalWithoutOpportunity).toBe(0);
    expect(result.engagementPercentage).toBe(100);
    expect(result.missingOpportunityPlayers).toHaveLength(0);
  });

  it("includes player core team name in missing opportunity players", async () => {
    for (const player of fx.players) {
      await db.availability.create({
        data: {
          playerId: player.id,
          matchRoundId: fx.matchRoundId,
          status: "AVAILABLE",
          organisationId: fx.organisationId,
        },
      });
    }

    const result = await computeRoundEngagement(fx.matchRoundId, db);

    expect(result.totalWithoutOpportunity).toBeGreaterThan(0);
    for (const missing of result.missingOpportunityPlayers) {
      expect(missing.playerId).toBeTruthy();
      expect(missing.playerName).toBeTruthy();
      expect(missing.hasOpportunity).toBe(false);
      expect(missing.assignedMatchIds).toHaveLength(0);
    }
  });
});

describe("ENGAGEMENT_OVERRIDE_REASONS", () => {
  it("contains all required categories", () => {
    const values = ENGAGEMENT_OVERRIDE_REASONS.map((r) => r.value);
    expect(values).toContain("injured");
    expect(values).toContain("late_withdrawal");
    expect(values).toContain("parent_logistics");
    expect(values).toContain("capacity_impossible");
    expect(values).toContain("coach_decision");
    expect(values).toContain("other");
  });

  it("each reason has non-empty label and description", () => {
    for (const reason of ENGAGEMENT_OVERRIDE_REASONS) {
      expect(reason.label.length).toBeGreaterThan(0);
      expect(reason.description.length).toBeGreaterThan(0);
    }
  });
});