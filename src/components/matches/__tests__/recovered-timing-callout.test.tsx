import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { RecoveredTimingCallout } from "../recovered-timing-callout";
import type { PostMatchReportTimingReviewRow } from "@/lib/reports/post-match-report-view-model";

/**
 * ADR-0146 §13/§14 — the post-match recovered-timing callout: shows the copy/actions the bundle
 * specifies, lets the coach confirm or correct, and never silently hides an out-of-range event.
 */

function needsReviewItem(overrides: Partial<PostMatchReportTimingReviewRow> = {}): PostMatchReportTimingReviewRow {
  return { period: "FIRST_HALF", periodLabel: "First half", resolvedDurationMinutes: 40, needsReview: true, ...overrides };
}

describe("RecoveredTimingCallout", () => {
  it("renders nothing when there is nothing needing review", () => {
    render(<RecoveredTimingCallout items={[needsReviewItem({ needsReview: false })]} />);
    expect(screen.queryByText(/still running/i)).not.toBeInTheDocument();
  });

  it("shows the bundle's exact copy shape with the resolved duration", () => {
    render(<RecoveredTimingCallout items={[needsReviewItem()]} />);
    expect(screen.getByText(/First half was still running when Live Reporting was completed/i)).toBeInTheDocument();
    expect(screen.getByText(/limited the automatically resolved period time to 40 minutes/i)).toBeInTheDocument();
    expect(screen.getByText("Confirm duration")).toBeInTheDocument();
    expect(screen.getByText("Edit duration")).toBeInTheDocument();
  });

  it("calls onConfirm with the period when Confirm duration is clicked", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ success: true });
    render(<RecoveredTimingCallout items={[needsReviewItem()]} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("Confirm duration"));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith("FIRST_HALF"));
  });

  it("switches to an editable duration input and calls onCorrect with the coach-entered minutes", async () => {
    const onCorrect = vi.fn().mockResolvedValue({ success: true });
    render(<RecoveredTimingCallout items={[needsReviewItem()]} onCorrect={onCorrect} />);

    fireEvent.click(screen.getByText("Edit duration"));
    const input = screen.getByLabelText(/corrected duration for first half/i);
    fireEvent.change(input, { target: { value: "34" } });
    fireEvent.click(screen.getByText("Save"));

    await waitFor(() => expect(onCorrect).toHaveBeenCalledWith("FIRST_HALF", 34));
  });

  it("shows the action's error instead of silently failing", async () => {
    const onConfirm = vi.fn().mockResolvedValue({ success: false, error: "Something went wrong." });
    render(<RecoveredTimingCallout items={[needsReviewItem()]} onConfirm={onConfirm} />);

    fireEvent.click(screen.getByText("Confirm duration"));
    await waitFor(() => expect(screen.getByText("Something went wrong.")).toBeInTheDocument());
  });

  it("surfaces out-of-range events as their own blocking notice, never silently hidden", () => {
    render(<RecoveredTimingCallout items={[needsReviewItem({ needsReview: false })]} outOfRangeEventCount={2} />);
    expect(screen.getByText(/2 recorded events fall outside a corrected period duration/i)).toBeInTheDocument();
    expect(screen.getByText(/live-event editor/i)).toBeInTheDocument();
  });
});
