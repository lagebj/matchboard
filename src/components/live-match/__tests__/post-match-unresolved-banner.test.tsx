import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const { mockGetUnresolvedCommands, mockUpdateCommandStatus } = vi.hoisted(() => ({
  mockGetUnresolvedCommands: vi.fn(),
  mockUpdateCommandStatus: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/live-match/local/live-local-store", () => ({
  getUnresolvedCommands: mockGetUnresolvedCommands,
  updateCommandStatus: mockUpdateCommandStatus,
}));

import { PostMatchUnresolvedBanner } from "../post-match-unresolved-banner";

function makeCommand(overrides: Record<string, unknown> = {}) {
  return {
    clientEventId: "evt-1",
    subjectType: "LEAGUE",
    subjectId: "match-1",
    sessionId: "session-1",
    eventType: "ROTATION_OUT",
    status: "NEEDS_REVIEW",
    localOrdinal: 1,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    attemptCount: 1,
    ...overrides,
  };
}

describe("PostMatchUnresolvedBanner (ADR-0138 Bundle 8, work item 5)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when there is nothing unresolved", async () => {
    mockGetUnresolvedCommands.mockResolvedValue([]);
    render(<PostMatchUnresolvedBanner subjectId="match-1" />);
    await waitFor(() => expect(mockGetUnresolvedCommands).toHaveBeenCalledWith("match-1"));
    expect(screen.queryByText(/still need/)).not.toBeInTheDocument();
  });

  it("shows a Review action for NEEDS_REVIEW commands, opening the shared NeedsReviewPanel", async () => {
    mockGetUnresolvedCommands.mockResolvedValue([makeCommand()]);
    render(<PostMatchUnresolvedBanner subjectId="match-1" playerNameById={{}} />);

    await waitFor(() => expect(screen.getByText(/still need/, { exact: false })).toBeInTheDocument());
    fireEvent.click(screen.getByText("Review"));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("shows a syncing message (no Review action) for a still-pending, non-NEEDS_REVIEW command", async () => {
    mockGetUnresolvedCommands.mockResolvedValue([makeCommand({ status: "LOCAL_PENDING" })]);
    render(<PostMatchUnresolvedBanner subjectId="match-1" />);

    await waitFor(() => expect(screen.getByText(/not finished syncing/)).toBeInTheDocument());
    expect(screen.queryByText("Review")).not.toBeInTheDocument();
  });

  it("resolving a command via the panel marks it FAILED_TERMINAL with resolvedByCoach and refreshes", async () => {
    mockGetUnresolvedCommands.mockResolvedValueOnce([makeCommand()]).mockResolvedValueOnce([]);
    render(<PostMatchUnresolvedBanner subjectId="match-1" playerNameById={{}} />);

    await waitFor(() => expect(screen.getByText("Review")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Review"));
    fireEvent.click(screen.getByText("Discard local intent"));

    await waitFor(() =>
      expect(mockUpdateCommandStatus).toHaveBeenCalledWith(
        "evt-1",
        "FAILED_TERMINAL",
        expect.objectContaining({ resolvedByCoach: true }),
      ),
    );
    await waitFor(() => expect(mockGetUnresolvedCommands).toHaveBeenCalledTimes(2));
  });
});
