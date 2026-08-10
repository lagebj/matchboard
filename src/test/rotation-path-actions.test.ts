import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma/client";
import { setupTestDb, teardownTestDb, seedTestFixture, getTestDb, type TestFixtureIds } from "@/test/test-db";

let testDb: PrismaClient;
let fixtureIds: TestFixtureIds;

vi.mock("@/lib/db", () => ({
  get db() { return getTestDb(); },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "test-org" }),
  }),
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: {},
  requireCoachAccess: vi.fn().mockResolvedValue({ id: "test-coach", email: "test@example.com", name: "Test Coach" }),
  getCurrentCoach: vi.fn().mockResolvedValue({ id: "test-coach", email: "test@example.com", name: "Test Coach" }),
  isAllowedCoach: vi.fn().mockReturnValue(true),
}));

vi.mock("@/lib/auth/actor-context", () => ({
  requireActorContext: vi.fn().mockImplementation(() => {
    if (!fixtureIds) throw new Error("Fixture not initialized");
    return Promise.resolve({
      userId: "test-coach",
      email: "test@example.com",
      membershipId: "test-membership",
      organisationId: fixtureIds.organisationId,
      organisationSlug: "test-org",
      role: "COACH",
      accessibleGroupIds: [fixtureIds.footballGroupId],
      groupAccesses: [{ footballGroupId: fixtureIds.footballGroupId, role: "GROUP_COACH" }],
      orgFilter: { type: "org", filter: { organisationId: fixtureIds.organisationId }, filterNullable: { organisationId: fixtureIds.organisationId }, organisationId: fixtureIds.organisationId },
    });
  }),
  requireMutationRole: vi.fn().mockImplementation((ctx: unknown) => ctx),
  requireTeamAccess: vi.fn().mockImplementation((ctx: unknown) => ctx),
  requireMatchTeamAccess: vi.fn().mockResolvedValue(null),
}));

function isRedirectError(error: unknown): boolean {
  return error instanceof Error && error.message === "NEXT_REDIRECT";
}

describe("Rotation path server actions", () => {
  beforeAll(async () => {
    testDb = await setupTestDb();
    fixtureIds = await seedTestFixture(testDb, {
      teams: [
        { name: "Alpha", targetSquadSize: 11, minCorePlayers: 8, supportPriority: 1, developmentSlots: 2, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Beta", targetSquadSize: 11, minCorePlayers: 8, supportPriority: 2, developmentSlots: 1, minAcceptedSquadSize: 9, maxSquadSize: 14 },
        { name: "Gamma", targetSquadSize: 11, minCorePlayers: 8, supportPriority: 3, developmentSlots: 0, minAcceptedSquadSize: 9, maxSquadSize: 14 },
      ],
      playersPerTeam: 0,
      rotationPaths: [],
    });
  });
  afterAll(async () => { await teardownTestDb(); });

  describe("createRotationPathAction", () => {
    it("creates a rotation path with required fields", async () => {
      const alphaId = fixtureIds.teams["Alpha"];
      const betaId = fixtureIds.teams["Beta"];

      const formData = new FormData();
      formData.set("fromTeamId", alphaId);
      formData.set("toTeamId", betaId);
      formData.set("role", "SUPPORT");
      formData.set("purpose", "Alpha supports Beta");
      formData.set("priority", "1");
      formData.set("redirectTeamId", alphaId);

      const { createRotationPathAction } = await import("@/app/(app)/rules/actions");

      try {
        await createRotationPathAction({ error: "" }, formData);
      } catch (error: unknown) {
        if (!isRedirectError(error)) throw error;
      }

      const path = await testDb.rotationPath.findFirst({
        where: { fromTeamId: alphaId, toTeamId: betaId, role: "SUPPORT" },
      });

      expect(path).not.toBeNull();
      expect(path!.role).toBe("SUPPORT");
      expect(path!.purpose).toBe("Alpha supports Beta");
      expect(path!.priority).toBe(1);
      expect(path!.active).toBe(true);
      expect(path!.allowDoubleLoad).toBe(false);
    });

    it("rejects creation with same source and target team", async () => {
      const alphaId = fixtureIds.teams["Alpha"];

      const formData = new FormData();
      formData.set("fromTeamId", alphaId);
      formData.set("toTeamId", alphaId);
      formData.set("role", "DEVELOPMENT");

      const { createRotationPathAction } = await import("@/app/(app)/rules/actions");

      const result = await createRotationPathAction({ error: "" }, formData);
      expect(result.error).toContain("different");
    });

    it("rejects duplicate role path for same team pair", async () => {
      const alphaId = fixtureIds.teams["Alpha"];
      const betaId = fixtureIds.teams["Beta"];

      const formData = new FormData();
      formData.set("fromTeamId", alphaId);
      formData.set("toTeamId", betaId);
      formData.set("role", "SUPPORT");

      const { createRotationPathAction } = await import("@/app/(app)/rules/actions");

      const result = await createRotationPathAction({ error: "" }, formData);
      expect(result.error).toContain("already exists");
    });

    it("allows same team pair with different role", async () => {
      const alphaId = fixtureIds.teams["Alpha"];
      const betaId = fixtureIds.teams["Beta"];

      const formData = new FormData();
      formData.set("fromTeamId", alphaId);
      formData.set("toTeamId", betaId);
      formData.set("role", "DEVELOPMENT");
      formData.set("purpose", "Alpha development to Beta");
      formData.set("redirectTeamId", alphaId);

      const { createRotationPathAction } = await import("@/app/(app)/rules/actions");

      try {
        await createRotationPathAction({ error: "" }, formData);
      } catch (error: unknown) {
        if (!isRedirectError(error)) throw error;
      }

      const count = await testDb.rotationPath.count({
        where: { fromTeamId: alphaId, toTeamId: betaId },
      });
      expect(count).toBe(2);
    });

    it("creates a path with double-load settings", async () => {
      const alphaId = fixtureIds.teams["Alpha"];
      const gammaId = fixtureIds.teams["Gamma"];

      const formData = new FormData();
      formData.set("fromTeamId", alphaId);
      formData.set("toTeamId", gammaId);
      formData.set("role", "BACKFILL");
      formData.set("purpose", "Squad repair path");
      formData.set("allowDoubleLoad", "on");
      formData.set("minRestSpacingHours", "48");
      formData.set("maxDoubleLoadsPerPeriod", "3");
      formData.set("redirectTeamId", alphaId);

      const { createRotationPathAction } = await import("@/app/(app)/rules/actions");

      try {
        await createRotationPathAction({ error: "" }, formData);
      } catch (error: unknown) {
        if (!isRedirectError(error)) throw error;
      }

      const path = await testDb.rotationPath.findFirst({
        where: { fromTeamId: alphaId, toTeamId: gammaId, role: "BACKFILL" },
      });

      expect(path).not.toBeNull();
      expect(path!.allowDoubleLoad).toBe(true);
      expect(path!.minRestSpacingHours).toBe(48);
      expect(path!.maxDoubleLoadsPerPeriod).toBe(3);
    });

    it("rejects invalid role", async () => {
      const alphaId = fixtureIds.teams["Alpha"];
      const betaId = fixtureIds.teams["Beta"];

      const formData = new FormData();
      formData.set("fromTeamId", alphaId);
      formData.set("toTeamId", betaId);
      formData.set("role", "INVALID_ROLE");

      const { createRotationPathAction } = await import("@/app/(app)/rules/actions");

      const result = await createRotationPathAction({ error: "" }, formData);
      expect(result.error).toContain("Role must be one of");
    });
  });

  describe("toggleRotationPathActiveAction", () => {
    it("toggles active status from true to false", async () => {
      const alphaId = fixtureIds.teams["Alpha"];
      const betaId = fixtureIds.teams["Beta"];

      const path = await testDb.rotationPath.findFirstOrThrow({
        where: { fromTeamId: alphaId, toTeamId: betaId, role: "SUPPORT" },
      });

      expect(path.active).toBe(true);

      const formData = new FormData();
      formData.set("pathId", path.id);
      formData.set("redirectTeamId", alphaId);

      const { toggleRotationPathActiveAction } = await import("@/app/(app)/rules/actions");

      try {
        await toggleRotationPathActiveAction({ error: "" }, formData);
      } catch (error: unknown) {
        if (!isRedirectError(error)) throw error;
      }

      const updated = await testDb.rotationPath.findUnique({ where: { id: path.id } });
      expect(updated!.active).toBe(false);
    });
  });

  describe("updateRotationPathAction", () => {
    it("updates purpose and priority", async () => {
      const alphaId = fixtureIds.teams["Alpha"];
      const betaId = fixtureIds.teams["Beta"];

      const path = await testDb.rotationPath.findFirstOrThrow({
        where: { fromTeamId: alphaId, toTeamId: betaId, role: "SUPPORT" },
      });

      const formData = new FormData();
      formData.set("pathId", path.id);
      formData.set("fromTeamId", alphaId);
      formData.set("toTeamId", betaId);
      formData.set("purpose", "Updated support purpose");
      formData.set("priority", "5");
      formData.set("redirectTeamId", alphaId);

      const { updateRotationPathAction } = await import("@/app/(app)/rules/actions");

      try {
        await updateRotationPathAction({ error: "" }, formData);
      } catch (error: unknown) {
        if (!isRedirectError(error)) throw error;
      }

      const updated = await testDb.rotationPath.findUnique({ where: { id: path.id } });
      expect(updated!.purpose).toBe("Updated support purpose");
      expect(updated!.priority).toBe(5);
    });
  });

  describe("deleteRotationPathAction", () => {
    it("deletes a rotation path", async () => {
      const alphaId = fixtureIds.teams["Alpha"];
      const gammaId = fixtureIds.teams["Gamma"];

      const path = await testDb.rotationPath.findFirstOrThrow({
        where: { fromTeamId: alphaId, toTeamId: gammaId, role: "BACKFILL" },
      });

      const formData = new FormData();
      formData.set("pathId", path.id);
      formData.set("redirectTeamId", alphaId);

      const { deleteRotationPathAction } = await import("@/app/(app)/rules/actions");

      try {
        await deleteRotationPathAction({ error: "" }, formData);
      } catch (error: unknown) {
        if (!isRedirectError(error)) throw error;
      }

      const deleted = await testDb.rotationPath.findUnique({ where: { id: path.id } });
      expect(deleted).toBeNull();
    });
  });
});