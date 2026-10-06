import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { OrgSlugProvider } from "@/components/shell/org-slug-context";
import { AssistantCoachHypothesisPanel, type AssistantCoachHypothesisViewModel } from "../assistant-coach-hypothesis-panel";

const confirmMock = vi.fn();
const dismissMock = vi.fn();

vi.mock("@/app/(app)/o/[orgSlug]/players/[playerId]/assistant-coach-actions", () => ({
  confirmAssistantCoachHypothesisAction: (...args: unknown[]) => confirmMock(...args),
  dismissAssistantCoachHypothesisAction: (...args: unknown[]) => dismissMock(...args),
}));

/**
 * Assistant Coach hypothesis display (ADR-0155 B7 / ADR-0157 C5). Covers the spec's own required
 * test: "AI hypothesis is visibly distinct and does not mutate without confirmation" — the panel
 * must label itself explicitly, cite its evidence, and must never call either action until the
 * coach presses a button.
 */

function makeHypothesis(overrides: Partial<AssistantCoachHypothesisViewModel> = {}): AssistantCoachHypothesisViewModel {
  return {
    id: "hyp1",
    statement: "This player's recent matches suggest a growing fit at left centre-back.",
    uncertainty: "MEDIUM",
    supportingRefs: [{ kind: "DERIVED_TREND", id: "t1" }],
    contradictingRefs: [],
    missingEvidence: ["More recorded minutes at this position."],
    ...overrides,
  };
}

function renderPanel(hypotheses: AssistantCoachHypothesisViewModel[]) {
  return render(
    <OrgSlugProvider orgSlug="acme">
      <AssistantCoachHypothesisPanel hypotheses={hypotheses} />
    </OrgSlugProvider>,
  );
}

describe("AssistantCoachHypothesisPanel", () => {
  it("renders nothing when there are no hypotheses", () => {
    const { container } = renderPanel([]);
    expect(container).toBeEmptyDOMElement();
  });

  it("labels itself distinctly as an AI hypothesis, never a confirmed fact, and never calls either action before a coach acts", () => {
    renderPanel([makeHypothesis()]);

    expect(screen.getByText("Assistant Coach hypothesis")).toBeInTheDocument();
    expect(screen.getByText(/not a confirmed fact/i)).toBeInTheDocument();
    expect(screen.getByText(/This player's recent matches suggest a growing fit/)).toBeInTheDocument();
    expect(screen.getByText(/Missing evidence:/)).toBeInTheDocument();
    expect(confirmMock).not.toHaveBeenCalled();
    expect(dismissMock).not.toHaveBeenCalled();
  });

  it("promotes only after the coach supplies a focus and presses Promote — never automatically", async () => {
    confirmMock.mockResolvedValue({ success: true });
    renderPanel([makeHypothesis()]);

    const promoteButton = screen.getByRole("button", { name: /promote to development focus/i });
    expect(promoteButton).toBeDisabled(); // no focus typed yet.

    fireEvent.change(screen.getByLabelText(/development focus to record if promoted/i), {
      target: { value: "Composure receiving under pressure" },
    });
    expect(promoteButton).toBeEnabled();

    fireEvent.click(promoteButton);
    await waitFor(() => expect(confirmMock).toHaveBeenCalledWith("acme", "hyp1", "Composure receiving under pressure"));
    expect(dismissMock).not.toHaveBeenCalled();

    await waitFor(() => expect(screen.queryByText("Assistant Coach hypothesis")).not.toBeInTheDocument());
  });

  it("dismisses without requiring a focus, and never promotes as a side effect", async () => {
    dismissMock.mockResolvedValue({ success: true });
    renderPanel([makeHypothesis({ id: "hyp2" })]);

    fireEvent.click(screen.getByRole("button", { name: /dismiss/i }));
    await waitFor(() => expect(dismissMock).toHaveBeenCalledWith("acme", "hyp2"));
    expect(confirmMock).not.toHaveBeenCalled();
  });

  it("shows the action's own error without hiding the card", async () => {
    confirmMock.mockResolvedValue({ success: false, error: "This hypothesis is no longer available." });
    renderPanel([makeHypothesis({ id: "hyp3" })]);

    fireEvent.change(screen.getByLabelText(/development focus to record if promoted/i), { target: { value: "Focus text" } });
    fireEvent.click(screen.getByRole("button", { name: /promote to development focus/i }));

    await waitFor(() => expect(screen.getByText("This hypothesis is no longer available.")).toBeInTheDocument());
    expect(screen.getByText("Assistant Coach hypothesis")).toBeInTheDocument();
  });
});
