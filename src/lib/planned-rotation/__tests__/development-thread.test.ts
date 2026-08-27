import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockThreadCreate,
  mockThreadFindFirst,
  mockThreadFindMany,
  mockThreadUpdate,
  mockThreadCount,
  mockObsCreate,
  mockObsFindFirst,
  mockObsUpdate,
  mockObsDelete,
  mockMatchFindFirst,
} = vi.hoisted(() => ({
  mockThreadCreate: vi.fn(),
  mockThreadFindFirst: vi.fn(),
  mockThreadFindMany: vi.fn(),
  mockThreadUpdate: vi.fn(),
  mockThreadCount: vi.fn(),
  mockObsCreate: vi.fn(),
  mockObsFindFirst: vi.fn(),
  mockObsUpdate: vi.fn(),
  mockObsDelete: vi.fn(),
  mockMatchFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    developmentThread: {
      create: mockThreadCreate,
      findFirst: mockThreadFindFirst,
      findMany: mockThreadFindMany,
      update: mockThreadUpdate,
      count: mockThreadCount,
    },
    developmentThreadObservation: {
      create: mockObsCreate,
      findFirst: mockObsFindFirst,
      update: mockObsUpdate,
      delete: mockObsDelete,
    },
    match: {
      findFirst: mockMatchFindFirst,
    },
  },
}));

const orgFilter = { type: "org" as const, filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" };

import {
  createThread,
  updateThread,
  addObservation,
  updateObservation,
  removeObservation,
  getThreadsForPlayer,
  getActiveThreadsForPlayer,
  completeThread,
  closeThread,
  reopenThread,
  DEVELOPMENT_FOCUS_CATEGORIES,
} from "../development-thread";

const baseThread = {
  id: "thread-1",
  organisationId: "org-1",
  playerId: "player-1",
  focus: "Improve positional discipline",
  rationale: "Player tends to drift out of position",
  status: "ACTIVE" as const,
  category: "POSITIONAL_DISCIPLINE" as const,
  startedAt: new Date("2026-01-01"),
  completedAt: null,
  closedAt: null,
  recordedBy: "coach-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  observations: [],
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("DEVELOPMENT_FOCUS_CATEGORIES", () => {
  it("includes the core categories", () => {
    expect(DEVELOPMENT_FOCUS_CATEGORIES).toContain("POSITIONAL_DISCIPLINE");
    expect(DEVELOPMENT_FOCUS_CATEGORIES).toContain("CONFIDENCE_REBUILD");
    expect(DEVELOPMENT_FOCUS_CATEGORIES).toContain("CHALLENGE_EXPOSURE");
    expect(DEVELOPMENT_FOCUS_CATEGORIES.length).toBe(12);
  });
});

describe("createThread", () => {
  it("creates a thread with valid input", async () => {
    mockThreadCount.mockResolvedValue(0);
    mockThreadCreate.mockResolvedValue({ ...baseThread, observations: [] });

    const result = await createThread(
      { playerId: "player-1", focus: "Improve positional discipline", rationale: "Player tends to drift out of position", category: "POSITIONAL_DISCIPLINE", recordedBy: "coach-1" },
      orgFilter,
    );

    expect(result.focus).toBe("Improve positional discipline");
    expect(mockThreadCreate).toHaveBeenCalled();
  });

  it("rejects empty focus", async () => {
    await expect(createThread({ playerId: "player-1", focus: "   " }, orgFilter)).rejects.toThrow("Focus is required");
  });

  it("rejects focus exceeding max length", async () => {
    await expect(createThread({ playerId: "player-1", focus: "x".repeat(201) }, orgFilter)).rejects.toThrow("Focus must be at most");
  });

  it("rejects rationale exceeding max length", async () => {
    await expect(createThread({ playerId: "player-1", focus: "test", rationale: "x".repeat(1001) }, orgFilter)).rejects.toThrow("Rationale must be at most");
  });

  it("rejects creating a thread when player has max active threads", async () => {
    mockThreadCount.mockResolvedValue(3);
    await expect(createThread({ playerId: "player-1", focus: "test" }, orgFilter)).rejects.toThrow("already has 3 active");
  });
});

describe("updateThread", () => {
  it("updates focus on an active thread", async () => {
    mockThreadFindFirst.mockResolvedValue(baseThread);
    mockThreadUpdate.mockResolvedValue({ ...baseThread, focus: "Updated focus", observations: [] });

    const result = await updateThread("thread-1", { focus: "Updated focus" }, orgFilter);
    expect(result.focus).toBe("Updated focus");
  });

  it("rejects editing a completed thread", async () => {
    mockThreadFindFirst.mockResolvedValue({ ...baseThread, status: "COMPLETED" });
    await expect(updateThread("thread-1", { focus: "New focus" }, orgFilter)).rejects.toThrow("Only active threads");
  });

  it("allows status transition to COMPLETED", async () => {
    mockThreadFindFirst.mockResolvedValue(baseThread);
    mockThreadUpdate.mockResolvedValue({ ...baseThread, status: "COMPLETED", completedAt: new Date(), observations: [] });

    const result = await updateThread("thread-1", { status: "COMPLETED" }, orgFilter);
    expect(result.status).toBe("COMPLETED");
  });

  it("allows status transition to CLOSED", async () => {
    mockThreadFindFirst.mockResolvedValue(baseThread);
    mockThreadUpdate.mockResolvedValue({ ...baseThread, status: "CLOSED", closedAt: new Date(), observations: [] });

    const result = await updateThread("thread-1", { status: "CLOSED" }, orgFilter);
    expect(result.status).toBe("CLOSED");
  });

  it("rejects updating a non-existent thread", async () => {
    mockThreadFindFirst.mockResolvedValue(null);
    await expect(updateThread("nonexistent", { focus: "test" }, orgFilter)).rejects.toThrow("not found");
  });
});

describe("addObservation", () => {
  it("adds an observation to an active thread", async () => {
    mockThreadFindFirst.mockResolvedValue(baseThread);
    mockObsCreate.mockResolvedValue({
      id: "obs-1",
      threadId: "thread-1",
      organisationId: "org-1",
      matchId: null,
      evidence: "Good positioning",
      context: null,
      recordedBy: "coach-1",
      createdAt: new Date(),
    });

    const result = await addObservation(
      { threadId: "thread-1", evidence: "Good positioning", recordedBy: "coach-1" },
      orgFilter,
    );
    expect(result.evidence).toBe("Good positioning");
  });

  it("rejects adding observation to non-active thread", async () => {
    mockThreadFindFirst.mockResolvedValue({ ...baseThread, status: "COMPLETED" });
    await expect(addObservation({ threadId: "thread-1", evidence: "test" }, orgFilter)).rejects.toThrow("only be added to active");
  });

  it("rejects empty evidence", async () => {
    await expect(addObservation({ threadId: "thread-1", evidence: "  " }, orgFilter)).rejects.toThrow("Evidence is required");
  });

  it("rejects evidence exceeding max length", async () => {
    await expect(addObservation({ threadId: "thread-1", evidence: "x".repeat(1001) }, orgFilter)).rejects.toThrow("Evidence must be at most");
  });
});

describe("updateObservation", () => {
  it("updates evidence on an observation in an active thread", async () => {
    mockObsFindFirst.mockResolvedValue({ id: "obs-1", evidence: "old", context: null, thread: baseThread });
    mockObsUpdate.mockResolvedValue({ id: "obs-1", evidence: "updated", context: null });

    const result = await updateObservation("obs-1", { evidence: "updated" }, orgFilter);
    expect(result.evidence).toBe("updated");
  });

  it("rejects editing observation in a completed thread", async () => {
    mockObsFindFirst.mockResolvedValue({ id: "obs-1", evidence: "old", context: null, thread: { ...baseThread, status: "COMPLETED" } });
    await expect(updateObservation("obs-1", { evidence: "new" }, orgFilter)).rejects.toThrow("only be edited on active");
  });
});

describe("removeObservation", () => {
  it("removes an observation from an active thread", async () => {
    mockObsFindFirst.mockResolvedValue({ id: "obs-1", thread: baseThread });
    mockObsDelete.mockResolvedValue({ id: "obs-1" });

    await removeObservation("obs-1", orgFilter);
    expect(mockObsDelete).toHaveBeenCalledWith({ where: { id: "obs-1" } });
  });

  it("rejects removing observation from a non-active thread", async () => {
    mockObsFindFirst.mockResolvedValue({ id: "obs-1", thread: { ...baseThread, status: "CLOSED" } });
    await expect(removeObservation("obs-1", orgFilter)).rejects.toThrow("only be removed from active");
  });
});

describe("completeThread", () => {
  it("completes an active thread", async () => {
    mockThreadFindFirst.mockResolvedValue(baseThread);
    mockThreadUpdate.mockResolvedValue({ ...baseThread, status: "COMPLETED", completedAt: new Date(), observations: [] });

    const result = await completeThread("thread-1", orgFilter);
    expect(result.status).toBe("COMPLETED");
  });
});

describe("closeThread", () => {
  it("closes an active thread", async () => {
    mockThreadFindFirst.mockResolvedValue(baseThread);
    mockThreadUpdate.mockResolvedValue({ ...baseThread, status: "CLOSED", closedAt: new Date(), observations: [] });

    const result = await closeThread("thread-1", orgFilter);
    expect(result.status).toBe("CLOSED");
  });
});

describe("reopenThread", () => {
  it("reopens a completed thread when under the active limit", async () => {
    mockThreadFindFirst.mockResolvedValue({ ...baseThread, status: "COMPLETED" });
    mockThreadCount.mockResolvedValue(1);
    mockThreadUpdate.mockResolvedValue({ ...baseThread, status: "ACTIVE", completedAt: null, closedAt: null, observations: [] });

    const result = await reopenThread("thread-1", orgFilter);
    expect(result.status).toBe("ACTIVE");
  });

  it("rejects reopening when player has max active threads", async () => {
    mockThreadFindFirst.mockResolvedValue({ ...baseThread, status: "COMPLETED" });
    mockThreadCount.mockResolvedValue(3);
    await expect(reopenThread("thread-1", orgFilter)).rejects.toThrow("already has 3 active");
  });

  it("rejects reopening an already active thread", async () => {
    mockThreadFindFirst.mockResolvedValue({ ...baseThread, status: "ACTIVE" });
    await expect(reopenThread("thread-1", orgFilter)).rejects.toThrow("Only completed or closed");
  });
});

describe("getThreadsForPlayer", () => {
  it("returns threads for a player", async () => {
    mockThreadFindMany.mockResolvedValue([baseThread]);
    const result = await getThreadsForPlayer("player-1", orgFilter);
    expect(result).toHaveLength(1);
  });
});

describe("getActiveThreadsForPlayer", () => {
  it("returns only active threads", async () => {
    mockThreadFindMany.mockResolvedValue([baseThread]);
    await getActiveThreadsForPlayer("player-1", orgFilter);
    expect(mockThreadFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) }),
    );
  });
});