import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { LegacyMatchFeedbackSection } from "../legacy-match-feedback-section";

/**
 * Regression test for the Post-match feedback / Football observations consolidation
 * (production consistency pass item #8): Post-match feedback is no longer an active
 * write path — Football observations is canonical. This section only ever displays
 * historical MatchExecutionFeedback rows read-only, and renders nothing when a match
 * has none.
 */
describe("LegacyMatchFeedbackSection", () => {
  it("renders nothing when there is no legacy feedback", () => {
    const { container } = render(<LegacyMatchFeedbackSection feedback={[]} players={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders existing feedback read-only, with no add or delete controls", () => {
    render(
      <LegacyMatchFeedbackSection
        feedback={[
          {
            id: "fb-1",
            playerId: "p-1",
            category: "EFFORT",
            value: "POSITIVE",
            observableBehavior: "Helped teammate after ball loss",
            nextAction: "NO_ACTION",
            note: null,
          },
        ]}
        players={[{ id: "p-1", name: "Alice" }]}
      />,
    );

    expect(screen.getByText("Post-match feedback (legacy)")).toBeTruthy();
    expect(screen.getByText("Alice", { exact: false })).toBeTruthy();
    expect(screen.getByText("Helped teammate after ball loss")).toBeTruthy();

    // No active write path: no add form, no remove/delete buttons.
    expect(screen.queryByRole("button")).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.queryByText("Add feedback")).toBeNull();
    expect(screen.queryByText("Remove")).toBeNull();
  });
});
