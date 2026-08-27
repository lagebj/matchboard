import { describe, it, expect, beforeEach, vi } from "vitest";

const {
  mockFocusCreate,
  mockFocusFindFirst,
  mockFocusFindMany,
  mockFocusUpdate,
  mockFocusCount,
  mockIntentFindFirst,
} = vi.hoisted(() => ({
  mockFocusCreate: vi.fn(),
  mockFocusFindFirst: vi.fn(),
  mockFocusFindMany: vi.fn(),
  mockFocusUpdate: vi.fn(),
  mockFocusCount: vi.fn(),
  mockIntentFindFirst: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    teamFocus: {
      create: mockFocusCreate,
      findFirst: mockFocusFindFirst,
      findMany: mockFocusFindMany,
      update: mockFocusUpdate,
      count: mockFocusCount,
    },
    coachingIntent: {
      findFirst: mockIntentFindFirst,
    },
  },
}));

const orgFilter = { type: "org" as const, filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" };

import {
  createTeamFocus,
  updateTeamFocus,
  completeTeamFocus,
  closeTeamFocus,
  reopenTeamFocus,
  getTeamFocusesForTeam,
  getActiveTeamFocusesForTeam,
} from "../team-focus";

const baseFocus = {
  id: "focus-1",
  organisationId: "org-1",
  teamId: "team-1",
  statement: "Build from the back",
  context: "Focus on playing out from defence",
  status: "ACTIVE" as const,
  startedAt: new Date("2026-01-01"),
  completedAt: null,
  closedAt: null,
  linkedIntentId: null,
  recordedBy: "coach-1",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("createTeamFocus", () => {
  it("creates a focus with valid input", async () => {
    mockFocusCount.mockResolvedValue(0);
    mockFocusCreate.mockResolvedValue({ ...baseFocus });

    const result = await createTeamFocus(
      { teamId: "team-1", statement: "Build from the back", context: "Focus on playing out from defence", recordedBy: "coach-1" },
      orgFilter,
    );

    expect(result.statement).toBe("Build from the back");
    expect(mockFocusCreate).toHaveBeenCalled();
  });

  it("rejects empty statement", async () => {
    await expect(createTeamFocus({ teamId: "team-1", statement: "   " }, orgFilter)).rejects.toThrow("Statement is required");
  });

  it("rejects statement exceeding max length", async () => {
    await expect(createTeamFocus({ teamId: "team-1", statement: "x".repeat(301) }, orgFilter)).rejects.toThrow("Statement must be at most");
  });

  it("rejects creating when team has max active focuses", async () => {
    mockFocusCount.mockResolvedValue(3);
    await expect(createTeamFocus({ teamId: "team-1", statement: "test" }, orgFilter)).rejects.toThrow("already has 3 active");
  });

  it("rejects non-existent linked intent", async () => {
    mockFocusCount.mockResolvedValue(0);
    mockIntentFindFirst.mockResolvedValue(null);
    await expect(createTeamFocus({ teamId: "team-1", statement: "test", linkedIntentId: "nonexistent" }, orgFilter)).rejects.toThrow("intent not found");
  });
});

describe("updateTeamFocus", () => {
  it("updates statement on an active focus", async () => {
    mockFocusFindFirst.mockResolvedValue(baseFocus);
    mockFocusUpdate.mockResolvedValue({ ...baseFocus, statement: "Updated focus" });

    const result = await updateTeamFocus("focus-1", { statement: "Updated focus" }, orgFilter);
    expect(result.statement).toBe("Updated focus");
  });

  it("rejects editing a completed focus", async () => {
    mockFocusFindFirst.mockResolvedValue({ ...baseFocus, status: "COMPLETED" });
    await expect(updateTeamFocus("focus-1", { statement: "New focus" }, orgFilter)).rejects.toThrow("Only active");
  });

  it("allows status transition to COMPLETED", async () => {
    mockFocusFindFirst.mockResolvedValue(baseFocus);
    mockFocusUpdate.mockResolvedValue({ ...baseFocus, status: "COMPLETED", completedAt: new Date() });

    const result = await completeTeamFocus("focus-1", orgFilter);
    expect(result.status).toBe("COMPLETED");
  });

  it("allows status transition to CLOSED", async () => {
    mockFocusFindFirst.mockResolvedValue(baseFocus);
    mockFocusUpdate.mockResolvedValue({ ...baseFocus, status: "CLOSED", closedAt: new Date() });

    const result = await closeTeamFocus("focus-1", orgFilter);
    expect(result.status).toBe("CLOSED");
  });
});

describe("reopenTeamFocus", () => {
  it("reopens a completed focus when under the active limit", async () => {
    mockFocusFindFirst.mockResolvedValue({ ...baseFocus, status: "COMPLETED" });
    mockFocusCount.mockResolvedValue(1);
    mockFocusUpdate.mockResolvedValue({ ...baseFocus, status: "ACTIVE", completedAt: null, closedAt: null });

    const result = await reopenTeamFocus("focus-1", orgFilter);
    expect(result.status).toBe("ACTIVE");
  });

  it("rejects reopening when team has max active focuses", async () => {
    mockFocusFindFirst.mockResolvedValue({ ...baseFocus, status: "COMPLETED" });
    mockFocusCount.mockResolvedValue(3);
    await expect(reopenTeamFocus("focus-1", orgFilter)).rejects.toThrow("already has 3 active");
  });

  it("rejects reopening an already active focus", async () => {
    mockFocusFindFirst.mockResolvedValue({ ...baseFocus, status: "ACTIVE" });
    await expect(reopenTeamFocus("focus-1", orgFilter)).rejects.toThrow("Only completed or closed");
  });
});

describe("getTeamFocusesForTeam", () => {
  it("returns focuses for a team", async () => {
    mockFocusFindMany.mockResolvedValue([baseFocus]);
    const result = await getTeamFocusesForTeam("team-1", orgFilter);
    expect(result).toHaveLength(1);
  });
});

describe("getActiveTeamFocusesForTeam", () => {
  it("returns only active focuses", async () => {
    mockFocusFindMany.mockResolvedValue([baseFocus]);
    await getActiveTeamFocusesForTeam("team-1", orgFilter);
    expect(mockFocusFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "ACTIVE" }) }),
    );
  });
});