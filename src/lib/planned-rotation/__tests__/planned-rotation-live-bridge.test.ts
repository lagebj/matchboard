/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  applyPlannedChange,
  skipPlannedChange,
  modifyPlannedChange,
  getNextPlannedChange,
} from "../planned-rotation-live-bridge";
import type { PlannedChangeStatus } from "@/generated/prisma/client";

vi.mock("@/lib/db", () => ({
  db: {
    plannedRotation: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    plannedRotationChange: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/tenancy/resolve-org-filter", () => ({
  resolveOrgFilter: vi.fn(),
}));

import { db } from "@/lib/db";

const ORG_FILTER = { type: "org" as const, filter: { organisationId: "org-1" }, filterNullable: { organisationId: "org-1" }, organisationId: "org-1" };

const MOCK_PENDING_CHANGE = {
  id: "change-1",
  plannedRotationId: "rotation-1",
  sequence: 1,
  outPlayerId: "player-1",
  inPlayerId: "player-2",
  outPosition: "CM",
  inPosition: "CM",
  positionOnly: false,
  approximateMatchSeconds: 1500,
  status: "PENDING" as PlannedChangeStatus,
  notes: null,
  liveEventId: null,
  outPlayer: { id: "player-1", firstName: "Alice", lastName: "Smith" },
  inPlayer: { id: "player-2", firstName: "Bob", lastName: "Jones" },
};

const MOCK_DRAFT_ROTATION = {
  id: "rotation-1",
  matchId: "match-1",
  teamId: "team-1",
  organisationId: "org-1",
  status: "DRAFT",
  notes: null,
  changes: [MOCK_PENDING_CHANGE],
};

describe("applyPlannedChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("applies a pending change and returns live event IDs", async () => {
    vi.mocked(db.plannedRotation.findFirst).mockResolvedValue(MOCK_DRAFT_ROTATION as any);
    vi.mocked(db.plannedRotationChange.update).mockResolvedValue({
      ...MOCK_PENDING_CHANGE,
      status: "APPLIED",
      liveEventId: "event-out-1",
    } as any);
    vi.mocked(db.plannedRotation.update).mockResolvedValue({ ...MOCK_DRAFT_ROTATION, status: "APPLIED" } as any);

    const result = await applyPlannedChange(
      "rotation-1",
      "change-1",
      { outEventId: "event-out-1", inEventId: "event-in-1" },
      ORG_FILTER,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.outEventId).toBe("event-out-1");
      expect(result.inEventId).toBe("event-in-1");
      expect(result.changeId).toBe("change-1");
    }
  });

  it("rejects applying a change with wrong status", async () => {
    vi.mocked(db.plannedRotation.findFirst).mockResolvedValue({
      ...MOCK_DRAFT_ROTATION,
      changes: [{ ...MOCK_PENDING_CHANGE, status: "APPLIED" }],
    } as any);

    const result = await applyPlannedChange(
      "rotation-1",
      "change-1",
      { outEventId: "event-out-1" },
      ORG_FILTER,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("APPLIED");
    }
  });

  it("rejects applying to a superseded rotation", async () => {
    vi.mocked(db.plannedRotation.findFirst).mockResolvedValue({
      ...MOCK_DRAFT_ROTATION,
      status: "SUPERSEDED",
    } as any);

    const result = await applyPlannedChange(
      "rotation-1",
      "change-1",
      { outEventId: "event-out-1" },
      ORG_FILTER,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("DRAFT");
    }
  });

  it("transitions rotation to APPLIED when all changes are resolved", async () => {
    vi.mocked(db.plannedRotation.findFirst).mockResolvedValue(MOCK_DRAFT_ROTATION as any);
    vi.mocked(db.plannedRotationChange.update).mockResolvedValue({
      ...MOCK_PENDING_CHANGE,
      status: "APPLIED",
      liveEventId: "event-out-1",
    } as any);
    vi.mocked(db.plannedRotation.update).mockResolvedValue({ ...MOCK_DRAFT_ROTATION, status: "APPLIED" } as any);

    const result = await applyPlannedChange(
      "rotation-1",
      "change-1",
      { outEventId: "event-out-1" },
      ORG_FILTER,
    );

    expect(result.success).toBe(true);
    expect(db.plannedRotation.update).toHaveBeenCalledWith({
      where: { id: "rotation-1" },
      data: { status: "APPLIED" },
    });
  });

  it("does not transition rotation to APPLIED when pending changes remain", async () => {
    const rotationWithMultipleChanges = {
      ...MOCK_DRAFT_ROTATION,
      changes: [
        MOCK_PENDING_CHANGE,
        { ...MOCK_PENDING_CHANGE, id: "change-2", sequence: 2 },
      ],
    };
    vi.mocked(db.plannedRotation.findFirst).mockResolvedValue(rotationWithMultipleChanges as any);
    vi.mocked(db.plannedRotationChange.update).mockResolvedValue({
      ...MOCK_PENDING_CHANGE,
      status: "APPLIED",
      liveEventId: "event-out-1",
    } as any);

    const result = await applyPlannedChange(
      "rotation-1",
      "change-1",
      { outEventId: "event-out-1" },
      ORG_FILTER,
    );

    expect(result.success).toBe(true);
    expect(db.plannedRotation.update).not.toHaveBeenCalled();
  });

  it("rejects with missing org context", async () => {
    const emptyFilter = { type: "org" as const, filter: { organisationId: "" }, filterNullable: { organisationId: "" }, organisationId: "" };
    const result = await applyPlannedChange(
      "rotation-1",
      "change-1",
      { outEventId: "event-out-1" },
      emptyFilter,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("Organisation context");
    }
  });
});

describe("skipPlannedChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("marks a pending change as skipped", async () => {
    vi.mocked(db.plannedRotation.findFirst).mockResolvedValue(MOCK_DRAFT_ROTATION as any);
    vi.mocked(db.plannedRotationChange.update).mockResolvedValue({
      ...MOCK_PENDING_CHANGE,
      status: "SKIPPED",
    } as any);

    const result = await skipPlannedChange("rotation-1", "change-1", ORG_FILTER);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.changeId).toBe("change-1");
    }
  });

  it("rejects skipping a non-pending change", async () => {
    vi.mocked(db.plannedRotation.findFirst).mockResolvedValue({
      ...MOCK_DRAFT_ROTATION,
      changes: [{ ...MOCK_PENDING_CHANGE, status: "APPLIED" }],
    } as any);

    const result = await skipPlannedChange("rotation-1", "change-1", ORG_FILTER);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("APPLIED");
    }
  });
});

describe("modifyPlannedChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("modifies a pending change and marks it as MODIFIED", async () => {
    vi.mocked(db.plannedRotation.findFirst).mockResolvedValue(MOCK_DRAFT_ROTATION as any);
    vi.mocked(db.plannedRotationChange.update).mockResolvedValue({
      ...MOCK_PENDING_CHANGE,
      status: "MODIFIED",
      inPlayerId: "player-3",
      inPosition: "FW",
    } as any);

    const result = await modifyPlannedChange(
      "rotation-1",
      "change-1",
      { inPlayerId: "player-3", inPosition: "FW" },
      ORG_FILTER,
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.change.id).toBe("change-1");
    }
  });

  it("rejects modifying a non-pending change", async () => {
    vi.mocked(db.plannedRotation.findFirst).mockResolvedValue({
      ...MOCK_DRAFT_ROTATION,
      changes: [{ ...MOCK_PENDING_CHANGE, status: "SKIPPED" }],
    } as any);

    const result = await modifyPlannedChange(
      "rotation-1",
      "change-1",
      { notes: "Coach changed his mind" },
      ORG_FILTER,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain("SKIPPED");
    }
  });
});

describe("getNextPlannedChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when no rotation exists", async () => {
    vi.mocked(db.plannedRotation.findUnique).mockResolvedValue(null);

    const result = await getNextPlannedChange("match-1", "team-1", ORG_FILTER);
    expect(result).toBeNull();
  });

  it("returns the first pending change", async () => {
    const rotationWithMultipleChanges = {
      ...MOCK_DRAFT_ROTATION,
      changes: [
        { ...MOCK_PENDING_CHANGE, id: "change-1", sequence: 1, status: "PENDING" },
        { ...MOCK_PENDING_CHANGE, id: "change-2", sequence: 2, status: "PENDING" },
      ],
    };
    vi.mocked(db.plannedRotation.findUnique).mockResolvedValue(rotationWithMultipleChanges as any);

    const result = await getNextPlannedChange("match-1", "team-1", ORG_FILTER);
    expect(result).not.toBeNull();
    expect(result!.id).toBe("change-1");
  });

  it("returns null when all changes are resolved", async () => {
    const rotationWithResolvedChanges = {
      ...MOCK_DRAFT_ROTATION,
      changes: [
        { ...MOCK_PENDING_CHANGE, id: "change-1", sequence: 1, status: "APPLIED" },
      ],
    };
    vi.mocked(db.plannedRotation.findUnique).mockResolvedValue(rotationWithResolvedChanges as any);

    const result = await getNextPlannedChange("match-1", "team-1", ORG_FILTER);
    expect(result).toBeNull();
  });
});