import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TeamPatternChips } from "../team-pattern-chips";
import type { PatternChipViewModel } from "@/lib/team-season-profile/presentation";

function chip(overrides: Partial<PatternChipViewModel> = {}): PatternChipViewModel {
  return {
    key: "c1",
    shortLabel: "Strong starts",
    evidenceSentence: "5 of 11 recorded goals came in the opening phase across 6 matches.",
    confidenceLabel: "Established pattern",
    ...overrides,
  };
}

describe("TeamPatternChips", () => {
  it("renders nothing when there are no chips", () => {
    const { container } = render(<TeamPatternChips chips={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders each chip's short label and no evidence sentence until opened", () => {
    render(<TeamPatternChips chips={[chip(), chip({ key: "c2", shortLabel: "Late concessions" })]} />);
    expect(screen.getByText("Strong starts")).toBeTruthy();
    expect(screen.getByText("Late concessions")).toBeTruthy();
    expect(screen.queryByText(chip().evidenceSentence)).toBeNull();
  });

  it("discloses the evidence sentence on click and is keyboard-operable (no hover needed)", async () => {
    const user = userEvent.setup();
    render(<TeamPatternChips chips={[chip()]} />);
    const button = screen.getByRole("button", { name: "Strong starts" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    button.focus();
    await user.keyboard("{Enter}");

    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("note")).toHaveTextContent(chip().evidenceSentence);
  });

  it("closes the disclosure when the same chip is activated again", async () => {
    const user = userEvent.setup();
    render(<TeamPatternChips chips={[chip()]} />);
    const button = screen.getByRole("button", { name: "Strong starts" });
    await user.click(button);
    expect(screen.getByRole("note")).toBeTruthy();
    await user.click(button);
    expect(screen.queryByRole("note")).toBeNull();
  });
});
