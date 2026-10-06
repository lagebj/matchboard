import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { SeasonReviewOverview } from "../season-review-overview";
import type { SeasonReviewStory } from "@/lib/season/season-review-view-model";

/**
 * ADR-0157 slice C7 required tests: "Overview starts with stories, not matrix/config controls"
 * and "empty story families are omitted". `SeasonReviewOverview` never renders a matrix row,
 * export control, or season create/finalize/match-format admin control at all -- those controls
 * moved to Settings and the Players tab -- so this test both documents and locks that.
 */

function makeStory(overrides: Partial<SeasonReviewStory> = {}): SeasonReviewStory {
  return {
    family: "OPPORTUNITY_DISTRIBUTION",
    title: "Opportunity distribution",
    evidenceStatement: "3 of 20 players recorded no core-team opportunity this league season.",
    coverageNote: "Based on finalised selections across 20 players this season.",
    supportingVisual: null,
    exploreHref: "?leagueSeasonId=ls-1&tab=opportunity",
    ...overrides,
  };
}

describe("SeasonReviewOverview", () => {
  it("renders stories as the first and only content -- no matrix, export, or admin controls", () => {
    render(<SeasonReviewOverview stories={[makeStory()]} />);

    expect(screen.getByText("Opportunity distribution")).toBeInTheDocument();
    expect(screen.getByText(/3 of 20 players/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /explore evidence/i })).toHaveAttribute("href", "?leagueSeasonId=ls-1&tab=opportunity");

    for (const forbidden of ["Finalise", "Finalised", "Match format", "Create league season", "Export", "Player", "Round"]) {
      expect(screen.queryByText(forbidden)).not.toBeInTheDocument();
    }
  });

  it("renders an explanatory empty state, never a blank hero, when no story is materially eligible", () => {
    render(<SeasonReviewOverview stories={[]} />);
    expect(screen.getByText(/No evidence-backed stories yet/)).toBeInTheDocument();
  });

  it("omits a story family entirely rather than rendering a zero-value placeholder for it", () => {
    render(<SeasonReviewOverview stories={[makeStory({ family: "OPPORTUNITY_DISTRIBUTION" })]} />);
    expect(screen.queryByText(/Recurring tactical/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Unresolved coaching/)).not.toBeInTheDocument();
  });
});
