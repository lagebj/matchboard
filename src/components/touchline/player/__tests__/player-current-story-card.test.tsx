import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerCurrentStoryCard } from "../player-current-story-card";

describe("PlayerCurrentStoryCard", () => {
  it("renders the selected story's text under a 'Current story' label", () => {
    render(<PlayerCurrentStoryCard story={{ text: "Central Midfield exposure has increased across the latest eligible window.", source: "TREND" }} />);
    expect(screen.getByText("Current story")).toBeInTheDocument();
    expect(screen.getByText("Central Midfield exposure has increased across the latest eligible window.")).toBeInTheDocument();
  });
});
