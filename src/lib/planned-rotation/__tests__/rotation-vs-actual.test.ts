import { describe, it, expect, vi, beforeEach } from "vitest";

const {
  mockRotationFindUnique,
  mockMatchRotationFindMany,
  mockMatchFindFirst,
  mockMatchLineupFindFirst,
  mockSelectionFindMany,
  mockRotationFindFirst,
  mockActualPositionIntervalFindMany,
  mockPlayerFindMany,
} = vi.hoisted(() => ({
  mockRotationFindUnique: vi.fn(),
  mockMatchRotationFindMany: vi.fn(),
  mockMatchFindFirst: vi.fn(),
  mockMatchLineupFindFirst: vi.fn(),
  mockSelectionFindMany: vi.fn(),
  mockRotationFindFirst: vi.fn(),
  mockActualPositionIntervalFindMany: vi.fn(),
  mockPlayerFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    plannedRotation: { findUnique: mockRotationFindUnique, findFirst: mockRotationFindFirst },
    matchRotation: { findMany: mockMatchRotationFindMany },
    match: { findFirst: mockMatchFindFirst },
    matchLineup: { findFirst: mockMatchLineupFindFirst },
    selection: { findMany: mockSelectionFindMany },
    actualPositionInterval: { findMany: mockActualPositionIntervalFindMany },
    player: { findMany: mockPlayerFindMany },
  },
}));

const { mockGetMatchFormatOverrideState } = vi.hoisted(() => ({
  mockGetMatchFormatOverrideState: vi.fn(),
}));
vi.mock("@/lib/matches/match-format-override", () => ({
  getMatchFormatOverrideState: mockGetMatchFormatOverrideState,
}));

import { getRotationVsActual } from "../rotation-vs-actual";

const orgFilter = {
  type: "org" as const,
  filter: { organisationId: "org-1" },
  filterNullable: { organisationId: "org-1" },
  organisationId: "org-1",
};

describe("getRotationVsActual", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMatchFormatOverrideState.mockResolvedValue(null);
    mockRotationFindFirst.mockResolvedValue(null);
    mockMatchRotationFindMany.mockResolvedValue([]);
    mockActualPositionIntervalFindMany.mockResolvedValue([]);
    mockPlayerFindMany.mockResolvedValue([]);
  });

  it("returns null when org context is missing", async () => {
    const result = await getRotationVsActual("match-1", "team-1", {
      type: "org",
      filter: { organisationId: "" },
      filterNullable: { organisationId: "" },
      organisationId: "",
    });
    expect(result).toBeNull();
  });

  it("returns a comparison even without a saved PlannedRotation row (a line-up alone is still a real plan)", async () => {
    mockRotationFindUnique.mockResolvedValue(null);
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", matchType: "LEAGUE" });
    mockMatchLineupFindFirst.mockResolvedValue({
      formation: { slots: [{ id: "slot-1", roleType: "STRIKER" }] },
      assignments: [{ playerId: "player-A", slotId: "slot-1" }],
    });
    mockSelectionFindMany.mockResolvedValue([{ playerId: "player-A" }]);
    mockActualPositionIntervalFindMany.mockResolvedValue([
      { playerId: "player-A", position: "STRIKER", startedAtMs: 0, endedAtMs: 45 * 60_000 },
    ]);
    mockPlayerFindMany.mockResolvedValue([{ id: "player-A", firstName: "Anna", lastName: "A" }]);

    const result = await getRotationVsActual("match-1", "team-1", orgFilter);

    expect(result).not.toBeNull();
    expect(result!.rotationId).toBeNull();
    expect(result!.hasLineup).toBe(true);
  });

  it("projects a real non-zero planned minutes value instead of the old hardcoded zero, matched by player and canonical position", async () => {
    mockRotationFindUnique.mockResolvedValue(null);
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", matchType: "LEAGUE" });
    mockMatchLineupFindFirst.mockResolvedValue({
      formation: { slots: [{ id: "slot-1", roleType: "STRIKER" }] },
      assignments: [{ playerId: "player-A", slotId: "slot-1" }],
    });
    mockSelectionFindMany.mockResolvedValue([{ playerId: "player-A" }]);
    mockActualPositionIntervalFindMany.mockResolvedValue([
      { playerId: "player-A", position: "STRIKER", startedAtMs: 0, endedAtMs: 45 * 60_000 },
    ]);
    mockPlayerFindMany.mockResolvedValue([{ id: "player-A", firstName: "Anna", lastName: "A" }]);

    const result = await getRotationVsActual("match-1", "team-1", orgFilter);

    const row = result!.minuteDeviations.find((d) => d.playerId === "player-A");
    expect(row).toBeDefined();
    expect(row!.plannedMinutes).toBe(50); // LEAGUE default: 2 x 25 min, not 0.
    expect(row!.plannedPositions).toEqual(["STRIKER"]);
    expect(row!.realisedMinutes).toBe(45);
    expect(row!.realisedPositions).toEqual(["STRIKER"]);
    expect(row!.deviation).toBe(-5);
  });

  it("sources realised minutes and positions only from ActualPositionInterval, never from MatchRotation.matchSeconds (ARR-0052)", async () => {
    mockRotationFindUnique.mockResolvedValue(null);
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", matchType: "LEAGUE" });
    mockMatchLineupFindFirst.mockResolvedValue({
      formation: { slots: [{ id: "slot-1", roleType: "STRIKER" }] },
      assignments: [{ playerId: "player-C", slotId: "slot-1" }],
    });
    mockSelectionFindMany.mockResolvedValue([{ playerId: "player-C" }]);
    // A recorded substitution event with a matchSeconds value — the previous implementation
    // would have used this directly as "realised minutes". It must now be ignored for that
    // purpose entirely; only ActualPositionInterval may supply realised minutes.
    mockMatchRotationFindMany.mockResolvedValue([
      {
        outPlayerId: "player-C",
        inPlayerId: null,
        matchSeconds: 20 * 60_000,
        positionOnly: false,
        source: "LIVE",
        liveEventId: "event-1",
        outPlayer: { id: "player-C", firstName: "Chris", lastName: null },
        inPlayer: null,
      },
    ]);
    mockActualPositionIntervalFindMany.mockResolvedValue([]); // no interval data recorded at all

    const result = await getRotationVsActual("match-1", "team-1", orgFilter);

    const row = result!.minuteDeviations.find((d) => d.playerId === "player-C");
    expect(row).toBeDefined();
    expect(row!.realisedMinutes).toBeNull();
    expect(row!.deviation).toBeNull();
  });

  it("keeps an open/incomplete actual interval's minutes genuinely unknown rather than guessing 'rest of match'", async () => {
    mockRotationFindUnique.mockResolvedValue(null);
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", matchType: "LEAGUE" });
    mockMatchLineupFindFirst.mockResolvedValue({
      formation: { slots: [] },
      assignments: [],
    });
    mockSelectionFindMany.mockResolvedValue([]);
    mockActualPositionIntervalFindMany.mockResolvedValue([
      { playerId: "player-B", position: "MIDFIELDER", startedAtMs: 10 * 60_000, endedAtMs: null },
    ]);
    mockPlayerFindMany.mockResolvedValue([{ id: "player-B", firstName: "Bo", lastName: null }]);

    const result = await getRotationVsActual("match-1", "team-1", orgFilter);

    const row = result!.minuteDeviations.find((d) => d.playerId === "player-B");
    expect(row).toBeDefined();
    expect(row!.realisedMinutes).toBeNull();
    expect(row!.deviation).toBeNull();
    // The position fact is still known even though the duration is not.
    expect(row!.realisedPositions).toEqual(["MIDFIELDER"]);
    expect(row!.plannedMinutes).toBe(0);
  });

  it("collapses consecutive duplicate positions in both planned and realised position lists", async () => {
    mockRotationFindUnique.mockResolvedValue(null);
    mockMatchFindFirst.mockResolvedValue({ id: "match-1", matchType: "LEAGUE" });
    mockMatchLineupFindFirst.mockResolvedValue({
      formation: { slots: [{ id: "slot-1", roleType: "STRIKER" }] },
      assignments: [{ playerId: "player-A", slotId: "slot-1" }],
    });
    mockSelectionFindMany.mockResolvedValue([{ playerId: "player-A" }]);
    mockActualPositionIntervalFindMany.mockResolvedValue([
      { playerId: "player-A", position: "STRIKER", startedAtMs: 0, endedAtMs: 20 * 60_000 },
      { playerId: "player-A", position: "STRIKER", startedAtMs: 20 * 60_000, endedAtMs: 40 * 60_000 },
    ]);
    mockPlayerFindMany.mockResolvedValue([{ id: "player-A", firstName: "Anna", lastName: null }]);

    const result = await getRotationVsActual("match-1", "team-1", orgFilter);

    const row = result!.minuteDeviations.find((d) => d.playerId === "player-A");
    expect(row!.realisedPositions).toEqual(["STRIKER"]);
  });
});
