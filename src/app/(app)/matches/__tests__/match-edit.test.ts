import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/auth", () => ({
  requireCoachAccess: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    match: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    postMatchReport: {
      findFirst: vi.fn(),
    },
    matchRound: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const { db } = vi.mocked(await import("@/lib/db"));
const { requireCoachAccess } = vi.mocked(await import("@/lib/auth"));

describe("updateMatchAction validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects update for match with completed report", async () => {
    requireCoachAccess.mockResolvedValue(undefined);
    db.match.findUnique.mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-15T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        planningPeriodId: "p1",
        planningPeriod: {
          id: "p1",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
        },
      },
    } as any);
    db.postMatchReport.findFirst.mockResolvedValue({ id: "pm1", status: "LOCKED" });

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction(
      "m1",
      "2026-04-20T15:00:00.000Z",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("completed report");
  });

  it("rejects date outside phase range", async () => {
    requireCoachAccess.mockResolvedValue(undefined);
    db.match.findUnique.mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-15T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        planningPeriodId: "p1",
        planningPeriod: {
          id: "p1",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
        },
      },
    } as any);
    db.postMatchReport.findFirst.mockResolvedValue(null);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction(
      "m1",
      "2026-08-15T15:00:00.000Z",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("outside the current phase");
  });

  it("allows date change within phase range", async () => {
    requireCoachAccess.mockResolvedValue(undefined);
    db.match.findUnique.mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-15T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        planningPeriodId: "p1",
        planningPeriod: {
          id: "p1",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
        },
      },
    } as any);
    db.postMatchReport.findFirst.mockResolvedValue(null);
    db.match.update.mockResolvedValue({ id: "m1" } as any);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction(
      "m1",
      "2026-04-20T15:00:00.000Z",
    );

    expect(result.success).toBe(true);
    expect(db.match.update).toHaveBeenCalled();
  });

  it("rejects target round from different phase", async () => {
    requireCoachAccess.mockResolvedValue(undefined);
    db.match.findUnique.mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-15T15:00:00Z"),
      matchRoundId: "r1",
      matchRound: {
        id: "r1",
        planningPeriodId: "p1",
        planningPeriod: {
          id: "p1",
          startDate: new Date("2026-04-01"),
          endDate: new Date("2026-06-30"),
        },
      },
    } as any);
    db.postMatchReport.findFirst.mockResolvedValue(null);
    db.matchRound.findUnique.mockResolvedValue({
      id: "r2",
      planningPeriodId: "p2",
    } as any);

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction(
      "m1",
      "2026-04-20T15:00:00.000Z",
      "r2",
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain("same phase");
  });
});