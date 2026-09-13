import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NeedsReviewPanel } from "../needs-review-panel";
import type { LocalCommand } from "@/lib/live-match/local/live-local-store";

function makeCommand(overrides: Partial<LocalCommand> = {}): LocalCommand {
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

describe("NeedsReviewPanel (ADR-0138 Bundle 8, work item 1)", () => {
  it("renders nothing when closed", () => {
    render(<NeedsReviewPanel open={false} onClose={vi.fn()} commands={[makeCommand()]} playerNameById={{}} onResolve={vi.fn()} />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows the empty state when there is nothing to review", () => {
    render(<NeedsReviewPanel open onClose={vi.fn()} commands={[]} playerNameById={{}} onResolve={vi.fn()} />);
    expect(screen.getByText("Nothing to review right now.")).toBeInTheDocument();
  });

  it("lists each command with its event type, player name, and a plain-English conflict explanation", () => {
    render(
      <NeedsReviewPanel
        open
        onClose={vi.fn()}
        commands={[makeCommand({ playerId: "p1", conflictCode: "PLAYER_ALREADY_OFF_FIELD" })]}
        playerNameById={{ p1: "Alex Berg" }}
        onResolve={vi.fn()}
      />,
    );
    expect(screen.getByText(/Player left.*Alex Berg/)).toBeInTheDocument();
    expect(screen.getByText("This player is already off the field.")).toBeInTheDocument();
  });

  it("falls back to a generic explanation for an unrecognized/missing conflict code", () => {
    render(
      <NeedsReviewPanel open onClose={vi.fn()} commands={[makeCommand({ conflictCode: undefined })]} playerNameById={{}} onResolve={vi.fn()} />,
    );
    expect(screen.getByText("This action could not be applied because the match state changed in the meantime.")).toBeInTheDocument();
  });

  it("calls onResolve with 'apply_new' when that button is clicked", () => {
    const onResolve = vi.fn();
    render(<NeedsReviewPanel open onClose={vi.fn()} commands={[makeCommand()]} playerNameById={{}} onResolve={onResolve} />);
    fireEvent.click(screen.getByText("Apply a new action now"));
    expect(onResolve).toHaveBeenCalledWith("evt-1", "apply_new");
  });

  it("calls onResolve with 'discard' when that button is clicked", () => {
    const onResolve = vi.fn();
    render(<NeedsReviewPanel open onClose={vi.fn()} commands={[makeCommand()]} playerNameById={{}} onResolve={onResolve} />);
    fireEvent.click(screen.getByText("Discard local intent"));
    expect(onResolve).toHaveBeenCalledWith("evt-1", "discard");
  });

  it("calls onClose when the backdrop or Close button is clicked", () => {
    const onClose = vi.fn();
    render(<NeedsReviewPanel open onClose={onClose} commands={[]} playerNameById={{}} onResolve={vi.fn()} />);
    fireEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
