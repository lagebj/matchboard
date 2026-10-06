import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockMatchFindFirst, mockMatchLineupFindFirst, mockSelectionFindMany, mockPlannedRotationFindFirst } =
  vi.hoisted(() => ({
    mockMatchFindFirst: vi.fn(),
    mockMatchLineupFindFirst: vi.fn(),
    mockSelectionFindMany: vi.fn(),
    mockPlannedRotationFindFirst: vi.fn(),
  }));

vi.mock("@/lib/db", () => ({
  db: {
    match: { findFirst: mockMatchFindFirst },
    matchLineup: { findFirst: mockMatchLineupFindFirst },
    selection: { findMany: mockSelectionFindMany },
    plannedRotation: { findFirst: mockPlannedRotationFindFirst },
  },
}));

const { mockGetMatchFormatOverrideState } = vi.hoisted(() => ({
  mockGetMatchFormatOverrideState: vi.fn(),
}));
vi.mock("@/lib/matches/match-format-override", () => ({
  getMatchFormatOverrideState: mockGetMatchFormatOverrideState,
}));

import { getPlannedMinutesProjectionForMatch } from "../planned-rotation";

const orgFilter = {
  type: "org" as const,
  filter: { organisationId: "org-1" },
  filterNullable: { organisationId: "org-1" },
  organisationId: "org-1",
};

describe("getPlannedMinutesProjectionForMatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMatchFormatOverrideState.mockResolvedValue(null);
    mockPlannedRotationFindFirst.mockResolvedValue(null);
  });

  it("reports hasLineup: false, never a guessed row set, when no match line-up exists", async () => {
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", matchType: "LEAGUE" });
    mockMatchLineupFindFirst.mockResolvedValue(null);

    const result = await getPlannedMinutesProjectionForMatch("match-1", "team-1", orgFilter);

    expect(result).toEqual({ hasLineup: false, totalMatchSeconds: null, rows: [] });
  });

  it("projects a real non-zero planned-minutes value for a starter with no planned changes (the required correction)", async () => {
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", matchType: "LEAGUE" });
    mockMatchLineupFindFirst.mockResolvedValue({
      formation: { slots: [{ id: "slot-1", roleType: "STRIKER" }] },
      assignments: [{ playerId: "player-A", slotId: "slot-1" }],
    });
    mockSelectionFindMany.mockResolvedValue([{ playerId: "player-A" }]);

    const result = await getPlannedMinutesProjectionForMatch("match-1", "team-1", orgFilter);

    expect(result.hasLineup).toBe(true);
    // LEAGUE, no format override configured -> REGULATION_ONLY_PERIOD_CONFIG: 2 x 25 min = 50 min.
    expect(result.totalMatchSeconds).toBe(50 * 60);
    expect(result.rows).toEqual([
      {
        playerId: "player-A",
        plannedMinutes: 50,
        startingPosition: "STRIKER",
        positions: [{ position: "STRIKER", fromSeconds: 0, toSeconds: 50 * 60 }],
      },
    ]);
  });

  it("resolves total match duration through the format-aware override chain, not a hardcoded per-format table", async () => {
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", matchType: "LEAGUE" });
    mockMatchLineupFindFirst.mockResolvedValue({
      formation: { slots: [{ id: "slot-1", roleType: "STRIKER" }] },
      assignments: [{ playerId: "player-A", slotId: "slot-1" }],
    });
    mockSelectionFindMany.mockResolvedValue([{ playerId: "player-A" }]);
    mockGetMatchFormatOverrideState.mockResolvedValue({
      matchOverride: null,
      inheritedFormat: null,
      effectiveFormat: { numberOfPeriods: 2, periodDurationMinutes: 20, breakDurationMinutes: 5 },
      frozenFormat: null,
    });

    const result = await getPlannedMinutesProjectionForMatch("match-1", "team-1", orgFilter);

    // 2 x 20 min configured halves + the configured 5-min break (getTotalPeriodDurationMs sums
    // every period, same as the existing ARR-0053 call sites) -- not the old hardcoded
    // 25-minute-halves default (which would have given 50 min here instead of 45).
    expect(result.totalMatchSeconds).toBe(45 * 60);
    expect(mockGetMatchFormatOverrideState).toHaveBeenCalledWith("match-1", "org-1");
  });
});
