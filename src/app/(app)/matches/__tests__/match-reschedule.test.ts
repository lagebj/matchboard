import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => {
  class AuthorizationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "AuthorizationError";
    }
  }
  return { AuthorizationError, requireCoachAccess: vi.fn() };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue({ value: "test-org" }),
  }),
}));

vi.mock("@/lib/auth/actor-context", () => ({
  requireActorContext: vi.fn().mockResolvedValue({
    userId: "test-user",
    email: "test@example.com",
    membershipId: "mem-1",
    organisationId: "org-1",
    organisationSlug: "test-org",
    role: "COACH",
    accessibleGroupIds: ["group-1"],
    groupAccesses: [{ footballGroupId: "group-1", role: "GROUP_COACH" }],
    orgFilter: { type: "org", filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
  }),
  requireMutationRole: vi.fn().mockResolvedValue({
    userId: "test-user",
    email: "test@example.com",
    membershipId: "mem-1",
    organisationId: "org-1",
    organisationSlug: "test-org",
    role: "COACH",
    accessibleGroupIds: ["group-1"],
    groupAccesses: [{ footballGroupId: "group-1", role: "GROUP_COACH" }],
    orgFilter: { type: "org", filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
  }),
  requireMatchGroupAccess: vi.fn().mockResolvedValue({
    userId: "test-user",
    email: "test@example.com",
    membershipId: "mem-1",
    organisationId: "org-1",
    organisationSlug: "test-org",
    role: "COACH",
    accessibleGroupIds: ["group-1"],
    groupAccesses: [{ footballGroupId: "group-1", role: "GROUP_COACH" }],
    orgFilter: { type: "org", filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" },
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/selection/reconcile-integrity", () => ({
  reconcileRoundAfterDraftMutation: vi.fn(),
}));

vi.mock("@/lib/matches/resolve-or-create-match-round-for-date", () => ({
  resolveOrCreateMatchRoundForDate: vi.fn(),
  isSameIsoWeek: vi.fn(),
  AmbiguousRoundError: class AmbiguousRoundError extends Error {
    constructor(m: string) { super(m); this.name = "AmbiguousRoundError"; }
  },
  DateOutsideLeagueSeasonError: class DateOutsideLeagueSeasonError extends Error {
    constructor(m: string) { super(m); this.name = "DateOutsideLeagueSeasonError"; }
  },
}));

import { resolveOrCreateMatchRoundForDate, isSameIsoWeek, AmbiguousRoundError } from "@/lib/matches/resolve-or-create-match-round-for-date";

describe("updateMatchAction automatic round placement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isSameIsoWeek).mockReturnValue(true);
  });

  async function setupCrossRoundMocks() {
    const { requireCoachAccess } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");

    vi.mocked(requireCoachAccess).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof requireCoachAccess>>);
    vi.mocked(isSameIsoWeek).mockReturnValue(false);
    vi.spyOn(db.match, "findFirst").mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-27T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        name: "W17 2026",
        leagueSeasonId: "p1",
        leagueSeason: { id: "p1", startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30") },
      },
    } as unknown as Awaited<ReturnType<typeof db.match.findFirst>>);
    vi.spyOn(db.postMatchReport, "findFirst").mockResolvedValue(null);
    vi.spyOn(db.selection, "findFirst").mockResolvedValue(null);

    return { db };
  }

  it("same-week edit updates date only without resolver call", async () => {
    const { requireCoachAccess } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");

    vi.mocked(requireCoachAccess).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof requireCoachAccess>>);
    vi.spyOn(db.match, "findFirst").mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-15T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        name: "W16 2026",
        leagueSeasonId: "p1",
        leagueSeason: { id: "p1", startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30") },
      },
    } as unknown as Awaited<ReturnType<typeof db.match.findFirst>>);
    vi.spyOn(db.postMatchReport, "findFirst").mockResolvedValue(null);
    vi.spyOn(db.match, "update").mockResolvedValue({ id: "m1" } as unknown as Awaited<ReturnType<typeof db.match.update>>);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-04-16T12:00:00.000Z");

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.movedRound).toBe(false);
      expect(result.createdRound).toBe(false);
    }
    expect(resolveOrCreateMatchRoundForDate).not.toHaveBeenCalled();
  });

  it("FINALIZED cross-round move rejected before resolver call", async () => {
    await setupCrossRoundMocks();
    const { db } = await import("@/lib/db");
    vi.spyOn(db.selection, "findFirst").mockResolvedValue({ id: "s1" } as unknown as Awaited<ReturnType<typeof db.selection.findFirst>>);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-05-11T15:00:00.000Z");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("finalised squad plan");
    }
    expect(resolveOrCreateMatchRoundForDate).not.toHaveBeenCalled();
  });

  it("ambiguous round error from resolver is surfaced", async () => {
    await setupCrossRoundMocks();
    vi.mocked(resolveOrCreateMatchRoundForDate).mockRejectedValue(
      new AmbiguousRoundError("More than one round matches the selected match week."),
    );

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-06-08T15:00:00.000Z");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("More than one round");
    }
  });

  it("no manual matchRoundId input is required", async () => {
    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    expect(updateMatchAction.length).toBe(2);
  });

  it("success result includes round placement metadata", async () => {
    await setupCrossRoundMocks();
    vi.mocked(resolveOrCreateMatchRoundForDate).mockResolvedValue({
      roundId: "r2",
      roundName: "W20 2026",
      created: false,
      isoWeekLabel: "W20 2026",
    });

    const { db } = await import("@/lib/db");
    const mockTransaction = async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const mockTx: Record<string, unknown> = {
        match: { update: vi.fn().mockResolvedValue({ id: "m1" }) },
        selection: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
        movementLedger: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      };
      return fn(mockTx);
    };
    vi.spyOn(db, "$transaction").mockImplementation(mockTransaction as unknown as typeof db.$transaction);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-05-11T15:00:00.000Z");

    if (result.success) {
      expect(result.movedRound).toBe(true);
      expect(result.createdRound).toBe(false);
      expect(result.targetRoundId).toBe("r2");
      expect(result.targetRoundName).toBe("W20 2026");
    }
  });

  it("success result differentiates created round", async () => {
    await setupCrossRoundMocks();
    vi.mocked(resolveOrCreateMatchRoundForDate).mockResolvedValue({
      roundId: "r-new",
      roundName: "W24 2026",
      created: true,
      isoWeekLabel: "W24 2026",
    });

    const { db } = await import("@/lib/db");
    const mockTransaction = async (fn: (tx: Record<string, unknown>) => Promise<unknown>) => {
      const mockTx: Record<string, unknown> = {
        match: { update: vi.fn().mockResolvedValue({ id: "m1" }) },
        selection: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
        movementLedger: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
      };
      return fn(mockTx);
    };
    vi.spyOn(db, "$transaction").mockImplementation(mockTransaction as unknown as typeof db.$transaction);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-06-08T15:00:00.000Z");

    if (result.success) {
      expect(result.movedRound).toBe(true);
      expect(result.createdRound).toBe(true);
    }
  });

  it("completed-report rejection prevents resolver call", async () => {
    const { requireCoachAccess } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");

    vi.mocked(requireCoachAccess).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof requireCoachAccess>>);
    vi.spyOn(db.match, "findFirst").mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-27T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        name: "W17 2026",
        leagueSeasonId: "p1",
        leagueSeason: { id: "p1", startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30") },
      },
    } as unknown as Awaited<ReturnType<typeof db.match.findFirst>>);
    vi.spyOn(db.postMatchReport, "findFirst").mockResolvedValue({
      id: "pm1",
      status: "LOCKED",
    } as unknown as Awaited<ReturnType<typeof db.postMatchReport.findFirst>>);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-05-11T15:00:00.000Z");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("completed report");
    }
    expect(resolveOrCreateMatchRoundForDate).not.toHaveBeenCalled();
  });

  it("outside-phase rejection prevents resolver call", async () => {
    const { requireCoachAccess } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");

    vi.mocked(requireCoachAccess).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof requireCoachAccess>>);
    vi.spyOn(db.match, "findFirst").mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-27T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        name: "W17 2026",
        leagueSeasonId: "p1",
        leagueSeason: { id: "p1", startDate: new Date("2026-04-01"), endDate: new Date("2026-06-30") },
      },
    } as unknown as Awaited<ReturnType<typeof db.match.findFirst>>);
    vi.spyOn(db.postMatchReport, "findFirst").mockResolvedValue(null);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-08-15T15:00:00.000Z");

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("outside the current league season");
    }
    expect(resolveOrCreateMatchRoundForDate).not.toHaveBeenCalled();
  });
});