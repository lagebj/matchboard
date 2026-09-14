import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext({ role: "COACH" });

vi.mock("@/lib/db", () => ({
  get db() {
    return testDb;
  },
}));

const mockRevalidatePath = vi.fn();
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

let testDb: PrismaClient;
let fixture: TestFixtureIds;

import { applyTodaySelectionRecommendationAction } from "../actions";
import { computeRoundPlanIntegrity } from "@/lib/selection/compute-plan-integrity";
import { getTodaySelectionRecommendations } from "@/lib/touchline/get-today-selection-recommendations";

/**
 * Today's inline mutation action (ADR-0141). Mirrors the authorization and stale-state test
 * shape used by `draft-selection-actions.ts`'s own callers — Today must never be a weaker
 * authorization path than the Round Board for the exact same underlying mutation
 * (`addPlayerToDraftMatch`).
 */
describe("applyTodaySelectionRecommendationAction (authorization, tenancy, and stale-state)", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    // Kickoffs must be in the future — `isPlanningBoundaryClosed()` closes planning once
    // `startsAt` has passed, and the fixture's default dates are in the past.
    const futureKickoff = new Date(Date.now() + 24 * 60 * 60 * 1000);
    fixture = await seedTestFixture(testDb, {
      playersPerTeam: 9,
      matchDates: { Bla: futureKickoff, Hvit: futureKickoff, Rod: futureKickoff },
    });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  beforeEach(async () => {
    auth.updateOrganisationId(fixture.organisationId);
    mockRevalidatePath.mockClear();
    auth.mockRequireMutationRole.mockImplementation(() => {});
    auth.mockRequireMatchGroupAccess.mockResolvedValue(null);
    auth.mockRequirePlayerGroupAccess.mockResolvedValue(null);
    await testDb.selection.deleteMany({});
  });

  /**
   * Assigns every player except `subjectPlayerId` a DRAFT selection into their own core team's
   * match, leaving `subjectPlayerId` as the *only* `AVAILABLE_PLAYER_WITHOUT_PLANNED_OPPORTUNITY`
   * signal — this makes the recommendation deterministic (no `dependsOnPrior` coordination chain)
   * without needing to reason about `buildAssignmentContext()`'s cross-team need ordering.
   */
  async function isolateSingleCandidate(subjectPlayerId: string) {
    const others = fixture.players.filter((p) => p.id !== subjectPlayerId);
    await testDb.selection.createMany({
      data: others.map((p) => ({
        matchId: fixture.matches[p.coreTeamName]!,
        matchRoundId: fixture.matchRoundId,
        playerId: p.id,
        role: "CORE" as const,
        status: "DRAFT" as const,
        organisationId: fixture.organisationId,
      })),
    });
  }

  async function getFreshRecommendation(playerId: string) {
    const integrity = await computeRoundPlanIntegrity(fixture.matchRoundId);
    const decisions = await getTodaySelectionRecommendations(
      fixture.organisationId,
      { [fixture.matchRoundId]: integrity },
      "test-org",
      [],
    );
    const decision = decisions.find((d) => d.playerId === playerId);
    if (!decision?.recommendation?.directlyActionable) {
      throw new Error(
        `Test setup expected a directly actionable recommendation but got: ${JSON.stringify(decision?.recommendation)}`,
      );
    }
    return decision.recommendation;
  }

  it("rejects an unauthenticated/no-membership caller before touching the mutation", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);

    auth.mockRequireActorContext.mockRejectedValueOnce(new Error("Not authenticated"));

    await expect(
      applyTodaySelectionRecommendationAction({
        orgSlug: "test-org",
        playerId: player.id,
        targetMatchId: rec.targetMatchId,
        role: rec.role,
        recommendationFingerprint: rec.fingerprint,
      }),
    ).rejects.toThrow();

    const selection = await testDb.selection.findFirst({ where: { playerId: player.id, matchId: rec.targetMatchId } });
    expect(selection).toBeNull();
  });

  it("rejects a caller whose resolved organisation does not own the target match (cross-tenant)", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);

    auth.updateOrganisationId("some-other-org-id");

    const result = await applyTodaySelectionRecommendationAction({
      orgSlug: "test-org",
      playerId: player.id,
      targetMatchId: rec.targetMatchId,
      role: rec.role,
      recommendationFingerprint: rec.fingerprint,
    });

    expect(result.success).toBe(false);
    expect(result.message).toMatch(/not found|access denied/i);
    auth.updateOrganisationId(fixture.organisationId);
  });

  it("rejects an insufficient role before touching the mutation", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);

    auth.mockRequireMutationRole.mockImplementationOnce(() => {
      throw new Error("Mutation access required");
    });

    await expect(
      applyTodaySelectionRecommendationAction({
        orgSlug: "test-org",
        playerId: player.id,
        targetMatchId: rec.targetMatchId,
        role: rec.role,
        recommendationFingerprint: rec.fingerprint,
      }),
    ).rejects.toThrow("Mutation access required");

    const selection = await testDb.selection.findFirst({ where: { playerId: player.id, matchId: rec.targetMatchId } });
    expect(selection).toBeNull();
  });

  it("rejects when the caller lacks match-group access", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);

    auth.mockRequireMatchGroupAccess.mockRejectedValueOnce(new Error("Match group access required"));

    await expect(
      applyTodaySelectionRecommendationAction({
        orgSlug: "test-org",
        playerId: player.id,
        targetMatchId: rec.targetMatchId,
        role: rec.role,
        recommendationFingerprint: rec.fingerprint,
      }),
    ).rejects.toThrow("Match group access required");

    const selection = await testDb.selection.findFirst({ where: { playerId: player.id, matchId: rec.targetMatchId } });
    expect(selection).toBeNull();
  });

  it("rejects when the caller lacks player-group access", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);

    auth.mockRequirePlayerGroupAccess.mockRejectedValueOnce(new Error("Player group access required"));

    await expect(
      applyTodaySelectionRecommendationAction({
        orgSlug: "test-org",
        playerId: player.id,
        targetMatchId: rec.targetMatchId,
        role: rec.role,
        recommendationFingerprint: rec.fingerprint,
      }),
    ).rejects.toThrow("Player group access required");

    const selection = await testDb.selection.findFirst({ where: { playerId: player.id, matchId: rec.targetMatchId } });
    expect(selection).toBeNull();
  });

  it("applies the mutation and revalidates Today/Round Board/Fixtures when the fingerprint matches current state", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Hvit")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);

    const result = await applyTodaySelectionRecommendationAction({
      orgSlug: "test-org",
      playerId: player.id,
      targetMatchId: rec.targetMatchId,
      role: rec.role,
      recommendationFingerprint: rec.fingerprint,
    });

    expect(result.success).toBe(true);
    const selection = await testDb.selection.findFirst({
      where: { playerId: player.id, matchId: rec.targetMatchId, status: "DRAFT" },
    });
    expect(selection).not.toBeNull();

    expect(mockRevalidatePath).toHaveBeenCalledWith("/o/test-org/today");
    expect(mockRevalidatePath).toHaveBeenCalledWith(`/o/test-org/rounds/${fixture.matchRoundId}`);
    expect(mockRevalidatePath).toHaveBeenCalledWith("/o/test-org/fixtures");
  });

  it("rejects a stale fingerprint without mutating", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Rod")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);

    const result = await applyTodaySelectionRecommendationAction({
      orgSlug: "test-org",
      playerId: player.id,
      targetMatchId: rec.targetMatchId,
      role: rec.role,
      recommendationFingerprint: "stale-fingerprint-value",
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("The round changed. Review the updated recommendation.");
    const selection = await testDb.selection.findFirst({ where: { playerId: player.id, matchId: rec.targetMatchId } });
    expect(selection).toBeNull();
  });

  it("rejects a submitted target match that no longer matches the rebuilt recommendation", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);
    const wrongTargetMatchId = fixture.matches["Hvit"]!;
    expect(wrongTargetMatchId).not.toBe(rec.targetMatchId);

    const result = await applyTodaySelectionRecommendationAction({
      orgSlug: "test-org",
      playerId: player.id,
      targetMatchId: wrongTargetMatchId,
      role: rec.role,
      recommendationFingerprint: rec.fingerprint,
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("The round changed. Review the updated recommendation.");
    const selection = await testDb.selection.findFirst({ where: { playerId: player.id, matchId: wrongTargetMatchId } });
    expect(selection).toBeNull();
  });

  it("rejects once the player is no longer available (now-unavailable) even with a previously valid fingerprint", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);

    await testDb.player.update({ where: { id: player.id }, data: { currentAvailability: "UNAVAILABLE" } });

    const result = await applyTodaySelectionRecommendationAction({
      orgSlug: "test-org",
      playerId: player.id,
      targetMatchId: rec.targetMatchId,
      role: rec.role,
      recommendationFingerprint: rec.fingerprint,
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("The round changed. Review the updated recommendation.");
    const selection = await testDb.selection.findFirst({ where: { playerId: player.id, matchId: rec.targetMatchId } });
    expect(selection).toBeNull();

    await testDb.player.update({ where: { id: player.id }, data: { currentAvailability: "AVAILABLE" } });
  });

  it("rejects once the planning boundary is closed for the target match", async () => {
    const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
    await isolateSingleCandidate(player.id);
    const rec = await getFreshRecommendation(player.id);

    await testDb.match.update({
      where: { id: rec.targetMatchId },
      data: { planningClosedAt: new Date(Date.now() - 60_000) },
    });

    const result = await applyTodaySelectionRecommendationAction({
      orgSlug: "test-org",
      playerId: player.id,
      targetMatchId: rec.targetMatchId,
      role: rec.role,
      recommendationFingerprint: rec.fingerprint,
    });

    expect(result.success).toBe(false);
    expect(result.message).toBe("The round changed. Review the updated recommendation.");
    const selection = await testDb.selection.findFirst({ where: { playerId: player.id, matchId: rec.targetMatchId } });
    expect(selection).toBeNull();

    await testDb.match.update({ where: { id: rec.targetMatchId }, data: { planningClosedAt: null } });
  });
});
