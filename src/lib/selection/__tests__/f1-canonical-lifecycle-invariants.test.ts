import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { mockAuthContext } from "@/test/support/auth-mock";
import { isMatchPlanningEditable, isMatchRoundPlanningEditable } from "@/lib/selection/planning-boundary";
import { addPlayerToDraftMatch } from "@/lib/selection/manual-draft-edit";
import { SelectionRole } from "@/generated/prisma/client";
import { refreshDraftSelection } from "@/lib/selection/refresh-draft-selection";
import { reconcileStaleRoundFinalization } from "@/lib/selection/round-finalization-transitions";

const auth = mockAuthContext();
let testDb: PrismaClient;

vi.mock("@/lib/db", () => ({
  get db() {
    return getTestDb();
  },
}));

/**
 * Consolidation Programme C1 / F1: a stale persisted `MatchRound.status` / `Selection.status`
 * must never independently block a match/round whose real planning boundary is still open.
 */
describe("F1 — canonical lifecycle invariants", () => {
  let fixture: TestFixtureIds;
  const FUTURE = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  beforeAll(async () => {
    testDb = await setupTestDb();
    fixture = await seedTestFixture(testDb, {
      matchDates: { Bla: FUTURE, Hvit: FUTURE, Rod: FUTURE },
    });
    auth.updateOrganisationId(fixture.organisationId);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("stale MatchRound.status = FINALIZED with an open boundary", () => {
    beforeAll(async () => {
      // Force the round record to FINALIZED while every match's boundary is genuinely open
      // (future kickoff, no planningClosedAt, no live session) — the pre-ADR-0109 stale state.
      await testDb.matchRound.update({
        where: { id: fixture.matchRoundId },
        data: { status: "FINALIZED" },
      });
    });

    it("isMatchPlanningEditable reports editable despite the stale status", async () => {
      const matchId = fixture.matches.Bla!;
      const result = await isMatchPlanningEditable(matchId);
      expect(result.editable).toBe(true);
    });

    it("isMatchRoundPlanningEditable reports editable despite the stale status", async () => {
      const result = await isMatchRoundPlanningEditable(fixture.matchRoundId);
      expect(result.editable).toBe(true);
    });

    it("addPlayerToDraftMatch succeeds (not blocked by the finalised round)", async () => {
      const matchId = fixture.matches.Bla!;
      const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      const result = await addPlayerToDraftMatch(matchId, player.id, SelectionRole.CORE);

      expect(result.errors).not.toEqual(
        expect.arrayContaining([expect.stringMatching(/finalis/i)]),
      );
      expect(result.success).toBe(true);
    });

    it("refreshDraftSelection does not reject with a finalised-round error", async () => {
      const matchId = fixture.matches.Hvit!;
      await expect(refreshDraftSelection(matchId)).resolves.toBeDefined();
    });
  });

  describe("reconcileStaleRoundFinalization", () => {
    it("reverts a FINALIZED round to DRAFT when no match ever actually closed, then is a no-op", async () => {
      const round = await testDb.matchRound.create({
        data: { name: "F1 stale round", leagueSeasonId: fixture.leagueSeasonId, status: "FINALIZED", organisationId: fixture.organisationId },
      });
      await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: fixture.teams.Bla!,
          opponent: "Somebody",
          opponentTeamId: Object.values(fixture.opponentTeamIds)[0]!,
          startsAt: FUTURE,
          homeAway: "HOME",
          squadSize: 11,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        },
      });

      expect(await reconcileStaleRoundFinalization(round.id)).toBe(true);
      expect((await testDb.matchRound.findUnique({ where: { id: round.id } }))?.status).toBe("DRAFT");

      // Idempotent — nothing left to correct.
      expect(await reconcileStaleRoundFinalization(round.id)).toBe(false);
    });

    it("leaves a genuinely fully-closed FINALIZED round untouched", async () => {
      const round = await testDb.matchRound.create({
        data: { name: "F1 closed round", leagueSeasonId: fixture.leagueSeasonId, status: "FINALIZED", organisationId: fixture.organisationId },
      });
      await testDb.match.create({
        data: {
          matchRoundId: round.id,
          teamId: fixture.teams.Rod!,
          opponent: "Someone else",
          opponentTeamId: Object.values(fixture.opponentTeamIds)[0]!,
          startsAt: new Date("2025-01-10T10:00:00Z"),
          planningClosedAt: new Date("2025-01-10T12:00:00Z"),
          homeAway: "AWAY",
          squadSize: 11,
          matchType: "FRIENDLY",
          gameFormat: "ELEVEN_A_SIDE",
          organisationId: fixture.organisationId,
        },
      });

      expect(await reconcileStaleRoundFinalization(round.id)).toBe(false);
      expect((await testDb.matchRound.findUnique({ where: { id: round.id } }))?.status).toBe("FINALIZED");
    });
  });
});
