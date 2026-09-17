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

  // 2026-09-17 incident follow-up: an unresolved FAILED_TERMINAL command (the validation bug's
  // 18 rejected SCORER_SET/ASSIST_SET events, in the real incident) was previously lumped into
  // the same bucket as a genuinely-still-syncing command and told the coach it "has not finished
  // syncing" — false; it had already failed for good, and there was no way to even see it, let
  // alone acknowledge it.
  it("shows a failed message (never the misleading 'not finished syncing' one) with a Review action for an unresolved FAILED_TERMINAL command", async () => {
    mockGetUnresolvedCommands.mockResolvedValue([
      makeCommand({ status: "FAILED_TERMINAL", terminalReason: "The server rejected this action and it will not be retried." }),
    ]);
    render(<PostMatchUnresolvedBanner subjectId="match-1" playerNameById={{}} />);

    await waitFor(() => expect(screen.getByText(/failed to save/i)).toBeInTheDocument());
    expect(screen.queryByText(/not finished syncing/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Review"));
    expect(screen.getByText("The server rejected this action and it will not be retried.")).toBeInTheDocument();
  });

  it("keeps a genuinely still-pending command in the 'not finished syncing' message, distinct from a failed one", async () => {
    mockGetUnresolvedCommands.mockResolvedValue([
      makeCommand({ clientEventId: "a", status: "LOCAL_PENDING" }),
      makeCommand({ clientEventId: "b", status: "FAILED_TERMINAL", terminalReason: "Rejected." }),
    ]);
    render(<PostMatchUnresolvedBanner subjectId="match-1" playerNameById={{}} />);

    await waitFor(() => expect(screen.getByText(/1 recorded action.*not finished syncing/i)).toBeInTheDocument());
    expect(screen.getByText(/1 recorded action.*failed to save/i)).toBeInTheDocument();
  });

  it("acknowledging a failed command keeps its original terminalReason and only sets resolvedByCoach", async () => {
    mockGetUnresolvedCommands
      .mockResolvedValueOnce([makeCommand({ status: "FAILED_TERMINAL", terminalReason: "The server rejected this action and it will not be retried." })])
      .mockResolvedValueOnce([]);
    render(<PostMatchUnresolvedBanner subjectId="match-1" playerNameById={{}} />);

    await waitFor(() => expect(screen.getByText("Review")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Review"));
    fireEvent.click(screen.getByText("Acknowledge"));

    await waitFor(() => expect(mockUpdateCommandStatus).toHaveBeenCalledWith("evt-1", "FAILED_TERMINAL", { resolvedByCoach: true }));
    await waitFor(() => expect(mockGetUnresolvedCommands).toHaveBeenCalledTimes(2));
  });
});
