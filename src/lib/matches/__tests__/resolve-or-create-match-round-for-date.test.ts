import { describe, it, expect, vi, beforeEach } from "vitest";
import { resolveOrCreateMatchRoundForDate, isSameIsoWeek, AmbiguousRoundError, DateOutsideLeagueSeasonError } from "../resolve-or-create-match-round-for-date";

vi.mock("@/lib/db", () => ({
  db: {
    leagueSeason: {
      findFirst: vi.fn(),
    },
    matchRound: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";

const PERIOD_ID = "p1";
const ORG_ID = "org-1";
const PERIOD_START = new Date("2026-04-01T00:00:00Z");
const PERIOD_END = new Date("2026-06-30T23:59:59Z");

describe("resolveOrCreateMatchRoundForDate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.leagueSeason.findFirst).mockResolvedValue({
      id: PERIOD_ID,
      startDate: PERIOD_START,
      endDate: PERIOD_END,
      organisationId: ORG_ID,
    } as unknown as Awaited<ReturnType<typeof db.leagueSeason.findFirst>>);
  });

  it("reuses an existing same-Phase ISO-week-label round", async () => {
    vi.mocked(db.matchRound.findMany).mockResolvedValue([
      { id: "r-w20", name: "W20 2026" },
    ] as unknown as Awaited<ReturnType<typeof db.matchRound.findMany>>);

    const result = await resolveOrCreateMatchRoundForDate({
      leagueSeasonId: PERIOD_ID,
      startsAt: new Date("2026-05-11T15:00:00Z"),
      organisationId: ORG_ID,
    });

    expect(result.roundId).toBe("r-w20");
    expect(result.created).toBe(false);
    expect(result.isoWeekLabel).toBe("W20 2026");
  });

  it("reuses an existing legacy-named round containing a target-week match", async () => {
    vi.mocked(db.matchRound.findMany).mockResolvedValue([
      { id: "r-legacy", name: "Mid-May fixtures" },
    ] as unknown as Awaited<ReturnType<typeof db.matchRound.findMany>>);

    const result = await resolveOrCreateMatchRoundForDate({
      leagueSeasonId: PERIOD_ID,
      startsAt: new Date("2026-05-11T15:00:00Z"),
      organisationId: ORG_ID,
    });

    expect(result.roundId).toBe("r-legacy");
    expect(result.created).toBe(false);
  });

  it("does not reuse a round from another Phase", async () => {
    vi.mocked(db.matchRound.findMany).mockResolvedValue([]);
    vi.mocked(db.matchRound.create).mockResolvedValue({
      id: "r-new",
      name: "W20 2026",
    } as unknown as Awaited<ReturnType<typeof db.matchRound.create>>);

    const result = await resolveOrCreateMatchRoundForDate({
      leagueSeasonId: PERIOD_ID,
      startsAt: new Date("2026-05-11T15:00:00Z"),
      organisationId: ORG_ID,
    });

    expect(result.created).toBe(true);
    expect(db.matchRound.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ leagueSeasonId: PERIOD_ID }),
      }),
    );
  });

  it("creates a new round when none exists in the Phase", async () => {
    vi.mocked(db.matchRound.findMany).mockResolvedValue([]);
    vi.mocked(db.matchRound.create).mockResolvedValue({
      id: "r-new",
      name: "W24 2026",
    } as unknown as Awaited<ReturnType<typeof db.matchRound.create>>);

    const result = await resolveOrCreateMatchRoundForDate({
      leagueSeasonId: PERIOD_ID,
      startsAt: new Date("2026-06-08T15:00:00Z"),
      organisationId: ORG_ID,
    });

    expect(result.roundId).toBe("r-new");
    expect(result.created).toBe(true);
    expect(result.isoWeekLabel).toBe("W24 2026");
    expect(db.matchRound.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "W24 2026",
          leagueSeasonId: PERIOD_ID,
          status: "NOT_GENERATED",
        }),
      }),
    );
  });

  it("rejects a date outside the Phase", async () => {
    await expect(
      resolveOrCreateMatchRoundForDate({
        leagueSeasonId: PERIOD_ID,
        startsAt: new Date("2026-08-15T15:00:00Z"),
        organisationId: ORG_ID,
      }),
    ).rejects.toThrow(DateOutsideLeagueSeasonError);

    expect(db.matchRound.findMany).not.toHaveBeenCalled();
    expect(db.matchRound.create).not.toHaveBeenCalled();
  });

  it("rejects ambiguous same-Phase candidates without writes", async () => {
    vi.mocked(db.matchRound.findMany).mockResolvedValue([
      { id: "r-a", name: "W24 2026" },
      { id: "r-b", name: "Week 24" },
    ] as unknown as Awaited<ReturnType<typeof db.matchRound.findMany>>);

    await expect(
      resolveOrCreateMatchRoundForDate({
        leagueSeasonId: PERIOD_ID,
        startsAt: new Date("2026-06-08T15:00:00Z"),
        organisationId: ORG_ID,
      }),
    ).rejects.toThrow(AmbiguousRoundError);

    expect(db.matchRound.create).not.toHaveBeenCalled();
  });

  it("works with a transaction client", async () => {
    const txMock = {
      leagueSeason: { findFirst: vi.fn().mockResolvedValue({ id: PERIOD_ID, startDate: PERIOD_START, endDate: PERIOD_END, organisationId: ORG_ID }) },
      matchRound: {
        findMany: vi.fn().mockResolvedValue([{ id: "r-w20", name: "W20 2026" }]),
        create: vi.fn(),
      },
    };

    const result = await resolveOrCreateMatchRoundForDate({
      leagueSeasonId: PERIOD_ID,
      startsAt: new Date("2026-05-11T15:00:00Z"),
      organisationId: ORG_ID,
      tx: txMock as unknown as Parameters<typeof resolveOrCreateMatchRoundForDate>[0]["tx"],
    });

    expect(result.roundId).toBe("r-w20");
    expect(txMock.matchRound.findMany).toHaveBeenCalled();
    expect(db.matchRound.findMany).not.toHaveBeenCalled();
  });

  it("rejects missing planning period", async () => {
    vi.mocked(db.leagueSeason.findFirst).mockResolvedValue(null);

    await expect(
      resolveOrCreateMatchRoundForDate({
        leagueSeasonId: "nonexistent",
        startsAt: new Date("2026-05-11T15:00:00Z"),
        organisationId: ORG_ID,
      }),
    ).rejects.toThrow(DateOutsideLeagueSeasonError);
  });
});

describe("isSameIsoWeek", () => {
  it("returns true for dates in the same ISO week", () => {
    const mon = new Date("2026-05-11T10:00:00Z");
    const sun = new Date("2026-05-17T18:00:00Z");
    expect(isSameIsoWeek(mon, sun)).toBe(true);
  });

  it("returns false for dates in different ISO weeks", () => {
    const week1 = new Date("2026-05-11T10:00:00Z");
    const week2 = new Date("2026-05-18T10:00:00Z");
    expect(isSameIsoWeek(week1, week2)).toBe(false);
  });
});