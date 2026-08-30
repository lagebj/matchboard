import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockAuthContext } from "@/test/support/auth-mock";

const auth = mockAuthContext();

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/selection/capture-planning-baseline", () => ({
  reopenMatchPlanningForReschedule: vi.fn().mockResolvedValue({ reopened: true }),
}));

describe("updateMatchAction validation", () => {
  beforeEach(() => {
    auth.mockRequireActorContext.mockResolvedValue({
      userId: "test-user-id",
      email: "test@example.com",
      membershipId: "test-membership-id",
      organisationId: "test-org-id",
      organisationSlug: "test-org",
      role: "ADMIN",
      accessibleGroupIds: [],
      groupAccesses: [],
      orgFilter: {
        type: "org",
        filter: { organisationId: "test-org-id" },
        filterNullable: { organisationId: "test-org-id" },
        organisationId: "test-org-id",
      },
    });
  });

  it("rejects update for match with completed report", async () => {
    const { db } = await import("@/lib/db");

    vi.spyOn(db.match, "findFirst").mockResolvedValue({
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
    } as unknown as Awaited<ReturnType<typeof db.match.findFirst>>);
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
    const { db } = await import("@/lib/db");

    vi.spyOn(db.match, "findFirst").mockResolvedValue({
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
    } as unknown as Awaited<ReturnType<typeof db.match.findFirst>>);
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
    const { db } = await import("@/lib/db");

    vi.spyOn(db.match, "findFirst").mockResolvedValue({
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
    } as unknown as Awaited<ReturnType<typeof db.match.findFirst>>);
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

  it("rejects a closed-boundary cross-round move that cannot be safely reopened (ADR-0109)", async () => {
    const { db } = await import("@/lib/db");
    const { reopenMatchPlanningForReschedule } = await import("@/lib/selection/capture-planning-baseline");

    vi.spyOn(db.match, "findFirst").mockResolvedValue({
      id: "m1",
      startsAt: new Date("2026-04-27T15:00:00Z"),
      matchRoundId: "r1",
      planningClosedAt: new Date("2026-04-27T15:00:00Z"),
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
    } as unknown as Awaited<ReturnType<typeof db.match.findFirst>>);
    vi.spyOn(db.postMatchReport, "findFirst").mockResolvedValue(null);
    vi.mocked(reopenMatchPlanningForReschedule).mockResolvedValueOnce({
      reopened: false,
      reason: "This match has live match activity recorded.",
    });

    const { updateMatchAction } = await import("@/app/(app)/matches/actions");
    const result = await updateMatchAction("m1", "2026-05-11T15:00:00.000Z");

    if (result.success) {
      expect.unreachable("Should have rejected a cross-round move that cannot be safely reopened");
    } else {
      expect(result.error).toContain("live match activity");
    }
  });
});