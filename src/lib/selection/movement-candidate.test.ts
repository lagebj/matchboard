import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from "vitest";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";
import { PrismaClient, type MovementCandidateRole, type MovementCandidateRationale } from "@/generated/prisma/client";

vi.mock("@/lib/db", () => {
  return {
    get db() {
      return getTestDb();
    },
  };
});

let db: PrismaClient;
let fixture: TestFixtureIds;

describe("movement-candidate data model and validation", () => {
  beforeAll(async () => {
    db = await setupTestDb();
    fixture = await seedTestFixture(db);
  });

  afterEach(async () => {
    await db.movementCandidate.deleteMany();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe("createMovementCandidate", () => {
    it("requires playerId", async () => {
      const { validateCandidateCreation } = await import("@/lib/selection/movement-candidate");
      const result = await validateCandidateCreation({
        playerId: "nonexistent",
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Player not found");
    });

    it("requires rotationPathId", async () => {
      const { validateCandidateCreation } = await import("@/lib/selection/movement-candidate");
      const player = fixture.players[0]!;
      const result = await validateCandidateCreation({
        playerId: player.id,
        rotationPathId: "nonexistent",
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("Rotation path not found");
    });

    it("requires role", async () => {
      const { validateCandidateCreation } = await import("@/lib/selection/movement-candidate");
      const player = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const blaToHvitSupportPath = fixture.rotationPathIds[0]!;
      const result = await validateCandidateCreation({
        playerId: player.id,
        rotationPathId: blaToHvitSupportPath,
        role: "DEVELOPMENT" as MovementCandidateRole,
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("does not match");
    });

    it("rejects invalid rationale category", async () => {
      const { createMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const result = await createMovementCandidate({
        playerId: fixture.players[0]!.id,
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "INVALID_CATEGORY" as MovementCandidateRationale,
      });
      expect(result.success).toBe(false);
    });

    it("cannot reference missing player", async () => {
      const { validateCandidateCreation } = await import("@/lib/selection/movement-candidate");
      const result = await validateCandidateCreation({
        playerId: "nonexistent-player-id",
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });
      expect(result.valid).toBe(false);
    });

    it("cannot reference missing rotation path", async () => {
      const { validateCandidateCreation } = await import("@/lib/selection/movement-candidate");
      const player = fixture.players[0]!;
      const result = await validateCandidateCreation({
        playerId: player.id,
        rotationPathId: "nonexistent-path-id",
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });
      expect(result.valid).toBe(false);
    });

    it("player must belong to rotation path source team", async () => {
      const { validateCandidateCreation } = await import("@/lib/selection/movement-candidate");
      const hvitPlayer = fixture.players.find((p) => p.coreTeamName === "Hvit")!;
      const blaToHvitSupportPath = fixture.rotationPathIds[0]!;

      const result = await validateCandidateCreation({
        playerId: hvitPlayer.id,
        rotationPathId: blaToHvitSupportPath,
        role: "SUPPORT",
        rationaleCategory: "STABILISE_TEAM_FUNCTION",
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain("source team");
    });

    it("rejects non-rotatable player", async () => {
      const { validateCandidateCreation } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      await db.player.update({
        where: { id: blaPlayer.id },
        data: { nonRotatable: true },
      });

      const result = await validateCandidateCreation({
        playerId: blaPlayer.id,
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "SUPPORT_TEAMMATES",
      });

      await db.player.update({
        where: { id: blaPlayer.id },
        data: { nonRotatable: false },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain("non-rotatable");
    });

    it("creates a valid candidate", async () => {
      const { createMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const blaToHvitSupportPath = fixture.rotationPathIds[0]!;

      const result = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: blaToHvitSupportPath,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
        rationaleNote: "Test note",
        reviewBy: new Date("2025-12-31"),
      });

      expect(result.success).toBe(true);
      expect(result.candidate).toBeDefined();
      expect(result.candidate!.role).toBe("SUPPORT");
      expect(result.candidate!.status).toBe("ACTIVE");
      expect(result.candidate!.rationaleCategory).toBe("CHALLENGE_EXPOSURE");

      await db.movementCandidate.delete({ where: { id: result.candidate!.id } });
    });

    it("rejects duplicate candidate for same player/path/role", async () => {
      const { createMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const blaToHvitSupportPath = fixture.rotationPathIds[0]!;

      const first = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: blaToHvitSupportPath,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });
      expect(first.success).toBe(true);

      const second = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: blaToHvitSupportPath,
        role: "SUPPORT",
        rationaleCategory: "SUPPORT_TEAMMATES",
      });
      expect(second.success).toBe(false);

      await db.movementCandidate.delete({ where: { id: first.candidate!.id } });
    });
  });

  describe("updateMovementCandidate", () => {
    it("pauses a candidate", async () => {
      const { createMovementCandidate, updateMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });

      const updated = await updateMovementCandidate(created.candidate!.id, { status: "PAUSED" });
      expect(updated.success).toBe(true);
      expect(updated.candidate!.status).toBe("PAUSED");

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });

    it("reactivates a paused candidate", async () => {
      const { createMovementCandidate, updateMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });

      await updateMovementCandidate(created.candidate!.id, { status: "PAUSED" });
      const reactivated = await updateMovementCandidate(created.candidate!.id, { status: "ACTIVE" });
      expect(reactivated.success).toBe(true);
      expect(reactivated.candidate!.status).toBe("ACTIVE");

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });

    it("updates rationale category and note", async () => {
      const { createMovementCandidate, updateMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });

      const updated = await updateMovementCandidate(created.candidate!.id, {
        rationaleCategory: "POSITIONAL_LEARNING",
        rationaleNote: "Updated note",
      });
      expect(updated.success).toBe(true);
      expect(updated.candidate!.rationaleCategory).toBe("POSITIONAL_LEARNING");
      expect(updated.candidate!.rationaleNote).toBe("Updated note");

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });
  });

  describe("deleteMovementCandidate", () => {
    it("deletes a candidate", async () => {
      const { createMovementCandidate, deleteMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });

      const deleted = await deleteMovementCandidate(created.candidate!.id);
      expect(deleted.success).toBe(true);

      const found = await db.movementCandidate.findUnique({ where: { id: created.candidate!.id } });
      expect(found).toBeNull();
    });
  });

  describe("team query behaviour", () => {
    it("incoming candidates for a team are returned correctly", async () => {
      const { createMovementCandidate, getIncomingCandidatesForTeam } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const blaToHvitSupportPath = fixture.rotationPathIds[0]!;
      const hvitTeamId = fixture.teams["Hvit"]!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: blaToHvitSupportPath,
        role: "SUPPORT",
        rationaleCategory: "STABILISE_TEAM_FUNCTION",
      });

      const incoming = await getIncomingCandidatesForTeam(hvitTeamId);
      expect(incoming.length).toBeGreaterThanOrEqual(1);
      expect(incoming.some((c) => c.playerId === blaPlayer.id)).toBe(true);

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });

    it("outgoing candidates for a team are returned correctly", async () => {
      const { createMovementCandidate, getOutgoingCandidatesForTeam } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const blaToHvitSupportPath = fixture.rotationPathIds[0]!;
      const blaTeamId = fixture.teams["Bla"]!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: blaToHvitSupportPath,
        role: "SUPPORT",
        rationaleCategory: "SUPPORT_TEAMMATES",
      });

      const outgoing = await getOutgoingCandidatesForTeam(blaTeamId);
      expect(outgoing.length).toBeGreaterThanOrEqual(1);
      expect(outgoing.some((c) => c.playerId === blaPlayer.id)).toBe(true);

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });

    it("paused candidates are included but clearly marked", async () => {
      const { createMovementCandidate, getIncomingCandidatesForTeam, updateMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const hvitTeamId = fixture.teams["Hvit"]!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });

      await updateMovementCandidate(created.candidate!.id, { status: "PAUSED" });

      const incoming = await getIncomingCandidatesForTeam(hvitTeamId);
      const pausedEntry = incoming.find((c) => c.playerId === blaPlayer.id);
      expect(pausedEntry).toBeDefined();
      expect(pausedEntry!.status).toBe("PAUSED");

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });

    it("candidate does not alter core team membership", async () => {
      const { createMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const originalCoreTeamId = blaPlayer.coreTeamId;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: fixture.rotationPathIds[0]!,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });

      const updatedPlayer = await db.player.findUnique({
        where: { id: blaPlayer.id },
        select: { coreTeamId: true },
      });
      expect(updatedPlayer!.coreTeamId).toBe(originalCoreTeamId);

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });
  });

  describe("active candidate queries", () => {
    it("getActiveMovementCandidatesForPath returns active candidates", async () => {
      const { createMovementCandidate, getActiveMovementCandidatesForPath } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const blaToHvitSupportPath = fixture.rotationPathIds[0]!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: blaToHvitSupportPath,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });

      const active = await getActiveMovementCandidatesForPath(blaToHvitSupportPath, "SUPPORT");
      expect(active.some((c) => c.playerId === blaPlayer.id)).toBe(true);

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });

    it("paused candidate is not returned as active", async () => {
      const { createMovementCandidate, getActiveMovementCandidatesForPath, updateMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const blaToHvitSupportPath = fixture.rotationPathIds[0]!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: blaToHvitSupportPath,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });

      await updateMovementCandidate(created.candidate!.id, { status: "PAUSED" });

      const active = await getActiveMovementCandidatesForPath(blaToHvitSupportPath, "SUPPORT");
      expect(active.some((c) => c.playerId === blaPlayer.id)).toBe(false);

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });

    it("isPlayerActiveCandidate returns true for active and false for paused", async () => {
      const { createMovementCandidate, isPlayerActiveCandidate, updateMovementCandidate } = await import("@/lib/selection/movement-candidate");
      const blaPlayer = fixture.players.find((p) => p.coreTeamName === "Bla")!;
      const blaToHvitSupportPath = fixture.rotationPathIds[0]!;

      const created = await createMovementCandidate({
        playerId: blaPlayer.id,
        rotationPathId: blaToHvitSupportPath,
        role: "SUPPORT",
        rationaleCategory: "CHALLENGE_EXPOSURE",
      });

      expect(await isPlayerActiveCandidate(blaPlayer.id, blaToHvitSupportPath, "SUPPORT")).toBe(true);

      await updateMovementCandidate(created.candidate!.id, { status: "PAUSED" });
      expect(await isPlayerActiveCandidate(blaPlayer.id, blaToHvitSupportPath, "SUPPORT")).toBe(false);

      await db.movementCandidate.delete({ where: { id: created.candidate!.id } });
    });
  });
});