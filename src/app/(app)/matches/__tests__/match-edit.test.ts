import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireCoachAccess: vi.fn(),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("updateMatchAction validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects update for match with completed report", async () => {
    const { requireCoachAccess } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");
    
    vi.mocked(requireCoachAccess).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof requireCoachAccess>>);
    vi.spyOn(db.match, "findUnique").mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-15T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        name: "W16 2026",
        leagueSeasonId: "p1",
        leagueSeason: {
          id: "p1",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
        },
      },
    } as unknown as Awaited<ReturnType<typeof db.match.findUnique>>);
    vi.spyOn(db.postMatchReport, "findFirst").mockResolvedValue({ id: "pm1", status: "LOCKED" } as unknown as Awaited<ReturnType<typeof db.postMatchReport.findFirst>>);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-04-20T15:00:00.000Z");

    if (result.success) {
      expect.unreachable("Should have rejected completed report");
    } else {
      expect(result.error).toContain("completed report");
    }
  });

  it("rejects date outside phase range", async () => {
    const { requireCoachAccess } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");
    
    vi.mocked(requireCoachAccess).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof requireCoachAccess>>);
    vi.spyOn(db.match, "findUnique").mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-15T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        name: "W16 2026",
        leagueSeasonId: "p1",
        leagueSeason: {
          id: "p1",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
        },
      },
    } as unknown as Awaited<ReturnType<typeof db.match.findUnique>>);
    vi.spyOn(db.postMatchReport, "findFirst").mockResolvedValue(null);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-08-15T15:00:00.000Z");

    if (result.success) {
      expect.unreachable("Should have rejected out-of-phase date");
    } else {
      expect(result.error).toContain("outside the current league season");
    }
  });

  it("allows same-week date change within phase range", async () => {
    const { requireCoachAccess } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");
    
    vi.mocked(requireCoachAccess).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof requireCoachAccess>>);
    vi.spyOn(db.match, "findUnique").mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-15T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        name: "W16 2026",
        leagueSeasonId: "p1",
        leagueSeason: {
          id: "p1",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
        },
      },
    } as unknown as Awaited<ReturnType<typeof db.match.findUnique>>);
    vi.spyOn(db.postMatchReport, "findFirst").mockResolvedValue(null);
    vi.spyOn(db.match, "update").mockResolvedValue({ id: "m1" } as unknown as Awaited<ReturnType<typeof db.match.update>>);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-04-16T15:00:00.000Z");

    if (!result.success) {
      throw new Error(`Unexpected failure: ${result.error}`);
    }
    expect(result.success).toBe(true);
    expect(result.movedRound).toBe(false);
  });

  it("rejects finalised selection on cross-round move", async () => {
    const { requireCoachAccess } = await import("@/lib/auth");
    const { db } = await import("@/lib/db");
    
    vi.mocked(requireCoachAccess).mockResolvedValue(undefined as unknown as Awaited<ReturnType<typeof requireCoachAccess>>);
    vi.spyOn(db.match, "findUnique").mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-27T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        name: "W17 2026",
        leagueSeasonId: "p1",
        leagueSeason: {
          id: "p1",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
        },
      },
    } as unknown as Awaited<ReturnType<typeof db.match.findUnique>>);
    vi.spyOn(db.postMatchReport, "findFirst").mockResolvedValue(null);
    vi.spyOn(db.selection, "findFirst").mockResolvedValue({ id: "s1" } as unknown as Awaited<ReturnType<typeof db.selection.findFirst>>);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-05-11T15:00:00.000Z");

    if (result.success) {
      expect.unreachable("Should have rejected finalised cross-round move");
    } else {
      expect(result.error).toContain("finalised squad plan");
    }
  });
});