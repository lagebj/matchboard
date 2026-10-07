import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { seasonReviewFixture } from "../fixtures";
import { SeasonReviewOverview } from "@/app/(app)/o/[orgSlug]/season/season-review-overview";

/**
 * ADR-0157 C9 — the Season Review golden-state fixture renders the real production C7 Overview
 * tab against stories built through the real `buildSeasonReviewViewModel()`.
 */
describe("Season Review golden-state fixture (ADR-0157 C9)", () => {
  it("selects every materially-qualifying story family through the real view model", () => {
    const families = seasonReviewFixture.viewModel.stories.map((s) => s.family);
    expect(families).toEqual([
      "OPPORTUNITY_DISTRIBUTION",
      "SUPPORT_MOVEMENT_CONCENTRATION",
      "POSITIONAL_BREADTH_DEVELOPMENT",
      "RECURRING_TEAM_PATTERNS",
      "UNRESOLVED_COACHING_THEMES",
    ]);
  });

  it("renders story-first: evidence statements and drill-down links, no matrix", () => {
    const { container } = render(
      <SeasonReviewOverview stories={seasonReviewFixture.viewModel.stories} />,
    );

    expect(screen.getByText("Opportunity distribution")).toBeInTheDocument();
    expect(screen.getByText(/5 of 42 players recorded no core-team opportunity/i)).toBeInTheDocument();
    // Each story carries its own "Explore evidence" drill-down link — never the matrix inline.
    expect(screen.getAllByRole("link", { name: /explore evidence/i }).length).toBe(5);
    expect(container.textContent).not.toMatch(/round progress|participation coverage/i);
  });
});