import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockLockFindMany,
  mockLockUpsert,
  mockLockFindFirst,
  mockLockDelete,
  mockRoundFindFirst,
  mockPlayerFindFirst,
  mockMatchFindMany,
} = vi.hoisted(() => ({
  mockLockFindMany: vi.fn(),
  mockLockUpsert: vi.fn(),
  mockLockFindFirst: vi.fn(),
  mockLockDelete: vi.fn(),
  mockRoundFindFirst: vi.fn(),
  mockPlayerFindFirst: vi.fn(),
  mockMatchFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    playerLock: {
      findMany: mockLockFindMany,
      upsert: mockLockUpsert,
      findFirst: mockLockFindFirst,
      delete: mockLockDelete,
    },
    matchRound: { findFirst: mockRoundFindFirst },
    player: { findFirst: mockPlayerFindFirst },
    match: { findMany: mockMatchFindMany },
  },
}));

import { getPlayerLocksForRound, createPlayerLock, deletePlayerLock } from "../player-lock";

const orgFilter = { type: "org" as const, filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" };

// A future match with no closures: isMatchRoundPlanningEditable() reports the round still open.
const OPEN_ROUND_MATCH = { id: "match-1", startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), planningClosedAt: null, liveSession: null };
// A match whose planning boundary has already closed.
const CLOSED_ROUND_MATCH = { id: "match-1", startsAt: new Date("2020-01-01T00:00:00Z"), planningClosedAt: new Date("2020-01-01T00:00:00Z"), liveSession: null };

const LOCK_ROW = {
  id: "lock-1",
  organisationId: "org-1",
  matchRoundId: "round-1",
  playerId: "player-1",
  lockType: "LOCKED_IN",
  reason: "Needs match time",
  lockedBy: "coach@example.com",
  createdAt: new Date("2026-01-01T00:00:00Z"),
};

describe("getPlayerLocksForRound", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns locks scoped to the round and organisation", async () => {
    mockLockFindMany.mockResolvedValue([LOCK_ROW]);
    const result = await getPlayerLocksForRound("round-1", orgFilter);
    expect(result).toHaveLength(1);
    expect(result[0]!.lockType).toBe("LOCKED_IN");
    expect(mockLockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { matchRoundId: "round-1", organisationId: "org-1" } }),
    );
  });
});

describe("createPlayerLock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("pins a player in via upsert", async () => {
    mockRoundFindFirst.mockResolvedValue({ id: "round-1", status: "DRAFT" });
    mockMatchFindMany.mockResolvedValue([OPEN_ROUND_MATCH]);
    mockPlayerFindFirst.mockResolvedValue({ id: "player-1" });
    mockLockUpsert.mockResolvedValue(LOCK_ROW);

    const result = await createPlayerLock({ matchRoundId: "round-1", playerId: "player-1", lockType: "LOCKED_IN" }, orgFilter);

    expect(result.lockType).toBe("LOCKED_IN");
    expect(mockLockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { matchRoundId_playerId: { matchRoundId: "round-1", playerId: "player-1" } },
      }),
    );
  });

  it("rejects pinning once planning has closed for the round (ADR-0109: real boundary, not round-FINALIZED status)", async () => {
    mockRoundFindFirst.mockResolvedValue({ id: "round-1", status: "DRAFT" });
    mockMatchFindMany.mockResolvedValue([CLOSED_ROUND_MATCH]);

    await expect(
      createPlayerLock({ matchRoundId: "round-1", playerId: "player-1", lockType: "LOCKED_OUT" }, orgFilter),
    ).rejects.toThrow(/[Pp]lanning is closed/);
    expect(mockLockUpsert).not.toHaveBeenCalled();
  });

  it("rejects when the round does not exist", async () => {
    mockRoundFindFirst.mockResolvedValue(null);

    await expect(
      createPlayerLock({ matchRoundId: "missing", playerId: "player-1", lockType: "LOCKED_OUT" }, orgFilter),
    ).rejects.toThrow(/not found/);
  });

  it("rejects when the player does not exist or is outside the organisation", async () => {
    mockRoundFindFirst.mockResolvedValue({ id: "round-1", status: "DRAFT" });
    mockMatchFindMany.mockResolvedValue([OPEN_ROUND_MATCH]);
    mockPlayerFindFirst.mockResolvedValue(null);

    await expect(
      createPlayerLock({ matchRoundId: "round-1", playerId: "ghost", lockType: "LOCKED_OUT" }, orgFilter),
    ).rejects.toThrow(/Player not found/);
  });

  it("trims a blank reason to null", async () => {
    mockRoundFindFirst.mockResolvedValue({ id: "round-1", status: "DRAFT" });
    mockMatchFindMany.mockResolvedValue([OPEN_ROUND_MATCH]);
    mockPlayerFindFirst.mockResolvedValue({ id: "player-1" });
    mockLockUpsert.mockResolvedValue(LOCK_ROW);

    await createPlayerLock({ matchRoundId: "round-1", playerId: "player-1", lockType: "LOCKED_OUT", reason: "   " }, orgFilter);

    expect(mockLockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ reason: null }) }),
    );
  });
});

describe("deletePlayerLock", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes an existing lock", async () => {
    mockLockFindFirst.mockResolvedValue({ id: "lock-1" });
    await deletePlayerLock("round-1", "player-1", orgFilter);
    expect(mockLockDelete).toHaveBeenCalledWith({ where: { id: "lock-1" } });
  });

  it("is a no-op when no lock exists", async () => {
    mockLockFindFirst.mockResolvedValue(null);
    await deletePlayerLock("round-1", "player-1", orgFilter);
    expect(mockLockDelete).not.toHaveBeenCalled();
  });
});
