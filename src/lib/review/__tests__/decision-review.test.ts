import { describe, it, expect, beforeEach, vi } from "vitest";

const { mockCreate, mockFindMany, mockFindFirst, mockUpdate, mockUpdateMany } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockFindMany: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    decisionReview: {
      create: mockCreate,
      findMany: mockFindMany,
      findFirst: mockFindFirst,
      update: mockUpdate,
      updateMany: mockUpdateMany,
    },
  },
}));

import {
  DECISION_REVIEW_CADENCE_DAYS,
  DECISION_REVIEW_DEFER_DAYS,
  developmentThreadRevision,
  teamFocusRevision,
  scheduleDecisionReview,
  supersedeDecisionReviewsForChange,
  supersedeDecisionReviewsOnClose,
  resolveDecisionReview,
  deferDecisionReview,
  getDueDecisionReviews,
} from "../decision-review";

const orgFilter = {
  type: "org" as const,
  filter: { organisationId: "org-1" },
  filterNullable: { organisationId: "org-1" },
  organisationId: "org-1",
};

// `OrgFilterMode` only models the "org" shape, so a non-org filter is constructed loosely to
// exercise `requireOrg()`'s defensive guard.
const nonOrgFilter = {
  type: "all",
  filter: {},
  filterNullable: {},
  organisationId: "",
} as unknown as typeof orgFilter;

beforeEach(() => {
  vi.clearAllMocks();
  mockCreate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({
    id: "dr-new",
    status: "PENDING",
    ...data,
  }));
});

function daysBetween(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

describe("revision fingerprints", () => {
  it("developmentThreadRevision ignores nothing material and is stable", () => {
    const a = developmentThreadRevision({ focus: "Press higher", category: "TACTICAL", rationale: "x" });
    const b = developmentThreadRevision({ focus: "Press higher", category: "TACTICAL", rationale: "x" });
    const c = developmentThreadRevision({ focus: "Press higher", category: "TACTICAL", rationale: "y" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });

  it("teamFocusRevision changes with statement or context", () => {
    const base = teamFocusRevision({ statement: "Build from the back", context: null });
    expect(teamFocusRevision({ statement: "Build from the back", context: null })).toBe(base);
    expect(teamFocusRevision({ statement: "Build from the back", context: "vs low block" })).not.toBe(base);
    expect(teamFocusRevision({ statement: "Play direct", context: null })).not.toBe(base);
  });
});

describe("scheduleDecisionReview", () => {
  it("defaults dueAt to 42 days out", async () => {
    const result = await scheduleDecisionReview(
      { targetType: "DEVELOPMENT_THREAD", targetId: "t-1", targetRevision: "rev-1" },
      orgFilter,
    );
    expect(result).not.toBeNull();
    const dueAt = mockCreate.mock.calls[0][0].data.dueAt as Date;
    expect(daysBetween(dueAt, new Date())).toBe(DECISION_REVIEW_CADENCE_DAYS);
  });

  it("creates nothing when dueAt is explicitly null (No scheduled review)", async () => {
    const result = await scheduleDecisionReview(
      { targetType: "TEAM_FOCUS", targetId: "t-2", targetRevision: "rev-2", dueAt: null },
      orgFilter,
    );
    expect(result).toBeNull();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("honours a caller-provided dueAt", async () => {
    const explicit = new Date("2026-12-01T00:00:00.000Z");
    await scheduleDecisionReview(
      { targetType: "TEAM_FOCUS", targetId: "t-3", targetRevision: "rev-3", dueAt: explicit },
      orgFilter,
    );
    expect(mockCreate.mock.calls[0][0].data.dueAt).toEqual(explicit);
  });

  it("throws without an organisation context", async () => {
    await expect(
      scheduleDecisionReview(
        { targetType: "TEAM_FOCUS", targetId: "t-4", targetRevision: "rev-4" },
        nonOrgFilter,
      ),
    ).rejects.toThrow(/organisation context/i);
  });
});

describe("supersedeDecisionReviewsForChange", () => {
  it("supersedes the pending review and schedules a fresh one on a material change", async () => {
    mockFindMany.mockResolvedValue([{ id: "dr-1", targetRevision: "old-rev" }]);
    mockUpdateMany.mockResolvedValue({ count: 1 });

    const result = await supersedeDecisionReviewsForChange(
      "DEVELOPMENT_THREAD",
      "t-1",
      "new-rev",
      orgFilter,
    );

    expect(mockUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "SUPERSEDED" } }),
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(result).not.toBeNull();
  });

  it("is a no-op when the revision is unchanged (metadata-only save)", async () => {
    mockFindMany.mockResolvedValue([{ id: "dr-1", targetRevision: "same-rev" }]);

    const result = await supersedeDecisionReviewsForChange(
      "DEVELOPMENT_THREAD",
      "t-1",
      "same-rev",
      orgFilter,
    );

    expect(mockUpdateMany).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
    expect(result).toBeNull();
  });

  it("is a no-op when there is no pending review", async () => {
    mockFindMany.mockResolvedValue([]);
    const result = await supersedeDecisionReviewsForChange("TEAM_FOCUS", "t-9", "rev", orgFilter);
    expect(result).toBeNull();
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });
});

describe("supersedeDecisionReviewsOnClose", () => {
  it("supersedes pending reviews with no replacement", async () => {
    mockUpdateMany.mockResolvedValue({ count: 2 });
    const count = await supersedeDecisionReviewsOnClose("TEAM_FOCUS", "t-1", orgFilter);
    expect(count).toBe(2);
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe("resolveDecisionReview", () => {
  const pending = {
    id: "dr-1",
    organisationId: "org-1",
    status: "PENDING",
    targetType: "DEVELOPMENT_THREAD",
    targetId: "t-1",
    targetRevision: "rev-1",
  };

  it("KEEP marks COMPLETED and schedules the next review 42 days out", async () => {
    mockFindFirst.mockResolvedValue(pending);
    mockUpdate.mockResolvedValue({ ...pending, status: "COMPLETED", outcome: "KEEP" });

    await resolveDecisionReview("dr-1", "KEEP", orgFilter);

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", outcome: "KEEP" }) }),
    );
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const dueAt = mockCreate.mock.calls[0][0].data.dueAt as Date;
    expect(daysBetween(dueAt, new Date())).toBe(DECISION_REVIEW_CADENCE_DAYS);
  });

  it("COMPLETE stops the cadence", async () => {
    mockFindFirst.mockResolvedValue(pending);
    mockUpdate.mockResolvedValue({ ...pending, status: "COMPLETED", outcome: "COMPLETE" });

    await resolveDecisionReview("dr-1", "COMPLETE", orgFilter);

    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("rejects a review that is not pending / not found", async () => {
    mockFindFirst.mockResolvedValue(null);
    await expect(resolveDecisionReview("dr-x", "KEEP", orgFilter)).rejects.toThrow(/not found|not pending/i);
  });
});

describe("deferDecisionReview", () => {
  it("moves the due date out by seven days and keeps it pending", async () => {
    const due = new Date("2026-10-01T00:00:00.000Z");
    mockFindFirst.mockResolvedValue({ id: "dr-1", organisationId: "org-1", status: "PENDING", dueAt: due });
    mockUpdate.mockImplementation(({ data }: { data: Record<string, unknown> }) => ({ id: "dr-1", ...data }));

    await deferDecisionReview("dr-1", orgFilter);

    const newDue = mockUpdate.mock.calls[0][0].data.dueAt as Date;
    expect(daysBetween(newDue, due)).toBe(DECISION_REVIEW_DEFER_DAYS);
  });
});

describe("getDueDecisionReviews", () => {
  it("queries pending reviews at or before the as-of date, soonest first", async () => {
    mockFindMany.mockResolvedValue([]);
    const asOf = new Date("2026-09-09T00:00:00.000Z");
    await getDueDecisionReviews(orgFilter, asOf);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING", dueAt: { lte: asOf } }),
        orderBy: { dueAt: "asc" },
      }),
    );
  });
});
